import re
from app.services.llm import call_llm_async
from app.config import MAX_RESULT_ROWS
from app.db_sql import execute_raw_sql

_SQL_SYSTEM = """You are an expert SQLite analyst.
Given a database schema, write a single valid SQLite SELECT query that answers the user's question.

SCHEMA FORMAT:
- Schema shows TABLE names and their COLUMNS with original filenames
- Tables are shown as: "TABLE: table_name (from file: filename)"
- COLUMN names are listed under "COLUMNS:" with dashes

CRITICAL RULES:
1. SELECT from ONE TABLE name ONLY (never from column names or multiple tables).
2. QUOTE all column names with backticks (`) to handle spaces: `Project Name`, `Resource Name`.
3. Return ONLY the raw SQL — no markdown, no backticks, no explanation.
4. Use EXACT table and column names from the schema — do not guess or invent.
5. Always use SELECT statements only — never INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE.

ROBUST MATCHING & ERROR HANDLING RULES:
6. CASE INSENSITIVITY: The user's query and the database values may have different casing. ALWAYS use LOWER() for string comparisons.
7. FUZZY MATCHING: Users may misspell words or use partial names. ALWAYS use the LIKE operator with '%' wildcards instead of '=' for string values.
   - Example CORRECT: LOWER(`Department`) LIKE LOWER('%data eng%')
   - Example WRONG: `Department` = 'Data Engineering'
8. SYNONYMS: If the user asks for a term that isn't a column but means the same thing (e.g., "staff" instead of "employees"), map it intelligently to the exact column name provided in the schema.

Limit results to 100 rows unless the user explicitly asks for more. For aggregations (totals, averages, counts), do NOT apply a row limit.
If the question cannot be answered with the given schema, return exactly: CANNOT_ANSWER
"""

_RESPONSE_SYSTEM = """You are a highly analytical, strict data system. 
Your ONLY job is to provide the direct answer to the user's question based on the SQL results provided.

CRITICAL RULES:
1. NO FLUFF. Do NOT say "Here is the data", "Based on the table", or "The answer is".
2. NO FLATTERY. Do not act like a conversational chatbot.
3. BE DIRECT. Start immediately with the answer.
4. If the user asks for a single number or stat, give the number clearly without extra narrative.
5. If presenting multiple rows, use a simple, clean markdown table without introductory text.

Example 1:
User: "How many employees are in Data Engineering?"
Data: 45
Your Response: "45 employees are in Data Engineering."

Example 2:
User: "Who are the top 3 highest paid?"
Data: [John: 100k, Jane: 95k, Bob: 90k]
Your Response: 
| Name | Salary |
|---|---|
| John | $100,000 |
| Jane | $95,000 |
| Bob | $90,000 |

Answer the query immediately following these strict rules."""

async def generate_sql(question: str, schema: str) -> str:
    user_msg = f"Schema:\n{schema}\n\nQuestion: {question}\n\nReturn only the SQL query, nothing else."
    raw = await call_llm_async(_SQL_SYSTEM, user_msg)
    
    cleaned = re.sub(r"```sql|```", "", raw).strip()
    cleaned = re.sub(r";\s*$", "", cleaned).strip()
    
    forbidden = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE"]
    if any(word in cleaned.upper() for word in forbidden) or not cleaned.upper().startswith("SELECT"):
        return "CANNOT_ANSWER"
    
    return cleaned

def execute_sql(query: str) -> dict:
    result = execute_raw_sql(query)
    if "error" not in result:
        result["rows"] = result["rows"][:MAX_RESULT_ROWS]
    return result

async def generate_response(question: str, sql_result: dict) -> str:
    if "error" in sql_result and sql_result["error"]:
        return f"⚠️ **Unable to retrieve data.**\n\nReason: {sql_result['error']}"
    
    columns = sql_result.get("columns", [])
    rows = sql_result.get("rows", [])
    
    if not rows:
        return "📭 No results found."

    header = " | ".join(columns)
    separator = " | ".join(["---"] * len(columns))
    body_lines = [" | ".join(str(v) if v is not None else "N/A" for v in row) for row in rows[:50]]
    result_text = header + "\n" + separator + "\n" + "\n".join(body_lines)
    
    user_msg = f"Business Question: \"{question}\"\n\nData:\n\n{result_text}"
    return await call_llm_async(_RESPONSE_SYSTEM, user_msg)