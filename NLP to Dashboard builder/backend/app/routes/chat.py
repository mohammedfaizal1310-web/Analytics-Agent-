from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db_sql import get_db, get_uploaded_schema
from app.schemas import ChatRequest, ChatResponse
from app.services.sql_agent import generate_sql, execute_sql, generate_response
from app import models

router = APIRouter()

CANNOT_ANSWER = "CANNOT_ANSWER"
NO_DATA_MSG = (
    "No datasets have been uploaded yet. "
    "Please upload a CSV file via /api/upload first, then ask your question."
)

@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, db: Session = Depends(get_db)):
    # 1. Verify session exists
    session = db.query(models.Session).filter(models.Session.id == req.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    # 2. Get real schema from DB
    schema = get_uploaded_schema()
    if not schema:
        return ChatResponse(
            session_id=req.session_id,
            sql="",
            response=NO_DATA_MSG,
        )

    # 3. Generate SQL
    try:
        sql_query = await generate_sql(req.query, schema)
    except Exception as exc:
        return ChatResponse(
            session_id=req.session_id,
            sql="",
            response="Sorry, I couldn't generate a SQL query for that question. Please try rephrasing or check your dataset.",
            error=str(exc),
        )

    if sql_query == CANNOT_ANSWER:
        return ChatResponse(
            session_id=req.session_id,
            sql="",
            response="I couldn't form a query for that question. Try rephrasing it.",
        )

    # 4. Execute SQL
    result = execute_sql(sql_query)

    # 5. Generate narrative response
    try:
        response_text = await generate_response(req.query, result)
    except Exception as exc:
        response_text = "Sorry, I couldn't generate a narrative response from the SQL results. Please try again."
        result["error"] = str(exc)

    # 6. Persist to DB
    chat_entry = models.Chat(
        session_id=req.session_id,
        user_query=req.query,
        bot_response=response_text,
        sql_query=sql_query,
    )
    db.add(chat_entry)
    db.commit()

    return ChatResponse(
        session_id=req.session_id,
        sql=sql_query,
        columns=result.get("columns"),
        rows=result.get("rows"),
        response=response_text,
        error=result.get("error"),
    )