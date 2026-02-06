from fastapi import APIRouter, HTTPException
from app.database import get_database
from app.schemas.settings import SettingsUpdate, SettingsResponse, TestResult
from app.config import get_settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
async def get_app_settings():
    db = get_database()
    settings = await db.app_settings.find_one({})
    config = get_settings()

    if not settings:
        return {
            "anthropic_api_key_set": bool(config.anthropic_api_key),
            "sec_edgar_user_agent": config.sec_edgar_user_agent,
            "queue_batch_size": config.queue_batch_size,
            "default_model": config.default_model,
        }

    # API key is set if either DB or env var has it
    api_key_set = bool(settings.get("anthropic_api_key")) or bool(config.anthropic_api_key)

    return {
        "anthropic_api_key_set": api_key_set,
        "sec_edgar_user_agent": settings.get("sec_edgar_user_agent", config.sec_edgar_user_agent),
        "queue_batch_size": settings.get("queue_batch_size", config.queue_batch_size),
        "default_model": settings.get("default_model", config.default_model),
    }


@router.patch("")
async def update_app_settings(data: SettingsUpdate):
    db = get_database()
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    await db.app_settings.update_one(
        {},
        {"$set": update_data},
        upsert=True
    )
    return await get_app_settings()


@router.post("/test-claude")
async def test_claude():
    try:
        db = get_database()
        settings_doc = await db.app_settings.find_one({})
        config = get_settings()

        api_key = (settings_doc or {}).get("anthropic_api_key") or config.anthropic_api_key
        if not api_key:
            return TestResult(success=False, message="No API key configured")

        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=50,
            messages=[{"role": "user", "content": "Say 'Connection successful' and nothing else."}]
        )
        return TestResult(success=True, message=response.content[0].text)
    except Exception as e:
        return TestResult(success=False, message=str(e))


@router.post("/test-sec")
async def test_sec():
    try:
        db = get_database()
        settings_doc = await db.app_settings.find_one({})
        config = get_settings()

        user_agent = (settings_doc or {}).get("sec_edgar_user_agent") or config.sec_edgar_user_agent
        if not user_agent:
            return TestResult(success=False, message="No SEC EDGAR user agent configured")

        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://data.sec.gov/submissions/CIK0000320193.json",
                headers={"User-Agent": user_agent},
                timeout=10.0,
            )
            if resp.status_code == 200:
                data = resp.json()
                return TestResult(success=True, message=f"Connected - retrieved data for {data.get('name', 'unknown')}")
            return TestResult(success=False, message=f"SEC EDGAR returned status {resp.status_code}")
    except Exception as e:
        return TestResult(success=False, message=str(e))
