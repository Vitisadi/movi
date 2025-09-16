from flask import request, jsonify
from . import users_bp
from . import service

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
