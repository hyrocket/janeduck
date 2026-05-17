from langgraph.types import interrupt
from workflows.state import WritingState, UserAction
from workflows.judgers import suggest_actions


# ── present_feedback — ActionSuggester (§8-1) ────────────────

def present_feedback_node(state: WritingState) -> dict:
    score      = state.get("overall_score") or 0
    scaffold   = state.get("current_scaffold", "high")
    attempt    = state.get("attempt_count", 0)
    word_used  = state.get("target_word_used", True)

    result  = suggest_actions(score, scaffold, attempt, word_used)
    print(f"[present_feedback] {result['reason']} → {result['actions']}")
    return {"suggested_actions": result["actions"]}


# ── await_user_action — Pause point 2 ────────────────────────

def await_user_action_node(state: WritingState) -> dict:
    """Pause point 2 — waits for student to choose try_again / master_challenge / next_word."""
    action: UserAction = interrupt({
        "event":             "awaiting_user_action",
        "suggested_actions": state.get("suggested_actions", []),
    })

    update: dict = {
        "user_action":   action,
        "attempt_count": (state.get("attempt_count") or 0) + 1,
    }

    if action == "master_challenge":
        scaffold_up = {"high": "medium", "medium": "low"}
        current     = state.get("current_scaffold", "high")
        update["current_scaffold"]    = scaffold_up.get(current, current)
        update["is_master_challenge"] = True
        # Advance mastery baseline to the earned value from the previous attempt.
        # try_again keeps session-start mastery (결정 C); master_challenge promotes it.
        update["mastery_level"] = state.get("mastery_level_after") or state.get("mastery_level", 0)
    else:
        update["is_master_challenge"] = False

    return update
