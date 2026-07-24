from collections.abc import Iterable, Mapping
from copy import deepcopy
from typing import Protocol, TypeVar, cast, runtime_checkable

from pydantic import BaseModel

from libs.domain.models import AgentPolicy, CreatorProfile, Promotion
from libs.repositories.firestore_paths import COLLECTIONS, FirestorePaths
from libs.repositories.serialization import DocumentData, document_to_model, model_to_document

ModelT = TypeVar("ModelT", bound=BaseModel)


class DocumentAlreadyExistsError(ValueError):
    pass


class IdempotencyConflictError(ValueError):
    pass


@runtime_checkable
class DocumentStore(Protocol):
    def set_document(
        self,
        path: str,
        data: Mapping[str, object],
        *,
        exists_ok: bool = True,
    ) -> None:
        pass

    def get_document(self, path: str) -> DocumentData | None:
        pass

    def list_documents(self, collection_path: str) -> list[DocumentData]:
        pass


class InMemoryDocumentStore:
    def __init__(self) -> None:
        self._documents: dict[str, DocumentData] = {}

    def set_document(
        self,
        path: str,
        data: Mapping[str, object],
        *,
        exists_ok: bool = True,
    ) -> None:
        if not exists_ok and path in self._documents:
            raise DocumentAlreadyExistsError(path)
        self._documents[path] = _copy_document(data)

    def get_document(self, path: str) -> DocumentData | None:
        document = self._documents.get(path)
        if document is None:
            return None
        return _copy_document(document)

    def list_documents(self, collection_path: str) -> list[DocumentData]:
        prefix = f"{collection_path.rstrip('/')}/"
        results: list[DocumentData] = []
        for path in sorted(self._documents):
            if path.startswith(prefix) and "/" not in path.removeprefix(prefix):
                results.append(_copy_document(self._documents[path]))
        return results

    @property
    def document_count(self) -> int:
        return len(self._documents)

    def paths(self) -> list[str]:
        return sorted(self._documents)


class KnotRepository:
    def __init__(self, store: DocumentStore) -> None:
        self._store = store

    def save_promotion(self, promotion: Promotion) -> None:
        self._store.set_document(
            FirestorePaths.promotion(promotion.promotion_id),
            model_to_document(promotion),
        )

    def get_promotion(self, promotion_id: str) -> Promotion | None:
        return self._get_model(FirestorePaths.promotion(promotion_id), Promotion)

    def save_creator_profile(self, creator: CreatorProfile) -> None:
        self._store.set_document(
            FirestorePaths.creator_profile(creator.creator_id),
            model_to_document(creator),
        )

    def get_creator_profile(self, creator_id: str) -> CreatorProfile | None:
        return self._get_model(FirestorePaths.creator_profile(creator_id), CreatorProfile)

    def list_creator_profiles(self) -> list[CreatorProfile]:
        return [
            document_to_model(CreatorProfile, document)
            for document in self._store.list_documents(COLLECTIONS.creator_profiles)
        ]

    def save_agent_policy(self, policy: AgentPolicy) -> None:
        self._store.set_document(
            FirestorePaths.agent_policy(policy.agent_id),
            model_to_document(policy),
        )

    def get_agent_policy(self, agent_id: str) -> AgentPolicy | None:
        return self._get_model(FirestorePaths.agent_policy(agent_id), AgentPolicy)

    def save_raw_document(self, path: str, document: Mapping[str, object]) -> None:
        self._store.set_document(path, document)

    def create_audit_event(self, event_id: str, document: Mapping[str, object]) -> None:
        self._store.set_document(FirestorePaths.audit_event(event_id), document, exists_ok=False)

    def claim_idempotency_key(
        self,
        key: str,
        *,
        payload_hash: str,
        owner_path: str,
    ) -> bool:
        path = FirestorePaths.idempotency_key(key)
        existing = self._store.get_document(path)
        if existing is None:
            self._store.set_document(
                path,
                {"key": key, "payloadHash": payload_hash, "ownerPath": owner_path},
                exists_ok=False,
            )
            return True
        if existing.get("payloadHash") != payload_hash:
            raise IdempotencyConflictError(key)
        return False

    def _get_model(self, path: str, model_type: type[ModelT]) -> ModelT | None:
        document = self._store.get_document(path)
        if document is None:
            return None
        return document_to_model(model_type, document)


def _copy_document(document: Mapping[str, object]) -> DocumentData:
    return cast(DocumentData, deepcopy(dict(document)))


def write_documents(
    store: DocumentStore,
    documents: Iterable[tuple[str, Mapping[str, object]]],
) -> None:
    for path, document in documents:
        store.set_document(path, document)
