CREATE TABLE IF NOT EXISTS word_audio (
  word       TEXT PRIMARY KEY,
  audio_url  TEXT NOT NULL,
  voice_id   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
