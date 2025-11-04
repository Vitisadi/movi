# app/users/routes.py
from flask import request, jsonify, current_app
from bson import ObjectId

from . import users_bp, service   # reuse blueprint created in app/users/__init__.py
from ..db import get_db


# --------- Activity (auto-logged by other blueprints, but POST remains for non-TMDB actions) ---------

@users_bp.post("/<userId>/activity")
def add_user_activity(userId: str):
    """
    AddActivity (manual): for non-TMDB actions you still want to log (e.g., followed a friend).
    Body: { "activity": "<string>", "meta": { ... } }  # meta optional
    """
    try:
        try:
            oid = ObjectId((userId or "").strip())
        except Exception:
            return jsonify({"error": "invalid_user_id"}), 400

        db = get_db()
        if not db.users.find_one({"_id": oid}, {"_id": 1}):
            return jsonify({"error": "user_not_found"}), 404

        payload = request.get_json(silent=True) or {}
        activity = (payload.get("activity") or "").strip()
        meta = payload.get("meta") if isinstance(payload.get("meta"), dict) else None
        if not activity:
            return jsonify({"error": "missing_activity"}), 400

        act_id = service.add_activity(oid, activity, meta)

        # newest first
        db.users.update_one(
            {"_id": oid},
            {"$push": {"activities": {"$each": [ObjectId(act_id)], "$position": 0}}}
        )

        u = db.users.find_one({"_id": oid}, {"activities": 1}) or {}
        count = len(u.get("activities") or [])
        return jsonify({"ok": True, "activityId": act_id, "userId": str(oid), "activitiesCount": count}), 201

    except Exception as e:
        current_app.logger.exception("add_user_activity failed")
        return jsonify({"error": "server", "detail": str(e)}), 500


@users_bp.get("/<userId>/activity")
def list_user_activity(userId: str):
    """GetUsersActivity: returns recent activities for a user. ?limit=50 (default 50)"""
    try:
        try:
            oid = ObjectId((userId or "").strip())
        except Exception:
            return jsonify({"error": "invalid_user_id"}), 400

        try:
            limit = max(1, min(500, int(request.args.get("limit", "50"))))
        except Exception:
            limit = 50

        data = service.get_user_activity(oid, limit)
        return jsonify({"ok": True, "count": len(data), "items": data})
    except Exception as e:
        current_app.logger.exception("list_user_activity failed")
        return jsonify({"error": "server", "detail": str(e)}), 500


@users_bp.get("/<userId>/activity/friends")
def list_user_activity_with_friends(userId: str):
    """
    GetUsersActivityWithFriends: returns recent activities for user + friends.
    Optional: ?friends=<id1,id2,...>&limit=100
    If ?friends is omitted, tries user's stored `friends` array.
    """
    try:
        try:
            oid = ObjectId((userId or "").strip())
        except Exception:
            return jsonify({"error": "invalid_user_id"}), 400

        friends_q = (request.args.get("friends") or "").strip()
        friend_ids = []
        if friends_q:
            for s in friends_q.split(","):
                s = s.strip()
                if not s:
                    continue
                try:
                    friend_ids.append(ObjectId(s))
                except Exception:
                    continue
        else:
            db = get_db()
            u = db.users.find_one({"_id": oid}, {"friends": 1}) or {}
            for s in (u.get("friends") or []):
                try:
                    friend_ids.append(ObjectId(str(s)))
                except Exception:
                    continue

        try:
            limit = max(1, min(500, int(request.args.get("limit", "100"))))
        except Exception:
            limit = 100

        data = service.get_user_activity_with_friends(oid, friend_ids, limit)
        return jsonify({
            "ok": True,
            "userId": str(oid),
            "friendCount": len(friend_ids),
            "count": len(data),
            "items": data
        })
    except Exception as e:
        current_app.logger.exception("list_user_activity_with_friends failed")
        return jsonify({"error": "server", "detail": str(e)}), 500

@users_bp.get("")
def list_users_route():
    return jsonify(service.list_users())

@users_bp.get("/by-email/<email>")
def get_user_route(email):
    user = service.get_user_by_email(email)
    return (jsonify(user), 200) if user else (jsonify({"error":"not_found"}), 404)

@users_bp.post("")
def create_user_route():
    payload = request.get_json(force=True) or {}
    created = service.create_user(payload)
    return jsonify(created), 201

