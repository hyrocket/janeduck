"""
Judgment modules — §11.
Pure functions: no DB calls, no side effects.
Interfaces are fixed; implementations are rule-based (MVP).
"""
from typing import Literal

ScaffoldLevel = Literal["high", "medium", "low"]

# ── ScaffoldDecider ───────────────────────────────────────────

def decide_scaffold(mastery: int) -> dict:
    """
    §5 rule: mastery 0-1 → high, 2-4 → medium, 5 → low.
    Boundaries match scaffold ceilings in §4-3 to prevent deadlock.
    """
    if mastery <= 1:
        scaffold = "high"
    elif mastery <= 4:
        scaffold = "medium"
    else:
        scaffold = "low"
    return {"scaffold": scaffold, "reason": f"rule: mastery={mastery}"}


# ── MasteryUpdater ────────────────────────────────────────────

_SCAFFOLD_CEILING: dict[str, int] = {"high": 2, "medium": 4, "low": 5}


def update_mastery(
    current: int,
    score: int,
    scaffold: str,
    is_master_challenge: bool,
) -> dict:
    """
    §4-3 mastery update rules.
    Returns new_mastery (0-5), new_scaffold, reason.
    """
    ceiling = _SCAFFOLD_CEILING.get(scaffold, 5)

    if score >= 8:
        if current < ceiling:
            new_mastery = current + 1
            reason = f"rule: score={score}>=8, scaffold={scaffold}, ceiling={ceiling} → +1"
        else:
            new_mastery = current
            reason = f"rule: score={score}>=8 but ceiling={ceiling} reached for scaffold={scaffold}"
    elif score >= 5:
        new_mastery = current
        reason = f"rule: score={score} in 5-7 → no change"
    else:
        # score <= 4
        if is_master_challenge:
            new_mastery = current
            reason = f"rule: score={score}<=4 but is_master_challenge → no penalty (§6)"
        else:
            new_mastery = max(current - 1, 1)  # floor 1 — never drops to untouched(0)
            reason = f"rule: score={score}<=4 → -1 (floor 1)"

    new_mastery = max(0, min(5, new_mastery))
    new_scaffold = decide_scaffold(new_mastery)["scaffold"]

    return {"new_mastery": new_mastery, "new_scaffold": new_scaffold, "reason": reason}


# ── ActionSuggester ───────────────────────────────────────────

def suggest_actions(
    score: int,
    scaffold: str,
    attempt_count: int,
    word_used: bool,
) -> dict:
    """
    §8-1 suggested_actions rule table.
    attempt_count is the value BEFORE this action selection (0-indexed when update_srs runs).
    """
    # attempt_count is incremented by await_user_action AFTER feedback; here it's pre-increment.
    # 3 attempts already done means attempt_count == 2 coming into present_feedback.
    if attempt_count >= 2:
        actions = ["next_word"]
        reason  = f"rule: attempt_count={attempt_count} → max 3 attempts reached"
    elif not word_used:
        actions = ["try_again", "next_word"]
        reason  = "rule: target_word_used=False"
    elif score <= 7:
        actions = ["try_again", "next_word"]
        reason  = f"rule: score={score} <= 7"
    elif scaffold == "low":
        actions = ["next_word"]
        reason  = "rule: score>=8, scaffold=low (no higher scaffold)"
    else:
        actions = ["master_challenge", "next_word"]
        reason  = f"rule: score={score}>=8, scaffold={scaffold}"

    return {"actions": actions, "reason": reason}
