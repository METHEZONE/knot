from importlib import import_module
from typing import Any, cast

from libs.repositories.firestore_adapter import FirestoreDocumentStore
from libs.repositories.seed import seed_demo_repository
from libs.repositories.store import InMemoryDocumentStore, KnotRepository
from libs.settings.config import Settings


def build_repository(settings: Settings) -> KnotRepository:
    if settings.repository_backend == "firestore":
        firestore_store = FirestoreDocumentStore(_firestore_client(settings.firestore_project_id))
        return KnotRepository(firestore_store)

    memory_store = InMemoryDocumentStore()
    repository = KnotRepository(memory_store)
    seed_demo_repository(repository)
    return repository


def _firestore_client(project_id: str | None) -> Any:
    firestore_module = import_module("google.cloud.firestore")
    return cast(Any, firestore_module.Client(project=project_id))
