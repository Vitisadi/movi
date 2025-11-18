from . import friend_bp
from ..db import get_db
from flask import jsonify
from bson.objectid import ObjectId


def build_user_reference(doc: dict):
    """
    Store only the bits we need for followers/following lists.
    """
    if not doc:
        return {}
    return {
        "_id": doc.get("_id"),
        "username": doc.get("username"),
        "name": doc.get("name"),
    }


def serialize_network_entry(entry: dict):
    if not entry:
        return None
    user_id = entry.get("_id")
    name = entry.get("name") or entry.get("username") or ""
    username = entry.get("username") or ""
    return {
        "name": name,
        "username": username,
        "userId": str(user_id) if user_id is not None else None,
    }

@friend_bp.get("/followers/user/<user_id>")
def getFollowers(user_id: str):
    db = get_db()
    try: 
        oid = ObjectId(user_id)

        user = db.users.find_one({"_id": oid})
        if user is None:
            return jsonify({"error": "user_not_found", "detail": "The requested user was not found"}), 404
        
        followers = user.get("followers") or []
        items = []
        for follower in followers:
            serialized = serialize_network_entry(follower)
            if serialized and serialized.get("userId"):
                items.append(serialized)
        
        return jsonify({"userId": user_id, "count": len(items), "followers": items}), 200
    except Exception as e:
        return jsonify({"error": "server", "detail": str(e)}), 500
    
@friend_bp.get("/following/user/<user_id>")
def getFollowing(user_id: str):
    db = get_db()
    try: 
        oid = ObjectId(user_id)

        user = db.users.find_one({"_id": oid})
        if user is None:
            return jsonify({"error": "user_not_found", "detail": "The requested user was not found"}), 404
        
        followings = user.get("following") or []
        items = []
        for following in followings:
            serialized = serialize_network_entry(following)
            if serialized and serialized.get("userId"):
                items.append(serialized)
        
        return jsonify({"userId": user_id, "count": len(items), "following": items}), 200
    except Exception as e:
        return jsonify({"error": "server", "detail": str(e)}), 500
    
@friend_bp.post("/followers/user/<user_id>/usertoadd/<user_to_add_id>")
def addFollower(user_id: str, user_to_add_id: str):
    db = get_db()
    try:
        oid_user = ObjectId(user_id)
        oid_user_to_add = ObjectId(user_to_add_id)

        user = db.users.find_one({"_id": oid_user})
        if user is None: 
                return jsonify({"error": "user_not_found", "detail": "The requested user was not found"}), 404 
        
        user_to_add = db.users.find_one({"_id": oid_user_to_add})
        if user_to_add is None: 
                return jsonify({"error": "user_not_found", "detail": "The requested user to add was not found"}), 404 
        
        current = user.get("followers") or []
        new_ref = build_user_reference(user_to_add)
        target_id = str(new_ref.get("_id"))
        is_dup = any(str((x or {}).get("_id")) == target_id for x in current)
        if is_dup:
            return jsonify({"error": "duplicate_entry", "detail": "The requested user to add is already registered as following"}), 409

        if "followers" not in user:
            db.users.update_one({"_id": oid_user}, {"$set": {"followers": [new_ref]}})
        else:
            db.users.update_one({"_id": oid_user}, {"$push": {"followers": new_ref}})
    except Exception as e:
         return jsonify({"error": "server", "detail": str(e)}), 500

    return jsonify({"ok": True, "userId": user_id, "userAddedId": user_to_add_id}), 200

@friend_bp.post("/following/user/<user_id>/usertoadd/<user_to_add_id>")
def addFollowing(user_id: str, user_to_add_id: str):
    db = get_db()
    try:
        oid_user = ObjectId(user_id)
        oid_user_to_add = ObjectId(user_to_add_id)

        user = db.users.find_one({"_id": oid_user})
        if user is None: 
                return jsonify({"error": "user_not_found", "detail": "The requested user was not found"}), 404 
        
        user_to_add = db.users.find_one({"_id": oid_user_to_add})
        if user_to_add is None: 
                return jsonify({"error": "user_not_found", "detail": "The requested user to add was not found"}), 404 
        
        current = user.get("following") or []
        new_ref = build_user_reference(user_to_add)
        target_id = str(new_ref.get("_id"))
        is_dup = any(str((x or {}).get("_id")) == target_id for x in current)
        if is_dup:
            return jsonify({"error": "duplicate_entry", "detail": "The requested user to add is already registered as following"}), 409

        if "following" not in user:
            db.users.update_one({"_id": oid_user}, {"$set": {"following": [new_ref]}})
        else:
            db.users.update_one({"_id": oid_user}, {"$push": {"following": new_ref}})
    except Exception as e:
         return jsonify({"error": "server", "detail": str(e)}), 500

    return jsonify({"ok": True, "userId": user_id, "userAddedId": user_to_add_id}), 200
    
@friend_bp.delete("/followers/user/<user_id>/usertoremove/<user_to_remove_id>")
def removeFollower(user_id: str, user_to_remove_id: str):
    db = get_db()
    try: 
        oid_user = ObjectId(user_id)
        oid_user_to_remove = ObjectId(user_to_remove_id)
        
        user = db.users.find_one({"_id": oid_user})
        if user is None: 
                return jsonify({"error": "user_not_found", "detail": "The requested user was not found"}), 404 
        
        user_to_remove = db.users.find_one({"_id": oid_user_to_remove})
        if user_to_remove is None: 
                return jsonify({"error": "user_not_found", "detail": "The requested user was not found"}), 404
        
        followers = user.get("followers") or []
        before_count = len(followers)

        db.users.update_one({"_id": oid_user},  {"$pull":  {"followers": {"_id": user_to_remove.get("_id")}}})

        after = db.users.find_one({"_id": oid_user})
        after_count = len((after.get("followers") or []))
        return jsonify({"ok": True,
                        "userId": user_id,
                        "RemovedUserId": user_to_remove_id,
                        "newCount": after_count, 
                        "modified": (before_count != after_count)})
    except Exception as e:
        return jsonify({"error": "server", "detail": str(e)}), 500
    
@friend_bp.delete("/following/user/<user_id>/usertoremove/<user_to_remove_id>")
def removeFollowing(user_id: str, user_to_remove_id: str):
    db = get_db()
    try: 
        oid_user = ObjectId(user_id)
        oid_user_to_remove = ObjectId(user_to_remove_id)
        
        user = db.users.find_one({"_id": oid_user})
        if user is None: 
                return jsonify({"error": "user_not_found", "detail": "The requested user was not found"}), 404 
        
        user_to_remove = db.users.find_one({"_id": oid_user_to_remove})
        if user_to_remove is None: 
                return jsonify({"error": "user_not_found", "detail": "The requested user was not found"}), 404
        
        followings = user.get("following") or []
        before_count = len(followings)

        db.users.update_one({"_id": oid_user},  {"$pull":  {"following": {"_id": user_to_remove.get("_id")}}})

        after = db.users.find_one({"_id": oid_user})
        after_count = len((after.get("following") or []))
        return jsonify({"ok": True,
                        "userId": user_id,
                        "RemovedUserId": user_to_remove_id,
                        "newCount": after_count, 
                        "modified": (before_count != after_count)})
    except Exception as e:
        return jsonify({"error": "server", "detail": str(e)}), 500
