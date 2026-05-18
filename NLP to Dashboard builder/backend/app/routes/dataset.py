from typing import Any, Dict
from fastapi import APIRouter, HTTPException

from app.schemas import DatasetCreate
import app.db_mongo as db_mongo

router = APIRouter()

@router.post("/datasets", response_model=Dict[str, Any])
async def create_dataset(dataset: DatasetCreate) -> Dict[str, Any]:
    try:
        dataset_id = await db_mongo.save_dataset(
            name=dataset.name,
            data=dataset.data,
            description=dataset.description,
        )
        return {"id": dataset_id, "message": "Dataset created successfully"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to create dataset: {exc}")

@router.get("/datasets", response_model=Dict[str, Any])
async def list_datasets() -> Dict[str, Any]:
    try:
        datasets_list = await db_mongo.list_datasets()
        return {"datasets": datasets_list}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to list datasets: {exc}")

@router.get("/datasets/{dataset_id}", response_model=Dict[str, Any])
async def get_dataset(dataset_id: str) -> Dict[str, Any]:
    dataset = await db_mongo.get_dataset_by_id(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset

@router.delete("/datasets/{dataset_id}")
async def delete_dataset(dataset_id: str) -> Dict[str, Any]:
    success = await db_mongo.delete_dataset(dataset_id)
    if not success:
        raise HTTPException(status_code=404, detail="Dataset not found or already deleted")
    return {"message": "Dataset deleted successfully"}