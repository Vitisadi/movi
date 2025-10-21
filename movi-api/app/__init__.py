from flask import Flask
from .config import Config
from flask_cors import CORS
from .errors import register_error_handlers
from .library import library_bp
from .users import users_bp
from .health import health_bp
from . import db as db_module
from .tmdb import tmdb_bp  # <-- added

def create_app(config_class: type[Config] = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Enable CORS
    CORS(app)

    # Init DB teardown
    db_module.init_app(app)

    # Blueprints
    app.register_blueprint(health_bp, url_prefix="/")
    app.register_blueprint(users_bp, url_prefix="/users")
    app.register_blueprint(tmdb_bp, url_prefix="/")  # <-- added
    app.register_blueprint(library_bp, url_prefix="/")


    # Error handlers
    register_error_handlers(app)

    return app

