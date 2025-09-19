from datetime import datetime
from pydantic import BaseModel
from typing import List
from users.schemas import UserIn

class Entry(BaseModel):
    title: str
    year_released: int | List[int] # for range of years
    date_added: datetime
    avg_rating: float
    added_by: dict[UserIn, int] # Key: user Value: rating given

class Book(Entry):
    author: str | List[str]
    publisher: str | List[str]
    page_count: int
    

class Movie(Entry):
    runtime: int # in minutes
    cast: dict[str, str]
    director: str | List[str]
    writer: str | List[str]
    producer: str | List[str]

class Series(Entry):
    season_count: int
    episode_count: int | List[int]
    cast: dict[str, str]
    creator: str | List[str]
    director: str | List[str]
    writer: str | List[str]
    producer: str | List[str]