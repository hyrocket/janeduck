from langgraph.types import interrupt
from workflows.state import WritingState


def await_user_input_node(state: WritingState) -> dict:
    """Pause point 1 — waits for student to submit their writing."""
    user_text = interrupt({
        "event":    "awaiting_user_text",
        "scaffold": state.get("current_scaffold"),
    })
    return {"user_text": user_text, "validation_error": None}


def validate_input_node(state: WritingState) -> dict:
    text = (state.get("user_text") or "").strip()
    if not text:
        return {"validation_error": "Please write something before submitting."}
    if len(text) < 5:
        return {"validation_error": "That's a bit short — try writing at least one full sentence."}
    # Reset attempt ID so update_srs_mastery generates a fresh deterministic ID for this submission
    return {"validation_error": None, "last_attempt_id": None}
