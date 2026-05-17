from workflows.state import WritingState
from workflows.judgers import decide_scaffold


def determine_scaffold_node(state: WritingState) -> dict:
    """ScaffoldDecider — §5 rule. Resets per-session state."""
    mastery = state.get("mastery_level", 0)
    result  = decide_scaffold(mastery)
    print(f"[determine_scaffold] {result['reason']} → scaffold={result['scaffold']}")
    return {
        "current_scaffold":    result["scaffold"],
        "is_master_challenge": False,
        "attempt_count":       0,
        "previous_attempts":   [],
        "suggested_actions":   [],
    }
