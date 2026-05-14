from fastapi import FastAPI
from mangum import Mangum
import langgraph
import langchain_anthropic  # noqa: F401

app = FastAPI()


@app.get("/api/python/health")
def health():
    return {"status": "ok", "langgraph": langgraph.__version__}


handler = Mangum(app, lifespan="off")
