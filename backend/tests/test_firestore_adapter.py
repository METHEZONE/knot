from collections.abc import Iterable, Mapping

import pytest

from libs.repositories.firestore_adapter import FirestoreDocumentStore
from libs.repositories.store import DocumentAlreadyExistsError


class FakeSnapshot:
    def __init__(self, data: dict[str, object] | None) -> None:
        self._data = data

    @property
    def exists(self) -> bool:
        return self._data is not None

    def to_dict(self) -> dict[str, object] | None:
        if self._data is None:
            return None
        return dict(self._data)


class FakeDocumentReference:
    def __init__(self, client: "FakeFirestoreClient", path: str) -> None:
        self._client = client
        self._path = path

    def get(self) -> FakeSnapshot:
        return FakeSnapshot(self._client.documents.get(self._path))

    def set(self, document_data: Mapping[str, object]) -> None:
        self._client.documents[self._path] = dict(document_data)


class FakeCollectionReference:
    def __init__(self, client: "FakeFirestoreClient", collection_path: str) -> None:
        self._client = client
        self._collection_path = collection_path

    def stream(self) -> Iterable[FakeSnapshot]:
        prefix = f"{self._collection_path}/"
        for path in sorted(self._client.documents):
            if path.startswith(prefix) and "/" not in path.removeprefix(prefix):
                yield FakeSnapshot(self._client.documents[path])


class FakeFirestoreClient:
    def __init__(self) -> None:
        self.documents: dict[str, dict[str, object]] = {}

    def document(self, document_path: str) -> FakeDocumentReference:
        return FakeDocumentReference(self, document_path)

    def collection(self, collection_path: str) -> FakeCollectionReference:
        return FakeCollectionReference(self, collection_path)


def test_firestore_adapter_sets_gets_lists_and_respects_create_only() -> None:
    client = FakeFirestoreClient()
    store = FirestoreDocumentStore(client)

    store.set_document("promotions/promotion-001", {"promotionId": "promotion-001"})
    store.set_document("promotions/promotion-002", {"promotionId": "promotion-002"})

    assert store.get_document("promotions/promotion-001") == {"promotionId": "promotion-001"}
    assert store.get_document("promotions/missing") is None
    assert store.list_documents("promotions") == [
        {"promotionId": "promotion-001"},
        {"promotionId": "promotion-002"},
    ]

    with pytest.raises(DocumentAlreadyExistsError):
        store.set_document(
            "promotions/promotion-001",
            {"promotionId": "promotion-001"},
            exists_ok=False,
        )
