from fastapi import FastAPI
from mangum import Mangum

app = FastAPI()


@app.get("/api/python/health")
def health():
    # Import heavy deps here to verify bundle size fits Vercel 500MB limit
    import langgraph  # noqa: F401
    import langchain_anthropic  # noqa: F401
    return {"status": "ok", "langgraph": langgraph.__version__}


handler = Mangum(app)
