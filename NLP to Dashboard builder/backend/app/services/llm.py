import json
import re
from openai import AsyncOpenAI
from app.config import LLM_PROVIDER, LLM_API_KEY, LLM_API_URL, LLM_API_MODEL

def get_llm_client():
    if LLM_PROVIDER == "nvidia":
        return AsyncOpenAI(
            base_url=LLM_API_URL or "https://integrate.api.nvidia.com/v1",
            api_key=LLM_API_KEY
        )
    # Default to OpenAI
    return AsyncOpenAI(api_key=LLM_API_KEY)

async def call_llm_async(system_prompt: str, user_prompt: str, json_mode: bool = False) -> str:
    client = get_llm_client()
    
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_prompt})

    kwargs = {
        "model": LLM_API_MODEL,
        "messages": messages,
        "temperature": 0.2,
    }
    
    if json_mode and LLM_PROVIDER == "openai":
        kwargs["response_format"] = {"type": "json_object"}

    response = await client.chat.completions.create(**kwargs)
    content = response.choices[0].message.content

    if json_mode:
        # Clean markdown if present
        content = content.strip()
        content = re.sub(r"^```json\s*", "", content, flags=re.IGNORECASE)
        content = re.sub(r"^```\s*", "", content, flags=re.IGNORECASE)
        content = re.sub(r"\s*```$", "", content)
        
    return content
