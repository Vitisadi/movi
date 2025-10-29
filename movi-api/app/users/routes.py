# app/users/routes.py
from flask import request, jsonify, current_app
from bson import ObjectId

from . import users_bp, service  # reuse the blueprint created in app/users/__init__.py
from ..db import get_db


# ---------- Activity Endpoints ----------

@users_bp.post("/<userId>/activity")
def add_user_activity(userId: str):
    """
    AddActivity: inserts an activity row and pushes its id to the user's `activities` array (newest first).
    Effective URL (with blueprint prefix): /users/<userId>/activity
    Body: { "activity": "<string>", "meta": { ... } }  # meta optional
    """
    try:
        # Validate user id & existence
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

        # Create activity doc
        act_id = service.add_activity(oid, activity, meta)

        # Push activity id to user's list, newest at front
        db.users.update_one(
            {"_id": oid},
            {"$push": {"activities": {"$each": [ObjectId(act_id)], "$position": 0}}}
        )

        # Optional: return count
        u = db.users.find_one({"_id": oid}, {"activities": 1}) or {}
        count = len(u.get("activities") or [])

        return jsonify({"ok": True, "activityId": act_id, "userId": str(oid), "activitiesCount": count}), 201

    except Exception as e:
        current_app.logger.exception("add_user_activity failed")
        return jsonify({"error": "server", "detail": str(e)}), 500


@users_bp.get("/<userId>/activity")
def list_user_activity(userId: str):
    """
    GetUsersActivity: returns recent activities for a user.
    Optional query: ?limit=50
    Effective URL: /users/<userId>/activity
    """
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

@users_bp.get("")
def list_users_route():
    return jsonify(service.list_users())

@users_bp.get("/by-email/<email>")
def get_user_route(email):
    user = service.get_user_by_email(email)
    return (jsonify(user), 200) if user else (jsonify({"error": "not_found"}), 404)

@users_bp.post("")
def create_user_route():
    payload = request.get_json(force=True) or {}
    created = service.create_user(payload)
    return jsonify(created), 201

