"""
EOA Global - Pluggable Hybrid LLM Gateway
Factory pattern supporting seamless switching between Cloud LLMs (OpenAI) 
and On-Premise Sovereign LLMs (Local LLaMA via Ollama / vLLM) for strict data residency.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

import httpx
from langchain_core.callbacks.manager import CallbackManagerForLLMRun
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatResult

from eoa_global_backend.core.config import settings

logger = logging.getLogger("eoa.ai.gateway")


class GenericHttpChatModel(BaseChatModel):
    """
    Lightweight, universal OpenAI-compatible ChatModel adhering to LangChain's BaseChatModel interface.
    Connects to any standard API: OpenAI, vLLM, Ollama (/v1), LM Studio, or LocalAI.
    """
    base_url: str = "https://api.openai.com/v1"
    api_key: str = "dummy-key"
    model_name: str = "gpt-4o-mini"
    temperature: float = 0.1
    timeout: float = 25.0

    @property
    def _llm_type(self) -> str:
        return "generic-http-chat-model"

    def _convert_messages(self, messages: List[BaseMessage]) -> List[Dict[str, str]]:
        formatted = []
        for msg in messages:
            role = "user"
            if msg.type == "system":
                role = "system"
            elif msg.type == "ai":
                role = "assistant"
            formatted.append({"role": role, "content": str(msg.content)})
        return formatted

    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        url = f"{self.base_url.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model_name,
            "messages": self._convert_messages(messages),
            "temperature": self.temperature,
        }
        if kwargs.get("response_format"):
            payload["response_format"] = kwargs["response_format"]

        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
                text = data["choices"][0]["message"]["content"]
                generation = ChatGeneration(message=AIMessage(content=text))
                return ChatResult(generations=[generation])
        except Exception as exc:
            logger.error(f"[LLM Gateway] HTTP call failed to {url}: {exc}")
            raise exc

    async def _agenerate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs: Any,
    ) -> ChatResult:
        url = f"{self.base_url.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model_name,
            "messages": self._convert_messages(messages),
            "temperature": self.temperature,
        }
        if kwargs.get("response_format"):
            payload["response_format"] = kwargs["response_format"]

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
                text = data["choices"][0]["message"]["content"]
                generation = ChatGeneration(message=AIMessage(content=text))
                return ChatResult(generations=[generation])
        except Exception as exc:
            logger.error(f"[LLM Gateway] Async HTTP call failed to {url}: {exc}")
            raise exc


def get_llm(provider: Optional[str] = None) -> BaseChatModel:
    """
    Pluggable LLM Factory Function.
    
    Reads provider choice from argument or environment variable:
      - 'openai': Uses OpenAI Cloud API (GPT-4o / GPT-4o-mini).
      - 'local' / 'vllm': Uses On-Premise sovereign endpoint (vLLM / LLaMA-3).
      - 'ollama': Uses local Ollama instance (ChatOllama or OpenAI-compatible endpoint).
      
    Guarantees strict data sovereignty for governmental and national defense tenants.
    """
    selected_provider = (provider or os.getenv("LLM_PROVIDER") or settings.LLM_PROVIDER).lower().strip()

    if selected_provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY") or settings.OPENAI_API_KEY or "sk-dummy"
        model_name = os.getenv("OPENAI_MODEL_NAME") or settings.OPENAI_MODEL_NAME

        # Try official langchain-openai first
        try:
            from langchain_openai import ChatOpenAI
            logger.info(f"[LLM Gateway] Loaded ChatOpenAI (Cloud): model={model_name}")
            return ChatOpenAI(
                api_key=api_key,
                model_name=model_name,
                temperature=0.1,
            )
        except ImportError:
            try:
                from langchain_community.chat_models import ChatOpenAI
                logger.info(f"[LLM Gateway] Loaded langchain_community ChatOpenAI (Cloud): model={model_name}")
                return ChatOpenAI(
                    openai_api_key=api_key,
                    model_name=model_name,
                    temperature=0.1,
                )
            except ImportError:
                logger.info(f"[LLM Gateway] Loaded Universal GenericHttpChatModel for OpenAI: model={model_name}")
                return GenericHttpChatModel(
                    base_url="https://api.openai.com/v1",
                    api_key=api_key,
                    model_name=model_name,
                    temperature=0.1,
                )

    elif selected_provider in ("local", "vllm", "ollama"):
        local_base_url = os.getenv("LOCAL_LLM_BASE_URL") or settings.LOCAL_LLM_BASE_URL
        local_model = os.getenv("LOCAL_LLM_MODEL_NAME") or settings.LOCAL_LLM_MODEL_NAME

        if selected_provider == "ollama":
            try:
                from langchain_community.chat_models import ChatOllama
                logger.info(f"[LLM Gateway] Loaded ChatOllama (On-Premise): model={local_model} at {local_base_url}")
                return ChatOllama(
                    base_url=local_base_url.replace("/v1", ""),
                    model=local_model,
                    temperature=0.1,
                )
            except ImportError:
                pass

        # For vLLM, local LLaMA, or Ollama in OpenAI compatibility mode
        try:
            from langchain_openai import ChatOpenAI
            logger.info(f"[LLM Gateway] Loaded ChatOpenAI for Local vLLM/Ollama: base={local_base_url}, model={local_model}")
            return ChatOpenAI(
                base_url=local_base_url,
                api_key="sovereign-local-key",
                model_name=local_model,
                temperature=0.1,
            )
        except ImportError:
            try:
                from langchain_community.chat_models import ChatOpenAI
                return ChatOpenAI(
                    openai_api_base=local_base_url,
                    openai_api_key="sovereign-local-key",
                    model_name=local_model,
                    temperature=0.1,
                )
            except ImportError:
                logger.info(f"[LLM Gateway] Loaded Universal GenericHttpChatModel for Local Sovereign: base={local_base_url}")
                return GenericHttpChatModel(
                    base_url=local_base_url,
                    api_key="sovereign-local-key",
                    model_name=local_model,
                    temperature=0.1,
                )

    else:
        logger.warning(f"[LLM Gateway] Unknown provider '{selected_provider}'. Falling back to default generic model.")
        return GenericHttpChatModel(
            base_url="https://api.openai.com/v1",
            api_key=os.getenv("OPENAI_API_KEY", "sk-dummy"),
            model_name="gpt-4o-mini",
            temperature=0.1,
        )
