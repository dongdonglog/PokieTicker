from __future__ import annotations

from typing import Any

import requests

from backend.config import settings


def provider_name() -> str:
    return settings.ai_provider


def complete_text(
    *,
    user_prompt: str,
    system_prompt: str | None = None,
    max_tokens: int = 1024,
    temperature: float = 0.2,
) -> str:
    if settings.ai_provider == "openai_compatible":
        return _complete_openai_compatible(
            user_prompt=user_prompt,
            system_prompt=system_prompt,
            max_tokens=max_tokens,
            temperature=temperature,
        )
    return _complete_anthropic(
        user_prompt=user_prompt,
        system_prompt=system_prompt,
        max_tokens=max_tokens,
        temperature=temperature,
    )


def _complete_anthropic(
    *,
    user_prompt: str,
    system_prompt: str | None,
    max_tokens: int,
    temperature: float,
) -> str:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    kwargs: dict[str, Any] = {
        "model": settings.anthropic_model,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": [{"role": "user", "content": user_prompt}],
    }
    if system_prompt:
        kwargs["system"] = system_prompt
    message = client.messages.create(**kwargs)
    return message.content[0].text if message.content else ""


def _complete_openai_compatible(
    *,
    user_prompt: str,
    system_prompt: str | None,
    max_tokens: int,
    temperature: float,
) -> str:
    if not settings.openai_compatible_base_url or not settings.openai_compatible_api_key:
        raise RuntimeError("OPENAI_COMPATIBLE_BASE_URL and OPENAI_COMPATIBLE_API_KEY must be configured")

    base_url = settings.openai_compatible_base_url.rstrip("/")
    headers = {
        "Authorization": f"Bearer {settings.openai_compatible_api_key}",
        "Content-Type": "application/json",
    }
    messages: list[dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_prompt})

    resp = requests.post(
        f"{base_url}/chat/completions",
        headers=headers,
        json={
            "model": settings.openai_compatible_model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        },
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    choices = data.get("choices") or []
    if not choices:
        return ""
    return choices[0].get("message", {}).get("content", "") or ""
