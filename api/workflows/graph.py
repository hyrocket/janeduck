"""
Writing Mode LangGraph workflow — DESIGN_DECISIONS.md §7.

Flow:
  START
  → determine_scaffold
  → prompt_high / prompt_medium / prompt_low        (scaffold router)
  → await_user_input                                (PAUSE 1: student writes)
  → validate_input   ──(invalid)──→ await_user_input (re-prompt loop)
  → check_target_word
  → evaluate_writing                                (only LLM call)
  → update_srs_mastery
  → present_feedback
  → await_user_action                               (PAUSE 2: student chooses)
  → try_again  → await_user_input  (same scaffold)
  → master_challenge → prompt_*    (scaffold bumped in await_user_action)
  → next_word  → END
"""
from langgraph.graph import StateGraph, END

from workflows.state import WritingState
from workflows.nodes import (
    determine_scaffold_node,
    prompt_high_node, prompt_medium_node, prompt_low_node,
    await_user_input_node, validate_input_node,
    check_target_word_node,
    evaluate_writing_node,
    update_srs_mastery_node,
    present_feedback_node, await_user_action_node,
)

# ── Routing functions ─────────────────────────────────────────

def _route_scaffold(state: WritingState) -> str:
    return state.get("current_scaffold", "high")


def _route_validation(state: WritingState) -> str:
    return "invalid" if state.get("validation_error") else "valid"


def _route_after_action(state: WritingState) -> str:
    """
    next_word → END.
    try_again / master_challenge → prompt node for the (possibly updated) scaffold.
    """
    action = state.get("user_action")
    if action == "next_word":
        return "next_word"
    scaffold = state.get("current_scaffold", "high")
    return f"prompt_{scaffold}"


# ── Graph assembly ────────────────────────────────────────────

def build_writing_graph(checkpointer=None):
    builder = StateGraph(WritingState)

    # ── Nodes ─────────────────────────────────────────────────
    builder.add_node("determine_scaffold",  determine_scaffold_node)
    builder.add_node("prompt_high",         prompt_high_node)
    builder.add_node("prompt_medium",       prompt_medium_node)
    builder.add_node("prompt_low",          prompt_low_node)
    builder.add_node("await_user_input",    await_user_input_node)
    builder.add_node("validate_input",      validate_input_node)
    builder.add_node("check_target_word",   check_target_word_node)
    builder.add_node("evaluate_writing",    evaluate_writing_node)
    builder.add_node("update_srs_mastery",  update_srs_mastery_node)
    builder.add_node("present_feedback",    present_feedback_node)
    builder.add_node("await_user_action",   await_user_action_node)

    # ── Entry point ────────────────────────────────────────────
    builder.set_entry_point("determine_scaffold")

    # ── Edges ──────────────────────────────────────────────────

    # determine_scaffold → prompt_*
    builder.add_conditional_edges(
        "determine_scaffold",
        _route_scaffold,
        {"high": "prompt_high", "medium": "prompt_medium", "low": "prompt_low"},
    )

    # prompt_* → await_user_input  (PAUSE 1)
    for prompt_node in ("prompt_high", "prompt_medium", "prompt_low"):
        builder.add_edge(prompt_node, "await_user_input")

    # await_user_input → validate_input
    builder.add_edge("await_user_input", "validate_input")

    # validate_input → check_target_word or back to await_user_input (invalid loop)
    builder.add_conditional_edges(
        "validate_input",
        _route_validation,
        {"valid": "check_target_word", "invalid": "await_user_input"},
    )

    # Linear path through evaluation
    builder.add_edge("check_target_word",  "evaluate_writing")
    builder.add_edge("evaluate_writing",   "update_srs_mastery")
    builder.add_edge("update_srs_mastery", "present_feedback")

    # present_feedback → await_user_action  (PAUSE 2)
    builder.add_edge("present_feedback", "await_user_action")

    # await_user_action → prompt_* (try_again/master_challenge) or END (next_word)
    builder.add_conditional_edges(
        "await_user_action",
        _route_after_action,
        {
            "prompt_high":   "prompt_high",
            "prompt_medium": "prompt_medium",
            "prompt_low":    "prompt_low",
            "next_word":     END,
        },
    )

    return builder.compile(checkpointer=checkpointer, name="writing_mode")


# Studio용 인스턴스 — langgraph.json이 참조. checkpointer 없음 (Studio가 자체 관리).
studio_graph = build_writing_graph()
