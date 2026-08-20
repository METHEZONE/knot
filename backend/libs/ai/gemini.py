import importlib
import json
import re
from typing import Any, cast

from pydantic import BaseModel, Field

from libs.a2a.models import NegotiationMessageType, NegotiationPayload
from libs.agents.negotiation import CreatorNegotiationContext, CreatorNegotiationDecision
from libs.domain.models import AgreementTerms, CreatorProfile, Promotion
from libs.settings.config import Settings


class AnalysisText(BaseModel):
    text: str
    provider: str
    model: str | None = None
    fallback_reason: str | None = Field(default=None, alias="fallbackReason")


class GenerationResult(BaseModel):
    data: dict[str, object] | None = None
    fallback_reason: str | None = Field(default=None, alias="fallbackReason")


def candidate_explanation(
    *,
    settings: Settings,
    promotion: Promotion,
    creator: CreatorProfile,
    candidate: dict[str, object],
    fallback: str,
) -> AnalysisText:
    if settings.gemini_mode != "vertex":
        return _fallback(settings, fallback, reason="gemini_mode_off")
    if not settings.gemini_match_explanations:
        return _fallback(settings, fallback, reason="gemini_match_explanations_disabled")

    prompt: dict[str, object] = {
        "task": "Explain why this creator candidate was ranked or filtered for a brand promotion.",
        "rules": [
            "Use only the supplied structured inputs.",
            "Do not change eligibility, score, rank, or policy results.",
            "Return one concise Korean sentence.",
        ],
        "promotion": {
            "title": promotion.title,
            "category": promotion.category,
            "targetAudience": promotion.target_audience,
            "budget": promotion.budget.model_dump(by_alias=True, mode="json"),
            "usageRights": promotion.usage_rights.value,
        },
        "creator": {
            "creatorAgentId": creator.creator_agent_id,
            "categories": creator.categories,
            "minBaseUsdc": creator.rate_card.min_base_usdc,
            "completedDealCount": creator.completed_deal_count,
            "allowedUsageRights": [right.value for right in creator.allowed_usage_rights],
        },
        "candidate": candidate,
        "outputSchema": {"explanation": "string"},
    }
    generated = _generate_json(settings=settings, prompt=prompt)
    if generated.data is None:
        return _fallback(settings, fallback, reason=generated.fallback_reason)
    explanation = generated.data.get("explanation")
    if not isinstance(explanation, str) or not explanation.strip():
        return _fallback(settings, fallback, reason="invalid_json_shape")
    return AnalysisText(
        text=explanation.strip(),
        provider="vertex-gemini",
        model=settings.gemini_model,
    )


def creator_rationale(
    *,
    settings: Settings,
    context: CreatorNegotiationContext,
    payload: NegotiationPayload,
    decision: CreatorNegotiationDecision,
) -> AnalysisText | None:
    prompt: dict[str, object] = {
        "task": "Write the display rationale for a creator agent negotiation decision.",
        "rules": [
            "The decision type and policy result are already fixed by code.",
            "Do not authorize payment, escrow, settlement, or any policy override.",
            "Do not reveal private thresholds except the public offer amount "
            "and the decision result.",
            "Return one concise Korean sentence.",
        ],
        "creatorAgentId": context.creator_agent_id,
        "fixedDecisionType": decision.type.value,
        "promotion": {
            "title": payload.promotion.title,
            "category": payload.promotion.category,
            "usageRights": payload.promotion.usage_rights.value,
        },
        "terms": payload.terms.model_dump(by_alias=True, mode="json"),
        "policyDecision": decision.policy_decision.model_dump(by_alias=True, mode="json"),
        "outputSchema": {"rationale": "string"},
    }
    generated = _generate_json(settings=settings, prompt=prompt)
    if generated.data is None:
        return None
    rationale = generated.data.get("rationale")
    if not isinstance(rationale, str) or not rationale.strip():
        return AnalysisText(
            text=decision.rationale,
            provider="deterministic",
            model=None,
            fallbackReason="invalid_json_shape",
        )
    return AnalysisText(
        text=rationale.strip(),
        provider="vertex-gemini",
        model=settings.gemini_model,
    )


def brand_message_display(
    *,
    settings: Settings,
    message_type: NegotiationMessageType,
    terms: AgreementTerms,
    promotion: Promotion,
    fallback_message: str,
    fallback_rationale: str,
) -> AnalysisText:
    if settings.gemini_mode != "vertex":
        return _fallback(settings, fallback_message, reason="gemini_mode_off")
    prompt: dict[str, object] = {
        "task": (
            "Write a natural Korean display message for a brand agent sponsorship "
            "negotiation turn."
        ),
        "rules": [
            "The action, amount, deliverables, and policy result are fixed by deterministic code.",
            "Do not change the action, amount, deadline, deliverables, usage rights, "
            "payment, escrow, or settlement.",
            "Do not claim pay.sh, escrow, Solana, or settlement success.",
            "Do not reveal private policy thresholds or chain-of-thought.",
            "Return one friendly but concise Korean sentence for the visible chat bubble.",
            "Use a practical manager tone, not marketing copy.",
        ],
        "styleExamples": {
            "OFFER": (
                "제품 착용샷 1건 기준으로 1 USDC를 제안합니다. "
                "일정과 사용 범위는 공개 조건에 맞춰 정리해두었습니다."
            ),
            "COUNTER": (
                "예산 안에서 2 USDC까지 조정해 다시 제안합니다. "
                "산출물과 게시 일정은 기존 조건을 유지합니다."
            ),
            "ACCEPT": (
                "제안해주신 2 USDC 조건이 브랜드 권한 범위 안이라 "
                "이 조건으로 확정하겠습니다."
            ),
        },
        "fixedAction": message_type.value,
        "promotion": {
            "title": promotion.title,
            "category": promotion.category,
            "usageRights": promotion.usage_rights.value,
        },
        "terms": terms.model_dump(by_alias=True, mode="json"),
        "deterministicRationale": fallback_rationale,
        "outputSchema": {"message": "string"},
    }
    generated = _generate_json(settings=settings, prompt=prompt)
    if generated.data is None:
        return _fallback(settings, fallback_message, reason=generated.fallback_reason)
    message = generated.data.get("message")
    if not isinstance(message, str) or not message.strip():
        return _fallback(settings, fallback_message, reason="invalid_json_shape")
    return AnalysisText(
        text=_one_line(message),
        provider="vertex-gemini",
        model=settings.gemini_model,
    )


def structured_analysis_json(*, settings: Settings, prompt: dict[str, object]) -> GenerationResult:
    return _generate_json(settings=settings, prompt=prompt)


def _fallback(
    settings: Settings,
    text: str,
    reason: str | None = None,
) -> AnalysisText:
    return AnalysisText(
        text=text,
        provider="deterministic",
        model=None if settings.gemini_mode == "off" else settings.gemini_model,
        fallbackReason=reason,
    )


def _one_line(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()[:220]


def _generate_json(*, settings: Settings, prompt: dict[str, object]) -> GenerationResult:
    if settings.gemini_mode != "vertex":
        return GenerationResult(fallbackReason="gemini_mode_off")
    if not settings.firestore_project_id:
        return GenerationResult(fallbackReason="missing_gcp_project")

    try:
        genai = cast(Any, importlib.import_module("google.genai"))
        genai_types = cast(Any, importlib.import_module("google.genai.types"))
        client = genai.Client(
            vertexai=True,
            project=settings.firestore_project_id,
            location=settings.vertex_ai_location,
            http_options=genai_types.HttpOptions(api_version="v1"),
        )
        try:
            response = client.models.generate_content(
                model=settings.gemini_model,
                contents=json.dumps(prompt, ensure_ascii=False, sort_keys=True),
                config=genai_types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )
            data = _json_object_from_text(str(getattr(response, "text", "") or ""))
            return GenerationResult(data=data, fallbackReason=None if data else "invalid_json")
        finally:
            close = getattr(client, "close", None)
            if callable(close):
                close()
    except Exception:
        return GenerationResult(fallbackReason="vertex_call_failed")


def _json_object_from_text(text: str) -> dict[str, object] | None:
    stripped = text.strip()
    if not stripped:
        return None
    fenced = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", stripped, flags=re.DOTALL)
    if fenced:
        stripped = fenced.group(1)
    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None
