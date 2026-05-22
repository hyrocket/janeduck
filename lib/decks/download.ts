import { sql } from "@/lib/db"

export class DuplicateNameError extends Error {
  constructor(public deckName: string) {
    super(`Deck named "${deckName}" already exists`)
  }
}

export async function copyDeckToUser(
  libraryDeckId: string,
  userId: string,
  customName?: string,
): Promise<string> {
  const srcRows = await sql`
    SELECT name, description, level, card_count, source
    FROM decks
    WHERE id = ${libraryDeckId} AND deck_type = 'library'
    LIMIT 1
  `
  if (srcRows.length === 0) throw new Error("Library deck not found")

  const src = srcRows[0]
  const deckName = customName ?? (src.name as string)

  const dup = await sql`
    SELECT id FROM decks
    WHERE owner_id = ${userId} AND deck_type = 'user' AND name = ${deckName}
    LIMIT 1
  `
  if (dup.length > 0) throw new DuplicateNameError(deckName)

  const newDeckRows = await sql`
    INSERT INTO decks (name, description, level, card_count, source, owner_id, deck_type, is_default, is_public)
    VALUES (
      ${deckName},
      ${src.description as string | null},
      ${src.level as number},
      ${src.card_count as number},
      ${src.source as string},
      ${userId},
      'user',
      false,
      false
    )
    RETURNING id
  `
  const newDeckId = newDeckRows[0].id as string

  await sql`
    INSERT INTO cards (
      deck_id, word, definition, part_of_speech, pronunciation,
      collocations, example_sentences, starter_templates, topic_hints,
      translations, level, difficulty_band, tags, order_in_deck, source, source_id
    )
    SELECT
      ${newDeckId}, word, definition, part_of_speech, pronunciation,
      collocations, example_sentences, starter_templates, topic_hints,
      translations, level, difficulty_band, tags, order_in_deck, source, source_id
    FROM cards
    WHERE deck_id = ${libraryDeckId}
  `

  return newDeckId
}
