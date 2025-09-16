# app/errors.py
from flask import Flask, jsonify
from pymongo.errors import DuplicateKeyError, WriteError

def register_error_handlers(app: Flask):
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify(error="bad_request", message=str(e)), 400

    @app.errorhandler(404)
    def not_found(_):
        return jsonify(error="not_found"), 404

    @app.errorhandler(DuplicateKeyError)
    def dup_key(e):
        return jsonify(error="duplicate_key", message=str(e)), 409

    @app.errorhandler(WriteError)
    def write_error(e):
        return jsonify(error="schema_validation", message=str(e)), 400

    @app.errorhandler(Exception)
    def unhandled(e):
        return jsonify(error="internal_error", message=str(e)), 500
