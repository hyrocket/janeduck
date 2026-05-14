from fastapi import FastAPI
from mangum import Mangum
from importlib.metadata import version
import langgraph  # noqa: F401
import langchain_anthropic  # noqa: F401

app = FastAPI()


@app.get("/api/python/health")
def health():
    return {"status": "ok", "langgraph": version("langgraph")}


handler = Mangum(app, lifespan="off")
