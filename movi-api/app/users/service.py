# app/users/service.py
from datetime import datetime
from typing import Optional, List, Dict, Any
from bson.objectid import ObjectId
from .schemas import UserIn, UserOut
from ..db import get_db

def _serialize(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return None
    d = dict(doc)
    d["_id"] = str(d["_id"])
    return d

def list_users(limit: int = 50) -> List[Dict[str, Any]]:
    db = get_db()
    docs = [_serialize(d) for d in db.users.find({}).limit(limit)]
    shaped = [
        UserOut.model_validate(d).model_dump(by_alias=True)  # type: ignore[arg-type]
        for d in docs if d is not None
    ]
    return shaped

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    db = get_db()
    doc = db.users.find_one({"email": email})
    if not doc:
        return None
    return UserOut.model_validate(_serialize(doc)).model_dump(by_alias=True)  # type: ignore[arg-type]

def create_user(payload: Dict[str, Any]) -> Dict[str, Any]:
    user_in = UserIn.model_validate(payload)
    now = datetime.utcnow()
    doc = user_in.model_dump()
    doc["createdAt"] = now
    doc["updatedAt"] = now

    db = get_db()
    result = db.users.insert_one(doc)
    saved = db.users.find_one({"_id": result.inserted_id})
    return UserOut.model_validate(_serialize(saved)).model_dump(by_alias=True)  # type: ignore[arg-type]

def delete_user(user_id: str) -> None:
    db = get_db()
    db.users.delete_one({"_id": ObjectId(user_id)})
