"""MongoDB connection management and index creation."""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING, IndexModel
from typing import Optional

from ..config import settings


class Database:
    client: Optional[AsyncIOMotorClient] = None
    database: Optional[AsyncIOMotorDatabase] = None


db = Database()


async def init_db() -> None:
    """Initialize database connection and create indexes."""
    db.client = AsyncIOMotorClient(settings.mongodb_url)
    db.database = db.client[settings.mongodb_database]
    await create_indexes()


async def close_db() -> None:
    """Close database connection."""
    if db.client:
        db.client.close()


async def create_indexes() -> None:
    """Create necessary indexes for all collections."""
    if db.database is None:
        return

    # --- accounts ---
    await db.database["accounts"].create_indexes([
        IndexModel([("accountName", ASCENDING)]),
    ])

    # --- users ---
    await db.database["users"].create_indexes([
        IndexModel([("email", ASCENDING)], unique=True),
        IndexModel([("accountId", ASCENDING)]),
    ])

    # --- voice_profiles ---
    await db.database["voice_profiles"].create_indexes([
        IndexModel([("isEnabled", ASCENDING)]),
    ])

    # --- intake_types ---
    await db.database["intake_types"].create_indexes([
        IndexModel([("intakeTypeName", ASCENDING)]),
    ])

    # --- template_versions ---
    await db.database["template_versions"].create_indexes([
        IndexModel([("intakeTypeId", ASCENDING)]),
        IndexModel([("isPublished", ASCENDING)]),
    ])

    # --- template_sections ---
    await db.database["template_sections"].create_indexes([
        IndexModel([("templateVersionId", ASCENDING)]),
        IndexModel([("sectionOrder", ASCENDING)]),
    ])

    # --- template_questions ---
    await db.database["template_questions"].create_indexes([
        IndexModel([("templateSectionId", ASCENDING)]),
        IndexModel([("questionOrder", ASCENDING)]),
        IndexModel([("questionKey", ASCENDING)]),
    ])

    # --- intakes ---
    await db.database["intakes"].create_indexes([
        IndexModel([("accountId", ASCENDING)]),
        IndexModel([("intakeTypeId", ASCENDING)]),
        IndexModel([("intakeStatus", ASCENDING)]),
        IndexModel([("intakeCodeHash", ASCENDING)]),
    ])

    # --- intake_contributors ---
    await db.database["intake_contributors"].create_indexes([
        IndexModel([("intakeId", ASCENDING)]),
        IndexModel([("email", ASCENDING)]),
    ])

    # --- intake_section_instances ---
    await db.database["intake_section_instances"].create_indexes([
        IndexModel([("intakeId", ASCENDING)]),
        IndexModel([("templateSectionId", ASCENDING)]),
        IndexModel(
            [
                ("intakeId", ASCENDING),
                ("templateSectionId", ASCENDING),
                ("repeatIndex", ASCENDING),
            ],
            unique=True,
            name="uq_section_instance",
        ),
    ])

    # --- intake_question_instances ---
    await db.database["intake_question_instances"].create_indexes([
        IndexModel([("intakeSectionInstanceId", ASCENDING)]),
        IndexModel(
            [
                ("intakeSectionInstanceId", ASCENDING),
                ("templateQuestionId", ASCENDING),
            ],
            unique=True,
            name="uq_question_instance",
        ),
    ])

    # --- answer_revisions ---
    await db.database["answer_revisions"].create_indexes([
        IndexModel([("intakeQuestionInstanceId", ASCENDING)]),
        IndexModel([("createdAt", DESCENDING)]),
    ])

    # --- current_answers ---
    await db.database["current_answers"].create_indexes([
        IndexModel(
            [("intakeQuestionInstanceId", ASCENDING)],
            unique=True,
            name="uq_current_answer",
        ),
    ])

    # --- sessions ---
    await db.database["sessions"].create_indexes([
        IndexModel([("intakeId", ASCENDING)]),
        IndexModel([("sessionType", ASCENDING)]),
        IndexModel([("startedAt", DESCENDING)]),
    ])

    # --- session_participants ---
    await db.database["session_participants"].create_indexes([
        IndexModel([("sessionId", ASCENDING)]),
    ])

    # --- transcripts ---
    await db.database["transcripts"].create_indexes([
        IndexModel([("sessionId", ASCENDING)]),
    ])

    # --- transcript_segments ---
    await db.database["transcript_segments"].create_indexes([
        IndexModel([("transcriptId", ASCENDING)]),
        IndexModel([("startMs", ASCENDING)]),
    ])

    # --- evidence_items ---
    await db.database["evidence_items"].create_indexes([
        IndexModel([("intakeId", ASCENDING)]),
        IndexModel([("sessionId", ASCENDING)]),
    ])

    # --- file_assets ---
    await db.database["file_assets"].create_indexes([
        IndexModel([("intakeId", ASCENDING)]),
    ])

    # --- url_sources ---
    await db.database["url_sources"].create_indexes([
        IndexModel([("intakeId", ASCENDING)]),
    ])

    # --- url_snapshots ---
    await db.database["url_snapshots"].create_indexes([
        IndexModel([("urlSourceId", ASCENDING)]),
        IndexModel([("fetchedAt", DESCENDING)]),
    ])

    # --- follow_up_plans ---
    await db.database["follow_up_plans"].create_indexes([
        IndexModel([("intakeId", ASCENDING)]),
        IndexModel([("status", ASCENDING)]),
        IndexModel([("nextContactAt", ASCENDING)]),
    ])

    # --- usage_ledger ---
    await db.database["usage_ledger"].create_indexes([
        IndexModel([("intakeId", ASCENDING)]),
        IndexModel([("sessionId", ASCENDING)]),
        IndexModel([("usageType", ASCENDING)]),
    ])

    # --- proposals ---
    await db.database["proposals"].create_indexes([
        IndexModel([("intakeId", ASCENDING)]),
        IndexModel([("status", ASCENDING)]),
    ])

    # --- section_assignments ---
    await db.database["section_assignments"].create_indexes([
        IndexModel([("intakeId", ASCENDING)]),
        IndexModel([("intakeContributorId", ASCENDING)]),
        IndexModel(
            [
                ("intakeId", ASCENDING),
                ("intakeContributorId", ASCENDING),
                ("intakeSectionInstanceId", ASCENDING),
            ],
            unique=True,
            name="uq_section_assignment",
        ),
    ])


def get_collection(name: str):
    """Get a collection from the database."""
    if db.database is None:
        raise RuntimeError("Database not initialized")
    return db.database[name]
