// ── Enums ────────────────────────────────────────────────────
export type DeckSource = "janeduck" | "quizlet" | "user"
export type SrsState = "new" | "learning" | "review" | "relearning" | "mastered"
export type SrsRating = "again" | "hard" | "good" | "easy"
export type RatingSource = "writing" | "self_eval"
export type StudyMode = "quick_review" | "writing"
export type SessionStatus = "in_progress" | "completed" | "abandoned"
export type ScaffoldLevel = "high" | "medium" | "low"

// ── DB Models ─────────────────────────────────────────────────
export interface Deck {
  id: string
  name: string
  description: string | null
  level: number
  card_count: number
  source: DeckSource
  source_id: string | null
  owner_id: string | null
  is_public: boolean
  created_at: Date
  updated_at: Date
}

export interface Card {
  id: string
  deck_id: string
  term: string
  definition: string
  part_of_speech: string | null
  pronunciation: string | null
  collocations: string[] | null
  example_sentences: { sentence: string; context: string }[] | null
  translations: Record<string, string | null> | null
  level: number | null
  difficulty: number | null
  tags: string[] | null
  order_in_deck: number
  source: DeckSource
  source_id: string | null
  created_at: Date
}

export interface UserCard {
  user_id: string
  card_id: string
  mastery_score: number
  mastery_level: number
  review_count: number
  writing_count: number
  self_eval_count: number
  srs_state: SrsState
  ease_factor: number
  interval_days: number
  previous_interval_days: number
  lapse_count: number
  last_reviewed_at: Date | null
  next_review_at: Date
  last_rating: SrsRating | null
  last_rating_source: RatingSource | null
  created_at: Date
  updated_at: Date
}

export interface AiFeedback {
  feedback_text: string
  improved_version: string
  issues: { type: string; original: string; suggested: string }[]
}

export interface WritingAttempt {
  id: string
  user_id: string
  card_id: string
  scaffold_level: ScaffoldLevel
  reference_starter: string | null  // high scaffold: 모범/예시 문장
  prompt_topic: string | null       // 주제/상황 프롬프트
  user_sentence: string
  ai_score: number | null
  ai_feedback: AiFeedback | null
  used_target_word: boolean
  meaning_correct: boolean
  attempt_number: number
  parent_attempt_id: string | null
  created_at: Date
}

export interface StudySession {
  id: string
  user_id: string
  deck_id: string
  mode: StudyMode | null
  status: SessionStatus
  cards_studied_count: number
  self_evaluations_count: number
  writings_completed: number
  started_at: Date
  last_active_at: Date
  ended_at: Date | null
}

// ── NextAuth session extension ────────────────────────────────
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name: string | null
      email: string | null
      image: string | null
    }
  }
}
