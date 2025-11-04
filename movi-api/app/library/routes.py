from . import library_bp
from flask import jsonify, request
import requests
from ..entries.schemas import Book
from ..db import get_db
from bson.objectid import ObjectId
import datetime
import json

def normalize_book(r: dict):
    return {"id": r.get("key"),
            "title": r.get("title"),
            "authors": get_authors_by_book(r),
            "description": r.get("description") or "",
            "coverUrl": f"https://covers.openlibrary.org/b/id/{r.get("covers")[0]}-M.jpg"
    }

def get_authors_by_book(r: dict):
    ret = []
    for n in len(r.get('authors')):
        location = "https://openlibrary.org/" + r.get('authors')[n].get('author').get('key')
        try:
            response = requests.get(location)
            if response.status_code == 200:
                ret.append(response.json().get("name"))
        except Exception as e:
            return jsonify({"error": "server", "detail": str(e)}), 500
        
    return ret

def search_book_by_title(title: str, num_results: int):
    title = "+".join(title.lower().split(" "))
    url = f"https://openlibrary.org/search.json?title={title}"
    result = None
    try:
        ret = []
        response = requests.get(url=url)

        if response.status_code == 200:
            posts = response.json()
            if not posts["docs"]:
                return "Book not found"
            results = posts["docs"]
        else:
            print('Error:', response.status_code)
            return None
        for i in range(num_results):
            if results is not None:
                result = results[i]
                
            else: 
                break
            cover_url = f"https://covers.openlibrary.org/b/id/{result.get("cover_i")}-M.jpg"
            ret.append((result, cover_url))
    except Exception as e:
        return jsonify({"error": "server", "detail": str(e)}), 500

    return ret

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
    title   = (request.args.get("name") or "").strip()
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