from sqlalchemy import Column, Integer, String, Text, ForeignKey
from app.db_sql import Base

class Session(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True)
    session_name = Column(String, default="New Chat")

class Chat(Base):
    __tablename__ = "chats"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    user_query = Column(Text)
    sql_query = Column(Text)
    bot_response = Column(Text)