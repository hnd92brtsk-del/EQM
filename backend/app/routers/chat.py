# Chat proxy router for LM Studio; keeps frontend API stable.
# Prompts enforce read-only vs admin guidance without data mutation.
from typing import List, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.dependencies import require_admin, require_read_access

router = APIRouter()
settings = get_settings()

SYSTEM_PROMPT_READONLY = (
    "Ты работаешь в режиме read-only. Отвечай на вопросы, пиши код и рекомендации, "
    "но не предлагай изменять, создавать или удалять данные"
)
SYSTEM_PROMPT_ADMIN = (
    "Ты работаешь от имени администратора. Разрешено предлагать создание и "
    "редактирование сущностей через UI, но запрещено удалять или удалённо "
    "модифицировать данные напрямую"
)


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(min_length=1)


class ChatResponse(BaseModel):
    content: str


async def _proxy_chat(messages: List[ChatMessage], system_prompt: str) -> ChatResponse:
    formatted_messages = [{"role": "system", "content": system_prompt}] + [
        {"role": message.role, "content": message.content} for message in messages
    ]
    payload = {
        "model": settings.lm_model,
        "messages": formatted_messages,
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
