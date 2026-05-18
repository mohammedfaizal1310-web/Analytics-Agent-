from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db_sql import get_db
from app.schemas import RenameSessionRequest
from app import models

router = APIRouter()

@router.post("/create-session")
def create_session(db: Session = Depends(get_db)):
    session = models.Session()
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

@router.get("/sessions")
def get_sessions(db: Session = Depends(get_db)):
    return db.query(models.Session).all()

@router.get("/chat-history/{session_id}")
def chat_history(session_id: int, db: Session = Depends(get_db)):
    return db.query(models.Chat).filter(models.Chat.session_id == session_id).all()

@router.delete("/session/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"message": "Session deleted"}

@router.put("/session/{session_id}/rename")
def rename_session(session_id: int, req: RenameSessionRequest, db: Session = Depends(get_db)):
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.session_name = req.session_name
    db.commit()
    db.refresh(session)
    return session