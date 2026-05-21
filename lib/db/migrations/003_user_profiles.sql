-- user_profiles: stores display_name and onboarding state
-- user_id = googleSubToUUID(profile.sub) — same value as user_cards.user_id

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id         UUID PRIMARY KEY,
  display_name    TEXT,
  onboarding_done BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
