from pydantic import BaseModel
from typing import Optional

class ActionPayload(BaseModel):
    action: str
    video_id: Optional[str] = None
    time: float = 0.0
    state: Optional[str] = None

class ChatPayload(BaseModel):
    username: str
    message: str
    is_admin: bool
