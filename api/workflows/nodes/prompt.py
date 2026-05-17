from ..state import WritingState


def prompt_high_node(state: WritingState) -> dict:
    # STUB — real impl: pick from cards.starter_templates (DB).
    word = state.get("word", "")
    return {
        "starter_used":         f"[STUB] I feel _____ when I see {word}.",
        "topic_hint":           None,
        "topic_used":           None,
        "structure_guide_used": None,
        "user_text":            None,
        "validation_error":     None,
    }


def prompt_medium_node(state: WritingState) -> dict:
    # STUB — real impl: pick topic hint from app-wide pool.
    return {
        "starter_used":         None,
        "topic_hint":           "[STUB] school life",
        "topic_used":           None,
        "structure_guide_used": None,
        "user_text":            None,
        "validation_error":     None,
    }


def prompt_low_node(state: WritingState) -> dict:
    # STUB — real impl: pick topic + structure guide from pools (§5-1), avoid prev choices.
    return {
        "starter_used":         None,
        "topic_hint":           None,
        "topic_used":           "[STUB] weekend",
        "structure_guide_used": "[STUB] second sentence explains why",
        "user_text":            None,
        "validation_error":     None,
    }
