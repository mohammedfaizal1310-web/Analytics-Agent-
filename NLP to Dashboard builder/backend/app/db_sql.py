import sqlite3
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import DATABASE_URL, DB_FILE

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_raw_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def execute_raw_sql(sql: str) -> dict:
    conn = get_raw_connection()
    try:
        cur = conn.execute(sql)
        columns = [d[0] for d in cur.description] if cur.description else []
        rows = [list(r) for r in cur.fetchall()]
        return {"columns": columns, "rows": rows}
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()

def get_uploaded_schema() -> str:
    orm_tables = {"sessions", "chats", "uploaded_files_metadata"}
    conn = get_raw_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT t.name as table_name, m.file_name
        FROM sqlite_master t
        JOIN uploaded_files_metadata m ON t.name = m.table_name
        WHERE t.type='table' AND t.name NOT IN (?, ?, ?)
        ORDER BY m.uploaded_at DESC
    """, tuple(orm_tables))
    table_info = cur.fetchall()
    
    if not table_info:
        conn.close()
        return ""
        
    parts = []
    for table_name, file_name in table_info:
        cur.execute(f"PRAGMA table_info({table_name})")
        cols = cur.fetchall()
        col_lines = [f"  - `{c['name']}` ({c['type'] or 'TEXT'})" for c in cols]
        parts.append(f"TABLE: {table_name} (from file: {file_name})\nCOLUMNS:\n" + "\n".join(col_lines))
    conn.close()
    return "\n\n".join(parts)