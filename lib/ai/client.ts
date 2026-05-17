import OpenAI from "openai"

// Per-callsite model keys — §11-1. Callsite코드는 모델 문자열을 직접 모름.
export type LlmCallsite = "evaluate" | "explain" | "card_meta"

const MODEL_DEFAULTS: Record<LlmCallsite, string> = {
  evaluate:  "gpt-4.1-mini",
  explain:   "gpt-4o-mini",
  card_meta: "gpt-4o-mini",
}

const MODEL_ENV: Record<LlmCallsite, string> = {
  evaluate:  "LLM_MODEL_EVALUATE",
  explain:   "LLM_MODEL_EXPLAIN",
  card_meta: "LLM_MODEL_CARD_META",
}

export function modelFor(callsite: LlmCallsite): string {
  return process.env[MODEL_ENV[callsite]] ?? MODEL_DEFAULTS[callsite]
}

let _client: OpenAI | null = null

export function llmClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set")
    _client = new OpenAI({ apiKey })
  }
  return _client
}
