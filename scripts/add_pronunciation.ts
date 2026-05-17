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

interface CardRow { id: string; word: string; part_of_speech: string | null }

async function getPronunciation(card: CardRow): Promise<string> {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 60,
    messages: [
      {
        role: "system",
        content: `Return JSON with one key "ipa": the standard IPA pronunciation of the given English word, enclosed in forward slashes. Example: {"ipa": "/rɪˈzɪliəns/"}. Use British English IPA. Keep it concise.`
      },
      {
        role: "user",
        content: `Word: "${card.word}" (${card.part_of_speech ?? "unknown"})`
      }
    ]
  })

  const raw = res.choices[0].message.content
  if (!raw) throw new Error("empty response")
  const parsed = JSON.parse(raw)
  if (typeof parsed.ipa !== "string") throw new Error(`unexpected shape: ${raw}`)
  return parsed.ipa
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  const cards = await sql`
    SELECT id, word, part_of_speech
    FROM cards
    WHERE pronunciation IS NULL
    ORDER BY order_in_deck
  ` as CardRow[]

  const total = cards.length
  console.log(`🔍 ${total} cards need pronunciation`)
  if (total === 0) { console.log("✅ All cards already have pronunciation."); return }

  const BATCH = 8
  let done = 0
  let failed = 0

  for (let i = 0; i < cards.length; i += BATCH) {
    const batch = cards.slice(i, i + BATCH)

    await Promise.all(batch.map(async (card) => {
      try {
        const ipa = await getPronunciation(card)
        await sql`UPDATE cards SET pronunciation = ${ipa} WHERE id = ${card.id}`
        done++
        console.log(`  [${done + failed}/${total}] ✅ ${card.word} → ${ipa}`)
      } catch (err) {
        failed++
        console.error(`  [${done + failed}/${total}] ❌ ${card.word}: ${err}`)
      }
    }))

    if (i + BATCH < cards.length) await sleep(200)
  }

  console.log(`\n✅ Done — ${done} updated, ${failed} failed`)
}

main().catch(err => { console.error("❌ Fatal:", err); process.exit(1) })
