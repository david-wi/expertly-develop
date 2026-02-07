"""Answer management service.

Handles answer revisions, current-answer selection, question status
changes, and conflict detection across contributors.
"""

from datetime import datetime, timezone
from typing import Any, Optional

from bson import ObjectId

from ..core.database import get_collection


# ---------------------------------------------------------------------------
# Collection helpers
# ---------------------------------------------------------------------------

def _answer_revisions():
    return get_collection("answer_revisions")


def _current_answers():
    return get_collection("current_answers")


def _question_instances():
    return get_collection("intake_question_instances")


def _section_instances():
    return get_collection("intake_section_instances")


def _evidence_items():
    return get_collection("evidence_items")


# ---------------------------------------------------------------------------
# Revision management
# ---------------------------------------------------------------------------

async def create_revision(
    question_instance_id: str,
    answer_value: Any,
    *,
    source: str = "manual",
    contributor_id: Optional[str] = None,
    evidence_id: Optional[str] = None,
    set_as_current: bool = True,
) -> dict:
    """Create a new answer revision for a question instance.

    Args:
        question_instance_id: The intake question instance to answer.
        answer_value: The answer payload (string, dict, list -- whatever
            the question type requires).
        source: Origin of the answer (``manual``, ``voice``, ``import``, etc.).
        contributor_id: Optional contributor who provided the answer.
        evidence_id: Optional link to an evidence item supporting the answer.
        set_as_current: If ``True`` (default), also upserts the current
            answer pointer to this revision.

    Returns:
        Dict with ``answerRevisionId`` and optionally ``currentAnswerId``.
    """
    now = datetime.now(timezone.utc)

    revision_doc = {
        "intakeQuestionInstanceId": question_instance_id,
        "answerValue": answer_value,
        "source": source,
        "contributorId": contributor_id,
        "evidenceId": evidence_id,
        "createdAt": now,
    }
    result = await _answer_revisions().insert_one(revision_doc)
    revision_id = str(result.inserted_id)

    current_id: Optional[str] = None
    if set_as_current:
        current_id = await _set_current(question_instance_id, revision_id, answer_value)
        # Also mark the question as answered
        await _question_instances().update_one(
            {"_id": ObjectId(question_instance_id)},
            {"$set": {"questionStatus": "answered", "updatedAt": now}},
        )

    return {
        "answerRevisionId": revision_id,
        "currentAnswerId": current_id,
    }


async def _set_current(
    question_instance_id: str,
    revision_id: str,
    answer_value: Any,
) -> Optional[str]:
    """Upsert the current_answers record for a question instance.

    Returns:
        The ``_id`` of the current_answers document as a string.
    """
    now = datetime.now(timezone.utc)
    await _current_answers().update_one(
        {"intakeQuestionInstanceId": question_instance_id},
        {
            "$set": {
                "intakeQuestionInstanceId": question_instance_id,
                "answerRevisionId": revision_id,
                "answerValue": answer_value,
                "updatedAt": now,
            }
        },
        upsert=True,
    )
    doc = await _current_answers().find_one(
        {"intakeQuestionInstanceId": question_instance_id}
    )
    return str(doc["_id"]) if doc else None


# ---------------------------------------------------------------------------
# Current answer selection
# ---------------------------------------------------------------------------

async def choose_current(
    question_instance_id: str,
    revision_id: str,
) -> dict:
    """Switch the current answer pointer to a different revision.

    Useful when a reviewer prefers an earlier revision over the latest one.

    Returns:
        Dict with ``currentAnswerId`` and ``answerRevisionId``.

    Raises:
        ValueError: If the revision does not exist or does not belong to
            the specified question instance.
    """
    revision = await _answer_revisions().find_one({"_id": ObjectId(revision_id)})
    if not revision:
        raise ValueError(f"Answer revision '{revision_id}' not found")
    if revision.get("intakeQuestionInstanceId") != question_instance_id:
        raise ValueError(
            f"Revision '{revision_id}' does not belong to question instance "
            f"'{question_instance_id}'"
        )

    answer_value = revision.get("answerValue")
    current_id = await _set_current(question_instance_id, revision_id, answer_value)

    # Ensure question status is "answered"
    now = datetime.now(timezone.utc)
    await _question_instances().update_one(
        {"_id": ObjectId(question_instance_id)},
        {"$set": {"questionStatus": "answered", "updatedAt": now}},
    )

    return {
        "currentAnswerId": current_id,
        "answerRevisionId": revision_id,
    }


# ---------------------------------------------------------------------------
# Question status management
# ---------------------------------------------------------------------------

async def mark_question_status(
    question_instance_id: str,
    status: str,
    *,
    reason: Optional[str] = None,
) -> dict:
    """Mark a question as skipped, later, or not applicable.

    Args:
        question_instance_id: The question instance to update.
        status: One of ``skipped``, ``later``, ``notApplicable``.
        reason: Optional human-readable reason for the status change.

    Returns:
        Dict with the updated ``questionInstanceId`` and ``questionStatus``.

    Raises:
        ValueError: If the status value is not allowed.
    """
    allowed = {"skipped", "later", "notApplicable"}
    if status not in allowed:
        raise ValueError(
            f"Invalid status '{status}'. Must be one of: {', '.join(sorted(allowed))}"
        )

    now = datetime.now(timezone.utc)
    update_fields: dict[str, Any] = {
        "questionStatus": status,
        "updatedAt": now,
    }
    if reason is not None:
        update_fields["statusReason"] = reason

    await _question_instances().update_one(
        {"_id": ObjectId(question_instance_id)},
        {"$set": update_fields},
    )

    return {
        "questionInstanceId": question_instance_id,
        "questionStatus": status,
    }


# ---------------------------------------------------------------------------
# Conflict detection
# ---------------------------------------------------------------------------

async def detect_conflicts(intake_id: str) -> list[dict]:
    """Find questions where multiple contributors gave different answers.

    A *conflict* occurs when a question has two or more answer revisions
    from distinct contributors whose ``answerValue`` fields differ.

    Returns:
        A list of conflict dicts, each containing:
        - ``questionInstanceId``
        - ``templateQuestionId``
        - ``sectionInstanceId``
        - ``revisions``: list of ``{revisionId, contributorId, answerValue, createdAt}``
    """
    # Gather all section instances for the intake
    section_instances = await _section_instances().find(
        {"intakeId": intake_id}
    ).to_list(length=None)

    si_ids = [str(si["_id"]) for si in section_instances]
    if not si_ids:
        return []

    # Gather all question instances in those sections
    question_instances = await _question_instances().find(
        {"intakeSectionInstanceId": {"$in": si_ids}}
    ).to_list(length=None)

    conflicts: list[dict] = []

    for qi in question_instances:
        qi_id = str(qi["_id"])

        # Get all revisions for this question that have a contributor
        revisions = await _answer_revisions().find(
            {
                "intakeQuestionInstanceId": qi_id,
                "contributorId": {"$ne": None},
            }
        ).sort("createdAt", 1).to_list(length=None)

        if len(revisions) < 2:
            continue

        # Group by contributor
        by_contributor: dict[str, list[dict]] = {}
        for rev in revisions:
            cid = rev.get("contributorId", "unknown")
            by_contributor.setdefault(cid, []).append(rev)

        if len(by_contributor) < 2:
            # Only one contributor -- no cross-contributor conflict
            continue

        # Check if the latest answer from each contributor differs
        latest_per_contributor: dict[str, Any] = {}
        for cid, revs in by_contributor.items():
            latest_per_contributor[cid] = revs[-1].get("answerValue")

        unique_values = set()
        for val in latest_per_contributor.values():
            # Convert to a hashable representation for comparison
            unique_values.add(_hashable(val))

        if len(unique_values) > 1:
            conflict_revisions = [
                {
                    "revisionId": str(rev["_id"]),
                    "contributorId": rev.get("contributorId"),
                    "answerValue": rev.get("answerValue"),
                    "createdAt": rev.get("createdAt"),
                }
                for rev in revisions
            ]
            conflicts.append({
                "questionInstanceId": qi_id,
                "templateQuestionId": qi.get("templateQuestionId"),
                "sectionInstanceId": qi.get("intakeSectionInstanceId"),
                "revisions": conflict_revisions,
            })

    return conflicts


def _hashable(value: Any) -> Any:
    """Convert a value to a hashable form for simple equality comparison."""
    if isinstance(value, dict):
        return tuple(sorted((k, _hashable(v)) for k, v in value.items()))
    if isinstance(value, list):
        return tuple(_hashable(v) for v in value)
    return value
