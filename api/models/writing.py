from pydantic import BaseModel
from typing import Optional, List, Literal


class StartWritingRequest(BaseModel):
    card_id:       str
    word:          str
    definition:    str
    user_id:       str
    session_id:    Optional[str] = None
    mastery_level: int = 0


class SubmitWritingRequest(BaseModel):
    thread_id: str
    user_text: str


class ActionRequest(BaseModel):
    thread_id: str
    action: Literal["try_again", "master_challenge", "next_word"]
