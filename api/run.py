"""Local dev runner — overrides uvicorn's Windows loop choice for psycopg3 compatibility.
uvicorn on Windows uses ProactorEventLoop; psycopg3 requires SelectorEventLoop.
Usage: python run.py
"""
import asyncio
import selectors
import uvicorn.loops.asyncio as _uvloop

# uvicorn's asyncio_loop_factory returns ProactorEventLoop on Windows (use_subprocess=False).
# Override so it always returns SelectorEventLoop — required by psycopg3.
_uvloop.asyncio_loop_factory = lambda use_subprocess=False: lambda: asyncio.SelectorEventLoop(
    selectors.SelectSelector()
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("index:app", port=8000, loop="asyncio")
