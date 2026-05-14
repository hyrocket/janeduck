-- JaneDuck Database Schema
-- PostgreSQL (Neon)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. decks
-- ============================================================
CREATE TABLE IF NOT EXISTS decks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  description   TEXT,
  level         INT CHECK (level BETWEEN 1 AND 4),
  card_count    INT DEFAULT 0,
  source        TEXT CHECK (source IN ('janeduck', 'quizlet', 'user')) DEFAULT 'janeduck',
  source_id     TEXT,
  owner_id      UUID,  -- NULL = system deck
  is_public     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. cards
-- ============================================================
CREATE TABLE IF NOT EXISTS cards (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deck_id            UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,

  -- Quizlet compatible
  term               TEXT NOT NULL,
  definition         TEXT NOT NULL,

  -- JaneDuck enriched (nullable)
  part_of_speech     TEXT,
  pronunciation      TEXT,
  collocations       JSONB,           -- ["reluctant to + verb"]
  example_sentences  JSONB,           -- [{sentence, context}]

  -- Phase 2+
  translations       JSONB,           -- {ko: null, zh: null, ms: null}

  -- System
  level              INT CHECK (level BETWEEN 1 AND 4),
  difficulty         INT CHECK (difficulty BETWEEN 1 AND 5),
  tags               JSONB,
  order_in_deck      INT DEFAULT 0,
  source             TEXT CHECK (source IN ('janeduck', 'quizlet', 'user')) DEFAULT 'janeduck',
  source_id          TEXT,

  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON cards(deck_id);

-- ============================================================
-- 3. user_cards (SRS state per user per card)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_cards (
  user_id                UUID NOT NULL,
  card_id                UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, card_id),

  -- Mastery
  mastery_score          FLOAT DEFAULT 0 CHECK (mastery_score BETWEEN 0 AND 1),
  mastery_level          INT DEFAULT 1 CHECK (mastery_level BETWEEN 1 AND 4),

  -- Stats
  review_count           INT DEFAULT 0,
  writing_count          INT DEFAULT 0,
  self_eval_count        INT DEFAULT 0,

  -- SRS (SM-2 variant)
  srs_state              TEXT CHECK (srs_state IN ('new', 'learning', 'review', 'relearning', 'mastered')) DEFAULT 'new',
  ease_factor            FLOAT DEFAULT 2.5 CHECK (ease_factor BETWEEN 1.3 AND 3.0),
  interval_days          INT DEFAULT 0 CHECK (interval_days BETWEEN 0 AND 365),
  previous_interval_days INT DEFAULT 0,
  lapse_count            INT DEFAULT 0,

  -- Timing
  last_reviewed_at       TIMESTAMPTZ,
  next_review_at         TIMESTAMPTZ DEFAULT NOW(),

  -- Last rating
  last_rating            TEXT CHECK (last_rating IN ('again', 'hard', 'good', 'easy')),
  last_rating_source     TEXT CHECK (last_rating_source IN ('writing', 'self_eval')),

  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_cards_user_id ON user_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cards_next_review ON user_cards(user_id, next_review_at);

-- ============================================================
-- 4. writing_attempts
-- scaffold_level 기반 단일 Writing Mode
-- high   = reference_starter 있음 (Echo Writing 스타일)
-- medium = prompt_topic만 있고 starter 없음
-- low    = 자유 작문 (Free Writing)
-- ============================================================
CREATE TABLE IF NOT EXISTS writing_attempts (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL,
  card_id              UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,

  -- Scaffold
  scaffold_level       TEXT CHECK (scaffold_level IN ('high', 'medium', 'low')) NOT NULL,
  reference_starter    TEXT,           -- high scaffold: 학생에게 보여주는 모범/예시 문장
  prompt_topic         TEXT,           -- 학생에게 준 주제/상황 프롬프트

  -- Student's work
  user_sentence        TEXT NOT NULL,

  -- AI evaluation
  ai_score             INT CHECK (ai_score BETWEEN 1 AND 10),
  ai_feedback          JSONB,  -- {feedback_text, improved_version, issues: [{type, original, suggested}]}
  used_target_word     BOOLEAN DEFAULT false,
  meaning_correct      BOOLEAN DEFAULT false,

  -- Rewriting tracking
  attempt_number       INT DEFAULT 1,
  parent_attempt_id    UUID REFERENCES writing_attempts(id),

  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_writing_attempts_user_card ON writing_attempts(user_id, card_id);

-- ============================================================
-- 5. study_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS study_sessions (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                UUID NOT NULL,
  deck_id                UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  mode                   TEXT CHECK (mode IN ('quick_review', 'writing')),
  status                 TEXT CHECK (status IN ('in_progress', 'completed', 'abandoned')) DEFAULT 'in_progress',

  -- Session stats
  cards_studied_count    INT DEFAULT 0,
  self_evaluations_count INT DEFAULT 0,
  writings_completed     INT DEFAULT 0,

  started_at             TIMESTAMPTZ DEFAULT NOW(),
  last_active_at         TIMESTAMPTZ DEFAULT NOW(),
  ended_at               TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON study_sessions(user_id);

-- ============================================================
-- Updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER decks_updated_at
  BEFORE UPDATE ON decks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_cards_updated_at
  BEFORE UPDATE ON user_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
