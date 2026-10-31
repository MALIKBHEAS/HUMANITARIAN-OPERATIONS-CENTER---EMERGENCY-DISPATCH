"""
EOA Global - Asynchronous Message Broker Infrastructure
Provides enterprise connection management and partitioning for Redis Pub/Sub, RabbitMQ, 
and high-throughput in-memory failover for development environments.
"""

from __future__ import annotations

import asyncio
import json
import logging
from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator, Dict, List, Optional, Set

from eoa_global_backend.core.config import settings

logger = logging.getLogger("eoa.broker")


class BaseMessageBroker(ABC):
    """
    Abstract message broker interface enforcing unified publish/subscribe and queue semantics.
    """

    @abstractmethod
    async def connect(self) -> None:
        """Establishes connections and connection pools to the broker."""
        pass

    @abstractmethod
    async def disconnect(self) -> None:
        """Closes all active connections gracefully."""
        pass

    @abstractmethod
    async def publish(self, channel: str, message: Dict[str, Any]) -> None:
        """Publishes a payload to a specific tenant broadcast channel."""
        pass

    @abstractmethod
    async def subscribe(self, channel: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Subscribes to a channel and yields received messages."""
        pass

    @abstractmethod
    async def enqueue(self, queue_name: str, item: Dict[str, Any]) -> None:
        """Pushes an SOS incident into the durable task queue."""
        pass

    @abstractmethod
    async def dequeue(self, queue_name: str, timeout: float = 1.0) -> Optional[Dict[str, Any]]:
        """Pulls an SOS incident from the task queue."""
        pass

    @abstractmethod
    async def get_cached_value(self, key: str) -> Optional[str]:
        """Retrieves a cached string value."""
        pass

    @abstractmethod
    async def set_cached_value(self, key: str, value: str, ttl: int = 300) -> None:
        """Stores a cached string value with TTL."""
        pass


class MemoryMessageBroker(BaseMessageBroker):
    """
    High-performance in-memory async broker utilizing asyncio.Queue and pub/sub sets.
    Guarantees 100% operational continuity during local development or when external
    Redis/RabbitMQ clusters are initializing.
    """

    def __init__(self) -> None:
        self._queues: Dict[str, asyncio.Queue] = {}
        self._channels: Dict[str, Set[asyncio.Queue]] = {}
        self._lock: Optional[asyncio.Lock] = None
        self._is_connected: bool = False
        self._cache: Dict[str, tuple[str, float]] = {}

    @property
    def lock(self) -> asyncio.Lock:
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock

    async def connect(self) -> None:
        self._is_connected = True
        logger.info("[Broker] In-Memory high-throughput event bus initialized.")

    async def disconnect(self) -> None:
        self._is_connected = False
        async with self.lock:
            self._queues.clear()
            self._channels.clear()
        logger.info("[Broker] In-Memory event bus disconnected.")

    async def publish(self, channel: str, message: Dict[str, Any]) -> None:
        async with self.lock:
            subscribers = self._channels.get(channel, set()).copy()
        for sub_queue in subscribers:
            await sub_queue.put(message)

    async def subscribe(self, channel: str) -> AsyncGenerator[Dict[str, Any], None]:
        sub_queue: asyncio.Queue = asyncio.Queue()
        async with self.lock:
            if channel not in self._channels:
                self._channels[channel] = set()
            self._channels[channel].add(sub_queue)
        try:
            while self._is_connected:
                try:
                    message = await asyncio.wait_for(sub_queue.get(), timeout=1.0)
                    yield message
                except asyncio.TimeoutError:
                    continue
        finally:
            async with self.lock:
                if channel in self._channels:
                    self._channels[channel].discard(sub_queue)

    async def enqueue(self, queue_name: str, item: Dict[str, Any]) -> None:
        async with self.lock:
            if queue_name not in self._queues:
                self._queues[queue_name] = asyncio.Queue()
            queue = self._queues[queue_name]
        await queue.put(item)

    async def dequeue(self, queue_name: str, timeout: float = 1.0) -> Optional[Dict[str, Any]]:
        async with self.lock:
            if queue_name not in self._queues:
                self._queues[queue_name] = asyncio.Queue()
            queue = self._queues[queue_name]
        try:
            return await asyncio.wait_for(queue.get(), timeout=timeout)
        except asyncio.TimeoutError:
            return None

    async def get_cached_value(self, key: str) -> Optional[str]:
        import time
        if key in self._cache:
            val, exp = self._cache[key]
            if time.time() < exp:
                return val
            del self._cache[key]
        return None

    async def set_cached_value(self, key: str, value: str, ttl: int = 300) -> None:
        import time
        self._cache[key] = (value, time.time() + ttl)


class RedisMessageBroker(BaseMessageBroker):
    """
    Production-grade Redis async message broker utilizing redis.asyncio connection pooling.
    Handles Pub/Sub for live WebSocket broadcasting and LPUSH/RPOP for SOS queues.
    """

    def __init__(self, redis_url: str) -> None:
        self._redis_url = redis_url
        self._client: Any = None
        self._pubsub: Any = None

    async def connect(self) -> None:
        try:
            import redis.asyncio as aioredis
            self._client = aioredis.from_url(
                self._redis_url,
                encoding="utf-8",
                decode_responses=True,
                max_connections=50,
            )
            # Test ping
            await self._client.ping()
            logger.info(f"[Broker] Connected successfully to Redis cluster at {self._redis_url}")
        except Exception as exc:
            logger.warning(f"[Broker] Could not connect to Redis at {self._redis_url}: {exc}. Falling back to internal engine.")
            raise exc

    async def disconnect(self) -> None:
        if self._client:
            await self._client.close()
            logger.info("[Broker] Redis connection pool closed.")

    async def publish(self, channel: str, message: Dict[str, Any]) -> None:
        if not self._client:
            raise RuntimeError("Redis broker is not connected.")
        payload_str = json.dumps(message)
        await self._client.publish(channel, payload_str)

    async def subscribe(self, channel: str) -> AsyncGenerator[Dict[str, Any], None]:
        if not self._client:
            raise RuntimeError("Redis broker is not connected.")
        pubsub = self._client.pubsub()
        await pubsub.subscribe(channel)
        try:
            async for raw_message in pubsub.listen():
                if raw_message and raw_message.get("type") == "message":
                    data = raw_message.get("data")
                    if isinstance(data, str):
                        yield json.loads(data)
                    elif isinstance(data, dict):
                        yield data
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()

    async def enqueue(self, queue_name: str, item: Dict[str, Any]) -> None:
        if not self._client:
            raise RuntimeError("Redis broker is not connected.")
        await self._client.lpush(queue_name, json.dumps(item))

    async def dequeue(self, queue_name: str, timeout: float = 1.0) -> Optional[Dict[str, Any]]:
        if not self._client:
            raise RuntimeError("Redis broker is not connected.")
        # brpop with integer timeout in seconds
        result = await self._client.brpop(queue_name, timeout=max(1, int(timeout)))
        if result:
            _, item_data = result
            return json.loads(item_data)
        return None

    async def get_cached_value(self, key: str) -> Optional[str]:
        if not self._client:
            return None
        try:
            return await self._client.get(key)
        except Exception:
            return None

    async def set_cached_value(self, key: str, value: str, ttl: int = 300) -> None:
        if self._client:
            try:
                await self._client.set(key, value, ex=ttl)
            except Exception:
                pass


class RabbitMQMessageBroker(BaseMessageBroker):
    """
    Enterprise RabbitMQ async broker utilizing aio-pika with robust exchanges and queues.
    """

    def __init__(self, amqp_url: str) -> None:
        self._amqp_url = amqp_url
        self._connection: Any = None
        self._channel: Any = None

    async def connect(self) -> None:
        try:
            import aio_pika
            self._connection = await aio_pika.connect_robust(self._amqp_url)
            self._channel = await self._connection.channel()
            logger.info(f"[Broker] Connected successfully to RabbitMQ at {self._amqp_url}")
        except Exception as exc:
            logger.warning(f"[Broker] Could not connect to RabbitMQ: {exc}")
            raise exc

    async def disconnect(self) -> None:
        if self._connection and not self._connection.is_closed:
            await self._connection.close()
            logger.info("[Broker] RabbitMQ connection closed.")

    async def publish(self, channel: str, message: Dict[str, Any]) -> None:
        import aio_pika
        if not self._channel:
            raise RuntimeError("RabbitMQ channel is not open.")
        exchange = await self._channel.declare_exchange(
            settings.EMERGENCY_EXCHANGE,
            aio_pika.ExchangeType.TOPIC,
            durable=True,
        )
        msg_body = json.dumps(message).encode("utf-8")
        await exchange.publish(
            aio_pika.Message(body=msg_body, content_type="application/json"),
            routing_key=channel,
        )

    async def subscribe(self, channel: str) -> AsyncGenerator[Dict[str, Any], None]:
        import aio_pika
        if not self._channel:
            raise RuntimeError("RabbitMQ channel is not open.")
        exchange = await self._channel.declare_exchange(
            settings.EMERGENCY_EXCHANGE,
            aio_pika.ExchangeType.TOPIC,
            durable=True,
        )
        queue = await self._channel.declare_queue(exclusive=True)
        await queue.bind(exchange, routing_key=channel)
        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                async with message.process():
                    yield json.loads(message.body.decode())

    async def enqueue(self, queue_name: str, item: Dict[str, Any]) -> None:
        import aio_pika
        if not self._channel:
            raise RuntimeError("RabbitMQ channel is not open.")
        queue = await self._channel.declare_queue(queue_name, durable=True)
        msg_body = json.dumps(item).encode("utf-8")
        await self._channel.default_exchange.publish(
            aio_pika.Message(
                body=msg_body,
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                content_type="application/json",
            ),
            routing_key=queue_name,
        )

    async def dequeue(self, queue_name: str, timeout: float = 1.0) -> Optional[Dict[str, Any]]:
        if not self._channel:
            raise RuntimeError("RabbitMQ channel is not open.")
        queue = await self._channel.declare_queue(queue_name, durable=True)
        try:
            incoming_message = await asyncio.wait_for(queue.get(no_ack=False), timeout=timeout)
            if incoming_message:
                async with incoming_message.process():
                    return json.loads(incoming_message.body.decode())
        except (asyncio.TimeoutError, Exception):
            return None
        return None

    async def get_cached_value(self, key: str) -> Optional[str]:
        return None

    async def set_cached_value(self, key: str, value: str, ttl: int = 300) -> None:
        pass


class BrokerManager:
    """
    Singleton connection manager handling the lifecycle of the active Message Broker.
    Selects Redis, RabbitMQ, or In-Memory broker based on configuration and availability.
    """

    def __init__(self) -> None:
        self._broker: Optional[BaseMessageBroker] = None

    def get_broker(self) -> BaseMessageBroker:
        if self._broker is None:
            self._broker = MemoryMessageBroker()
        return self._broker

    async def start(self) -> None:
        """
        Initializes broker based on settings with auto-fallback for seamless local orchestration.
        """
        broker_type = settings.BROKER_TYPE.lower()
        if broker_type == "redis":
            try:
                redis_broker = RedisMessageBroker(settings.REDIS_URL)
                await redis_broker.connect()
                self._broker = redis_broker
                return
            except Exception:
                logger.info("[BrokerManager] Switching to resilient In-Memory broker.")
        elif broker_type == "rabbitmq":
            try:
                rabbitmq_broker = RabbitMQMessageBroker(settings.RABBITMQ_URL)
                await rabbitmq_broker.connect()
                self._broker = rabbitmq_broker
                return
            except Exception:
                logger.info("[BrokerManager] Switching to resilient In-Memory broker.")

        # Default resilient fallback
        mem_broker = MemoryMessageBroker()
        await mem_broker.connect()
        self._broker = mem_broker

    async def stop(self) -> None:
        if self._broker:
            await self._broker.disconnect()
            self._broker = None

    async def get_cached_value(self, key: str) -> Optional[str]:
        if self._broker:
            return await self._broker.get_cached_value(key)
        return None

    async def set_cached_value(self, key: str, value: str, ttl: int = 300) -> None:
        if self._broker:
            await self._broker.set_cached_value(key, value, ttl)


# Global singleton instance
broker_manager = BrokerManager()
