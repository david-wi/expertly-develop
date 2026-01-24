"""API route handlers."""

from fastapi import APIRouter

from app.api import tasks, questions, projects, knowledge, playbooks, people, clients, search, drafts, waiting_items, users, organization, artifacts

api_router = APIRouter()

api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(questions.router, prefix="/questions", tags=["questions"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(knowledge.router, prefix="/knowledge", tags=["knowledge"])
api_router.include_router(playbooks.router, prefix="/playbooks", tags=["playbooks"])
api_router.include_router(people.router, prefix="/people", tags=["people"])
api_router.include_router(clients.router, prefix="/clients", tags=["clients"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(drafts.router, prefix="/drafts", tags=["drafts"])
api_router.include_router(waiting_items.router, prefix="/waiting-items", tags=["waiting-items"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(organization.router, prefix="/organization", tags=["organization"])
api_router.include_router(artifacts.router, prefix="/artifacts", tags=["artifacts"])
