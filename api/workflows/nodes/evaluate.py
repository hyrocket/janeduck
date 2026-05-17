"""
evaluate_writing node — the only LLM call in the graph (§7).
Mirrors lib/ai/evaluate-writing.ts logic.
"""
import os
import json
from typing import Optional
from openai import AsyncOpenAI
from ..state import WritingState

# ── OpenAI structured output schema (§8) ─────────────────────

_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "overall_score":               {"type": "integer", "minimum": 0, "maximum": 10},
        "writing_rating":              {"type": "string", "enum": ["again", "hard", "good", "easy"]},
        "target_word_used":            {"type": "boolean"},
        "target_word_used_correctly":  {"type": "boolean"},
        "chat_message":                {"type": "string"},
        "strengths":                   {"type": "array", "items": {"type": "string"}},
        "weakness_signals":            {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "overall_score", "writing_rating",
        "target_word_used", "target_word_used_correctly",
        "chat_message", "strengths", "weakness_signals",
    ],
    "additionalProperties": False,
}

_FALLBACK = {
    "overall_score":              5,
    "writing_rating":             "hard",
    "target_word_used":           True,
    "target_word_used_correctly": True,
    "chat_message": (
        "Good effort! I had a little trouble processing your answer just now. "
        "Your writing has been saved — give it another go if you'd like."
    ),
    "strengths":         [],
    "weakness_signals":  [],
}

# ── Scaffold-specific criteria (§8-0) ────────────────────────

_SCAFFOLD_CRITERIA: dict[str, str] = {
    "high": """\
## Scaffold: HIGH (Structure Scaffold)
The student was given a sentence starter (e.g. "I feel ___ when ___") and asked to complete it.
IMPORTANT: Evaluate ONLY what the student contributed — the words they added.
Do NOT penalise for the structural part provided by the system.
Criteria:
- Target word used in a meaningful way.
- Completed sentence makes sense in context.
Tone: lenient. Small grammar slips are fine. Encourage the attempt.
Expected output: 1 completed sentence.""",

    "medium": """\
## Scaffold: MEDIUM (Semantic Scaffold)
Student wrote a sentence independently, guided by a topic hint.
Criteria:
- Target word used correctly and naturally.
- Sentence makes grammatical sense.
- Vocabulary appropriate for Sec 2.
Tone: standard — fair and clear. One key issue max.
Expected output: 1 sentence.""",

    "low": """\
## Scaffold: LOW (Micro Story Scaffold)
Student given a structure guide and topic. Must write EXACTLY 2 connected sentences.
Criteria:
- Sentence 2 fulfils the structure guide (reason / result / emotion / contrast).
- Two sentences meaningfully connected (coherence).
- No repeated expressions between the two sentences.
- 1 sentence → note gently, minor deduction.  3+ sentences → praise effort, note the constraint.
Tone: strict on coherence/structure, encouraging on effort.
Expected output: exactly 2 connected sentences.""",
}

# ── Prompt builders ──────────────────────────────────────────

def _build_system(scaffold: str) -> str:
    criteria = _SCAFFOLD_CRITERIA.get(scaffold, _SCAFFOLD_CRITERIA["high"])
    return f"""\
You are JaneDuck, a friendly English writing coach for Singapore secondary school students (age 13–15).

## Your Persona
- Warm, honest, never over-the-top. Praise only when genuinely deserved.
- Address the student directly as "you".
- Write in clear, simple English. Singapore-friendly — avoid heavy American slang.
- Keep chat_message to 2–3 short paragraphs at most.

## Evaluation Process
STEP 1 — SCORE (internal):
Apply the scaffold criteria below. Assign overall_score as an integer 0–10.
Derive writing_rating: 0–3 → "again", 4–6 → "hard", 7–8 → "good", 9–10 → "easy".

STEP 2 — COACHING (chat_message, English):
- Strength first, then ONE improvement only — even if there are multiple issues.
- Give a concrete fix: not "it's wrong" but "try writing: ___".
- Tone by score:
  - 9–10: Genuine celebration. Point out what showed real skill.
  - 7–8: Warm encouragement. One small tweak.
  - 4–6: Acknowledge the try. One clear fix + rewrite example.
  - 0–3: Supportive. Simplify the model, no long error list.
- End with a forward-looking line ("Want to try again?" / "Ready for the next one?").

{criteria}

## Output format
Return a single JSON object — no markdown, no explanation outside the JSON.
Fields: overall_score, writing_rating, target_word_used, target_word_used_correctly,
chat_message, strengths (array of short phrases, max 3), weakness_signals (array of short phrases, max 3).
Empty array if none."""


def _build_user(state: WritingState) -> str:
    word       = state.get("word", "")
    definition = state.get("definition", "")
    scaffold   = state.get("current_scaffold", "high")
    user_text  = state.get("user_text", "")

    lines = [f'Target word: "{word}"', f'Definition: "{definition}"']

    if scaffold == "high" and state.get("starter_used"):
        lines.append(f'Sentence starter shown to student: "{state["starter_used"]}"')
    if scaffold == "medium" and state.get("topic_hint"):
        lines.append(f'Topic hint shown to student: "{state["topic_hint"]}"')
    if scaffold == "low":
        if state.get("topic_used"):
            lines.append(f'Topic given: "{state["topic_used"]}"')
        if state.get("structure_guide_used"):
            lines.append(f'Structure guide: "{state["structure_guide_used"]}"')

    prev = state.get("previous_attempts") or []
    if prev:
        lines.append("\nPrevious attempts this session:")
        for i, a in enumerate(prev):
            lines.append(f'  [Attempt {i+1}] Student wrote: "{a["user_text"]}"')
            lines.append(f'  [Attempt {i+1}] Your feedback: "{a["ai_feedback"]}"')

    lines.append(f'\nStudent\'s writing:\n"{user_text}"')
    return "\n".join(lines)


def _rating_from_score(score: int) -> str:
    if score <= 3: return "again"
    if score <= 6: return "hard"
    if score <= 8: return "good"
    return "easy"

# ── OpenAI client (lazy singleton) ───────────────────────────

_client: Optional[AsyncOpenAI] = None

def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not set")
        _client = AsyncOpenAI(api_key=api_key)
    return _client

# ── Node ─────────────────────────────────────────────────────

_MAX_RETRIES = 2


async def evaluate_writing_node(state: WritingState) -> dict:
    client = _get_client()
    model  = os.environ.get("LLM_MODEL_EVALUATE", "gpt-4.1-mini")
    system = _build_system(state.get("current_scaffold", "high"))
    user   = _build_user(state)

    for attempt in range(_MAX_RETRIES + 1):
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user",   "content": user},
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name":   "evaluate_writing_output",
                        "strict": True,
                        "schema": _OUTPUT_SCHEMA,
                    },
                },
                temperature=0.3,
            )
            raw = response.choices[0].message.content
            if not raw:
                raise ValueError("Empty LLM response")

            parsed = json.loads(raw)
            # Override writing_rating from score to prevent inconsistency (§8-2)
            parsed["writing_rating"] = _rating_from_score(parsed["overall_score"])
            return parsed

        except Exception as exc:
            if attempt == _MAX_RETRIES:
                print(f"[evaluate_writing] All retries exhausted: {exc}")
                return dict(_FALLBACK)
            print(f"[evaluate_writing] Attempt {attempt + 1} failed, retrying: {exc}")

    return dict(_FALLBACK)
