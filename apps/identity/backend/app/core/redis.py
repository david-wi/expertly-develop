import json
from typing import Optional
import redis.asyncio as redis

from app.config import get_settings

settings = get_settings()

# Redis connection pool
redis_pool: Optional[redis.ConnectionPool] = None


async def get_redis() -> redis.Redis:
    """Get Redis connection from pool."""
    global redis_pool
    if redis_pool is None:
        redis_pool = redis.ConnectionPool.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True
        )
    return redis.Redis(connection_pool=redis_pool)


async def close_redis():
    """Close Redis connection pool."""
    global redis_pool
    if redis_pool:
        await redis_pool.disconnect()
        redis_pool = None


# Session cache helpers
SESSION_PREFIX = "session:"
SESSION_TTL = settings.session_expiry_days * 24 * 60 * 60  # Convert days to seconds


async def cache_session(session_token: str, user_data: dict) -> None:
    """Cache session data in Redis."""
    r = await get_redis()
    key = f"{SESSION_PREFIX}{session_token}"
    await r.setex(key, SESSION_TTL, json.dumps(user_data))


async def get_cached_session(session_token: str) -> Optional[dict]:
    """Get cached session data from Redis."""
    r = await get_redis()
    key = f"{SESSION_PREFIX}{session_token}"
    data = await r.get(key)
    if data:
        return json.loads(data)
    return None


async def delete_cached_session(session_token: str) -> None:
    """Delete session from Redis cache."""
    r = await get_redis()
    key = f"{SESSION_PREFIX}{session_token}"
    await r.delete(key)


async def refresh_session_ttl(session_token: str) -> None:
    """Refresh session TTL in Redis."""
    r = await get_redis()
    key = f"{SESSION_PREFIX}{session_token}"
    await r.expire(key, SESSION_TTL)
