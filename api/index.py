import os
import uuid
import traceback
from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv

# Load env files: .env.local overrides .env (mirrors Next.js precedence).
_root = Path(__file__).parent.parent
load_dotenv(_root / ".env.local", override=False)
load_dotenv(_root / ".env", override=False)
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from langgraph.types import Command
from psycopg_pool import AsyncConnectionPool
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from workflows.graph import build_writing_graph
from models.writing import StartWritingRequest, SubmitWritingRequest, ActionRequest

writing_graph = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global writing_graph
    # Use unpooled (direct) connection for checkpointer — pgbouncer transaction mode
    # can interfere with DDL in setup() and with multi-statement checkpoint operations.
    conninfo = os.environ.get("DATABASE_URL_UNPOOLED") or os.environ["DATABASE_URL"]
    pool = AsyncConnectionPool(
        conninfo=conninfo,
        min_size=1,
        max_size=5,
        kwargs={"autocommit": True, "prepare_threshold": 0},
        open=False,
    )
    await pool.open()
    checkpointer = AsyncPostgresSaver(pool)
    await checkpointer.setup()  # Creates checkpoint tables if not exist; safe to call repeatedly
    writing_graph = build_writing_graph(checkpointer)
    yield
    await pool.close()


app = FastAPI(title="JaneDuck API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


# ── Helpers ───────────────────────────────────────────────────

def _config(thread_id: str) -> dict:
    return {"configurable": {"thread_id": thread_id}}


async def _snapshot(thread_id: str):
    return await writing_graph.aget_state(_config(thread_id))


def _interrupt_value(snap) -> dict | None:
    """Returns the interrupt payload from the paused node, or None if finished."""
    if snap.tasks and snap.tasks[0].interrupts:
        return snap.tasks[0].interrupts[0].value
    return None


def _prompt_context(state: dict) -> dict:
    """Fields the frontend needs to render the writing prompt."""
    return {
        "scaffold":             state.get("current_scaffold"),
        "is_master_challenge":  state.get("is_master_challenge", False),
        "starter_used":         state.get("starter_used"),
        "topic_hint":           state.get("topic_hint"),
        "topic_used":           state.get("topic_used"),
        "structure_guide_used": state.get("structure_guide_used"),
        "introduce_message":    state.get("introduce_message"),
    }


# ── Routes ────────────────────────────────────────────────────

@app.post("/writing/start")
async def start_writing(req: StartWritingRequest):
    """
    Start a new writing session for a card.
    Returns thread_id + the prompt context the frontend needs to show.
    Graph runs until PAUSE 1 (await_user_input).
    """
    thread_id = str(uuid.uuid4())
    initial   = {
        "card_id":       req.card_id,
        "word":          req.word,
        "definition":    req.definition,
        "user_id":       req.user_id,
        "session_id":    req.session_id,
        "mastery_level": req.mastery_level,
    }
    await writing_graph.ainvoke(initial, config=_config(thread_id))

    snap  = await _snapshot(thread_id)
    state = snap.values
    return {
        "thread_id": thread_id,
        "status":    "awaiting_user_text",
        **_prompt_context(state),
    }


@app.post("/writing/submit")
async def submit_writing(req: SubmitWritingRequest):
    """
    Resume with the student's writing.
    Graph runs from validate_input → evaluate_writing → present_feedback,
    then pauses at PAUSE 2 (await_user_action).
    """
    try:
        await writing_graph.ainvoke(
            Command(resume=req.user_text),
            config=_config(req.thread_id),
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, detail={"error": str(e), "type": type(e).__name__})

    snap          = await _snapshot(req.thread_id)
    state         = snap.values
    interrupt_val = _interrupt_value(snap)

    if interrupt_val and interrupt_val.get("event") == "awaiting_user_action":
        return {
            "thread_id":                  req.thread_id,
            "status":                     "awaiting_user_action",
            "overall_score":              state.get("overall_score"),
            "writing_rating":             state.get("writing_rating"),
            "target_word_used":           state.get("target_word_used"),
            "target_word_used_correctly": state.get("target_word_used_correctly"),
            "chat_message":               state.get("chat_message"),
            "strengths":                  state.get("strengths", []),
            "weakness_signals":           state.get("weakness_signals", []),
            "suggested_actions":          state.get("suggested_actions", []),
            "mastery_level_before":       state.get("mastery_level_before"),
            "mastery_level_after":        state.get("mastery_level_after"),
        }

    # Validation failed → back at PAUSE 1
    if interrupt_val and interrupt_val.get("event") == "awaiting_user_text":
        return {
            "thread_id":        req.thread_id,
            "status":           "awaiting_user_text",
            "validation_error": state.get("validation_error"),
            **_prompt_context(state),
        }

    raise HTTPException(500, "Unexpected graph state after submit")


@app.post("/writing/action")
async def choose_action(req: ActionRequest):
    """
    Resume with user's chosen action.
    - next_word → graph ends, returns status "done"
    - try_again / master_challenge → graph pauses at PAUSE 1 again, returns new prompt
    """
    try:
        await writing_graph.ainvoke(
            Command(resume=req.action),
            config=_config(req.thread_id),
        )
    except Exception as e:
        raise HTTPException(500, f"Graph error: {e}")

    snap  = await _snapshot(req.thread_id)
    state = snap.values

    # Graph finished (next_word hit END)
    if not snap.next:
        return {"thread_id": req.thread_id, "status": "done"}

    # Graph paused at PAUSE 1 for the next writing attempt
    return {
        "thread_id": req.thread_id,
        "status":    "awaiting_user_text",
        **_prompt_context(state),
    }


# Vercel Python Function handler.
# api_gateway_base_path strips "/api/py" so FastAPI sees "/writing/start" etc.
# Local dev (uvicorn) ignores this handler entirely.
handler = Mangum(app, api_gateway_base_path="/api/py")
