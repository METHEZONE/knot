import hashlib
import json

from libs.domain.models import AgreementTerms


def canonical_terms_json(terms: AgreementTerms) -> str:
    payload = terms.model_dump(by_alias=True, mode="json")
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def terms_hash(terms: AgreementTerms) -> str:
    digest = hashlib.sha256(canonical_terms_json(terms).encode("utf-8")).hexdigest()
    return f"sha256:{digest}"
