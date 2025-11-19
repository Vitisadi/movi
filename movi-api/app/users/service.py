from datetime import datetime
from typing import Optional, List, Dict, Any, Sequence

from bson import ObjectId

from .schemas import UserIn, UserOut
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

def _build_user_lookup(db, ids: Sequence[ObjectId]) -> dict[str, dict[str, Any]]:
    valid: list[ObjectId] = []
    seen: set[str] = set()
    for oid in ids:
        if not isinstance(oid, ObjectId):
            continue
        key = str(oid)
        if key in seen:
            continue
        seen.add(key)
        valid.append(oid)
    if not valid:
        return {}

    cursor = db.users.find(
        {"_id": {"$in": valid}},
        {"username": 1, "name": 1, "avatarUrl": 1}
    )
    lookup: dict[str, dict[str, Any]] = {}
    for doc in cursor:
        key = str(doc["_id"])
        lookup[key] = {
            "id": key,
            "username": doc.get("username"),
            "name": doc.get("name"),
            "avatarUrl": doc.get("avatarUrl"),
        }
    return lookup


def _serialize_activities(docs: list[dict], user_lookup: dict[str, dict[str, Any]] | None = None) -> list[dict]:
    out: list[dict[str, Any]] = []
    for d in docs:
        activity_id = d.get("_id")
        user_raw = d.get("userId")
        if isinstance(activity_id, ObjectId):
            act_id_str: str | None = str(activity_id)
        elif isinstance(activity_id, str):
            act_id_str = activity_id
        else:
            act_id_str = str(activity_id) if activity_id is not None else None

        if isinstance(user_raw, ObjectId):
            user_id_str = str(user_raw)
        elif isinstance(user_raw, str):
            user_id_str = user_raw
        else:
            user_id_str = None

        shaped: dict[str, Any] = {
            "_id": act_id_str,
            "userId": user_id_str,
            "activity": d.get("activity"),
            "meta": d.get("meta"),
            "createdAt": d.get("createdAt"),
        }

        if user_lookup and user_id_str:
            actor = user_lookup.get(user_id_str)
            if actor:
                shaped["user"] = actor

        out.append(shaped)
    return out


def get_user_activity(user_id: ObjectId, limit: int = 50) -> list[dict]:
    db = get_db()
    docs = list(db.userActivities.find({"userId": user_id}).sort("createdAt", -1).limit(limit))
    actors = _build_user_lookup(db, [user_id])
    return _serialize_activities(docs, actors)


def get_user_activity_with_friends(user_id: ObjectId, friend_ids: list[ObjectId], limit: int = 100) -> list[dict]:
    db = get_db()
    ids = [user_id] + list(friend_ids or [])
    docs = list(
        db.userActivities.find({"userId": {"$in": ids}})
        .sort("createdAt", -1)
        .limit(limit)
    )
    actors = _build_user_lookup(db, ids)
    return _serialize_activities(docs, actors)

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
