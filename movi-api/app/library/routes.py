from . import library_bp
from flask import current_app, jsonify, request
import requests
from ..entries.schemas import Book
from ..db import get_db
from bson.objectid import ObjectId
import datetime
import json
from ..tmdb.routes import _fetch_movie_simple
from ..users.service import add_activity as users_add_activity
from typing import Any

def normalize_book(r: dict):
    # Works JSON uses 'covers': [id,...]; Search JSON uses 'cover_i'
    cover_id = r.get('cover_i')
    if cover_id is None:
        covers = r.get('covers') or []
        cover_id = covers[0] if covers else None
    cover_url = f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg" if cover_id else None

    return {
        "id": r.get("key"),  # e.g. '/works/OL12345W'
        "title": r.get("title") or "",
        "authors": get_authors_by_book(r),
        "description": r.get("description") or "",
        "coverUrl": cover_url,
    }


def get_authors_by_book(r: dict):
    """
    Accepts either Works JSON (has 'authors': [{'author': {'key': '/authors/OL..A'}}...])
    or Search JSON (often has 'author_name': ['...']).
    """
    # If search result already has names, prefer those quickly
    names = r.get("author_name")
    if isinstance(names, list) and names:
        return names

    ret = []
    authors = r.get('authors') or []
    for entry in authors:
        try:
            akey = ((entry or {}).get('author') or {}).get('key')  # '/authors/OL...A'
            if not akey:
                continue
            url = f"https://openlibrary.org{akey}.json"
            resp = requests.get(url, timeout=10)
            if resp.ok:
                name = (resp.json() or {}).get("name")
                if name:
                    ret.append(name)
        except Exception:
            # Skip failures; don't turn author lookup into a 500
            continue
    return ret


def search_book_by_title(title: str, num_results: int):
    try:
        n = max(1, int(num_results))
    except Exception:
        n = 20

    q = "+".join((title or "").strip().lower().split())
    url = f"https://openlibrary.org/search.json?title={q}"

    try:
        resp = requests.get(url, timeout=15)
        if not resp.ok:
            return jsonify({"error": "upstream", "status": resp.status_code}), 502

        data = resp.json() or {}
        docs = data.get("docs") or []
        items = []

        for result in docs[:n]:
            cover_id = result.get('cover_i')
            cover_url = f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg" if cover_id else None
            items.append({
                "id": result.get("key"),                          # '/works/OL...W'
                "title": result.get("title") or "",
                "authors": result.get("author_name") or [],
                "coverUrl": cover_url,
            })

        if not items:
            return jsonify({"query": title, "count": 0, "items": []}), 200

        return jsonify({"query": title, "count": len(items), "items": items}), 200

    except Exception as e:
        return jsonify({"error": "server", "detail": str(e)}), 500


def get_book_by_id(id: str):
    url = f"https://openlibrary.org/works/{id}.json"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        if response.status_code == 200:
            result = response.json()
            return result
    except Exception as e:
        return jsonify({"error": "server", "detail": str(e)}), 500


def _safe_book_title(book: Any) -> str | None:
    """Attempt to extract a title string from a book payload."""
    try:
        if isinstance(book, dict):
            title = book.get("title")
            if isinstance(title, str):
                return title
            if title is not None:
                return str(title)
    except Exception:
        return None
    return None


def _safe_cover_url(book: Any) -> str | None:
    """Attempt to extract a cover URL from Works/OpenLibrary shapes."""
    try:
        if isinstance(book, dict):
            cover_id = None
            if isinstance(book.get("covers"), list) and book["covers"]:
                cover_id = book["covers"][0]
            if cover_id:
                return f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg"
            if isinstance(book.get("coverUrl"), str):
                return book["coverUrl"]
    except Exception:
        return None
    return None


def _log_activity(user_oid: ObjectId, activity: str, meta: dict | None = None) -> str | None:
    """
    Create an activity row and push its id to the user's `activities` array (newest first).
    Failures are swallowed so book operations do not error out because of logging.
    """
    try:
        act_id = users_add_activity(
            user_oid,
            activity,
            meta if isinstance(meta, dict) else None
        )
        db = get_db()
        db.users.update_one(
            {"_id": user_oid},
            {"$push": {"activities": {"$each": [ObjectId(act_id)], "$position": 0}}}
        )
        return str(act_id)
    except Exception:
        try:
            current_app.logger.warning("activity log failed for user %s", user_oid)
        except Exception:
            pass
        return None


@library_bp.get("/book")
def searchBook():
    title = (request.args.get("name") or "").strip()
    num_results = request.args.get("n") or 20
    return search_book_by_title(title, num_results)

@library_bp.get("/book/<title>")
def searchBookByTitle(title: str):
    num_results = request.args.get("n") or 20
    return search_book_by_title(title, num_results)


@library_bp.get("/read/user/<id>")
def get_books_by_user(id: str):
    db = get_db()
    try: 
        oid = ObjectId(id)

        user = db.users.find_one({"_id": oid})
        if user is None:
            return jsonify({"error": "user_not_found", "detail": "The requested user was not found"}), 404
        
        book_ids = user.get("readBooks") or []
        items = []
        for book_id in book_ids:
            items.append(get_book_by_id(book_id))
        
        return jsonify({"userId": id, "count": len(items), "readBooks": items}), 200
    except Exception as e:
        return jsonify({"error": "server", "detail": str(e)}), 500
        

@library_bp.get("/toberead/user/<id>")
def get_tbr_by_user(id: str):
    db = get_db()
    try: 
        oid = ObjectId(id)

        user = db.users.find_one({"_id": oid})
        if user is None:
            return jsonify({"error": "user_not_found", "detail": "The requested user was not found"}), 404
        
        book_ids = user.get("toBeReadBooks") or []
        items = []
        for book_id in book_ids:
            items.append(get_book_by_id(book_id))
        
        return jsonify({"userId": id, "count": len(items), "toBeReadBooks": items}), 200
    except Exception as e:
        return jsonify({"error": "server", "detail": str(e)}), 500

@library_bp.post("/read/user/<user_id>/book/<book_id>")
def add_read_book(user_id: str, book_id: str):
    db = get_db()
    try: 
        uid = str(user_id)
        oid = ObjectId(uid)

        b = get_book_by_id(book_id)
        if b is None:
            return jsonify({"error": "book_not_found", "detail": "The requested book was not found"}), 404 
        
        user = db.users.find_one({"_id": oid})
        if user is None: 
            return jsonify({"error": "user_not_found", "detail": "The requested user was not found"}), 404 
        
        current = user.get("readBooks") or []
        is_dup = False
        for x in current: 
            if str(x) == book_id:
                is_dup = True
                break
        if is_dup:
            return jsonify({"error": "duplicate_entry", "detail": "The requested entry to add is already registered as read"}), 409
        
        if "readBooks" not in user:
            db.users.update_one({"_id": oid}, {"$set": {"readBooks": [book_id]}})
        else:
            db.users.update_one({"_id": oid}, {"$push": {"readBooks": book_id}})

        # Remove book from read later list if present
        db.users.update_one({"_id": oid}, {"$pull": {"toBeReadBooks": book_id}})

        meta = {
            "bookId": book_id,
            "status": "Read",
            "type": "book",
            "coverUrl": _safe_cover_url(b),
        }
        title = _safe_book_title(b)
        if title:
            meta["title"] = title
        _log_activity(oid, "Added book to Read", meta)

        return jsonify({"ok": True, "userId": user_id, "bookId": book_id}), 200
    except Exception as e:
        return jsonify({"error": "server", "detail": str(e)}), 500


@library_bp.post("/toberead/user/<user_id>/book/<book_id>")
def add_tbr_book(user_id: str, book_id: str):
    db = get_db()
    try: 
        uid = str(user_id)
        oid = ObjectId(uid)

        b = get_book_by_id(book_id)
        if b is None:
            return jsonify({"error": "book_not_found", "detail": "The requested book was not found"}), 404 
        
        user = db.users.find_one({"_id": oid})
        if user is None: 
            return jsonify({"error": "user_not_found", "detail": "The requested user was not found"}), 404 
        
        current = user.get("toBeReadBooks") or []
        is_dup = False
        for x in current: 
            if str(x) == book_id:
                is_dup = True
                break
        if is_dup:
            return jsonify({"error": "duplicate_entry", "detail": "The requested entry to add is already registered as to be read"}), 409
        
        if "toBeReadBooks" not in user:
            db.users.update_one({"_id": oid}, {"$set": {"toBeReadBooks": [book_id]}})
        else:
            db.users.update_one({"_id": oid}, {"$push": {"toBeReadBooks": book_id}})

        meta = {
            "bookId": book_id,
            "status": "Read Later",
            "type": "book",
            "coverUrl": _safe_cover_url(b),
        }
        title = _safe_book_title(b)
        if title:
            meta["title"] = title
        _log_activity(oid, "Added book to Read Later", meta)

        return jsonify({"ok": True, "userId": user_id, "bookId": book_id}), 200
    except Exception as e:
        return jsonify({"error": "server", "detail": str(e)}), 500

@library_bp.delete("/read/user/<user_id>/book/<book_id>")
def remove_read_book(user_id: str, book_id: str):
    db = get_db()
    try: 
        uid = str(user_id)
        oid = ObjectId(uid)

        b = get_book_by_id(book_id)
        if b is None:
            return jsonify({"error": "book_not_found", "detail": "The requested book was not found"}), 404 
        
        user = db.users.find_one({"_id": oid})
        if user is None: 
            return jsonify({"error": "user_not_found", "detail": "The requested user was not found"}), 404 
        
        before_count = 0
        try:
            before_count = len(user.get("readBooks"))
        except Exception as e:
            return jsonify({"error": "book_not_found", "detail": "The requested user has no readBooks attribute"}), 404 

        db.users.update_one({"_id": oid},  {"$pull":  {"readBooks": book_id}})

        after = db.users.find_one({"_id": oid})
        after_count = len(after.get("readBooks"))
        return jsonify({"ok": True,
                        "userId": uid,
                        "bookId": book_id,
                        "newCount": after_count, 
                        "modified": (before_count != after_count)})
    except Exception as e:
        return jsonify({"error": "server", "detail": str(e)}), 500

@library_bp.delete("/toberead/user/<user_id>/book/<book_id>")
def remove_tbr_book(user_id: str, book_id: str):
    db = get_db()
    try: 
        uid = str(user_id)
        oid = ObjectId(uid)

        b = get_book_by_id(book_id)
        if b is None:
            return jsonify({"error": "book_not_found", "detail": "The requested book was not found"}), 404 
        
        user = db.users.find_one({"_id": oid})
        
        if user is None: 
            return jsonify({"error": "user_not_found", "detail": "The requested user was not found"}), 404 
        
        before_count = 0
        try:
            before_count = len(user.get("toBeReadBooks"))
        except Exception as e:
            return jsonify({"error": "book_not_found", "detail": "The requested user has no toBeReadBooks attribute"}), 404 

        db.users.update_one({"_id": oid},  {"$pull":  {"toBeReadBooks": book_id}})

        after = db.users.find_one({"_id": oid})
        after_count = len(after.get("toBeReadBooks"))
        return jsonify({"ok": True,
                        "userId": uid,
                        "bookId": book_id,
                        "newCount": after_count, 
                        "modified": (before_count != after_count)})
    except Exception as e:
        return jsonify({"error": "server", "detail": str(e)}), 500

def _coerce_iso(dt):
    if isinstance(dt, datetime.datetime):
        return dt.isoformat()
    try:
        return dt if dt is None else str(dt)
    except Exception:
        return None

def _shape_movie_review(db, review: dict) -> dict | None:
    try:
        rid = str(review.get("_id"))
    except Exception:
        return None
    movie_id = review.get("movieId")
    meta = None
    try:
        meta = _fetch_movie_simple(movie_id)
    except Exception:
        meta = None
    return {
        "id": rid,
        "kind": "movie",
        "itemId": movie_id,
        "itemTitle": (meta or {}).get("title"),
        "itemPoster": (meta or {}).get("posterUrl"),
        "itemYear": (meta or {}).get("year"),
        "rating": review.get("rating"),
        "title": review.get("title"),
        "body": review.get("body"),
        "createdAt": _coerce_iso(review.get("createdAt")),
        "updatedAt": _coerce_iso(review.get("updatedAt")),
    }

def _shape_book_review(review: dict) -> dict | None:
    try:
        rid = str(review.get("_id"))
    except Exception:
        return None
    book_id = review.get("bookId")
    meta = None
    try:
        meta = get_book_by_id(book_id)
    except Exception:
        meta = None
    author_name = None
    if isinstance(meta, dict):
        if isinstance(meta.get("authors"), list):
            try:
                author_name = ", ".join([a.get("name") for a in meta["authors"] if a.get("name")])
            except Exception:
                author_name = None
        if not author_name and isinstance(meta.get("author_name"), list):
            try:
                author_name = ", ".join([a for a in meta["author_name"] if a])
            except Exception:
                author_name = None
    return {
        "id": rid,
        "kind": "book",
        "itemId": book_id,
        "itemTitle": (meta or {}).get("title"),
        "itemAuthor": author_name,
        "itemYear": (meta or {}).get("first_publish_year"),
        "itemCover": (meta or {}).get("coverUrl"),
        "rating": review.get("rating"),
        "title": review.get("title"),
        "body": review.get("body"),
        "createdAt": _coerce_iso(review.get("createdAt")),
        "updatedAt": _coerce_iso(review.get("updatedAt")),
    }

@library_bp.get("/reviews/user/<user_id>")
def list_reviews(user_id: str):
    """
    Return combined movie and book reviews for the user, sorted by newest first.
    """
    db = get_db()
    try:
        oid = ObjectId((user_id or "").strip())
    except Exception:
        return jsonify({"error": "invalid_user_id"}), 400
    try:
        movie_reviews = list(db.movieReviews.find({"userId": oid}).sort("createdAt", -1))
    except Exception:
        movie_reviews = []
    try:
        book_reviews = list(db.bookReviews.find({"userId": oid}).sort("createdAt", -1))
    except Exception:
        book_reviews = []

    items = []
    for r in movie_reviews:
        shaped = _shape_movie_review(db, r)
        if shaped:
            items.append(shaped)
    for r in book_reviews:
        shaped = _shape_book_review(r)
        if shaped:
            items.append(shaped)

    # Ensure chronological order newest->oldest
    try:
        items.sort(key=lambda r: r.get("createdAt") or "", reverse=True)
    except Exception:
        pass

    return jsonify({
        "ok": True,
        "userId": user_id,
        "count": len(items),
        "items": items
    }), 200

@library_bp.delete("/reviews/<kind>/<review_id>")
def delete_review(kind: str, review_id: str):
    """
    Delete a single review by id. Kind must be 'movie' or 'book'.
    Also removes the review reference from the user document if present.
    """
    db = get_db()
    kind_norm = (kind or "").strip().lower()
    if kind_norm not in {"movie", "book"}:
        return jsonify({"error": "invalid_kind"}), 400
    try:
        rid = ObjectId((review_id or "").strip())
    except Exception:
        return jsonify({"error": "invalid_review_id"}), 400

    collection = db.movieReviews if kind_norm == "movie" else db.bookReviews

    doc = collection.find_one({"_id": rid})
    if not doc:
        return jsonify({"error": "review_not_found"}), 404

    res = collection.delete_one({"_id": rid})

    user_oid = doc.get("userId") if isinstance(doc.get("userId"), ObjectId) else None
    if user_oid:
        field = "movieReviews" if kind_norm == "movie" else "bookReviews"
        try:
            db.users.update_one({"_id": user_oid}, {"$pull": {field: rid}})
        except Exception:
            pass

    # Remove any related activity entries (by meta.reviewId) and pull from user's activities list
    try:
        if user_oid:
            related_acts = list(
                db.userActivities.find(
                    {"userId": user_oid, "meta.reviewId": str(review_id)}
                )
            )
            if related_acts:
                act_ids = [act["_id"] for act in related_acts if isinstance(act.get("_id"), ObjectId)]
                db.userActivities.delete_many({"_id": {"$in": act_ids}})
                if act_ids:
                    db.users.update_one(
                        {"_id": user_oid},
                        {"$pull": {"activities": {"$in": act_ids}}},
                    )
    except Exception:
        # Do not fail deletion because activity cleanup failed
        pass

    return jsonify({
        "ok": True,
        "kind": kind_norm,
        "reviewId": review_id,
        "deleted": bool(res.deleted_count),
        "userId": str(user_oid) if user_oid else None,
    }), 200

@library_bp.post("/createbookreview")
def add_review_book():
    db = get_db()
    try: 
        payload = request.get_json(silent=True) or {}
        user_id = (payload.get("userId") or "").strip()
        book_id = payload.get("bookId")
        rating = payload.get("rating")
        title = payload.get("title")
        body = payload.get("body")

        uid = str(user_id)
        oid = ObjectId(uid)

        b = get_book_by_id(book_id)
        if b is None:
            return jsonify({"error": "book_not_found", "detail": "The requested book was not found"}), 404 
        
        try:
            r = int(rating)
        except Exception:
            return jsonify({"error": "invalid_rating"}), 400
        if r < 1 or r > 10:
            return jsonify({"error": "rating_out_of_range", "min": 1, "max": 10}), 400
        
        if not isinstance(body, str) or not body.strip():
            return jsonify({"error": "missing_body"}), 400
        
        user = db.users.find_one({"_id": oid})
        
        if user is None: 
            return jsonify({"error": "user_not_found", "detail": "The requested user was not found"}), 404
        
        doc = {"userId": oid, 
               "bookId": book_id,
               "rating": r,
               "title": title if (title is None or isinstance(title, str)) else str(title), 
               "body": body.strip(),
               "createdAt": datetime.datetime.utcnow(),
               "updatedAt": datetime.datetime.utcnow(),
        }
        res = db.bookReviews.insert_one(doc)
        review_id = res.inserted_id

        try:
            db.users.update_one(
                {"_id": oid},
                {"$addToSet": {"bookReviews": review_id}}
            )
        except Exception as e:
            # if this fails (e.g., validator missing bookReviews), surface a helpful error
            return jsonify({
                "error": "user_update_failed",
                "detail": str(e),
                "reviewId": str(review_id)
            }), 500
        
        try:
            db.users.update_one({"_id": oid}, {"$addToSet": {"readBooks": book_id}})
            db.users.update_one({"_id": oid}, {"$pull": {"toBeReadBooks": book_id}})
        except Exception as e:
            return jsonify({
                "error": "user_update_failed",
                "detail": str(e),
                "reviewId": str(review_id)
            }), 500

        # Log activity for feed
        try:
            _log_activity(
                oid,
                "Reviewed book",
                {
                    "bookId": book_id,
                    "rating": r,
                    "title": (title if isinstance(title, str) else None),
                    "reviewId": str(review_id),
                    "type": "book",
                    "coverUrl": _safe_cover_url(b),
                },
            )
        except Exception:
            pass
        
        return jsonify({
            "ok": True,
            "id": str(review_id),
            "bookId": book_id,
            "userId": str(oid),
            "rating": r
        }), 201
    except Exception as e:
        return jsonify({"error": "server", "detail": str(e)})
