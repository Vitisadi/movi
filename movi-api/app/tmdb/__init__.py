from flask import Blueprint
tmdb_bp = Blueprint("tmdb", __name__)
from . import routes  # noqa: F401

