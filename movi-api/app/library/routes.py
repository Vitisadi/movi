from . import library_bp
from flask import jsonify, request
import requests
from ..entries.schemas import Book
from ..db import get_db
from bson.objectid import ObjectId
import datetime
import json

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
        
        return jsonify({
            "ok": True,
            "id": str(review_id),
            "bookId": book_id,
            "userId": str(oid),
            "rating": r
        }), 201
    except Exception as e:
        return jsonify({"error": "server", "detail": str(e)})
