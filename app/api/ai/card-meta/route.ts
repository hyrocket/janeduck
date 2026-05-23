import { auth } from "@/auth"
import { llmClient, modelFor } from "@/lib/ai/client"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const word: string = (body.word ?? "").trim()
  const definition: string = (body.definition ?? "").trim()
  if (!word || !definition) {
    return NextResponse.json({ error: "word and definition are required" }, { status: 400 })
  }

  const client = llmClient()
  const model = modelFor("card_meta")

  const completion = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a vocabulary assistant for Singapore middle school students (Sec 1–4).
Given an English word and its definition, generate vocabulary card metadata.

Return a JSON object with exactly these fields:
- "pronunciation": IPA transcription string, e.g. "/rɪˈlʌktənt/"
- "example_sentences": array of 2 objects with keys "sentence" (string) and "context" (string, e.g. "at school"), using the word naturally in teen contexts
- "collocations": array of 2–3 common collocations, e.g. ["reluctant to + verb", "be reluctant about"]
- "starter_templates": array of 2 fill-in-the-blank sentences for writing practice, e.g. ["My friend was reluctant to ___ when ___"]
- "topic_hints": array of 2–3 relatable topics, e.g. ["school", "friendship"]`,
      },
      {
        role: "user",
        content: `Word: ${word}\nDefinition: ${definition}`,
      },
    ],
  })

  const raw = completion.choices[0].message.content ?? "{}"
  try {
    const meta = JSON.parse(raw)
    return NextResponse.json(meta)
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 })
  }
}
