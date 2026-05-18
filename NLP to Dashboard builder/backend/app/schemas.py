from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

# POC 1 Schemas
class ChatRequest(BaseModel):
    session_id: int
    query: str

class ChatResponse(BaseModel):
    session_id: int
    sql: str
    columns: Optional[List[str]] = None
    rows: Optional[List[list]] = None
    response: str
    error: Optional[str] = None

class RenameSessionRequest(BaseModel):
    session_name: str

# POC 2 Schemas
class DatasetCreate(BaseModel):
    name: str = Field(..., example="Sales Data 2024")
    description: str = Field(default="")
    data: List[Dict[str, Any]] = Field(...)

class PromptRequest(BaseModel):
    prompt: str = Field(...)
    dataset_id: Optional[str] = Field(default=None, description="MongoDB Dataset ID")
    table_name: Optional[str] = Field(default=None, description="SQLite Table Name from Uploads")