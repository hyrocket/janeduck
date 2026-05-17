from langgraph.types import interrupt
from workflows.state import WritingState, UserAction

# ── present_feedback — ActionSuggester rule table (§8-1) ─────

def present_feedback_node(state: WritingState) -> dict:
    score        = state.get("overall_score") or 0
    scaffold     = state.get("current_scaffold", "high")
    attempt      = state.get("attempt_count", 1)
    word_used    = state.get("target_word_used", True)

    if attempt >= 3:
        actions = ["next_word"]
        reason  = "rule: attempt_count >= 3"
    elif not word_used:
        actions = ["try_again", "next_word"]
        reason  = "rule: target_word_used=False"
    elif score <= 7:
        actions = ["try_again", "next_word"]
        reason  = f"rule: score={score} <= 7"
    elif scaffold == "low":
        actions = ["next_word"]
        reason  = "rule: score>=8, scaffold=low (ceiling reached)"
    else:
        actions = ["master_challenge", "next_word"]
        reason  = f"rule: score={score} >= 8, scaffold={scaffold}"

    print(f"[present_feedback] {reason} → {actions}")
    return {"suggested_actions": actions}


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
    else:
        update["is_master_challenge"] = False

    return update
