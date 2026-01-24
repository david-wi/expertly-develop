"""Knowledge capture and routing service."""

from uuid import UUID
from typing import Optional, List, Tuple
from datetime import datetime, timezone
import re

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models import Knowledge, Person, Client, Project, Playbook, Log
from app.models.knowledge import KnowledgeStatus, KnowledgeCategory
from app.models.playbook import PlaybookStatus
from app.models.log import LogActor
from app.schemas.knowledge import (
    KnowledgeCapture,
    KnowledgeResponse,
    RoutingResult,
    TRIGGER_PHRASES,
)


class KnowledgeService:
    """Service for knowledge capture and routing."""

    def __init__(self, db: AsyncSession, tenant_id: UUID, user_id: Optional[UUID] = None):
        self.db = db
        self.tenant_id = tenant_id
        self.user_id = user_id

    async def capture(self, data: KnowledgeCapture) -> Tuple[Knowledge, Optional[RoutingResult]]:
        """
        Capture knowledge and route it to the appropriate entity.

        Returns the knowledge entry and routing result.
        """
        # Create knowledge entry
        knowledge = Knowledge(
            tenant_id=self.tenant_id,
            source_task_id=data.source_task_id,
            source_type="task" if data.source_task_id else "manual",
            trigger_phrase=data.trigger_phrase,
            content=data.content,
            category=data.category,
            status=KnowledgeStatus.CAPTURED,
            learned_at=datetime.now(timezone.utc).isoformat(),
        )
        self.db.add(knowledge)
        await self.db.flush()

        # Route to appropriate entity
        routing_result = await self._route_knowledge(knowledge)

        await self._log_action(
            "knowledge.captured",
            "knowledge",
            knowledge.id,
            {
                "category": data.category,
                "routed_to": routing_result.type if routing_result else None,
            },
        )

        return knowledge, routing_result

    async def _route_knowledge(self, knowledge: Knowledge) -> Optional[RoutingResult]:
        """Route knowledge to the appropriate entity based on category."""
        category = knowledge.category
        content = knowledge.content

        if category == KnowledgeCategory.PLAYBOOK:
            return await self._route_to_playbook(knowledge)

        elif category == KnowledgeCategory.PERSON:
            return await self._route_to_person(knowledge)

        elif category == KnowledgeCategory.CLIENT:
            return await self._route_to_client(knowledge)

        elif category == KnowledgeCategory.PROJECT:
            return await self._route_to_project(knowledge)

        elif category == KnowledgeCategory.RULE:
            return await self._route_to_rules_playbook(knowledge)

        elif category == KnowledgeCategory.SETTING:
            # Settings go to pending review for now
            knowledge.status = KnowledgeStatus.PENDING_REVIEW
            return RoutingResult(
                type="setting",
                action_taken="Marked for user settings review",
            )

        return None

    async def _route_to_playbook(self, knowledge: Knowledge) -> RoutingResult:
        """Create a proposed playbook from knowledge."""
        # Extract a name from the content (first line or first N words)
        lines = knowledge.content.strip().split('\n')
        name = lines[0][:100] if lines else "Untitled Playbook"

        playbook = Playbook(
            tenant_id=self.tenant_id,
            name=name,
            description=knowledge.content[:500],
            content=knowledge.content,
            learned_from=f"Captured on {knowledge.learned_at}",
            source_task_id=knowledge.source_task_id,
            status=PlaybookStatus.PROPOSED,
        )
        self.db.add(playbook)
        await self.db.flush()

        knowledge.routed_to_type = "playbook"
        knowledge.routed_to_id = playbook.id
        knowledge.status = KnowledgeStatus.ROUTED

        return RoutingResult(
            type="playbook",
            id=playbook.id,
            action_taken=f"Created proposed playbook: {name}",
        )

    async def _route_to_person(self, knowledge: Knowledge) -> RoutingResult:
        """Update or create a person with the knowledge."""
        # Try to extract a person name from content
        person_name = self._extract_person_name(knowledge.content)

        if person_name:
            # Try to find existing person
            result = await self.db.execute(
                select(Person).where(
                    and_(
                        Person.tenant_id == self.tenant_id,
                        Person.name.ilike(f"%{person_name}%"),
                    )
                ).limit(1)
            )
            person = result.scalar_one_or_none()

            if person:
                # Append to context_notes
                timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                person.context_notes = (
                    f"{person.context_notes or ''}\n\n[{timestamp}] {knowledge.content}"
                ).strip()

                knowledge.routed_to_type = "person"
                knowledge.routed_to_id = person.id
                knowledge.status = KnowledgeStatus.ROUTED

                await self.db.flush()

                return RoutingResult(
                    type="person",
                    id=person.id,
                    field_updated="context_notes",
                    action_taken=f"Updated {person.name}'s context_notes",
                )

        # Couldn't find person, mark for review
        knowledge.status = KnowledgeStatus.PENDING_REVIEW
        return RoutingResult(
            type="person",
            action_taken="Could not find person to update, marked for review",
        )

    async def _route_to_client(self, knowledge: Knowledge) -> RoutingResult:
        """Update a client with the knowledge."""
        # Try to find client name in content
        client_name = self._extract_entity_name(knowledge.content, "client")

        if client_name:
            result = await self.db.execute(
                select(Client).where(
                    and_(
                        Client.tenant_id == self.tenant_id,
                        Client.name.ilike(f"%{client_name}%"),
                    )
                ).limit(1)
            )
            client = result.scalar_one_or_none()

            if client:
                timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                client.notes = (
                    f"{client.notes or ''}\n\n[{timestamp}] {knowledge.content}"
                ).strip()

                knowledge.routed_to_type = "client"
                knowledge.routed_to_id = client.id
                knowledge.status = KnowledgeStatus.ROUTED

                await self.db.flush()

                return RoutingResult(
                    type="client",
                    id=client.id,
                    field_updated="notes",
                    action_taken=f"Updated {client.name}'s notes",
                )

        knowledge.status = KnowledgeStatus.PENDING_REVIEW
        return RoutingResult(
            type="client",
            action_taken="Could not find client to update, marked for review",
        )

    async def _route_to_project(self, knowledge: Knowledge) -> RoutingResult:
        """Update a project with the knowledge."""
        project_name = self._extract_entity_name(knowledge.content, "project")

        if project_name:
            result = await self.db.execute(
                select(Project).where(
                    and_(
                        Project.tenant_id == self.tenant_id,
                        Project.name.ilike(f"%{project_name}%"),
                    )
                ).limit(1)
            )
            project = result.scalar_one_or_none()

            if project:
                timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                project.description = (
                    f"{project.description or ''}\n\n[{timestamp}] {knowledge.content}"
                ).strip()

                knowledge.routed_to_type = "project"
                knowledge.routed_to_id = project.id
                knowledge.status = KnowledgeStatus.ROUTED

                await self.db.flush()

                return RoutingResult(
                    type="project",
                    id=project.id,
                    field_updated="description",
                    action_taken=f"Updated {project.name}'s description",
                )

        knowledge.status = KnowledgeStatus.PENDING_REVIEW
        return RoutingResult(
            type="project",
            action_taken="Could not find project to update, marked for review",
        )

    async def _route_to_rules_playbook(self, knowledge: Knowledge) -> RoutingResult:
        """Add to or create a rules playbook."""
        # Find or create rules playbook
        result = await self.db.execute(
            select(Playbook).where(
                and_(
                    Playbook.tenant_id == self.tenant_id,
                    Playbook.name == "Company Rules",
                    Playbook.status == PlaybookStatus.ACTIVE,
                )
            )
        )
        rules_playbook = result.scalar_one_or_none()

        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        if rules_playbook:
            rules_playbook.content = (
                f"{rules_playbook.content}\n\n## [{timestamp}]\n{knowledge.content}"
            )
            knowledge.routed_to_id = rules_playbook.id
            action = "Added rule to Company Rules playbook"
            await self.db.flush()
        else:
            rules_playbook = Playbook(
                tenant_id=self.tenant_id,
                name="Company Rules",
                description="Company-specific rules, terminology, and conventions",
                category="rules",
                content=f"# Company Rules\n\n## [{timestamp}]\n{knowledge.content}",
                must_consult=False,
                status=PlaybookStatus.ACTIVE,
            )
            self.db.add(rules_playbook)
            await self.db.flush()
            knowledge.routed_to_id = rules_playbook.id
            action = "Created Company Rules playbook with rule"

        knowledge.routed_to_type = "playbook"
        knowledge.status = KnowledgeStatus.ROUTED

        return RoutingResult(
            type="playbook",
            id=rules_playbook.id,
            action_taken=action,
        )

    def _extract_person_name(self, content: str) -> Optional[str]:
        """Try to extract a person's name from content."""
        # Simple heuristic: look for capitalized words at start
        # In production, could use NER
        words = content.split()
        if len(words) >= 2:
            # Check if first two words could be a name (capitalized)
            if words[0][0].isupper() and words[1][0].isupper():
                return f"{words[0]} {words[1]}"
        return None

    def _extract_entity_name(self, content: str, entity_type: str) -> Optional[str]:
        """Try to extract an entity name from content."""
        # Split into words and find entity type keyword
        words = content.split()
        entity_lower = entity_type.lower()

        # Pattern 1: "Client Acme Corp" - entity type followed by capitalized words
        for i, word in enumerate(words):
            if word.lower() == entity_lower and i + 1 < len(words):
                # Collect consecutive capitalized words after entity type
                name_words = []
                for j in range(i + 1, len(words)):
                    if words[j] and words[j][0].isupper():
                        name_words.append(words[j])
                    else:
                        break
                if name_words:
                    return " ".join(name_words)

        # Pattern 2: "Acme Corp client" - capitalized words before entity type
        for i, word in enumerate(words):
            if word.lower() == entity_lower and i > 0:
                # Collect consecutive capitalized words before entity type
                name_words = []
                for j in range(i - 1, -1, -1):
                    if words[j] and words[j][0].isupper():
                        name_words.insert(0, words[j])
                    else:
                        break
                if name_words:
                    return " ".join(name_words)

        return None

    async def list_knowledge(
        self,
        status: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Knowledge]:
        """List knowledge entries."""
        query = select(Knowledge).where(Knowledge.tenant_id == self.tenant_id)

        if status:
            query = query.where(Knowledge.status == status)
        if category:
            query = query.where(Knowledge.category == category)

        query = query.order_by(Knowledge.created_at.desc())
        query = query.limit(limit).offset(offset)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_pending(self, limit: int = 50) -> List[Knowledge]:
        """Get knowledge entries pending review."""
        return await self.list_knowledge(status=KnowledgeStatus.PENDING_REVIEW, limit=limit)

    async def dismiss(self, knowledge_id: UUID, reason: Optional[str] = None) -> Optional[Knowledge]:
        """Dismiss a knowledge entry."""
        result = await self.db.execute(
            select(Knowledge).where(
                and_(
                    Knowledge.id == knowledge_id,
                    Knowledge.tenant_id == self.tenant_id,
                )
            )
        )
        knowledge = result.scalar_one_or_none()

        if not knowledge:
            return None

        knowledge.status = KnowledgeStatus.DISMISSED
        await self.db.flush()

        await self._log_action("knowledge.dismissed", "knowledge", knowledge_id, {"reason": reason})

        return knowledge

    def get_trigger_phrases(self) -> List[str]:
        """Get list of trigger phrases that should force knowledge capture."""
        return TRIGGER_PHRASES

    def detect_trigger_phrase(self, text: str) -> Optional[str]:
        """Detect if text contains a trigger phrase."""
        text_lower = text.lower()
        for phrase in TRIGGER_PHRASES:
            if phrase in text_lower:
                return phrase
        return None

    async def _log_action(
        self,
        action: str,
        entity_type: str,
        entity_id: UUID,
        details: dict = None,
    ) -> None:
        """Create an audit log entry."""
        log = Log.create(
            tenant_id=self.tenant_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=self.user_id,
            actor=LogActor.CLAUDE,
            details=details or {},
        )
        self.db.add(log)
