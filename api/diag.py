import sys
import os
import json
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            task_ls = os.listdir("/var/task")
        except Exception as e:
            task_ls = str(e)
        info = {
            "sys_path": sys.path,
            "cwd": os.getcwd(),
            "file": __file__,
            "var_task_ls": task_ls,
            "errors": [],
        }
        try:
            from a2wsgi import ASGIMiddleware
            info["a2wsgi"] = "ok"
        except Exception as e:
            info["errors"].append(f"a2wsgi: {e}")
        try:
            from workflows.graph import build_writing_graph
            info["workflows"] = "ok"
        except Exception as e:
            info["errors"].append(f"workflows: {e}")
        try:
            from models.writing import StartWritingRequest
            info["models"] = "ok"
        except Exception as e:
            info["errors"].append(f"models: {e}")
        try:
            from fastapi import FastAPI
            info["fastapi"] = "ok"
        except Exception as e:
            info["errors"].append(f"fastapi: {e}")

        body = json.dumps(info, indent=2).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
