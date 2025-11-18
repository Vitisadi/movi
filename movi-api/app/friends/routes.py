from . import friend_bp
from ..db import get_db
from flask import jsonify
from bson.objectid import ObjectId

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
            items.append({"name": follower.get("username"), "userId": str(follower.get("_id"))})
        
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
            items.append({"name": following.get("username"), "userId": following.get("_id")})
        
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
        is_dup = False
        for x in current: 
            if str(x) == user_to_add:
                is_dup = True
                break
        if is_dup:
            return jsonify({"error": "duplicate_entry", "detail": "The requested user to add is already registered as following"}), 409

        if "followers" not in user:
            db.users.update_one({"_id": oid_user}, {"$set": {"followers": [user_to_add]}})
        else:
            db.users.update_one({"_id": oid_user}, {"$push": {"followers": user_to_add}})
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
        is_dup = False
        for x in current: 
            if str(x) == user_to_add:
                is_dup = True
                break
        if is_dup:
            return jsonify({"error": "duplicate_entry", "detail": "The requested user to add is already registered as following"}), 409

        if "followers" not in user:
            db.users.update_one({"_id": oid_user}, {"$set": {"following": [user_to_add]}})
        else:
            db.users.update_one({"_id": oid_user}, {"$push": {"following": user_to_add}})
    except Exception as e:
         return jsonify({"error": "server", "detail": str(e)}), 500
    
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
        
        before_count = 0
        try:
            before_count = len(user.get("followers"))
        except Exception as e:
            return jsonify({"error": "followers_not_found", "detail": "The requested user has no followers attribute"}), 404 

        db.users.update_one({"_id": oid_user_to_remove},  {"$pull":  {"followers": user_to_remove}})

        after = db.users.find_one({"_id": oid_user})
        after_count = len(after.get("followers"))
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
        
        before_count = 0
        try:
            before_count = len(user.get("following"))
        except Exception as e:
            return jsonify({"error": "followers_not_found", "detail": "The requested user has no followers attribute"}), 404 

        db.users.update_one({"_id": oid_user_to_remove},  {"$pull":  {"following": user_to_remove}})

        after = db.users.find_one({"_id": oid_user})
        after_count = len(after.get("following"))
        return jsonify({"ok": True,
                        "userId": user_id,
                        "RemovedUserId": user_to_remove_id,
                        "newCount": after_count, 
                        "modified": (before_count != after_count)})
    except Exception as e:
        return jsonify({"error": "server", "detail": str(e)}), 500