from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .api import health

app = FastAPI(
    title="Preschool Agent API",
)

app.include_router(health.router, prefix="/api")

# Mount the static files directory
# This will serve the built React app
app.mount("/", StaticFiles(directory="src/static", html=True), name="static")
