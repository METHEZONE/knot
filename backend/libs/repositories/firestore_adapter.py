from collections.abc import Iterable, Mapping
from typing import Protocol

from libs.repositories.serialization import DocumentData
from libs.repositories.store import DocumentAlreadyExistsError


class FirestoreDocumentSnapshot(Protocol):
    @property
    def exists(self) -> bool:
        pass

    def to_dict(self) -> dict[str, object] | None:
        pass


class FirestoreDocumentReference(Protocol):
    def get(self) -> FirestoreDocumentSnapshot:
        pass

    def set(self, document_data: Mapping[str, object]) -> object:
        pass

    def delete(self) -> object:
        pass


class FirestoreCollectionReference(Protocol):
    def stream(self) -> Iterable[FirestoreDocumentSnapshot]:
        pass


class FirestoreClient(Protocol):
    def document(self, document_path: str) -> FirestoreDocumentReference:
        pass

    def collection(self, collection_path: str) -> FirestoreCollectionReference:
        pass


class FirestoreDocumentStore:
    """Adapter for google-cloud-firestore clients without importing the SDK at module load."""

    def __init__(self, client: FirestoreClient) -> None:
        self._client = client

    def set_document(
        self,
        path: str,
        data: Mapping[str, object],
        *,
        exists_ok: bool = True,
    ) -> None:
        reference = self._client.document(path)
        if not exists_ok and reference.get().exists:
            raise DocumentAlreadyExistsError(path)
        reference.set(dict(data))

    def get_document(self, path: str) -> DocumentData | None:
        snapshot = self._client.document(path).get()
        if not snapshot.exists:
            return None
        data = snapshot.to_dict()
        if data is None:
            return None
        return dict(data)

    def list_documents(self, collection_path: str) -> list[DocumentData]:
        return [
            dict(snapshot.to_dict() or {})
            for snapshot in self._client.collection(collection_path).stream()
            if snapshot.exists
        ]

    def delete_document(self, path: str) -> None:
        self._client.document(path).delete()
