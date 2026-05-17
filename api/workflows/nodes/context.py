import traceback
from workflows.state import WritingState
from workflows.db import get_card_and_user_card


async def load_context_node(state: WritingState) -> dict:
    """
    Load card metadata + user_card state from DB at session start.
    Overwrites mastery_level with the authoritative DB value (§5 decision B).
    Upserts user_card row with defaults if it doesn't exist yet.
    Falls back gracefully if DB is unavailable (Studio / offline dev).
    """
    card_id = state.get("card_id", "")
    user_id = state.get("user_id", "")

    if not card_id or not user_id:
        return {}

    try:
        data = await get_card_and_user_card(card_id, user_id)
        return {
            "starter_templates":      data["starter_templates"],
            "topic_hints":            data["topic_hints"],
            "part_of_speech":         data["part_of_speech"],
            "example_sentences":      data["example_sentences"],
            "mastery_level":          data["mastery_level"],
            "writing_attempts_count": data["writing_attempts_count"],
        }
    except Exception as exc:
        traceback.print_exc()
        print(f"[load_context] DB unavailable ({type(exc).__name__}: {exc}) — using request defaults")
        return {}
