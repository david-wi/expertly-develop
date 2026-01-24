#!/usr/bin/env python3
"""
Data migration script to import data from Claude Cowork folder.

Migrates:
- People (from people.md + people/*.md)
- Clients (from clients/*/overview.md)
- Projects (from projects/*/README.md)
- Playbooks (from playbooks/*.md)
- Waiting items (from waiting.md)
- Questions (from top-questions.md)

Usage:
    python scripts/migrate_data.py --dry-run  # Preview what will be imported
    python scripts/migrate_data.py            # Actually import data
"""

import asyncio
import argparse
import os
import re
import sys
from pathlib import Path
from uuid import uuid4
from datetime import datetime

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# Data source path
DATA_SOURCE = Path("/Users/david/Documents/9999 Cowork - Claude Cowork")


class DataMigrator:
    """Handles data migration from markdown files to database."""

    def __init__(self, session: AsyncSession, dry_run: bool = False):
        self.session = session
        self.dry_run = dry_run
        self.tenant_id = None
        self.user_id = None
        self.stats = {
            "tenant": 0,
            "user": 0,
            "people": 0,
            "clients": 0,
            "projects": 0,
            "playbooks": 0,
            "waiting_items": 0,
            "questions": 0,
        }

    async def run(self):
        """Run the full migration."""
        print("\n" + "=" * 60)
        print("EXPERTLY TODAY DATA MIGRATION")
        print("=" * 60)
        print(f"Source: {DATA_SOURCE}")
        print(f"Mode: {'DRY RUN (no data will be written)' if self.dry_run else 'LIVE'}")
        print("=" * 60 + "\n")

        # Step 1: Create tenant and user
        await self.create_tenant_and_user()

        # Step 2: Migrate people
        await self.migrate_people()

        # Step 3: Migrate clients
        await self.migrate_clients()

        # Step 4: Migrate projects
        await self.migrate_projects()

        # Step 5: Migrate playbooks
        await self.migrate_playbooks()

        # Step 6: Migrate waiting items
        await self.migrate_waiting_items()

        # Step 7: Migrate questions
        await self.migrate_questions()

        # Print summary
        self.print_summary()

        if not self.dry_run:
            await self.session.commit()
            print("\n✅ Migration committed to database!")

    async def create_tenant_and_user(self):
        """Create the tenant and David's user account."""
        from app.models import Tenant, User
        from app.models.base import generate_api_key

        print("Creating tenant and user...")

        # Create tenant
        self.tenant_id = uuid4()
        tenant = Tenant(
            id=self.tenant_id,
            name="Expertly AI",
            slug="expertly-ai",
            database_mode="shared",
            tier="enterprise",
            settings={
                "company": "Expertly AI",
                "timezone": "America/New_York",
            },
        )

        if not self.dry_run:
            self.session.add(tenant)
            await self.session.flush()

        self.stats["tenant"] = 1
        print(f"  ✓ Tenant: Expertly AI (id: {self.tenant_id})")

        # Create David's user
        self.user_id = uuid4()
        api_key = generate_api_key()
        user = User(
            id=self.user_id,
            tenant_id=self.tenant_id,
            email="david@expertly.com",
            name="David Bodnick",
            api_key=api_key,
            role="owner",
            settings={
                "timezone": "America/New_York",
                "location": "Miami, FL",
            },
            timezone="America/New_York",
        )

        if not self.dry_run:
            self.session.add(user)
            await self.session.flush()

        self.stats["user"] = 1
        print(f"  ✓ User: David Bodnick (david@expertly.com)")
        print(f"  ✓ API Key: {api_key[:12]}...{api_key[-4:]}")

    async def migrate_people(self):
        """Migrate people from people.md and people/*.md."""
        from app.models import Person

        print("\nMigrating people...")

        # Parse people.md for the table
        people_md = DATA_SOURCE / "people.md"
        people_data = self._parse_people_table(people_md)

        # Also parse individual people files
        people_dir = DATA_SOURCE / "people"
        if people_dir.exists():
            for file in people_dir.glob("*.md"):
                if file.name == "README.md":
                    continue
                person_data = self._parse_person_file(file)
                if person_data:
                    # Merge with existing or add new
                    name = person_data.get("name", "")
                    existing = next((p for p in people_data if p.get("name", "").lower() == name.lower()), None)
                    if existing:
                        existing.update(person_data)
                    else:
                        people_data.append(person_data)

        # Create Person records
        for data in people_data:
            person = Person(
                id=uuid4(),
                tenant_id=self.tenant_id,
                name=data.get("name", "Unknown"),
                email=data.get("email"),
                title=data.get("title"),
                company=data.get("company"),
                relationship=data.get("relationship", "colleague"),
                context_notes=data.get("notes"),
                communication_notes=data.get("communication_notes"),
            )

            if not self.dry_run:
                self.session.add(person)

            self.stats["people"] += 1
            print(f"  ✓ {person.name}")

        if not self.dry_run:
            await self.session.flush()

    def _parse_people_table(self, file_path: Path) -> list:
        """Parse the markdown table in people.md."""
        people = []

        if not file_path.exists():
            return people

        content = file_path.read_text()

        # Find tables and parse them
        table_pattern = r'\|.*\|.*\|.*\|\n\|[-\s|]+\|\n((?:\|.*\|\n)+)'
        matches = re.findall(table_pattern, content)

        for table_content in matches:
            rows = table_content.strip().split('\n')
            for row in rows:
                cells = [c.strip() for c in row.split('|')[1:-1]]
                if len(cells) >= 2:
                    name = cells[0].replace('**', '').strip()
                    if name and not name.startswith('-'):
                        role = cells[1] if len(cells) > 1 else None
                        notes = cells[2] if len(cells) > 2 else None

                        # Extract email from notes if present
                        email = None
                        email_match = re.search(r'[\w.-]+@[\w.-]+\.\w+', notes or '')
                        if email_match:
                            email = email_match.group(0)

                        people.append({
                            "name": name,
                            "title": role,
                            "notes": notes,
                            "email": email,
                            "company": "Expertly" if "expertly" in (email or "").lower() else "WebINTENSIVE",
                        })

        # Also parse the David section
        if "David Bodnick" not in [p.get("name") for p in people]:
            people.append({
                "name": "David Bodnick",
                "email": "david@expertly.com",
                "title": "Founder/CEO",
                "company": "Expertly AI",
                "relationship": "self",
                "notes": "Reviews technical proposals, manages product direction. Location: Miami, FL",
            })

        return people

    def _parse_person_file(self, file_path: Path) -> dict:
        """Parse an individual person's markdown file."""
        content = file_path.read_text()
        data = {}

        # Extract name from first heading
        name_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
        if name_match:
            data["name"] = name_match.group(1).strip()

        # Extract email
        email_match = re.search(r'Email:\s*([\w.-]+@[\w.-]+\.\w+)', content, re.IGNORECASE)
        if email_match:
            data["email"] = email_match.group(1)

        # Extract role
        role_match = re.search(r'##\s*Role\s*\n([^#]+)', content, re.IGNORECASE)
        if role_match:
            role_content = role_match.group(1).strip()
            # Get first bullet point
            bullet = re.search(r'^[-*]\s*(.+)$', role_content, re.MULTILINE)
            if bullet:
                data["title"] = bullet.group(1).strip()

        return data

    async def migrate_clients(self):
        """Migrate clients from clients/ directory."""
        from app.models import Client

        print("\nMigrating clients...")

        clients_dir = DATA_SOURCE / "clients"
        if not clients_dir.exists():
            print("  (no clients directory found)")
            return

        for client_dir in clients_dir.iterdir():
            if not client_dir.is_dir():
                continue

            # Look for overview.md or README.md
            overview = client_dir / "overview.md"
            if not overview.exists():
                overview = client_dir / "README.md"
            if not overview.exists():
                continue

            data = self._parse_client_file(overview, client_dir.name)

            client = Client(
                id=uuid4(),
                tenant_id=self.tenant_id,
                name=data.get("name", client_dir.name.replace("-", " ").title()),
                status="active",
                notes=data.get("notes"),
            )

            if not self.dry_run:
                self.session.add(client)

            self.stats["clients"] += 1
            print(f"  ✓ {client.name}")

        if not self.dry_run:
            await self.session.flush()

    def _parse_client_file(self, file_path: Path, dir_name: str) -> dict:
        """Parse a client overview file."""
        content = file_path.read_text()
        data = {}

        # Extract name from first heading
        name_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
        if name_match:
            data["name"] = name_match.group(1).strip()
            # Clean up name
            data["name"] = re.sub(r'\s*/.*$', '', data["name"])  # Remove "/ Other info"

        # Get overview/notes
        overview_match = re.search(r'##\s*(Overview|Status|Contact)\s*\n([^#]+)', content, re.IGNORECASE)
        if overview_match:
            data["notes"] = overview_match.group(2).strip()[:500]

        return data

    async def migrate_projects(self):
        """Migrate projects from projects/ directory."""
        from app.models import Project

        print("\nMigrating projects...")

        projects_dir = DATA_SOURCE / "projects"
        if not projects_dir.exists():
            print("  (no projects directory found)")
            return

        for project_dir in projects_dir.iterdir():
            if not project_dir.is_dir():
                continue

            # Look for README.md or overview.md
            readme = project_dir / "README.md"
            if not readme.exists():
                readme = project_dir / "overview.md"
            if not readme.exists():
                continue

            data = self._parse_project_file(readme, project_dir.name)

            project = Project(
                id=uuid4(),
                tenant_id=self.tenant_id,
                user_id=self.user_id,
                name=data.get("name", project_dir.name.replace("-", " ").title()),
                description=data.get("description"),
                project_type="project",
                status="active",
            )

            if not self.dry_run:
                self.session.add(project)

            self.stats["projects"] += 1
            print(f"  ✓ {project.name}")

        if not self.dry_run:
            await self.session.flush()

    def _parse_project_file(self, file_path: Path, dir_name: str) -> dict:
        """Parse a project README file."""
        content = file_path.read_text()
        data = {}

        # Extract name from first heading
        name_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
        if name_match:
            data["name"] = name_match.group(1).strip()

        # Get overview
        overview_match = re.search(r'##\s*Overview\s*\n([^#]+)', content, re.IGNORECASE)
        if overview_match:
            data["description"] = overview_match.group(1).strip()[:1000]
        else:
            # Get first paragraph after title
            para_match = re.search(r'^#[^#].*?\n\n(.+?)(?=\n\n|\n#|$)', content, re.DOTALL)
            if para_match:
                data["description"] = para_match.group(1).strip()[:1000]

        return data

    async def migrate_playbooks(self):
        """Migrate playbooks from playbooks/ directory."""
        from app.models import Playbook
        from app.models.playbook import PlaybookStatus

        print("\nMigrating playbooks...")

        playbooks_dir = DATA_SOURCE / "playbooks"
        if not playbooks_dir.exists():
            print("  (no playbooks directory found)")
            return

        for playbook_file in playbooks_dir.glob("*.md"):
            if playbook_file.name == "README.md":
                continue

            data = self._parse_playbook_file(playbook_file)

            playbook = Playbook(
                id=uuid4(),
                tenant_id=self.tenant_id,
                name=data.get("name", playbook_file.stem.replace("-", " ").title()),
                description=data.get("description", "Imported playbook"),
                category=data.get("category"),
                triggers=data.get("triggers", []),
                must_consult=data.get("must_consult", False),
                content=data.get("content", ""),
                status=PlaybookStatus.ACTIVE,
            )

            if not self.dry_run:
                self.session.add(playbook)

            self.stats["playbooks"] += 1
            print(f"  ✓ {playbook.name}")

        if not self.dry_run:
            await self.session.flush()

    def _parse_playbook_file(self, file_path: Path) -> dict:
        """Parse a playbook markdown file."""
        content = file_path.read_text()
        data = {}

        # Extract name from first heading
        name_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
        if name_match:
            data["name"] = name_match.group(1).strip()

        # Get first paragraph as description
        desc_match = re.search(r'^#[^#].*?\n\n([^#]+?)(?=\n\n|\n#)', content, re.DOTALL)
        if desc_match:
            data["description"] = desc_match.group(1).strip()[:500]

        # Full content
        data["content"] = content

        # Determine category from filename or content
        filename = file_path.stem.lower()
        if "email" in filename or "draft" in filename:
            data["category"] = "communication"
        elif "calendar" in filename or "schedule" in filename:
            data["category"] = "scheduling"
        elif "sales" in filename:
            data["category"] = "sales"
        elif "slack" in filename:
            data["category"] = "communication"
        else:
            data["category"] = "general"

        # Check for must_consult markers
        if "STOP" in content or "MUST" in content.upper()[:500]:
            data["must_consult"] = True

        # Extract trigger words from content
        triggers = []
        trigger_match = re.search(r'trigger[s]?[:\s]+([^\n]+)', content, re.IGNORECASE)
        if trigger_match:
            triggers = [t.strip() for t in trigger_match.group(1).split(',')]
        else:
            # Generate from name
            name_words = file_path.stem.replace("-", " ").split()
            triggers = [" ".join(name_words)]
        data["triggers"] = triggers

        return data

    async def migrate_waiting_items(self):
        """Migrate waiting items from waiting.md."""
        from app.models import WaitingItem

        print("\nMigrating waiting items...")

        waiting_file = DATA_SOURCE / "waiting.md"
        if not waiting_file.exists():
            print("  (waiting.md not found)")
            return

        items = self._parse_waiting_file(waiting_file)

        for data in items:
            item = WaitingItem(
                id=uuid4(),
                tenant_id=self.tenant_id,
                what=data.get("what", "Unknown"),
                who=data.get("who"),
                since=data.get("since"),
                follow_up_date=data.get("follow_up"),
                why_it_matters=data.get("why"),
                status="waiting",
            )

            if not self.dry_run:
                self.session.add(item)

            self.stats["waiting_items"] += 1
            print(f"  ✓ {item.what[:50]}...")

        if not self.dry_run:
            await self.session.flush()

    def _parse_waiting_file(self, file_path: Path) -> list:
        """Parse waiting.md tables."""
        content = file_path.read_text()
        items = []

        # Find tables and parse them
        table_pattern = r'\|.*\|.*\|.*\|\n\|[-\s|]+\|\n((?:\|.*\|\n)+)'
        matches = re.findall(table_pattern, content)

        for table_content in matches:
            rows = table_content.strip().split('\n')
            for row in rows:
                cells = [c.strip() for c in row.split('|')[1:-1]]
                if len(cells) >= 2:
                    what = cells[0].strip()
                    if what and not what.startswith('-'):
                        items.append({
                            "what": what,
                            "who": cells[1] if len(cells) > 1 else None,
                            "since": cells[2] if len(cells) > 2 else None,
                            "follow_up": cells[3] if len(cells) > 3 else None,
                            "why": cells[4] if len(cells) > 4 else None,
                        })

        return items

    async def migrate_questions(self):
        """Migrate questions from top-questions.md."""
        from app.models import Question
        from app.models.question import QuestionStatus

        print("\nMigrating questions...")

        questions_file = DATA_SOURCE / "top-questions.md"
        if not questions_file.exists():
            print("  (top-questions.md not found)")
            return

        questions = self._parse_questions_file(questions_file)

        for data in questions:
            question = Question(
                id=uuid4(),
                tenant_id=self.tenant_id,
                user_id=self.user_id,
                text=data.get("question", "Unknown question"),
                why_asking=data.get("why"),
                what_claude_will_do=data.get("what_will_do"),
                priority=data.get("priority", 3),
                status=QuestionStatus.UNANSWERED if not data.get("resolved") else QuestionStatus.ANSWERED,
            )

            if not self.dry_run:
                self.session.add(question)

            self.stats["questions"] += 1
            status = "resolved" if data.get("resolved") else "pending"
            print(f"  ✓ [{status}] {question.text[:50]}...")

        if not self.dry_run:
            await self.session.flush()

    def _parse_questions_file(self, file_path: Path) -> list:
        """Parse top-questions.md sections."""
        content = file_path.read_text()
        questions = []

        # Find question sections (### numbered items)
        question_pattern = r'###\s*(\d+)\.\s*(.+?)\n(.*?)(?=###|\Z)'
        matches = re.findall(question_pattern, content, re.DOTALL)

        for num, title, body in matches:
            question_text = title.strip()
            why = None
            what_will_do = None
            resolved = False

            # Extract why
            why_match = re.search(r'\*\*Why.*?:\*\*\s*(.+?)(?=\*\*|\n\n|$)', body, re.DOTALL)
            if why_match:
                why = why_match.group(1).strip()

            # Extract what claude will do
            what_match = re.search(r'\*\*What Claude.*?:\*\*\s*(.+?)(?=\*\*|\n\n|$)', body, re.DOTALL)
            if what_match:
                what_will_do = what_match.group(1).strip()

            # Check if in resolved section
            if "✅ Recently Resolved" in content:
                resolved_section = content.split("✅ Recently Resolved")[1]
                if title in resolved_section or "~~" in title:
                    resolved = True

            # Determine priority from section
            priority = 3
            if "🔴 High Priority" in content[:content.find(f"### {num}.")] if f"### {num}." in content else "":
                priority = 1
            elif "🟠 Medium Priority" in content[:content.find(f"### {num}.")] if f"### {num}." in content else "":
                priority = 2
            elif "🔵 Lower Priority" in content[:content.find(f"### {num}.")] if f"### {num}." in content else "":
                priority = 4

            # Extract actual question if present
            q_match = re.search(r'\*\*Question\*\*:\s*(.+?)(?=\*\*|\n\n|$)', body, re.DOTALL)
            if q_match:
                question_text = q_match.group(1).strip()

            questions.append({
                "question": question_text,
                "why": why,
                "what_will_do": what_will_do,
                "priority": priority,
                "resolved": resolved,
            })

        return questions

    def print_summary(self):
        """Print migration summary."""
        print("\n" + "=" * 60)
        print("MIGRATION SUMMARY")
        print("=" * 60)
        for entity, count in self.stats.items():
            print(f"  {entity.replace('_', ' ').title()}: {count}")
        print("=" * 60)


async def main():
    parser = argparse.ArgumentParser(description="Migrate data from Claude Cowork folder")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview migration without writing to database",
    )
    parser.add_argument(
        "--database-url",
        default=os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./expertly_test.db"),
        help="Database URL",
    )
    args = parser.parse_args()

    # Check data source exists
    if not DATA_SOURCE.exists():
        print(f"ERROR: Data source not found: {DATA_SOURCE}")
        sys.exit(1)

    # Create database connection
    engine = create_async_engine(args.database_url, echo=False)

    # Create tables if using SQLite
    if "sqlite" in args.database_url:
        from app.database import Base
        from app.models import (
            Tenant, User, Project, Task, Question, Person, TaskPerson,
            Client, Draft, Playbook, Knowledge, RecurringTask, WaitingItem,
            SalesOpportunity, Log
        )
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        migrator = DataMigrator(session, dry_run=args.dry_run)
        await migrator.run()

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
