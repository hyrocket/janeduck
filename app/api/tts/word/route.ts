import { NextResponse } from "next/server"
import TextToSpeech from "@google-cloud/text-to-speech"
import { put } from "@vercel/blob"
import { sql } from "@/lib/db"

const VOICE_ID = process.env.TTS_VOICE_ID!
const LANGUAGE_CODE = process.env.TTS_LANGUAGE_CODE ?? "en-GB"
const SPEAKING_RATE = 0.95

function normalize(word: string): string {
  return word.trim().toLowerCase()
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const raw: string = body?.word ?? ""
  if (!raw.trim()) {
    return NextResponse.json({ error: "word required" }, { status: 400 })
  }

  const word = normalize(raw)

  // 1. Cache hit
  const cached = await sql`SELECT audio_url FROM word_audio WHERE word = ${word}`
  if (cached.length > 0) {
    return NextResponse.json({ audio_url: cached[0].audio_url })
  }

  // 2. Generate via Google Cloud TTS → upload → cache
  try {
    const credentials = JSON.parse(
      Buffer.from(process.env.GOOGLE_TTS_CREDENTIALS!, "base64").toString()
    )
    const client = new TextToSpeech.TextToSpeechClient({ credentials })

    const [response] = await client.synthesizeSpeech({
      input: { text: word },
      voice: { languageCode: LANGUAGE_CODE, name: VOICE_ID },
      audioConfig: { audioEncoding: "MP3", pitch: 0, speakingRate: SPEAKING_RATE },
    })

    const raw = response.audioContent
    if (!raw) throw new Error("TTS response returned empty audioContent")
    // SDK returns Uint8Array (gRPC) or base64 string (REST) depending on transport
    const audioContent = typeof raw === "string"
      ? Buffer.from(raw, "base64")
      : Buffer.from(raw as Uint8Array)

    // 3. Upload to Vercel Blob
    const blob = await put(`words/${encodeURIComponent(word)}.mp3`, audioContent, {
      access: "public",
      contentType: "audio/mpeg",
    })

    // 4. Insert — ON CONFLICT DO NOTHING handles concurrent requests
    await sql`
      INSERT INTO word_audio (word, audio_url, voice_id)
      VALUES (${word}, ${blob.url}, ${VOICE_ID})
      ON CONFLICT (word) DO NOTHING
    `

    // 5. SELECT back to handle race condition (another request may have inserted first)
    const final = await sql`SELECT audio_url FROM word_audio WHERE word = ${word}`
    return NextResponse.json({ audio_url: final[0].audio_url })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[TTS] generation failed:", msg)
    return NextResponse.json({ error: "TTS unavailable, try again", detail: msg }, { status: 503 })
  }
}
