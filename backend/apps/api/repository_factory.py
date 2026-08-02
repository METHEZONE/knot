from importlib import import_module
import json
import os
from pathlib import Path
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
    _seed_extra_documents(repository)
    return repository


def _firestore_client(project_id: str | None) -> Any:
    firestore_module = import_module("google.cloud.firestore")
    return cast(Any, firestore_module.Client(project=project_id))


def _seed_extra_documents(repository: KnotRepository) -> None:
    seed_file = os.getenv("KNOT_EXTRA_MEMORY_SEED_FILE")
    if not seed_file:
        return
    path = Path(seed_file)
    if not path.exists():
        raise RuntimeError(f"KNOT_EXTRA_MEMORY_SEED_FILE does not exist: {seed_file}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise RuntimeError("KNOT_EXTRA_MEMORY_SEED_FILE must contain a JSON object")
    for document_path, document in data.items():
        if not isinstance(document_path, str) or not isinstance(document, dict):
            raise RuntimeError("KNOT_EXTRA_MEMORY_SEED_FILE must map paths to document objects")
        repository.save_raw_document(document_path, document)
