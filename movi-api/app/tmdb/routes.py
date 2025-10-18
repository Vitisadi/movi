# app/tmdb/routes.py
import os
import json
from urllib.parse import urlencode

import requests
from flask import request, jsonify, current_app

from . import tmdb_bp  # blueprint defined in app/tmdb/__init__.py
from ..db import get_db  # your DB helper
from bson.objectid import ObjectId  # for Mongo _id lookups

TMDB_BASE = "https://api.themoviedb.org/3"
IMG_BASE, IMG_SIZE = "https://image.tmdb.org/t/p", "w342"


def _tmdb_key() -> str:
    return os.getenv("TMDB_V3_KEY", "")


def _tmdb_url(path: str, params: dict) -> str:
    q = dict(params or {})
    q["api_key"] = _tmdb_key()
    return f"{TMDB_BASE}{path}?{urlencode(q)}"


def _poster_url(path: str | None):
    return f"{IMG_BASE}/{IMG_SIZE}{path}" if path else None


def _normalize_movie(r: dict) -> dict:
    return {
        "id": r.get("id"),
        "title": r.get("title") or r.get("original_title") or "",
        "year": (r.get("release_date") or "")[:4],
        "overview": r.get("overview") or "",
        "posterUrl": _poster_url(r.get("poster_path")),
        "release_date": r.get("release_date") or None,
    }


def _fetch_movie_simple(movie_id: int | str) -> dict | None:
    """Fetch a single movie by TMDB id and return normalized fields."""
    if not _tmdb_key():
        return None
    url = _tmdb_url(f"/movie/{movie_id}", {"language": "en-US"})
    r = requests.get(url, timeout=15)
    if not r.ok:
        try:
            body = r.json()
        except Exception:
            body = {}
        current_app.logger.error("TMDB %s for id=%s %s", r.status_code, movie_id, body)
        return None
    data = r.json() if r.content else {}
    return _normalize_movie(data)


@tmdb_bp.get("/healthz")
def healthz():
    return jsonify({
        "ok": True,
        "auth": {"v3": bool(_tmdb_key())},
        "routes": [
            "/getmovies?name=...",
            "/getmoviesfromuser?id=...",
            "/api/search/movie",
            "/api/search/movie/simple",
            "/api/title/movie/<id>",
        ],
    })


# --- Custom search endpoint (trimmed payload) ---
@tmdb_bp.get("/getmovies")
def get_movies_by_name():
    """
    /getmovies?name=Inception
    Optional: &page=2&pretty=1&save=1
    Returns the same trimmed payload shape as /api/search/movie/simple
    """
    try:
        name = (request.args.get("name") or "").strip()
        page = request.args.get("page", "1")
        pretty = request.args.get("pretty") == "1"
        save = request.args.get("save") == "1"

        if not name:
            return jsonify({"error": "missing name"}), 400
        if not _tmdb_key():
            return jsonify({"error": "server", "detail": "TMDB_V3_KEY not set"}), 500

        url = _tmdb_url("/search/movie", {
            "query": name, "include_adult": "false", "language": "en-US", "page": page
        })
        r = requests.get(url, timeout=15)
        raw = r.json() if r.content else {}
        if not r.ok:
            current_app.logger.error("TMDB %s %s", r.status_code, raw)
            return jsonify({"error": "upstream", "status": r.status_code, "detail": raw}), 502

        items = [_normalize_movie(it) for it in (raw.get("results") or [])]
        payload = {
            "query": name,
            "page": raw.get("page", 1),
            "total_pages": raw.get("total_pages", 1),
            "total_results": raw.get("total_results", 0),
            "items": items,
        }

        if save:
            try:
                with open("last_search.json", "w", encoding="utf-8") as f:
                    json.dump(payload, f, indent=2)
            except Exception as e:
                current_app.logger.warning("could not write last_search.json: %s", e)

        if pretty:
            return current_app.response_class(
                json.dumps(payload, indent=2),
                mimetype="application/json; charset=utf-8",
            )
        return jsonify(payload)
    except Exception as e:
        current_app.logger.exception("server error")
        return jsonify({"error": "server", "detail": str(e)}), 500


# --- Movies from a user by Mongo _id ---
@tmdb_bp.get("/getmoviesfromuser")
def get_movies_from_user():
    """
    /getmoviesfromuser?id=<24-hex ObjectId>
    Reads user.watchedMovies (TMDB int IDs), fetches each from TMDB, returns normalized list.
    Optional: &limit=50 (default 50), &pretty=1
    """
    try:
        id_str = (request.args.get("id") or "").strip()
        if not id_str:
            return jsonify({"error": "missing_id"}), 400

        # Must be a valid 24-hex ObjectId
        try:
            oid = ObjectId(id_str)
        except Exception:
            return jsonify({"error": "invalid_id"}), 400

        pretty = request.args.get("pretty") == "1"
        try:
            limit_i = max(0, int(request.args.get("limit", "50")))
        except Exception:
            limit_i = 50

        # Ensure TMDB key configured
        if not _tmdb_key():
            return jsonify({"error": "server", "detail": "TMDB_V3_KEY not set"}), 500

        db = get_db()

        user = db.users.find_one({"_id": oid}, {"watchedMovies": 1})
        if not user:
            return jsonify({"error": "not_found"}), 404

        raw_ids = user.get("watchedMovies") or []
        # Coerce to ints, de-dup, preserve order
        seen, movie_ids = set(), []
        for v in raw_ids:
            try:
                iv = int(v)
            except Exception:
                continue
            if iv not in seen:
                seen.add(iv)
                movie_ids.append(iv)

        if limit_i:
            movie_ids = movie_ids[:limit_i]

        items = []
        for mid in movie_ids:
            m = _fetch_movie_simple(mid)
            if m:
                items.append(m)

        payload = {"userId": id_str, "count": len(items), "items": items}
        if pretty:
            return current_app.response_class(
                json.dumps(payload, indent=2),
                mimetype="application/json; charset=utf-8",
            )
        return jsonify(payload)

    except Exception as e:
        current_app.logger.exception("server error")
        return jsonify({"error": "server", "detail": str(e)}), 500


# --- RAW TMDB payload (search) ---
@tmdb_bp.get("/api/search/movie")
def search_movie_raw():
    try:
        q = (request.args.get("q") or "").strip()
        page = request.args.get("page", "1")
        if not q:
            return jsonify({"error": "missing q"}), 400
        if not _tmdb_key():
            return jsonify({"error": "server", "detail": "TMDB_V3_KEY not set"}), 500

        url = _tmdb_url("/search/movie", {
            "query": q, "include_adult": "false", "language": "en-US", "page": page
        })
        r = requests.get(url, timeout=15)
        data = r.json() if r.content else {}
        if not r.ok:
            current_app.logger.error("TMDB %s %s", r.status_code, data)
            return jsonify({"error": "upstream", "status": r.status_code, "detail": data}), 502
        return jsonify(data)
    except Exception as e:
        current_app.logger.exception("server error")
        return jsonify({"error": "server", "detail": str(e)}), 500


# --- Trimmed UI-friendly payload (search) ---
@tmdb_bp.get("/api/search/movie/simple")
def search_movie_simple():
    try:
        q = (request.args.get("q") or "").strip()
        page = request.args.get("page", "1")
        pretty = request.args.get("pretty") == "1"
        save = request.args.get("save") == "1"
        if not q:
            return jsonify({"error": "missing q"}), 400
        if not _tmdb_key():
            return jsonify({"error": "server", "detail": "TMDB_V3_KEY not set"}), 500

        url = _tmdb_url("/search/movie", {
            "query": q, "include_adult": "false", "language": "en-US", "page": page
        })
        r = requests.get(url, timeout=15)
        raw = r.json() if r.content else {}
        if not r.ok:
            current_app.logger.error("TMDB %s %s", r.status_code, raw)
            return jsonify({"error": "upstream", "status": r.status_code, "detail": raw}), 502

        items = [_normalize_movie(it) for it in (raw.get("results") or [])]
        payload = {
            "query": q,
            "page": raw.get("page", 1),
            "total_pages": raw.get("total_pages", 1),
            "total_results": raw.get("total_results", 0),
            "items": items,
        }

        if save:
            try:
                with open("last_search.json", "w", encoding="utf-8") as f:
                    json.dump(payload, f, indent=2)
            except Exception as e:
                current_app.logger.warning("could not write last_search.json: %s", e)

        if pretty:
            return current_app.response_class(
                json.dumps(payload, indent=2), mimetype="application/json; charset=utf-8"
            )
        return jsonify(payload)
    except Exception as e:
        current_app.logger.exception("server error")
        return jsonify({"error": "server", "detail": str(e)}), 500


# --- Title details (RAW payload) ---
@tmdb_bp.get("/api/title/movie/<id>")
def title_movie(id: str):
    try:
        if not _tmdb_key():
            return jsonify({"error": "server", "detail": "TMDB_V3_KEY not set"}), 500
        url = _tmdb_url(f"/movie/{id}", {
            "language": "en-US",
            "append_to_response": "credits,watch/providers,videos",
        })
        r = requests.get(url, timeout=15)
        data = r.json() if r.content else {}
        if not r.ok:
            current_app.logger.error("TMDB %s %s", r.status_code, data)
            return jsonify({"error": "upstream", "status": r.status_code, "detail": data}), 502
        return jsonify(data)
    except Exception as e:
        current_app.logger.exception("server error")
        return jsonify({"error": "server", "detail": str(e)}), 500

