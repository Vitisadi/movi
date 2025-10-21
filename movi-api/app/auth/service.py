import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import bcrypt
import jwt
import base64
from ..db import get_db
from pymongo.errors import DuplicateKeyError, PyMongoError
from ..users.schemas import UserIn, UserOut

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")
JWT_ALGO = "HS256"
JWT_EXP_DELTA_SECONDS = int(os.getenv("JWT_EXP_SECONDS", 3600))

def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return base64.b64encode(hashed).decode("ascii")

def check_password(password: str, hashed_b64: str) -> bool:
    try:
        hashed = base64.b64decode(hashed_b64)
    except Exception:
        return False
    return bcrypt.checkpw(password.encode("utf-8"), hashed)

def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(seconds=JWT_EXP_DELTA_SECONDS),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)
    return token

def decode_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except Exception:
        return None

def register_user(payload: Dict[str, Any]) -> Dict[str, Any]:
    # expect payload has email and password
    if "password" not in payload:
        raise ValueError("password required")
    db = get_db()
    existing = db.users.find_one({"email": payload.get("email")})
    if existing:
        raise ValueError("email_taken")
    pw = payload.pop("password")
    # Validate only the user fields (exclude password)
    user_fields = {k: v for k, v in payload.items()}
    user_in = UserIn.model_validate(user_fields)
    doc = user_in.model_dump()
    print(doc)
    doc["passwordHash"] = hash_password(pw)
    now = datetime.utcnow()
    doc["createdAt"] = now
    doc["updatedAt"] = now
    try:
        # remove any pre-populated _id so MongoDB can generate one and schema validators
        # that disallow unknown _id fields won't reject the insert
        doc.pop("_id", None)
        result = db.users.insert_one(doc)
        print(f"result{result}")
        saved = db.users.find_one({"_id": result.inserted_id})
    except DuplicateKeyError as e:
        # likely email or username duplicate
        print("DuplicateKeyError inserting user:", e)
        raise ValueError("email_taken")
    except PyMongoError as e:
        # unexpected DB error; include some debug info
        print("PyMongoError inserting user:", e)
        print("db object:", type(db), repr(db))
        print("doc being inserted:", doc)
        raise
    print(saved)
    # ensure id is string for UserOut
    saved["_id"] = str(saved["_id"])
    user_out = UserOut.model_validate(saved)
    return user_out.model_dump(by_alias=True)

def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    db = get_db()
    doc = db.users.find_one({"email": email})
    if not doc:
        return None
    pw_hash = doc.get("passwordHash")
    if not pw_hash:
        return None
    ok = check_password(password, pw_hash)
    if not ok:
        return None
    user_id = str(doc["_id"])
    token = create_token(user_id)
    doc["_id"] = user_id
    user_out = UserOut.model_validate(doc)
    return {"token": token, "user": user_out.model_dump(by_alias=True)}
