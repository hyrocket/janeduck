from typing import TypedDict, Literal, Optional, List

ScaffoldLevel  = Literal["high", "medium", "low"]
UserAction     = Literal["try_again", "master_challenge", "next_word"]
WritingRating  = Literal["again", "hard", "good", "easy"]


class WritingState(TypedDict, total=False):
    # ── Card context (set at start, immutable) ───────────────────
    card_id:       str
    word:          str
    definition:    str
    user_id:       str
    session_id:    Optional[str]
    mastery_level: int          # for ScaffoldDecider (real impl)

    # ── Scaffold ─────────────────────────────────────────────────
    current_scaffold:  ScaffoldLevel
    is_master_challenge: bool

    # ── Prompt context shown to student ─────────────────────────
    starter_used:         Optional[str]   # HIGH
    topic_hint:           Optional[str]   # MEDIUM
    topic_used:           Optional[str]   # LOW
    structure_guide_used: Optional[str]   # LOW

    # ── User input ───────────────────────────────────────────────
    user_text:        Optional[str]
    validation_error: Optional[str]

    # ── Evaluation output (§8) ───────────────────────────────────
    overall_score:              Optional[int]
    writing_rating:             Optional[WritingRating]
    target_word_used:           bool
    target_word_used_correctly: bool
    chat_message:               Optional[str]
    strengths:                  List[str]
    weakness_signals:           List[str]

    # ── DB-loaded card metadata (set by load_context) ───────────
    starter_templates:   List[str]   # HIGH scaffold: pre-generated starters (§10)
    topic_hints:         List[str]   # MEDIUM scaffold: per-card hint pool
    part_of_speech:      Optional[str]
    example_sentences:   List[dict]  # [{sentence, context}, ...]

    # ── First-encounter intro (set by introduce_word) ────────────
    is_first_word_in_session: bool
    introduce_message:        Optional[str]

    # ── Word check results (set by check_target_word) ───────────
    exact_match:   bool
    variant_match: bool

    # ── Mastery tracking ─────────────────────────────────────────
    writing_attempts_count: int      # loaded from DB; used for context
    mastery_level_before:   Optional[int]
    mastery_level_after:    Optional[int]

    # ── Attempt tracking ─────────────────────────────────────────
    attempt_count:     int          # incremented by await_user_action
    previous_attempts: List[dict]   # [{user_text, ai_feedback}] for try_again context
    last_attempt_id:   Optional[str]

    # ── Action routing ───────────────────────────────────────────
    suggested_actions: List[str]
    user_action:       Optional[UserAction]
