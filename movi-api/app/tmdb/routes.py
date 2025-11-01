# app/tmdb/routes.py
import os
import json
from urllib.parse import urlencode
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from flask import request, jsonify, current_app

from . import tmdb_bp
from ..db import get_db
from bson.objectid import ObjectId

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


def _fetch_movies_parallel_ordered(movie_ids: list[int] | list[str], max_workers: int = 10) -> list[dict]:
    """Fetch multiple movies from TMDB in parallel, preserving input order.

    Any items that fail resolve to None and are filtered out.
    """
    try:
        n = len(movie_ids)
    except Exception:
        movie_ids = list(movie_ids or [])
        n = len(movie_ids)

    if n == 0:
        return []

    # Cap workers
    workers = max(1, min(int(max_workers or 1), n))

    # Fallback to sequential for small lists
    if workers == 1:
        items = []
        for mid in movie_ids:
            m = _fetch_movie_simple(mid)
            if m:
                items.append(m)
        return items

    results: list[dict | None] = [None] * n
    try:
        with ThreadPoolExecutor(max_workers=workers) as ex:
            futures = {ex.submit(_fetch_movie_simple, movie_ids[i]): i for i in range(n)}
            for fut in as_completed(futures):
                i = futures[fut]
                try:
                    results[i] = fut.result()
                except Exception:
                    results[i] = None

    except Exception:
        # If thread pool fails for any reason, fall back to sequential
        items = []
        for mid in movie_ids:
            m = _fetch_movie_simple(mid)
            if m:
                items.append(m)
        return items

    return [m for m in results if m]


@tmdb_bp.get("/healthz")
def healthz():
    return jsonify({
        "ok": True,
        "auth": {"v3": bool(_tmdb_key())},
        "routes": [
            "/getmovies/<movieName>",                               # trimmed payload search (path param)
            "/movies/user/<id>",                                    # watched movies from a user (path param)
            "/watchlatermovies/user/<id>",                          # watch later movies from a user (path param)
            "/addwatchedmovie/user/<userID>/movie/<movieID>",       # POST method, add a movie to a user's watchedMovies
            "/addwatchlatermovie/user/<userID>/movie/<movieID>",    # POST method, add a movie to a user's watchedLaterMovies
            "/createmoviereview",                                   # POST method, create a movie review, stores id in user profile
            "/removewatchedmovie/user/<userID>/movie/<movieID>",    # POST method, delete a movie from a user's watch list
            "/removewatchlatermovie/user/<userID>/movie/<movieID>", # POST method, delete a movie from a user's watch later list
            "/api/search/movie",
            "/api/search/movie/simple",
            "/api/title/movie/<id>",
        ],
    })


# --- Custom search endpoint (trimmed payload) ---
# /getmovies/<movieName>?page=2&pretty=1&save=1
@tmdb_bp.get("/getmovies/<movieName>")
def get_movies_by_name(movieName: str):
    """
    /getmovies/<movieName>
    Optional: &page=2&pretty=1&save=1
    Returns the same trimmed payload shape as /api/search/movie/simple
    """
    try:
        name = (movieName or "").strip()
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
# /movies/user/<id>?limit=50&pretty=1
@tmdb_bp.get("/movies/user/<id>")
def get_movies_from_user(id: str):
    """
    /movies/user/<id>
    Reads user.watchedMovies (TMDB int IDs), fetches each from TMDB, returns normalized list.
    Optional: &limit=50 (default 50), &pretty=1
    """
    try:
        id_str = (id or "").strip()
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

        items = _fetch_movies_parallel_ordered(movie_ids)

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



# --- Movies from a user by Mongo _id ---
# /watchlatermovies/user/<id>?limit=50&pretty=1
@tmdb_bp.get("/watchlatermovies/user/<id>")
def get_watch_later_movies_from_user(id: str):
    """
    /watchlatermovies/user/<id>
    Reads user.watchLaterMovies (TMDB int IDs), fetches each from TMDB, returns normalized list.
    Optional: &limit=50 (default 50), &pretty=1
    """
    try:
        id_str = (id or "").strip()
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

        user = db.users.find_one({"_id": oid}, {"watchLaterMovies": 1})
        if not user:
            return jsonify({"error": "not_found"}), 404

        raw_ids = user.get("watchLaterMovies") or []
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

        items = _fetch_movies_parallel_ordered(movie_ids)

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


@tmdb_bp.post("/addwatchedmovie/user/<userID>/movie/<movieID>")
def add_watched_movie(userID: str, movieID: str):
    try:
        uid = (userID or "").strip()
        try:
            oid = ObjectId(uid)
        except Exception:
            return jsonify({"error": "invalid_id"}), 400

        try:
            mid = int((movieID or "").strip())
        except Exception:
            return jsonify({"error": "invalid_movie_id"}), 400
        if mid < -2147483648 or mid > 2147483647:
            return jsonify({"error": "movie_id_out_of_range_int32"}), 400

        if not _tmdb_key():
            return jsonify({"error": "server", "detail": "TMDB_V3_KEY not set"}), 500
        m = _fetch_movie_simple(mid)
        if not m:
            return jsonify({"error": "movie_not_found_tmdb", "movieId": mid}), 404

        db = get_db()
        user = db.users.find_one({"_id": oid}, {"watchedMovies": 1})
        if not user:
            return jsonify({"error": "user_not_found"}), 404

        current = user.get("watchedMovies") or []
        is_dup = False
        for x in current:
            try:
                if int(x) == mid:
                    is_dup = True
                    break
            except Exception:
                continue
        if is_dup:
            return jsonify({"error": "already_in_watched", "movieId": mid}), 409

        if "watchedMovies" not in user:
            db.users.update_one({"_id": oid}, {"$set": {"watchedMovies": [mid]}})
        else:
            db.users.update_one({"_id": oid}, {"$addToSet": {"watchedMovies": mid}})

        after = db.users.find_one({"_id": oid}, {"watchedMovies": 1}) or {}
        new_list = after.get("watchedMovies") or []
        try:
            new_list_len = len(new_list)
        except Exception:
            new_list_len = None

        return jsonify({
            "ok": True,
            "userId": uid,
            "movieId": mid,
            "watchedCount": new_list_len
        }), 200

    except Exception as e:
        current_app.logger.exception("server error")
        return jsonify({"error": "server", "detail": str(e)}), 500


@tmdb_bp.post("/addwatchlatermovie/user/<userID>/movie/<movieID>")
def add_watch_later_movie(userID: str, movieID: str):
    try:
        # validate user id
        uid = (userID or "").strip()
        try:
            oid = ObjectId(uid)
        except Exception:
            return jsonify({"error": "invalid_id"}), 400

        # validate movie id (int32)
        try:
            mid = int((movieID or "").strip())
        except Exception:
            return jsonify({"error": "invalid_movie_id"}), 400
        if mid < -2147483648 or mid > 2147483647:
            return jsonify({"error": "movie_id_out_of_range_int32"}), 400

        # confirm movie exists in TMDB
        if not _tmdb_key():
            return jsonify({"error": "server", "detail": "TMDB_V3_KEY not set"}), 500
        m = _fetch_movie_simple(mid)
        if not m:
            return jsonify({"error": "movie_not_found_tmdb", "movieId": mid}), 404

        db = get_db()

        # ensure user exists
        user = db.users.find_one({"_id": oid}, {"watchLaterMovies": 1})
        if not user:
            return jsonify({"error": "user_not_found"}), 404

        # reject duplicates
        current = user.get("watchLaterMovies") or []
        is_dup = False
        for x in current:
            try:
                if int(x) == mid:
                    is_dup = True
                    break
            except Exception:
                continue
        if is_dup:
            return jsonify({"error": "already_in_watch_later", "movieId": mid}), 409

        # create array if missing, else add
        if "watchLaterMovies" not in user:
            db.users.update_one({"_id": oid}, {"$set": {"watchLaterMovies": [mid]}})
        else:
            db.users.update_one({"_id": oid}, {"$addToSet": {"watchLaterMovies": mid}})

        after = db.users.find_one({"_id": oid}, {"watchLaterMovies": 1}) or {}
        new_list = after.get("watchLaterMovies") or []
        return jsonify({
            "ok": True,
            "userId": uid,
            "movieId": mid,
            "watchLaterCount": len(new_list)
        }), 200

    except Exception as e:
        current_app.logger.exception("server error")
        return jsonify({"error": "server", "detail": str(e)}), 500


@tmdb_bp.post("/createmoviereview")
def create_movie_review():
    try:
        payload = request.get_json(silent=True) or {}
        user_id = (payload.get("userId") or "").strip()
        movie_id = payload.get("movieId")
        rating = payload.get("rating")
        title = payload.get("title")   # optional
        body = payload.get("body")     # required

        # validate userId
        try:
            oid = ObjectId(user_id)
        except Exception:
            return jsonify({"error": "invalid_user_id"}), 400

        # validate movieId (int32)
        try:
            mid = int(movie_id)
        except Exception:
            return jsonify({"error": "invalid_movie_id"}), 400
        if not (-2147483648 <= mid <= 2147483647):
            return jsonify({"error": "movie_id_out_of_range_int32"}), 400

        # validate rating 1..10
        try:
            r = int(rating)
        except Exception:
            return jsonify({"error": "invalid_rating"}), 400
        if r < 1 or r > 10:
            return jsonify({"error": "rating_out_of_range", "min": 1, "max": 10}), 400

        # validate body (required)
        if not isinstance(body, str) or not body.strip():
            return jsonify({"error": "missing_body"}), 400

        # check TMDB availability + that the movie exists
        if not _tmdb_key():
            return jsonify({"error": "server", "detail": "TMDB_V3_KEY not set"}), 500
        if not _fetch_movie_simple(mid):
            return jsonify({"error": "movie_not_found_tmdb", "movieId": mid}), 404

        db = get_db()

        # ensure user exists
        if not db.users.find_one({"_id": oid}, {"_id": 1}):
            return jsonify({"error": "user_not_found"}), 404

        now = __import__("datetime").datetime.utcnow()

        # prepare review doc
        doc = {
            "movieId": mid,            # Int32 in Mongo
            "userId": oid,             # ObjectId
            "rating": r,
            "title": title if (title is None or isinstance(title, str)) else str(title),
            "body": body.strip(),
            "createdAt": now,
            "updatedAt": now,
        }

        # insert review (unique index on {movieId, userId} recommended)
        res = db.movieReviews.insert_one(doc)
        review_id = res.inserted_id

        # add review id to user's movieReviews array (creates if missing, no dups)
        try:
            db.users.update_one(
                {"_id": oid},
                {"$addToSet": {"movieReviews": review_id}}
            )
        except Exception as e:
            # if this fails (e.g., validator missing movieReviews), surface a helpful error
            return jsonify({
                "error": "user_update_failed",
                "detail": str(e),
                "reviewId": str(review_id)
            }), 500

        # ensure the movie is in watchedMovies and removed from watchLaterMovies
        try:
            db.users.update_one({"_id": oid}, {"$addToSet": {"watchedMovies": mid}})
            db.users.update_one({"_id": oid}, {"$pull": {"watchLaterMovies": mid}})
        except Exception as e:
            return jsonify({
                "error": "user_update_failed",
                "detail": str(e),
                "reviewId": str(review_id)
            }), 500

        return jsonify({
            "ok": True,
            "id": str(review_id),
            "movieId": mid,
            "userId": str(oid),
            "rating": r
        }), 201

    except Exception as e:
        msg = str(e)
        # duplicate review (if you add the unique index below)
        if "E11000" in msg:
            return jsonify({
                "error": "duplicate_review",
                "detail": "user already reviewed this movie"
            }), 409
        current_app.logger.exception("server error")
        return jsonify({"error": "server", "detail": msg}), 500



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

@tmdb_bp.delete("/removewatchedmovie/user/<userID>/movie/<movieID>")
def remove_watched_movie(userID: str, movieID: str):
    try:
        # validate user id
        try:
            oid = ObjectId((userID or "").strip())
        except Exception:
            return jsonify({"error": "invalid_id"}), 400

        # validate movie id (int32)
        try:
            mid = int((movieID or "").strip())
        except Exception:
            return jsonify({"error": "invalid_movie_id"}), 400
        if mid < -2147483648 or mid > 2147483647:
            return jsonify({"error": "movie_id_out_of_range_int32"}), 400

        db = get_db()

        # ensure user exists
        user = db.users.find_one({"_id": oid}, {"watchedMovies": 1})
        if not user:
            return jsonify({"error": "user_not_found"}), 404

        # pull movie id (no-op if not present)
        res = db.users.update_one({"_id": oid}, {"$pull": {"watchedMovies": mid}})

        # fetch new count for convenience
        after = db.users.find_one({"_id": oid}, {"watchedMovies": 1}) or {}
        new_list = after.get("watchedMovies") or []

        return jsonify({
            "ok": True,
            "userId": str(oid),
            "movieId": mid,
            "removed": bool(res.modified_count),
            "watchedCount": len(new_list)
        }), 200

    except Exception as e:
        current_app.logger.exception("server error")
        return jsonify({"error": "server", "detail": str(e)}), 500

@tmdb_bp.delete("/removewatchlatermovie/user/<userID>/movie/<movieID>")
def remove_watch_later_movie(userID: str, movieID: str):
    try:
        # validate user id
        try:
            oid = ObjectId((userID or "").strip())
        except Exception:
            return jsonify({"error": "invalid_id"}), 400

        # validate movie id (int32)
        try:
            mid = int((movieID or "").strip())
        except Exception:
            return jsonify({"error": "invalid_movie_id"}), 400
        if mid < -2147483648 or mid > 2147483647:
            return jsonify({"error": "movie_id_out_of_range_int32"}), 400

        db = get_db()

        # ensure user exists
        user = db.users.find_one({"_id": oid}, {"watchLaterMovies": 1})
        if not user:
            return jsonify({"error": "user_not_found"}), 404

        # pull movie id (no-op if not present)
        res = db.users.update_one({"_id": oid}, {"$pull": {"watchLaterMovies": mid}})

        # fetch new count for convenience
        after = db.users.find_one({"_id": oid}, {"watchLaterMovies": 1}) or {}
        new_list = after.get("watchLaterMovies") or []

        return jsonify({
            "ok": True,
            "userId": str(oid),
            "movieId": mid,
            "removed": bool(res.modified_count),
            "watchLaterCount": len(new_list)
        }), 200

    except Exception as e:
        current_app.logger.exception("server error")
        return jsonify({"error": "server", "detail": str(e)}), 500

