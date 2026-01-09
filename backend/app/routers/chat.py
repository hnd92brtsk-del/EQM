# Chat proxy router for LM Studio; keeps frontend API stable.
# Prompts enforce read-only vs admin guidance without data mutation.
import json
from typing import Any, List, Literal

import httpx
import jsonschema
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.dependencies import require_admin, require_read_access

router = APIRouter()
settings = get_settings()

SYSTEM_PROMPT_READONLY = (
    "Ты работаешь в режиме read-only. Отвечай коротко и по существу, без перечислений "
    "и индексации. Формат ответа — обычный текст."
)
SYSTEM_PROMPT_ADMIN = (
    "Ты работаешь в режиме администратора, удаление запрещено. Отвечай коротко и по существу, "
    "без перечислений и индексации. Формат ответа — обычный текст."
)


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(min_length=1)
    output_schema: dict | None = None


class ChatResponse(BaseModel):
    content: str


async def _proxy_chat(
    messages: List[ChatMessage],
    system_prompt: str,
    output_schema: dict | None,
) -> ChatResponse | dict:
    formatted_messages = [{"role": "system", "content": system_prompt}] + [
        {"role": message.role, "content": message.content} for message in messages
    ]
    if output_schema is not None:
        schema_prompt = (
            "Строго следуй следующей JSON-схеме и возвращай результат только в формате JSON:\n"
            f"{json.dumps(output_schema, ensure_ascii=False)}"
        )
        formatted_messages = [{"role": "system", "content": schema_prompt}] + formatted_messages

    payload = {
        "model": settings.lm_model,
        "messages": formatted_messages,
        "temperature": 0.4,
        "max_tokens": 512,
    }
    if output_schema is not None:
        payload["response_format"] = {"type": "json_object"}

    headers: dict[str, str] = {}
    if settings.lm_studio_api_key:
        headers["Authorization"] = f"Bearer {settings.lm_studio_api_key}"

    url = f"{str(settings.lm_studio_base_url).rstrip('/')}/v1/chat/completions"
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
    except (httpx.RequestError, httpx.HTTPStatusError):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="LLM unavailable",
        )

    data = response.json()
    assistant_reply = data["choices"][0]["message"]["content"]
    if output_schema is None:
        return ChatResponse(content=assistant_reply)

    try:
        parsed_reply = json.loads(assistant_reply)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="LLM returned invalid JSON",
        )

    try:
        jsonschema.validate(instance=parsed_reply, schema=output_schema)
    except jsonschema.ValidationError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="LLM returned JSON that does not match schema",
        )

    return parsed_reply


@router.post("/chat", response_model=ChatResponse | dict)
async def chat(payload: ChatRequest, _user=Depends(require_read_access())):
    return await _proxy_chat(payload.messages, SYSTEM_PROMPT_READONLY, payload.output_schema)


@router.post("/chat/admin", response_model=ChatResponse | dict)
async def chat_admin(payload: ChatRequest, _user=Depends(require_admin())):
    return await _proxy_chat(payload.messages, SYSTEM_PROMPT_ADMIN, payload.output_schema)
