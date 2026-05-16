-- Migration 002: Remaining renames, constraint fixes, type changes
-- Covers items missed by 001 due to comment-filter bug

-- ── cards: rename term → word ──────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cards' AND column_name = 'term'
  ) THEN
    ALTER TABLE cards RENAME COLUMN term TO word;
  END IF;
END $$;

-- ── user_cards: fix mastery_level constraint 1~4 → 0~5 ────────────────────────
ALTER TABLE user_cards DROP CONSTRAINT IF EXISTS user_cards_mastery_level_check;
ALTER TABLE user_cards ADD CONSTRAINT user_cards_mastery_level_check
  CHECK (mastery_level BETWEEN 0 AND 5);

-- ── user_cards: rename writing_count → writing_attempts_count ─────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_cards' AND column_name = 'writing_count'
  ) THEN
    ALTER TABLE user_cards RENAME COLUMN writing_count TO writing_attempts_count;
  END IF;
END $$;

-- ── user_cards: add last_self_eval_rating (may have been missed) ───────────────
ALTER TABLE user_cards ADD COLUMN IF NOT EXISTS last_self_eval_rating TEXT
  CHECK (last_self_eval_rating IN ('dont_know', 'unsure', 'know', 'know_well'));

-- ── writing_attempts: rename scaffold_level → scaffold_used ───────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'writing_attempts' AND column_name = 'scaffold_level'
  ) THEN
    ALTER TABLE writing_attempts RENAME COLUMN scaffold_level TO scaffold_used;
  END IF;
END $$;

-- ── writing_attempts: fix ai_score constraint 1~10 → 0~10 ─────────────────────
ALTER TABLE writing_attempts DROP CONSTRAINT IF EXISTS writing_attempts_ai_score_check;
ALTER TABLE writing_attempts ADD CONSTRAINT writing_attempts_ai_score_check
  CHECK (ai_score BETWEEN 0 AND 10);

-- ── writing_attempts: ai_feedback JSONB → TEXT ────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'writing_attempts'
      AND column_name = 'ai_feedback'
      AND data_type = 'jsonb'
  ) THEN
    ALTER TABLE writing_attempts ALTER COLUMN ai_feedback TYPE TEXT
      USING (ai_feedback::text);
  END IF;
END $$;

-- ── writing_attempts: add session_id ──────────────────────────────────────────
ALTER TABLE writing_attempts ADD COLUMN IF NOT EXISTS session_id UUID
  REFERENCES study_sessions(id);

CREATE INDEX IF NOT EXISTS idx_writing_attempts_session ON writing_attempts(session_id);

-- ── study_sessions: add session_type ──────────────────────────────────────────
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS session_type TEXT
  CHECK (session_type IN ('mixed', 'starred_only', 'weak_only')) DEFAULT 'mixed';
