import { neon } from "@neondatabase/serverless"
import { readFileSync } from "fs"
import { join } from "path"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL || DATABASE_URL.includes("user:password")) {
  console.error("❌ DATABASE_URL not set in .env.local")
  process.exit(1)
}

const dataFile = process.argv[2]
if (!dataFile) {
  console.error("Usage: npx tsx scripts/seed_deck.ts <data-file>")
  console.error("Example: npx tsx scripts/seed_deck.ts data/deck_sec2_advanced.json")
  process.exit(1)
}

const sql = neon(DATABASE_URL)

interface CardData {
  word: string
  definition: string
  part_of_speech?: string
  difficulty_band?: string
  example_sentences?: { sentence: string; context: string }[]
  starter_templates?: string[]
  topic_hints?: string[]
  collocations?: string[]
  tags?: string[]
  order_in_deck: number
}

interface DeckData {
  deck: {
    name: string
    description: string
    level: number
    source: string
    is_public: boolean
  }
  cards: CardData[]
}

async function seed() {
  const raw = readFileSync(join(process.cwd(), dataFile), "utf-8")
  const data: DeckData = JSON.parse(raw)

  console.log(`🌱 Seeding: "${data.deck.name}" (${data.cards.length} cards)`)

  // check if deck already exists
  const existing = await sql.query(
    `SELECT id FROM decks WHERE name = $1 LIMIT 1`,
    [data.deck.name]
  ) as { id: string }[]

  if (existing.length > 0) {
    console.log(`⚠️  Deck "${data.deck.name}" already exists (id: ${existing[0].id}). Skipping.`)
    console.log(`   To re-seed, delete the deck first.`)
    process.exit(0)
  }

  // insert deck
  const deckResult = await sql.query(
    `INSERT INTO decks (name, description, level, card_count, source, is_public)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      data.deck.name,
      data.deck.description,
      data.deck.level,
      data.cards.length,
      data.deck.source,
      data.deck.is_public,
    ]
  ) as { id: string }[]
  const deckId = deckResult[0].id
  console.log(`  ✅ Deck created: ${deckId}`)

  // insert cards
  let inserted = 0
  for (const card of data.cards) {
    await sql.query(
      `INSERT INTO cards (
        deck_id, word, definition, part_of_speech,
        example_sentences, starter_templates, topic_hints,
        collocations, difficulty_band, tags,
        level, order_in_deck, source
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        deckId,
        card.word,
        card.definition,
        card.part_of_speech ?? null,
        card.example_sentences ? JSON.stringify(card.example_sentences) : null,
        card.starter_templates ? JSON.stringify(card.starter_templates) : null,
        card.topic_hints ? JSON.stringify(card.topic_hints) : null,
        card.collocations ? JSON.stringify(card.collocations) : null,
        card.difficulty_band ?? null,
        card.tags ? JSON.stringify(card.tags) : null,
        data.deck.level,
        card.order_in_deck,
        data.deck.source,
      ]
    )
    inserted++
  }

  console.log(`  ✅ ${inserted} cards inserted`)
  console.log(`\n✅ Seed complete — deck id: ${deckId}`)
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err)
  process.exit(1)
})
