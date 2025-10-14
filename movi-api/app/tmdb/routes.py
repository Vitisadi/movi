# app/tmdb/routes.py
import os, json
from urllib.parse import urlencode
import requests
from flask import request, jsonify, current_app
from . import tmdb_bp

TMDB_BASE = "https://api.themoviedb.org/3"
IMG_BASE, IMG_SIZE = "https://image.tmdb.org/t/p", "w342"

def _tmdb_key():
    return os.getenv("TMDB_V3_KEY", "")

def _tmdb_url(path: str, params: dict) -> str:
    q = dict(params or {})
    q["api_key"] = _tmdb_key()
    return f"{TMDB_BASE}{path}?{urlencode(q)}"

def _poster_url(path):
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

# --- New: matches desired usage /getmovies?name=Inception ---
@tmdb_bp.get("/getmovies")
def get_movies_by_name():
    """
    /getmovies?name=Inception
    Optional: &page=2&pretty=1&save=1
    Returns the same trimmed payload shape as /api/search/movie/simple
    """
    try:
        name   = (request.args.get("name") or "").strip()
        page   = request.args.get("page", "1")
        pretty = request.args.get("pretty") == "1"
        save   = request.args.get("save") == "1"

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

@tmdb_bp.get("/api/search/movie/simple")
def search_movie_simple():
    try:
        q = (request.args.get("q") or "").strip()
        page   = request.args.get("page", "1")
        pretty = request.args.get("pretty") == "1"
        save   = request.args.get("save") == "1"
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

@tmdb_bp.get("/api/title/movie/<id>")
def title_movie(id: str):
    try:
        if not _tmdb_key():
            return jsonify({"error": "server", "detail": "TMDB_V3_KEY not set"}), 500
        url = _tmdb_url(f"/movie/{id}", {
            "language": "en-US", "append_to_response": "credits,watch/providers,videos"
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

