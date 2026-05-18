import os
from dotenv import load_dotenv

load_dotenv()

# Shared
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

# SQL Database (POC 1)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./chatbot.db")
DB_FILE = os.getenv("DB_FILE", "./chatbot.db")
MAX_RESULT_ROWS = int(os.getenv("MAX_RESULT_ROWS", "100"))

# MongoDB (POC 2)
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")

# Unified LLM Settings
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai").lower()
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_API_URL = os.getenv("LLM_API_URL", "")
LLM_API_MODEL = os.getenv("LLM_API_MODEL", "gpt-3.5-turbo")