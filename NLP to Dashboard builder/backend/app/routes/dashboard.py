from typing import Any, Dict
from fastapi import APIRouter, HTTPException

from app.schemas import PromptRequest
from app.services.dash_agent import generate_dashboard_json
from app.db_sql import execute_raw_sql
import app.db_mongo as db_mongo

router = APIRouter()

@router.post("/generate-page")
async def generate_page(request: PromptRequest) -> Dict[str, Any]:
    dataset_data = None

    # Option A: Pull data from MongoDB
    if request.dataset_id:
        dataset = await db_mongo.get_dataset_by_id(request.dataset_id)
        if dataset:
            dataset_data = dataset.get("data", [])
            
    # Option B: Pull data from SQLite (Excel/CSV Uploads)
    elif request.table_name:
        # Fetch up to 50 rows to give the LLM context without exceeding token limits
        sql_result = execute_raw_sql(f"SELECT * FROM `{request.table_name}` LIMIT 50")
        
        if "error" in sql_result:
            raise HTTPException(status_code=400, detail=f"SQL Error: {sql_result['error']}")
            
        if not sql_result["rows"]:
            raise HTTPException(status_code=400, detail=f"Table '{request.table_name}' is empty or not found.")
            
        # Zip columns and rows into a list of dictionaries for the LLM
        cols = sql_result["columns"]
        dataset_data = [dict(zip(cols, row)) for row in sql_result["rows"]]

    if not dataset_data:
        raise HTTPException(
            status_code=400, 
            detail="No data source provided. Please provide either a valid 'dataset_id' or 'table_name'."
        )

    # 1. Generate JSON using the LLM
    try:
        dashboard_json = await generate_dashboard_json(request.prompt, dataset_data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"LLM generation failed: {exc}")

    # 2. Save the request to MongoDB
    try:
        # Save a reference to whatever data source was used
        reference_id = request.dataset_id or request.table_name
        await db_mongo.save_dashboard(request.prompt, dashboard_json, reference_id)
    except Exception as db_exc:
        print(f"Warning: Failed to save dashboard to database: {db_exc}")
    
    # 3. Return the UI-ready JSON
    return {
        "prompt": request.prompt,
        **dashboard_json,
    }

@router.get("/dashboards")
async def list_dashboards() -> Dict[str, Any]:
    dashboards = await db_mongo.list_dashboards()
    return {"dashboards": dashboards}

@router.get("/dashboard/{dashboard_id}")
async def get_dashboard(dashboard_id: str) -> Dict[str, Any]:
    doc = await db_mongo.get_dashboard_by_id(dashboard_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    return {
        "id": str(doc.get("_id")),
        "prompt": doc.get("prompt"),
        "response": doc.get("response"),
        "created_at": doc.get("created_at"),
    }