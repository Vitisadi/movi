from flask import request, jsonify
from . import entries_bp
import service

@entries_bp.get("/book/<title>")
def searchBook(title: str):
    return jsonify(service.get_book_from_api(title).model_dump_json())