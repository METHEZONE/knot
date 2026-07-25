from collections.abc import Mapping
from typing import cast

from pydantic import BaseModel

DocumentData = dict[str, object]


def model_to_document(model: BaseModel) -> DocumentData:
    return cast(DocumentData, model.model_dump(by_alias=True, mode="json", exclude_none=True))


def document_to_model[ModelT: BaseModel](
    model_type: type[ModelT],
    document: Mapping[str, object],
) -> ModelT:
    return model_type.model_validate(document)
