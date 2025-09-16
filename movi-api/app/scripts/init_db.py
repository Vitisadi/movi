import os
from dotenv import load_dotenv
from pymongo import MongoClient, ASCENDING
load_dotenv()

client = MongoClient(os.getenv("MONGODB_URI"))
db = client[os.getenv("DB_NAME","movi")]

db.users.create_index([("email", ASCENDING)], unique=True)
db.users.create_index([("username", ASCENDING)], unique=True, sparse=True)

print("Indexes ensured.")
