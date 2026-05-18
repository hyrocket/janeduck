# JaneDuck 🦆

> AI Micro Writing Coach for English vocabulary learning.

**Learn words by writing with them, not just memorizing them.**

JaneDuck gives AI feedback on short sentences you write using target vocabulary — turning passive review into active production. Built as a graduation project for the Nomad Coders AI Engineer club.

🔗 **Live:** [janeduck.vercel.app](https://janeduck.vercel.app)

---

## What it does

**Quick Review** — Flashcard warm-up. Flip cards, rate yourself, star words to revisit.

**Writing Mode** — Write a sentence using the target word. JaneDuck, an AI coach, gives structured feedback: was the word used correctly, what's strong, and what to improve. You can then try again, take on a harder scaffold, or move to the next word.

Three scaffold levels adapt to your mastery of each word:

| Scaffold | What you do |
|---|---|
| Guided Writing | Fill in the blank of a sentence starter |
| Practice Writing | Write one sentence freely, with a topic hint |
| Extended Writing | Write two connected sentences — open challenge |

Mastery is **earned through writing**, not self-rating — a word's mastery level only rises when you write with it well.

---

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind CSS |
| Backend | FastAPI (Python) |
| AI Workflow | LangGraph — powers the multi-turn Writing Mode conversation |
| Database | Neon PostgreSQL |
| Auth | NextAuth.js v5 · Google OAuth |
| LLM | OpenAI gpt-4o-mini · gpt-4.1-mini |
| Deployment | Vercel |

---

## Design Notes

- **Writing-first mastery** — `mastery_level` (0–5) increases only through Writing Mode, not flashcard self-rating. Writing is the real test of knowing a word.
- **Adaptive scaffolding** — the writing task adjusts to each word's mastery level, from filling a blank to open two-sentence writing.
- **LangGraph for Writing Mode only** — the stateful, multi-turn coaching conversation runs on a LangGraph workflow. Quick Review is plain FastAPI.
- **Serverless-ready state** — the LangGraph checkpointer uses Neon Postgres so conversation state survives Vercel's serverless cold starts.

---

JaneDuck started as a personal project — to help a secondary school student who knew word meanings but struggled to actually use them in writing.
