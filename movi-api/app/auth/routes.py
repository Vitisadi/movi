from flask import request, jsonify
from . import auth_bp
from . import service


@auth_bp.post("/register")
def register_route():
    payload = request.get_json(force=True) or {}
    try:
        created = service.register_user(payload)
        return jsonify(created), 201
    except ValueError as e:
        msg = str(e)
        if msg == "email_taken":
            return jsonify({"error": "email_taken"}), 400
        return jsonify({"error": msg}), 400
    except Exception as e:
        return jsonify({"error": "internal_error", "detail": str(e)}), 500


@auth_bp.post("/login")
def login_route():
    payload = request.get_json(force=True) or {}
    email = payload.get("email")
    password = payload.get("password")
    if not email or not password:
        return jsonify({"error": "missing_credentials"}), 400
    auth = service.authenticate_user(email, password)
    if not auth:
        return jsonify({"error": "invalid_credentials"}), 401
    return jsonify(auth), 200
