"""Parse natural language availability descriptions into structured preferences."""

import re
from datetime import datetime, timedelta
from typing import Optional
from bson import ObjectId

from ..models.waitlist import (
    AvailabilityPreference,
    TIME_KEYWORDS,
    DAY_KEYWORDS,
    URGENCY_KEYWORDS,
    FLEXIBILITY_KEYWORDS,
)
from ..core.database import get_collection


def parse_time_range(text: str) -> list[dict]:
    """Extract time ranges from text like '2-4pm' or '9am to 12pm'."""
    ranges = []

    # Pattern for time ranges like "2-4pm", "9am-12pm", "2:30-4:30pm"
    time_pattern = r'(\d{1,2}(?::\d{2})?)\s*(?:am|pm)?\s*[-–to]+\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)?'

    for match in re.finditer(time_pattern, text.lower()):
        start_str, end_str, period = match.groups()

        # Parse start time
        start_hour = int(start_str.split(':')[0])
        start_min = int(start_str.split(':')[1]) if ':' in start_str else 0

        # Parse end time
        end_hour = int(end_str.split(':')[0])
        end_min = int(end_str.split(':')[1]) if ':' in end_str else 0

        # Apply AM/PM
        if period == 'pm':
            if end_hour < 12:
                end_hour += 12
            # If start is smaller than end and we know end is PM
            if start_hour < end_hour - 12:
                start_hour += 12
        elif period == 'am':
            pass  # Already in AM

        # Handle implicit PM (e.g., "2-4" when salon is open afternoon)
        if start_hour < 8 and end_hour < 8:
            start_hour += 12
            end_hour += 12

        ranges.append({
            "start": f"{start_hour:02d}:{start_min:02d}",
            "end": f"{end_hour:02d}:{end_min:02d}",
        })

    return ranges


def parse_days(text: str) -> list[int]:
    """Extract day preferences from text."""
    days = set()
    text_lower = text.lower()

    for keyword, day_value in DAY_KEYWORDS.items():
        if keyword in text_lower:
            if isinstance(day_value, list):
                days.update(day_value)
            else:
                days.add(day_value)

    return sorted(list(days))


async def parse_staff_preferences(text: str, salon_id: ObjectId) -> tuple[list[str], bool]:
    """Extract staff preferences from text."""
    staff_collection = get_collection("staff")

    # Get all active staff for this salon
    cursor = staff_collection.find({
        "salon_id": salon_id,
        "is_active": True,
        "$or": [{"deleted_at": None}, {"deleted_at": {"$exists": False}}],
    })
    staff_list = await cursor.to_list(length=None)

    preferred_staff_ids = []
    text_lower = text.lower()

    # Check for staff names in the text
    for staff in staff_list:
        first_name = staff["first_name"].lower()
        display_name = (staff.get("display_name") or "").lower()

        if first_name in text_lower or (display_name and display_name in text_lower):
            preferred_staff_ids.append(str(staff["_id"]))

    # Check for "any" or "anyone" indicating flexibility
    any_staff_ok = not preferred_staff_ids or any(
        word in text_lower for word in ["any", "anyone", "whoever", "doesn't matter"]
    )

    return preferred_staff_ids, any_staff_ok


def parse_urgency(text: str) -> bool:
    """Check if the request indicates urgency."""
    text_lower = text.lower()
    return any(keyword in text_lower for keyword in URGENCY_KEYWORDS)


def parse_flexibility(text: str) -> bool:
    """Check if the request indicates flexibility."""
    text_lower = text.lower()
    return any(keyword in text_lower for keyword in FLEXIBILITY_KEYWORDS)


def parse_time_of_day(text: str) -> tuple[bool, bool, bool]:
    """Parse general time of day preferences."""
    text_lower = text.lower()

    morning_ok = True
    afternoon_ok = True
    evening_ok = True

    # Check for explicit preferences
    if "morning" in text_lower and "afternoon" not in text_lower and "evening" not in text_lower:
        afternoon_ok = False
        evening_ok = False
    elif "afternoon" in text_lower and "morning" not in text_lower and "evening" not in text_lower:
        morning_ok = False
        evening_ok = False
    elif "evening" in text_lower and "morning" not in text_lower and "afternoon" not in text_lower:
        morning_ok = False
        afternoon_ok = False

    # Check for negatives
    if "not morning" in text_lower or "no morning" in text_lower:
        morning_ok = False
    if "not afternoon" in text_lower or "no afternoon" in text_lower:
        afternoon_ok = False
    if "not evening" in text_lower or "no evening" in text_lower:
        evening_ok = False

    return morning_ok, afternoon_ok, evening_ok


async def parse_availability_description(
    description: str,
    salon_id: ObjectId,
    preferred_staff_id: Optional[str] = None,
    expires_in_days: int = 30,
) -> AvailabilityPreference:
    """Parse a natural language availability description into structured preferences."""

    # Parse staff preferences
    staff_ids, any_staff_ok = await parse_staff_preferences(description, salon_id)
    if preferred_staff_id:
        staff_ids = [preferred_staff_id] + [s for s in staff_ids if s != preferred_staff_id]
        any_staff_ok = False

    # Parse time ranges
    time_ranges = parse_time_range(description)

    # If no explicit time ranges, check for time-of-day keywords
    if not time_ranges:
        for keyword, time_range in TIME_KEYWORDS.items():
            if keyword in description.lower():
                time_ranges.append(time_range)

    # Parse days
    preferred_days = parse_days(description)

    # Parse time of day preferences
    morning_ok, afternoon_ok, evening_ok = parse_time_of_day(description)

    # Parse urgency and flexibility
    is_urgent = parse_urgency(description)
    flexible = parse_flexibility(description)

    # Calculate date range
    now = datetime.utcnow()
    earliest_date = now
    latest_date = now + timedelta(days=expires_in_days)

    return AvailabilityPreference(
        preferred_staff_ids=staff_ids,
        any_staff_ok=any_staff_ok,
        preferred_days=preferred_days,
        preferred_time_ranges=time_ranges,
        morning_ok=morning_ok,
        afternoon_ok=afternoon_ok,
        evening_ok=evening_ok,
        is_urgent=is_urgent,
        flexible=flexible,
        earliest_date=earliest_date,
        latest_date=latest_date,
    )
