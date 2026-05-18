from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import ALLOWED_ORIGINS
from app.db_sql import Base, engine
import app.models  # Register models

# Import all routers
from app.routes import chat, upload, session, dataset, dashboard

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite ORM tables
    Base.metadata.create_all(bind=engine)
    # MongoDB initializes lazily in db_mongo.py
    yield

app = FastAPI(
    title="Unified AI Analytics Platform",
    description="NLP-to-SQL Chatbot & Low-Code Dashboard Builder.",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# POC 1 Routes
app.include_router(upload.router, prefix="/api", tags=["SQL: Upload"])
app.include_router(chat.router, prefix="/api", tags=["SQL: Chat"])
app.include_router(session.router, prefix="/api", tags=["SQL: Session"])

# POC 2 Routes
app.include_router(dataset.router, prefix="/api", tags=["Dash: Datasets"])
app.include_router(dashboard.router, prefix="/api", tags=["Dash: Builder"])

@app.get("/health", tags=["System"])
def health():
    return {"status": "ok"}