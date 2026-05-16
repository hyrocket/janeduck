-- Migration 001: Update schema per DESIGN_DECISIONS.md §12
-- Run once against existing Neon database (apply_migration.ts)

-- ── cards ──────────────────────────────────────────────────────────────────────
ALTER TABLE cards RENAME COLUMN term TO word;

ALTER TABLE cards DROP COLUMN IF EXISTS difficulty;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS difficulty_band TEXT
  CHECK (difficulty_band IN ('common', 'uncommon', 'advanced'));

ALTER TABLE cards ADD COLUMN IF NOT EXISTS starter_templates JSONB;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS topic_hints JSONB;

-- ── user_cards ─────────────────────────────────────────────────────────────────
-- mastery_level: widen range 1~4 → 0~5, default 1 → 0
ALTER TABLE user_cards DROP CONSTRAINT IF EXISTS user_cards_mastery_level_check;
ALTER TABLE user_cards ALTER COLUMN mastery_level SET DEFAULT 0;
ALTER TABLE user_cards ADD CONSTRAINT user_cards_mastery_level_check
  CHECK (mastery_level BETWEEN 0 AND 5);

-- rename writing_count → writing_attempts_count
ALTER TABLE user_cards RENAME COLUMN writing_count TO writing_attempts_count;

-- new columns
ALTER TABLE user_cards ADD COLUMN IF NOT EXISTS last_self_eval_rating TEXT
  CHECK (last_self_eval_rating IN ('dont_know', 'unsure', 'know', 'know_well'));
ALTER TABLE user_cards ADD COLUMN IF NOT EXISTS last_self_eval_at TIMESTAMPTZ;
ALTER TABLE user_cards ADD COLUMN IF NOT EXISTS recent_scores JSONB DEFAULT '[]';
ALTER TABLE user_cards ADD COLUMN IF NOT EXISTS last_writing_score INT;
ALTER TABLE user_cards ADD COLUMN IF NOT EXISTS last_writing_at TIMESTAMPTZ;
ALTER TABLE user_cards ADD COLUMN IF NOT EXISTS current_scaffold TEXT
  CHECK (current_scaffold IN ('high', 'medium', 'low')) DEFAULT 'high';
ALTER TABLE user_cards ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT false;
ALTER TABLE user_cards ADD COLUMN IF NOT EXISTS starred_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_cards_starred ON user_cards(user_id, is_starred);

-- ── writing_attempts ───────────────────────────────────────────────────────────
ALTER TABLE writing_attempts RENAME COLUMN scaffold_level TO scaffold_used;
ALTER TABLE writing_attempts RENAME COLUMN user_sentence TO user_text;

-- ai_score: widen range 1~10 → 0~10
ALTER TABLE writing_attempts DROP CONSTRAINT IF EXISTS writing_attempts_ai_score_check;
ALTER TABLE writing_attempts ADD CONSTRAINT writing_attempts_ai_score_check
  CHECK (ai_score BETWEEN 0 AND 10);

-- ai_feedback: JSONB → TEXT (chat_message)
ALTER TABLE writing_attempts ALTER COLUMN ai_feedback TYPE TEXT USING (ai_feedback::text);

-- new columns
ALTER TABLE writing_attempts ADD COLUMN IF NOT EXISTS session_id UUID
  REFERENCES study_sessions(id);
ALTER TABLE writing_attempts ADD COLUMN IF NOT EXISTS is_master_challenge BOOLEAN DEFAULT false;
ALTER TABLE writing_attempts ADD COLUMN IF NOT EXISTS topic_used TEXT;
ALTER TABLE writing_attempts ADD COLUMN IF NOT EXISTS structure_guide_used TEXT;
ALTER TABLE writing_attempts ADD COLUMN IF NOT EXISTS ai_strengths JSONB;
ALTER TABLE writing_attempts ADD COLUMN IF NOT EXISTS ai_weakness_signals JSONB;
ALTER TABLE writing_attempts ADD COLUMN IF NOT EXISTS writing_rating TEXT
  CHECK (writing_rating IN ('again', 'hard', 'good', 'easy'));

CREATE INDEX IF NOT EXISTS idx_writing_attempts_session ON writing_attempts(session_id);

-- ── study_sessions ─────────────────────────────────────────────────────────────
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS session_type TEXT
  CHECK (session_type IN ('mixed', 'starred_only', 'weak_only')) DEFAULT 'mixed';
