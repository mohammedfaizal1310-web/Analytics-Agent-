from fastapi import APIRouter, UploadFile, File, HTTPException
import pandas as pd
import sqlite3
import re
from app.db_sql import get_raw_connection

router = APIRouter()
METADATA_TABLE_NAME = "uploaded_files_metadata"

def ensure_metadata_table(conn):
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {METADATA_TABLE_NAME} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_name TEXT NOT NULL,
            table_name TEXT NOT NULL UNIQUE,
            uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()

def sanitize_table_name(filename: str) -> str:
    name = re.sub(r'\.[^.]+$', '', filename)
    name = re.sub(r'[^a-zA-Z0-9_]', '_', name)
    name = re.sub(r'_+', '_', name).strip('_')
    if not name: name = 'upload'
    if name[0].isdigit(): name = 'upload_' + name
    return name.lower()

def add_uploaded_file_info(conn, file_name: str, table_name: str):
    ensure_metadata_table(conn)
    try:
        conn.execute(f"INSERT INTO {METADATA_TABLE_NAME} (file_name, table_name) VALUES (?, ?)", (file_name, table_name))
        conn.commit()
    except sqlite3.IntegrityError:
        counter = 1
        while True:
            unique_table_name = f"{table_name}_{counter}"
            try:
                conn.execute(f"INSERT INTO {METADATA_TABLE_NAME} (file_name, table_name) VALUES (?, ?)", (file_name, unique_table_name))
                conn.commit()
                return unique_table_name
            except sqlite3.IntegrityError:
                counter += 1
    return table_name

def get_uploaded_files_info(conn):
    ensure_metadata_table(conn)
    rows = conn.execute(f"SELECT file_name, table_name FROM {METADATA_TABLE_NAME} ORDER BY uploaded_at DESC").fetchall()
    return [{"file_name": row[0], "table_name": row[1]} for row in rows]

def remove_uploaded_file_info(conn, table_name: str):
    ensure_metadata_table(conn)
    conn.execute(f"DELETE FROM {METADATA_TABLE_NAME} WHERE table_name = ?", (table_name,))
    conn.commit()

@router.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    try:
        if not file.filename: raise HTTPException(status_code=400, detail="No file uploaded")
        filename = file.filename.lower()

        if filename.endswith(".csv"):
            df = pd.read_csv(file.file)
        elif filename.endswith((".xlsx", ".xls")):
            try:
                df = pd.read_excel(file.file, engine="openpyxl")
            except ImportError:
                raise HTTPException(status_code=500, detail="openpyxl is not installed. Run: pip install openpyxl")
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format.")

        if df.empty: raise HTTPException(status_code=400, detail="Uploaded file is empty")

        conn = get_raw_connection()
        try:
            base_table_name = sanitize_table_name(file.filename)
            actual_table_name = add_uploaded_file_info(conn, file.filename, base_table_name)
            df.to_sql(actual_table_name, conn, if_exists="replace", index=False)
            return {
                "message": "File uploaded successfully",
                "file_name": file.filename,
                "table_name": actual_table_name,
                "rows_loaded": len(df),
                "columns": list(df.columns),
            }
        finally:
            conn.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/upload-status")
def upload_status():
    conn = get_raw_connection()
    try:
        return {"uploaded_files": get_uploaded_files_info(conn)}
    finally:
        conn.close()

@router.delete("/upload-file/{table_name}")
def delete_uploaded_file(table_name: str):
    conn = get_raw_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", (table_name,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="File not found")
        cur.execute(f"DROP TABLE {table_name}")
        remove_uploaded_file_info(conn, table_name)
        return {"message": "File removed successfully"}
    finally:
        conn.close()

@router.delete("/clear-data")
def clear_data():
    conn = get_raw_connection()
    try:
        cur = conn.cursor()
        cur.execute(f"SELECT table_name FROM {METADATA_TABLE_NAME}")
        tables = [row[0] for row in cur.fetchall()]
        for table in tables:
            try:
                cur.execute(f"DROP TABLE {table}")
            except: pass
        cur.execute(f"DELETE FROM {METADATA_TABLE_NAME}")
        conn.commit()
        return {"message": "All uploaded data cleared"}
    finally:
        conn.close()