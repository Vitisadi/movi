from pymongo import MongoClient
from flask import current_app, g

def get_client() -> MongoClient:
    if "mongo_client" not in g:
        uri = current_app.config["MONGODB_URI"]
        g.mongo_client = MongoClient(uri, serverSelectionTimeoutMS=10000)
    return g.mongo_client

def get_db():
    client = get_client()
    db_name = current_app.config["DB_NAME"]
    return client[db_name]

from flask import Flask
def init_app(app: Flask):
    @app.teardown_appcontext
    def close_client(_exc):
        client = g.pop("mongo_client", None)
        if client:
            client.close()
