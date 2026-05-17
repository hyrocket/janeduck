import os
import uuid
import traceback
from pathlib import Path
from dotenv import load_dotenv

# Load env files: .env.local overrides .env (mirrors Next.js precedence).
_root = Path(__file__).parent.parent
load_dotenv(_root / ".env.local", override=False)
load_dotenv(_root / ".env", override=False)
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from a2wsgi import ASGIMiddleware
from langgraph.types import Command
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from workflows.graph import build_writing_graph
from models.writing import StartWritingRequest, SubmitWritingRequest, ActionRequest

fastapi_app = FastAPI(title="JaneDuck API")

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://janeduck.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _conninfo() -> str:
    return os.environ.get("DATABASE_URL_UNPOOLED") or os.environ["DATABASE_URL"]


def _config(thread_id: str) -> dict:
    return {"configurable": {"thread_id": thread_id}}


def _interrupt_value(snap) -> dict | None:
    if snap.tasks and snap.tasks[0].interrupts:
        return snap.tasks[0].interrupts[0].value
    return None


def _prompt_context(state: dict) -> dict:
    return {
        "scaffold":             state.get("current_scaffold"),
        "is_master_challenge":  state.get("is_master_challenge", False),
        "starter_used":         state.get("starter_used"),
        "topic_hint":           state.get("topic_hint"),
        "topic_used":           state.get("topic_used"),
        "structure_guide_used": state.get("structure_guide_used"),
        "introduce_message":    state.get("introduce_message"),
    }


@fastapi_app.get("/health")
def health():
    return {"status": "ok"}


@fastapi_app.post("/writing/start")
async def start_writing(req: StartWritingRequest):
    async with AsyncPostgresSaver.from_conn_string(_conninfo()) as checkpointer:
        await checkpointer.setup()
        graph     = build_writing_graph(checkpointer)
        thread_id = str(uuid.uuid4())
        initial   = {
            "card_id":       req.card_id,
            "word":          req.word,
            "definition":    req.definition,
            "user_id":       req.user_id,
            "session_id":    req.session_id,
            "mastery_level": req.mastery_level,
        }
        await graph.ainvoke(initial, config=_config(thread_id))
        snap  = await graph.aget_state(_config(thread_id))
        state = snap.values
        return {
            "thread_id": thread_id,
            "status":    "awaiting_user_text",
            **_prompt_context(state),
        }


@fastapi_app.post("/writing/submit")
async def submit_writing(req: SubmitWritingRequest):
    async with AsyncPostgresSaver.from_conn_string(_conninfo()) as checkpointer:
        await checkpointer.setup()
        graph = build_writing_graph(checkpointer)
        try:
            await graph.ainvoke(
                Command(resume=req.user_text),
                config=_config(req.thread_id),
            )
        except Exception as e:
            traceback.print_exc()
            raise HTTPException(500, detail={"error": str(e), "type": type(e).__name__})

        snap          = await graph.aget_state(_config(req.thread_id))
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

        if interrupt_val and interrupt_val.get("event") == "awaiting_user_text":
            return {
                "thread_id":        req.thread_id,
                "status":           "awaiting_user_text",
                "validation_error": state.get("validation_error"),
                **_prompt_context(state),
            }

        raise HTTPException(500, "Unexpected graph state after submit")


@fastapi_app.post("/writing/action")
async def choose_action(req: ActionRequest):
    async with AsyncPostgresSaver.from_conn_string(_conninfo()) as checkpointer:
        await checkpointer.setup()
        graph = build_writing_graph(checkpointer)
        try:
            await graph.ainvoke(
                Command(resume=req.action),
                config=_config(req.thread_id),
            )
        except Exception as e:
            raise HTTPException(500, f"Graph error: {e}")

        snap  = await graph.aget_state(_config(req.thread_id))
        state = snap.values

        if not snap.next:
            return {"thread_id": req.thread_id, "status": "done"}

        return {
            "thread_id": req.thread_id,
            "status":    "awaiting_user_text",
            **_prompt_context(state),
        }


# Vercel Python Function handler (WSGI).
# Strips the "/api/py" prefix before forwarding to FastAPI.
class _StripPrefix:
    def __init__(self, wsgi_app, prefix: str):
        self._app = wsgi_app
        self._prefix = prefix

    def __call__(self, environ, start_response):
        path = environ.get("PATH_INFO", "")
        if path.startswith(self._prefix):
            environ = dict(environ)
            environ["PATH_INFO"] = path[len(self._prefix):] or "/"
        return self._app(environ, start_response)


app = _StripPrefix(ASGIMiddleware(fastapi_app), "/api/py")
