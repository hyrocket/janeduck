from ..state import WritingState


def determine_scaffold_node(state: WritingState) -> dict:
    # STUB — always returns "high".
    # Real impl (§5): mastery 0-1→high, 2-4→medium, 5→low.
    # Also resets per-attempt state on entry.
    return {
        "current_scaffold":  "high",
        "is_master_challenge": False,
        "attempt_count":     0,
        "previous_attempts": [],
        "suggested_actions": [],
    }
