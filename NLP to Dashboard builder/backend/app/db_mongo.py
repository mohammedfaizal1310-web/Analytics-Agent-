from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import MONGODB_URI

_mongo_client = None
_db = None


def get_mongo_db():

    global _mongo_client, _db

    if _mongo_client is None:

        try:

            _mongo_client = AsyncIOMotorClient(
                MONGODB_URI,
                serverSelectionTimeoutMS=5000
            )

            _db = _mongo_client["low_page_builder"]

        except Exception as e:

            print(f"MongoDB connection failed: {e}")

            _mongo_client = None
            _db = None

    return _db


# ─────────────────────────────────────────────
# DATASETS
# ─────────────────────────────────────────────

async def save_dataset(
    name: str,
    data: List[Dict[str, Any]],
    description: str = ""
) -> str:

    db = get_mongo_db()

    document = {
        "name": name,
        "description": description,
        "data": data,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await db["datasets"].insert_one(document)

    return str(result.inserted_id)


async def list_datasets(
    limit: int = 50
) -> List[Dict[str, Any]]:

    db = get_mongo_db()

    cursor = (
        db["datasets"]
        .find()
        .sort("created_at", -1)
        .limit(limit)
    )

    datasets = []

    async for doc in cursor:

        datasets.append({

            "id": str(doc.get("_id")),

            "name": doc.get("name"),

            "description": doc.get("description"),

            "record_count": len(doc.get("data", [])),

            "created_at": doc.get("created_at"),
        })

    return datasets


async def get_dataset_by_id(
    dataset_id: str
) -> Optional[Dict[str, Any]]:

    db = get_mongo_db()

    if not ObjectId.is_valid(dataset_id):
        return None

    document = await db["datasets"].find_one({
        "_id": ObjectId(dataset_id)
    })

    if not document:
        return None

    return {

        "id": str(document.get("_id")),

        "name": document.get("name"),

        "description": document.get("description"),

        "data": document.get("data", [])
    }


# ─────────────────────────────────────────────
# DASHBOARDS
# ─────────────────────────────────────────────

async def save_dashboard(
    prompt: str,
    response: Any,
    dataset_id: str = None
) -> str:

    db = get_mongo_db()

    document = {

        "prompt": prompt,

        "response": response,

        "dataset_id": dataset_id,

        "created_at": datetime.utcnow()
    }

    result = await db["dashboard_requests"].insert_one(document)

    return str(result.inserted_id)


async def list_dashboards(
    limit: int = 50
) -> List[Dict[str, Any]]:

    db = get_mongo_db()

    cursor = (
        db["dashboard_requests"]
        .find()
        .sort("created_at", -1)
        .limit(limit)
    )

    dashboards = []

    async for doc in cursor:

        dashboards.append({

            "id": str(doc.get("_id")),

            "prompt": doc.get("prompt"),

            "dataset_id": doc.get("dataset_id"),

            "response": doc.get("response"),

            "created_at": doc.get("created_at")
        })

    return dashboards


async def get_dashboard_by_id(
    dashboard_id: str
) -> Optional[Dict[str, Any]]:

    db = get_mongo_db()

    if not ObjectId.is_valid(dashboard_id):
        return None

    document = await db["dashboard_requests"].find_one({
        "_id": ObjectId(dashboard_id)
    })

    if not document:
        return None

    return {

        "id": str(document.get("_id")),

        "prompt": document.get("prompt"),

        "dataset_id": document.get("dataset_id"),

        "response": document.get("response"),

        "created_at": document.get("created_at")
    }