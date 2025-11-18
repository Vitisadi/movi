from datetime import datetime
from typing import Optional, List, Dict, Any
from bson.objectid import ObjectId
from .schemas import UserIn, UserOut
from ..db import get_db
from datetime import datetime
from bson import ObjectId
from ..db import get_db

def add_activity(user_id: ObjectId, activity: str, meta: dict | None = None) -> str:
    db = get_db()
    doc = {
        "userId": user_id,
        "activity": str(activity),
        "meta": meta if isinstance(meta, dict) else None,
        "createdAt": datetime.utcnow(),
    }
    res = db.userActivities.insert_one(doc)
    return str(res.inserted_id)

def get_user_activity(user_id: ObjectId, limit: int = 50) -> list[dict]:
    db = get_db()
    cur = db.userActivities.find({"userId": user_id}).sort("createdAt", -1).limit(limit)
    out = []
    for d in cur:
        d["_id"] = str(d["_id"])
        d["userId"] = str(d["userId"])
        out.append(d)
    return out

def get_user_activity_with_friends(user_id: ObjectId, friend_ids: list[ObjectId], limit: int = 100) -> list[dict]:
    db = get_db()
    ids = [user_id] + list(friend_ids or [])
    cur = db.userActivities.find({"userId": {"$in": ids}}).sort("createdAt", -1).limit(limit)
    out = []
    for d in cur:
        d["_id"] = str(d["_id"])
        d["userId"] = str(d["userId"])
        out.append(d)
    return out

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


def get_profile_summary(user_id: str) -> dict:
    """Return aggregated profile counts for UI display."""
    db = get_db()
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise ValueError("invalid_id")

    user = db.users.find_one({"_id": oid})
    if not user:
        raise LookupError("user_not_found")

    watched = user.get("watchedMovies") or []
    watch_later = user.get("watchLaterMovies") or []
    read_books = user.get("readBooks") or []
    tobe_books = user.get("toBeReadBooks") or []

    # reviews stored in collections; count both movieReviews and bookReviews
    try:
        movie_reviews_count = db.movieReviews.count_documents({"userId": oid})
    except Exception:
        movie_reviews_count = 0
    try:
        book_reviews_count = db.bookReviews.count_documents({"userId": oid})
    except Exception:
        book_reviews_count = 0

    summary = {
        "userId": user_id,
        "moviesWatched": len(watched),
        "booksRead": len(read_books),
        "watchLaterCount": len(watch_later),
        "toBeReadCount": len(tobe_books),
        "wishlistCount": len(watch_later) + len(tobe_books),
        "reviewsCount": int(movie_reviews_count or 0) + int(book_reviews_count or 0),
        "bio": user.get("bio") or "",
    }
    return summary
