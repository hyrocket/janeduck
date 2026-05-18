# JaneDuck 🦆

> AI Micro Writing Coach for English vocabulary learning — built for secondary school students in Singapore.

**Learn words by writing with them, not just memorizing them.**
JaneDuck gives AI feedback on short sentences you write using target vocabulary — turning passive review into active production.

---

## What it does

**Quick Review** — Flashcard warm-up. Flip cards, rate yourself, star words you want to revisit.

**Writing Mode** — Write a sentence using the target word. JaneDuck (AI coach) gives structured feedback: did you use the word correctly? What's strong? What to improve? Then choose to try again, attempt a harder scaffold, or move to the next word.

Three scaffold levels adapt to your mastery:
| Level | Mode | What you do |
|---|---|---|
| 🚀 Guided Writing | Complete a sentence starter | Fill in the blank |
| 🚀🚀 Practice Writing | Write freely with a topic hint | One sentence |
| 🚀🚀🚀 Extended Writing | Open challenge | Two connected sentences |

---

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind CSS |
| Backend | FastAPI · LangGraph (Python) |
| Database | Neon PostgreSQL (pooled) |
| Auth | NextAuth.js v5 · Google OAuth |
| LLM | OpenAI gpt-4o-mini / gpt-4.1-mini |
| Deploy | Vercel (frontend + Python Functions) |

---

## Running Locally

### Prerequisites
- Node.js 18+
- Python 3.13
- A `.env.local` file with the required environment variables (see below)

### Frontend (Next.js)

```bash
npm install
npm run dev
```

Opens at `http://localhost:3000`.

### Backend (FastAPI + LangGraph)

```bash
cd api
python -m venv .venv
.venv\Scripts\Activate.ps1   # Windows
pip install -r requirements.txt
python run.py
```

Runs at `http://localhost:8000`. The `run.py` wrapper forces `SelectorEventLoop` for Windows + psycopg3 compatibility.

### Required environment variables (`.env.local`)

```
DATABASE_URL=
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
OPENAI_API_KEY=
```

---

## Project Structure

```
janeduck/
├── app/                        # Next.js App Router
│   ├── (auth)/login/           # Google OAuth login page
│   ├── (learn)/quick-review/   # Flashcard mode
│   ├── (learn)/writing/        # Writing mode (messenger UI)
│   ├── decks/                  # Deck selection
│   └── api/                    # Next.js API routes → proxy to Python
├── api/                        # FastAPI + LangGraph (Python)
│   ├── index.py                # FastAPI app entry point
│   ├── workflows/              # LangGraph writing graph + nodes
│   └── requirements.txt
├── components/Card/            # FlashCard, SelfEvalButtons, etc.
├── lib/
│   ├── srs/                    # Mastery-based review priority (SRS_SPEC.md)
│   └── db/                     # Neon DB client + schema
├── docs/devlog/                # Development log
├── DESIGN_DECISIONS.md         # System design spec (single source of truth)
├── SRS_SPEC.md                 # Review priority algorithm spec
└── CLAUDE.md                   # AI coding guidelines
```

---

## Design Notes

- **Mastery is earned through writing**, not self-rating. `mastery_level` (0–5) only increases via Writing Mode.
- **SRS queue** combines new cards, review cards, and starred cards using a ratio that shifts as the deck is learned. See `SRS_SPEC.md`.
- **LangGraph** handles only the Writing Mode conversation graph (stateful, multi-turn). Quick Review is plain FastAPI.
- **Checkpointer**: Production uses `AsyncPostgresSaver` (Neon) so conversation state survives Vercel serverless cold starts.

---

## License

MIT
