// ── Enums ────────────────────────────────────────────────────
export type DeckSource = "janeduck" | "quizlet" | "user"
export type SrsState = "new" | "learning" | "review" | "relearning" | "mastered"
export type SrsRating = "again" | "hard" | "good" | "easy"
export type RatingSource = "writing" | "self_eval"
export type StudyMode = "quick_review" | "writing"
export type SessionStatus = "in_progress" | "completed" | "abandoned"
export type SessionType = "mixed" | "starred_only" | "weak_only"
export type ScaffoldLevel = "high" | "medium" | "low"
export type SelfEvalRating = "dont_know" | "unsure" | "know" | "know_well"
export type DifficultyBand = "common" | "uncommon" | "advanced"

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
  word: string
  definition: string
  part_of_speech: string | null
  pronunciation: string | null
  collocations: string[] | null
  example_sentences: { sentence: string; context: string }[] | null
  starter_templates: string[] | null   // HIGH scaffold: pre-generated starters
  topic_hints: string[] | null         // HIGH scaffold: topic hints
  translations: Record<string, string | null> | null
  level: number | null
  difficulty_band: DifficultyBand | null
  tags: string[] | null
  order_in_deck: number
  source: DeckSource
  source_id: string | null
  created_at: Date
}

export interface UserCard {
  user_id: string
  card_id: string

  // Mastery signal (0=untouched, 1~2=familiar, 3~4=productive, 5=mastered)
  mastery_score: number
  mastery_level: number

  // Self-evaluation signal (independent from mastery)
  last_self_eval_rating: SelfEvalRating | null
  last_self_eval_at: Date | null

  // Writing signal
  writing_attempts_count: number
  last_writing_score: number | null
  last_writing_at: Date | null
  recent_scores: number[]            // last 3 ai_scores

  // Scaffold state
  current_scaffold: ScaffoldLevel

  // Star
  is_starred: boolean
  starred_at: Date | null

  // Stats
  review_count: number
  self_eval_count: number

  // SRS (Hybrid SM-2)
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

export interface WritingAttempt {
  id: string
  user_id: string
  card_id: string
  session_id: string | null

  scaffold_used: ScaffoldLevel
  is_master_challenge: boolean

  reference_starter: string | null     // HIGH: starter sentence shown to student
  prompt_topic: string | null          // topic/situation prompt given to student
  topic_used: string | null            // LOW: topic from pool
  structure_guide_used: string | null  // LOW: structure guide from pool

  user_text: string

  // AI evaluation (§8 groups A/B/C)
  ai_score: number | null
  ai_feedback: string | null           // chat_message
  ai_strengths: string[] | null
  ai_weakness_signals: string[] | null
  writing_rating: SrsRating | null
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
  session_type: SessionType
  status: SessionStatus
  cards_studied_count: number
  self_evaluations_count: number
  writings_completed: number
  started_at: Date
  last_active_at: Date
  ended_at: Date | null
  created_at: Date
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
