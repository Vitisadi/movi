from flask import Blueprint
friend_bp = Blueprint("friends", __name__)
from . import routes  # noqa: F401