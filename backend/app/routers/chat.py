# Chat proxy router for LM Studio; keeps frontend API stable.
# Prompts enforce read-only vs admin guidance without data mutation.
from typing import List, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from app.core.config import get_settings
from app.core.dependencies import require_admin, require_read_access

router = APIRouter()

SYSTEM_PROMPT_READONLY = (
    "Ты работаешь в режиме read-only. Отвечай коротко и по существу, без перечислений "
    "и индексации. Формат ответа — обычный текст."
)
SYSTEM_PROMPT_ADMIN = (
    "Ты работаешь в режиме администратора, удаление запрещено. Отвечай коротко и по существу, "
    "без перечислений и индексации. Формат ответа — обычный текст."
)


class ChatMessage(BaseModel):
    role: Literal["user"]
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(min_length=1)
    output_schema: dict | None = None

    @field_validator("output_schema")
    @classmethod
    def reject_client_controlled_schema(cls, value: dict | None) -> dict | None:
        if value is not None:
            raise ValueError("Client-controlled output_schema is not allowed")
        return value


class ChatResponse(BaseModel):
    content: str


async def _proxy_chat(messages: List[ChatMessage], system_prompt: str) -> ChatResponse:
    settings = get_settings()
    payload = {
        "model": settings.lm_model,
        "messages": [{"role": "system", "content": system_prompt}]
        + [{"role": message.role, "content": message.content} for message in messages],
        "temperature": 0.4,
        "max_tokens": 512,
    }

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
    return ChatResponse(content=assistant_reply)


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, _user=Depends(require_read_access())):
    return await _proxy_chat(payload.messages, SYSTEM_PROMPT_READONLY)


@router.post("/chat/admin", response_model=ChatResponse)
async def chat_admin(payload: ChatRequest, _user=Depends(require_admin())):
    return await _proxy_chat(payload.messages, SYSTEM_PROMPT_ADMIN)
