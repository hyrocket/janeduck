import { neon } from "@neondatabase/serverless"
import OpenAI from "openai"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const DATABASE_URL = process.env.DATABASE_URL
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

if (!DATABASE_URL) { console.error("❌ DATABASE_URL not set"); process.exit(1) }
if (!OPENAI_API_KEY) { console.error("❌ OPENAI_API_KEY not set"); process.exit(1) }

const sql = neon(DATABASE_URL)
const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

interface CardRow {
  id: string
  word: string
  definition: string
  part_of_speech: string | null
  example_sentences: { sentence: string; context: string }[] | null
}

async function enrichCard(card: CardRow): Promise<{ starter_templates: string[]; topic_hints: string[] }> {
  const example = card.example_sentences?.[0]?.sentence ?? ""

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: 300,
    messages: [
      {
        role: "system",
        content: `You help generate vocabulary learning content for Singapore Secondary 2 students (ages 13-14).

Return JSON with exactly these two keys:
- "starter_templates": array of 2-3 sentence starters. Each starter contains "___" as a placeholder where the target word belongs. The student will replace "___" with the target word and complete the sentence. Keep starters natural, teen-appropriate, and varied in context (different situations).
- "topic_hints": array of 3-5 short topic labels (1-3 words each) representing everyday situations where this word naturally comes up for a teenager.

Example output for "resilience":
{
  "starter_templates": [
    "She showed real ___ when ___.",
    "It takes ___ to ___.",
    "After failing the test, I learned that ___ means ___."
  ],
  "topic_hints": ["school life", "sports", "friendships", "overcoming failure"]
}`
      },
      {
        role: "user",
        content: `Word: "${card.word}"
Part of speech: ${card.part_of_speech ?? "unknown"}
Definition: ${card.definition}${example ? `\nExample: ${example}` : ""}`
      }
    ]
  })

  const raw = res.choices[0].message.content
  if (!raw) throw new Error("empty response")

  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed.starter_templates) || !Array.isArray(parsed.topic_hints)) {
    throw new Error(`unexpected shape: ${raw}`)
  }

  return {
    starter_templates: parsed.starter_templates.slice(0, 3),
    topic_hints: parsed.topic_hints.slice(0, 5),
  }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  const cards = await sql`
    SELECT id, word, definition, part_of_speech, example_sentences
    FROM cards
    WHERE starter_templates IS NULL
    ORDER BY order_in_deck
  ` as CardRow[]

  const total = cards.length
  console.log(`🔍 ${total} cards to enrich`)
  if (total === 0) { console.log("✅ All cards already enriched."); return }

  const BATCH = 5
  let done = 0
  let failed = 0

  for (let i = 0; i < cards.length; i += BATCH) {
    const batch = cards.slice(i, i + BATCH)

    await Promise.all(batch.map(async (card) => {
      try {
        const { starter_templates, topic_hints } = await enrichCard(card)
        await sql`
          UPDATE cards
          SET starter_templates = ${JSON.stringify(starter_templates)}::jsonb,
              topic_hints       = ${JSON.stringify(topic_hints)}::jsonb
          WHERE id = ${card.id}
        `
        done++
        console.log(`  [${done + failed}/${total}] ✅ ${card.word}`)
      } catch (err) {
        failed++
        console.error(`  [${done + failed}/${total}] ❌ ${card.word}: ${err}`)
      }
    }))

    if (i + BATCH < cards.length) await sleep(300)
  }

  console.log(`\n✅ Done — ${done} enriched, ${failed} failed`)
}

main().catch(err => { console.error("❌ Fatal:", err); process.exit(1) })
