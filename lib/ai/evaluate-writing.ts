import type { ScaffoldLevel } from "@/lib/types"
import { llmClient, modelFor } from "./client"

// ── I/O types ────────────────────────────────────────────────

export interface EvaluateWritingInput {
  word: string
  definition: string
  scaffold: ScaffoldLevel
  user_text: string
  // HIGH: sentence starter shown to student (evaluate only what student added)
  starter_used?: string
  // MEDIUM: topic hint shown to student
  topic_hint?: string
  // LOW: structure guide + topic prompt shown to student
  structure_guide?: string
  topic?: string
  // Prior attempts in this session (try_again context)
  previous_attempts?: { user_text: string; ai_feedback: string }[]
}

export interface EvaluateWritingOutput {
  // Group A — shown to student
  overall_score: number                   // 0–10 integer
  chat_message: string                    // JaneDuck coaching message, English
  // Group B — system routing
  target_word_used: boolean
  target_word_used_correctly: boolean
  // Group C — DB / Phase 2
  writing_rating: "again" | "hard" | "good" | "easy"
  strengths: string[]
  weakness_signals: string[]
}

// ── JSON Schema for OpenAI structured output ─────────────────

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    overall_score:               { type: "integer", minimum: 0, maximum: 10 },
    writing_rating:              { type: "string", enum: ["again", "hard", "good", "easy"] },
    target_word_used:            { type: "boolean" },
    target_word_used_correctly:  { type: "boolean" },
    chat_message:                { type: "string" },
    strengths:                   { type: "array", items: { type: "string" } },
    weakness_signals:            { type: "array", items: { type: "string" } },
  },
  required: [
    "overall_score", "writing_rating",
    "target_word_used", "target_word_used_correctly",
    "chat_message", "strengths", "weakness_signals",
  ],
  additionalProperties: false,
} as const

// ── Safe fallback (parse failure after all retries) ──────────

const FALLBACK: EvaluateWritingOutput = {
  overall_score: 5,
  writing_rating: "hard",
  target_word_used: true,
  target_word_used_correctly: true,
  chat_message:
    "Good effort! I had a little trouble processing your answer just now. " +
    "Your writing has been saved — give it another go if you'd like.",
  strengths: [],
  weakness_signals: [],
}

// ── writing_rating from score (§8-2) — override LLM if mismatch ──

function ratingFromScore(score: number): EvaluateWritingOutput["writing_rating"] {
  if (score <= 3) return "again"
  if (score <= 6) return "hard"
  if (score <= 8) return "good"
  return "easy"
}

// ── Prompt builders ──────────────────────────────────────────

function buildSystemPrompt(scaffold: ScaffoldLevel): string {
  const scaffoldCriteria: Record<ScaffoldLevel, string> = {
    high: `
## Scaffold: HIGH (Structure Scaffold)
The student was given a sentence starter (e.g. "My friend is ___ when ___") and asked to complete it.
IMPORTANT: Evaluate ONLY what the student contributed — the words they added to complete or extend the starter.
Do NOT penalise for the structural part that was provided by the system.
Criteria:
- Did the student use the target word in a meaningful way?
- Does the completed sentence make sense in context?
- Tone: lenient. Small grammar slips are fine at this level. Encourage the attempt.
Expected output: 1 completed sentence.`.trim(),

    medium: `
## Scaffold: MEDIUM (Semantic Scaffold)
The student wrote a sentence independently, guided by a topic hint.
Criteria:
- Is the target word used correctly and naturally?
- Does the sentence make grammatical sense?
- Is the vocabulary appropriate for Sec 2?
Tone: standard — be fair and clear. One key issue max in the feedback.
Expected output: 1 sentence.`.trim(),

    low: `
## Scaffold: LOW (Micro Story Scaffold)
The student was given a structure guide (e.g. "second sentence explains WHY") and a topic.
They must produce EXACTLY 2 connected sentences.
Criteria:
- Does sentence 2 fulfil the structure guide (reason / result / emotion / contrast)?
- Are the two sentences meaningfully connected (coherence)?
- No repeated expressions between the two sentences.
- Sentence count: if only 1 sentence → note it gently, minor deduction. 3+ sentences → praise the effort, note the 2-sentence constraint.
Tone: strict on coherence and structure, encouraging on effort.
Expected output: exactly 2 connected sentences.`.trim(),
  }

  return `You are JaneDuck, a friendly English writing coach for Singapore secondary school students (age 13–15).

## Your Persona
- Warm, honest, never over-the-top. Praise only when genuinely deserved.
- Address the student directly as "you".
- Write in clear, simple English. Singapore-friendly — avoid heavy American slang.
- Keep chat_message to 2–3 short paragraphs at most. Short enough for a middle schooler to read fully.

## Evaluation Process
STEP 1 — SCORE (internal):
Apply the scaffold criteria below. Assign overall_score as an integer 0–10.
Then derive writing_rating: 0–3 → "again", 4–6 → "hard", 7–8 → "good", 9–10 → "easy".

STEP 2 — COACHING (chat_message, English):
- Strength first, then one improvement. ONE main point only — even if there are multiple issues.
- Give a concrete fix example: not "it's wrong" but "try writing: ___".
- Tone by score:
  - 9–10: Genuine celebration. Point out what showed real skill. Hint at master challenge.
  - 7–8: Warm encouragement. One small tweak.
  - 4–6: Acknowledge the try. One clear fix + rewrite example.
  - 0–3: Supportive. Simplify the model, no long error list. Gentle invite to retry.
- End with a forward-looking line ("Want to try again?" / "Ready for the next one?").

${scaffoldCriteria[scaffold]}

## Output format
Return a single JSON object — no markdown, no explanation outside the JSON.
Fields: overall_score, writing_rating, target_word_used, target_word_used_correctly, chat_message, strengths (array of short phrases), weakness_signals (array of short phrases).
strengths and weakness_signals: short natural-language phrases (not enum). Max 3 each. Empty array if none.`
}

function buildUserPrompt(input: EvaluateWritingInput): string {
  const lines: string[] = [
    `Target word: "${input.word}"`,
    `Definition: "${input.definition}"`,
  ]

  if (input.scaffold === "high" && input.starter_used) {
    lines.push(`Sentence starter shown to student: "${input.starter_used}"`)
  }
  if (input.scaffold === "medium" && input.topic_hint) {
    lines.push(`Topic hint shown to student: "${input.topic_hint}"`)
  }
  if (input.scaffold === "low") {
    if (input.topic)            lines.push(`Topic given: "${input.topic}"`)
    if (input.structure_guide)  lines.push(`Structure guide: "${input.structure_guide}"`)
  }

  if (input.previous_attempts && input.previous_attempts.length > 0) {
    lines.push("\nPrevious attempts this session:")
    input.previous_attempts.forEach((a, i) => {
      lines.push(`  [Attempt ${i + 1}] Student wrote: "${a.user_text}"`)
      lines.push(`  [Attempt ${i + 1}] Your feedback: "${a.ai_feedback}"`)
    })
  }

  lines.push(`\nStudent's writing:\n"${input.user_text}"`)
  return lines.join("\n")
}

// ── Main function ─────────────────────────────────────────────

const MAX_RETRIES = 2

export async function evaluateWriting(
  input: EvaluateWritingInput
): Promise<EvaluateWritingOutput> {
  const client = llmClient()
  const model  = modelFor("evaluate")
  const system = buildSystemPrompt(input.scaffold)
  const user   = buildUserPrompt(input)

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user",   content: user   },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name:   "evaluate_writing_output",
            strict: true,
            schema: OUTPUT_SCHEMA,
          },
        },
        temperature: 0.3,   // low temp for consistent scoring
      })

      const raw = response.choices[0]?.message?.content
      if (!raw) throw new Error("Empty response from LLM")

      const parsed = JSON.parse(raw) as EvaluateWritingOutput

      // Override writing_rating with score-derived value (§8-2) to prevent mismatch
      parsed.writing_rating = ratingFromScore(parsed.overall_score)

      return parsed
    } catch (err) {
      const isLastAttempt = attempt === MAX_RETRIES
      if (isLastAttempt) {
        console.error("[evaluate-writing] All retries failed, using fallback:", err)
        return FALLBACK
      }
      console.warn(`[evaluate-writing] Attempt ${attempt + 1} failed, retrying:`, err)
    }
  }

  return FALLBACK
}
