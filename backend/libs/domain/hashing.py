import hashlib
import json
from collections.abc import Mapping

from libs.domain.models import AgreementTerms


def canonical_json(payload: Mapping[str, object]) -> str:
    """Deterministic JSON: sorted keys, compact separators, unicode preserved."""
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def sha256_prefixed(text: str) -> str:
    """`sha256:`-prefixed hex digest of ``text``."""
    return "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()


def canonical_terms_json(terms: AgreementTerms) -> str:
    return canonical_json(terms.model_dump(by_alias=True, mode="json"))


def terms_hash(terms: AgreementTerms) -> str:
    return sha256_prefixed(canonical_terms_json(terms))
