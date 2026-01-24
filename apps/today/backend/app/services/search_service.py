"""Search service for full-text search across entities."""

from uuid import UUID
from typing import Optional, List
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func

from app.models import Task, Person, Playbook, Project, Knowledge
from app.models.task import TaskStatus


@dataclass
class SearchResult:
    """A single search result."""
    id: UUID
    entity_type: str  # task, person, playbook, project, knowledge
    title: str
    description: Optional[str]
    match_context: Optional[str]  # Snippet showing the match
    relevance: float  # 0-1 score


class SearchService:
    """Service for searching across entities."""

    SEARCHABLE_TYPES = ["task", "person", "playbook", "project", "knowledge"]

    def __init__(self, db: AsyncSession, tenant_id: UUID):
        self.db = db
        self.tenant_id = tenant_id

    async def search(
        self,
        query: str,
        entity_types: Optional[List[str]] = None,
        limit: int = 20,
    ) -> List[SearchResult]:
        """
        Search across entities for the given query.

        Args:
            query: The search query string
            entity_types: List of entity types to search (defaults to all)
            limit: Maximum number of results per entity type

        Returns:
            List of SearchResult objects sorted by relevance
        """
        if not query or not query.strip():
            return []

        # Default to all searchable types
        if not entity_types:
            entity_types = self.SEARCHABLE_TYPES

        # Validate entity types
        entity_types = [t for t in entity_types if t in self.SEARCHABLE_TYPES]
        if not entity_types:
            return []

        results: List[SearchResult] = []
        search_pattern = f"%{query.lower()}%"

        # Search each entity type
        for entity_type in entity_types:
            if entity_type == "task":
                results.extend(await self._search_tasks(search_pattern, query, limit))
            elif entity_type == "person":
                results.extend(await self._search_people(search_pattern, query, limit))
            elif entity_type == "playbook":
                results.extend(await self._search_playbooks(search_pattern, query, limit))
            elif entity_type == "project":
                results.extend(await self._search_projects(search_pattern, query, limit))
            elif entity_type == "knowledge":
                results.extend(await self._search_knowledge(search_pattern, query, limit))

        # Sort by relevance descending
        results.sort(key=lambda r: -r.relevance)

        return results[:limit]

    async def _search_tasks(
        self, pattern: str, query: str, limit: int
    ) -> List[SearchResult]:
        """Search tasks by title and description."""
        result = await self.db.execute(
            select(Task)
            .where(
                Task.tenant_id == self.tenant_id,
                Task.status.notin_([TaskStatus.CANCELLED]),
                or_(
                    func.lower(Task.title).contains(query.lower()),
                    func.lower(Task.description).contains(query.lower()),
                ),
            )
            .order_by(Task.priority.asc(), Task.created_at.desc())
            .limit(limit)
        )
        tasks = result.scalars().all()

        return [
            SearchResult(
                id=task.id,
                entity_type="task",
                title=task.title,
                description=task.description,
                match_context=self._extract_match_context(
                    task.title + " " + (task.description or ""), query
                ),
                relevance=self._calculate_relevance(task.title, task.description, query),
            )
            for task in tasks
        ]

    async def _search_people(
        self, pattern: str, query: str, limit: int
    ) -> List[SearchResult]:
        """Search people by name, email, title, company."""
        result = await self.db.execute(
            select(Person)
            .where(
                Person.tenant_id == self.tenant_id,
                or_(
                    func.lower(Person.name).contains(query.lower()),
                    func.lower(Person.email).contains(query.lower()),
                    func.lower(Person.title).contains(query.lower()),
                    func.lower(Person.company).contains(query.lower()),
                    func.lower(Person.context_notes).contains(query.lower()),
                ),
            )
            .order_by(Person.name)
            .limit(limit)
        )
        people = result.scalars().all()

        return [
            SearchResult(
                id=person.id,
                entity_type="person",
                title=person.name,
                description=f"{person.title or ''} at {person.company or ''}".strip() or None,
                match_context=self._extract_match_context(
                    f"{person.name} {person.email or ''} {person.title or ''} {person.company or ''}",
                    query,
                ),
                relevance=self._calculate_relevance(
                    person.name, f"{person.title} {person.company}", query
                ),
            )
            for person in people
        ]

    async def _search_playbooks(
        self, pattern: str, query: str, limit: int
    ) -> List[SearchResult]:
        """Search playbooks by name, description, content."""
        from app.models.playbook import PlaybookStatus

        result = await self.db.execute(
            select(Playbook)
            .where(
                Playbook.tenant_id == self.tenant_id,
                Playbook.status == PlaybookStatus.ACTIVE,
                or_(
                    func.lower(Playbook.name).contains(query.lower()),
                    func.lower(Playbook.description).contains(query.lower()),
                    func.lower(Playbook.content).contains(query.lower()),
                ),
            )
            .order_by(Playbook.name)
            .limit(limit)
        )
        playbooks = result.scalars().all()

        return [
            SearchResult(
                id=playbook.id,
                entity_type="playbook",
                title=playbook.name,
                description=playbook.description,
                match_context=self._extract_match_context(
                    f"{playbook.name} {playbook.description} {playbook.content}", query
                ),
                relevance=self._calculate_relevance(
                    playbook.name, playbook.description, query
                ),
            )
            for playbook in playbooks
        ]

    async def _search_projects(
        self, pattern: str, query: str, limit: int
    ) -> List[SearchResult]:
        """Search projects by name and description."""
        result = await self.db.execute(
            select(Project)
            .where(
                Project.tenant_id == self.tenant_id,
                Project.status.in_(["active", "on_hold"]),
                or_(
                    func.lower(Project.name).contains(query.lower()),
                    func.lower(Project.description).contains(query.lower()),
                ),
            )
            .order_by(Project.priority_order, Project.name)
            .limit(limit)
        )
        projects = result.scalars().all()

        return [
            SearchResult(
                id=project.id,
                entity_type="project",
                title=project.name,
                description=project.description,
                match_context=self._extract_match_context(
                    f"{project.name} {project.description or ''}", query
                ),
                relevance=self._calculate_relevance(
                    project.name, project.description, query
                ),
            )
            for project in projects
        ]

    async def _search_knowledge(
        self, pattern: str, query: str, limit: int
    ) -> List[SearchResult]:
        """Search knowledge entries by content and trigger phrase."""
        result = await self.db.execute(
            select(Knowledge)
            .where(
                Knowledge.tenant_id == self.tenant_id,
                or_(
                    func.lower(Knowledge.content).contains(query.lower()),
                    func.lower(Knowledge.trigger_phrase).contains(query.lower()),
                ),
            )
            .order_by(Knowledge.created_at.desc())
            .limit(limit)
        )
        knowledge_items = result.scalars().all()

        return [
            SearchResult(
                id=item.id,
                entity_type="knowledge",
                title=item.trigger_phrase or item.content[:100],
                description=item.content[:200] if len(item.content) > 200 else item.content,
                match_context=self._extract_match_context(item.content, query),
                relevance=self._calculate_relevance(
                    item.trigger_phrase or "", item.content, query
                ),
            )
            for item in knowledge_items
        ]

    def _extract_match_context(self, text: str, query: str, context_chars: int = 100) -> Optional[str]:
        """Extract a snippet around the query match."""
        if not text:
            return None

        text_lower = text.lower()
        query_lower = query.lower()
        pos = text_lower.find(query_lower)

        if pos == -1:
            return None

        start = max(0, pos - context_chars // 2)
        end = min(len(text), pos + len(query) + context_chars // 2)

        snippet = text[start:end].strip()
        if start > 0:
            snippet = "..." + snippet
        if end < len(text):
            snippet = snippet + "..."

        return snippet

    def _calculate_relevance(
        self, title: Optional[str], description: Optional[str], query: str
    ) -> float:
        """Calculate a simple relevance score based on match position and type."""
        score = 0.0
        query_lower = query.lower()

        # Title match (highest weight)
        if title:
            title_lower = title.lower()
            if query_lower == title_lower:
                score += 1.0  # Exact match
            elif title_lower.startswith(query_lower):
                score += 0.8  # Prefix match
            elif query_lower in title_lower:
                score += 0.6  # Contains match

        # Description match (lower weight)
        if description:
            description_lower = description.lower()
            if query_lower in description_lower:
                score += 0.3

        return min(score, 1.0)
