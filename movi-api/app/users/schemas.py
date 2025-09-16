from typing import Optional, List, Literal, Dict, Any
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from pydantic.config import ConfigDict

class Name(BaseModel):
   first: str
   last: str
   model_config = ConfigDict(extra="forbid")

class UserIn(BaseModel):
   email: EmailStr
   username: Optional[str] = None
   name: Optional[Name] = None
   bio: Optional[str] = None
   avatarUrl: Optional[str] = None
   model_config = ConfigDict(extra="forbid")

class UserOut(BaseModel):
   id: str = Field(alias="_id")
   email: EmailStr
   username: Optional[str] = None
   name: Optional[Name] = None
   bio: Optional[str] = None
   avatarUrl: Optional[str] = None
   createdAt: datetime
   updatedAt: Optional[datetime] = None
   model_config = ConfigDict(populate_by_name=True)
