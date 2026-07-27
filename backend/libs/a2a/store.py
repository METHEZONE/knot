from collections.abc import Callable
from typing import TypedDict
from uuid import uuid4

from libs.a2a.models import (
    A2AArtifact,
    A2AMessage,
    A2APart,
    A2ARole,
    A2ATask,
    A2ATaskState,
    A2ATaskStatus,
    NegotiationMessageType,
    NegotiationPayload,
    TermSheetArtifactData,
)
from libs.agents.negotiation import (
    CreatorNegotiationContext,
    CreatorNegotiationDecision,
    evaluate_creator_message,
)
from libs.domain.models import AgreementResult, AgreementTerms


class A2ATaskError(ValueError):
    pass


class DisplayRationale(TypedDict):
    text: str
    provider: str
    model: str | None
    fallbackReason: str | None


class InMemoryA2ATaskStore:
    def __init__(
        self,
        context_by_tenant: dict[str, CreatorNegotiationContext],
        context_resolver: Callable[[str], CreatorNegotiationContext | None] | None = None,
        rationale_provider: Callable[
            [CreatorNegotiationContext, NegotiationPayload, CreatorNegotiationDecision],
            object | None,
        ]
        | None = None,
    ) -> None:
        self._context_by_tenant = context_by_tenant
        self._context_resolver = context_resolver
        self._tasks: dict[str, A2ATask] = {}
        self._message_results: dict[str, A2ATask] = {}
        self._rationale_provider = rationale_provider

    def list_tasks(self) -> list[A2ATask]:
        return list(self._tasks.values())

    def get_task(self, task_id: str) -> A2ATask:
        try:
            return self._tasks[task_id]
        except KeyError as exc:
            raise A2ATaskError("task not found") from exc

    def cancel_task(self, task_id: str) -> A2ATask:
        task = self.get_task(task_id)
        if task.terminal:
            return task
        task.status = A2ATaskStatus(state=A2ATaskState.CANCELED)
        return task

    def send_message(self, tenant: str, message: A2AMessage) -> A2ATask:
        if message.message_id in self._message_results:
            return self._message_results[message.message_id]

        context = self._get_context(tenant)
        task = self._get_or_create_task(message)
        self._validate_message_task_context(task, message)
        if task.terminal:
            raise A2ATaskError("terminal tasks do not accept new messages")

        payload = _payload_from_message(message)
        decision = evaluate_creator_message(context, payload)
        rationale = self._display_rationale(context, payload, decision)
        response = _message_from_decision(
            message,
            task_id=task.id,
            decision_type=decision.type,
            data={
                "schema": "knot.negotiation.v1",
                "type": decision.type.value,
                "round": payload.round,
                "terms": (
                    decision.terms.model_dump(by_alias=True, mode="json")
                    if decision.terms
                    else None
                ),
                "changedFields": decision.changed_fields,
                "rationale": rationale["text"],
                "rationaleProvider": rationale["provider"],
                "rationaleModel": rationale["model"],
                "rationaleFallbackReason": rationale["fallbackReason"],
                "policyDecision": decision.policy_decision.model_dump(by_alias=True),
            },
        )

        task.history.append(message)
        task.history.append(response)

        if decision.type == NegotiationMessageType.COUNTER:
            task.status = A2ATaskStatus(state=A2ATaskState.INPUT_REQUIRED, message=response)
        elif decision.type == NegotiationMessageType.ACCEPT:
            task.status = A2ATaskStatus(state=A2ATaskState.COMPLETED, message=response)
            task.artifacts.append(
                _artifact(
                    result=AgreementResult.AGREED,
                    agreement_id=decision.agreement_id or f"agreement-{uuid4()}",
                    terms=decision.terms,
                    terms_hash=decision.terms_hash,
                    rationale=rationale["text"],
                )
            )
        elif decision.type == NegotiationMessageType.REJECT:
            task.status = A2ATaskStatus(state=A2ATaskState.COMPLETED, message=response)
            task.artifacts.append(
                _artifact(
                    result=AgreementResult.REJECTED,
                    agreement_id=decision.agreement_id or f"agreement-{uuid4()}",
                    terms=decision.terms,
                    terms_hash=None,
                    rationale=rationale["text"],
                )
            )
        else:
            task.status = A2ATaskStatus(state=A2ATaskState.INPUT_REQUIRED, message=response)

        self._message_results[message.message_id] = task
        return task

    def _get_context(self, tenant: str) -> CreatorNegotiationContext:
        try:
            return self._context_by_tenant[tenant]
        except KeyError as exc:
            if self._context_resolver is None:
                raise A2ATaskError("unknown tenant") from exc
            context = self._context_resolver(tenant)
            if context is None:
                raise A2ATaskError("unknown tenant") from exc
            self._context_by_tenant[tenant] = context
            return context

    def _display_rationale(
        self,
        context: CreatorNegotiationContext,
        payload: NegotiationPayload,
        decision: CreatorNegotiationDecision,
    ) -> DisplayRationale:
        if self._rationale_provider is None:
            return {
                "text": decision.rationale,
                "provider": "deterministic",
                "model": None,
                "fallbackReason": None,
            }
        generated = self._rationale_provider(context, payload, decision)
        text = getattr(generated, "text", None)
        if not isinstance(text, str) or not text.strip():
            return {
                "text": decision.rationale,
                "provider": "deterministic",
                "model": None,
                "fallbackReason": "invalid_rationale_provider",
            }
        return {
            "text": text,
            "provider": _optional_str(getattr(generated, "provider", None)) or "unknown",
            "model": _optional_str(getattr(generated, "model", None)),
            "fallbackReason": _optional_str(getattr(generated, "fallback_reason", None)),
        }

    def _get_or_create_task(self, message: A2AMessage) -> A2ATask:
        if message.task_id:
            return self.get_task(message.task_id)
        task = A2ATask(
            id=f"task-{uuid4()}",
            contextId=message.context_id,
            status=A2ATaskStatus(state=A2ATaskState.SUBMITTED),
        )
        self._tasks[task.id] = task
        return task

    @staticmethod
    def _validate_message_task_context(task: A2ATask, message: A2AMessage) -> None:
        if message.task_id and message.task_id != task.id:
            raise A2ATaskError("taskId mismatch")
        if message.context_id != task.context_id:
            raise A2ATaskError("contextId mismatch")


def _payload_from_message(message: A2AMessage) -> NegotiationPayload:
    part = message.parts[0]
    if part.data is None:
        raise A2ATaskError("KNOT negotiation messages must use Part.data")
    return NegotiationPayload.model_validate(part.data)


def _optional_str(value: object) -> str | None:
    return value if isinstance(value, str) else None


def _message_from_decision(
    request_message: A2AMessage,
    *,
    task_id: str,
    decision_type: NegotiationMessageType,
    data: dict[str, object],
) -> A2AMessage:
    return A2AMessage(
        messageId=f"message-{uuid4()}",
        contextId=request_message.context_id,
        taskId=task_id,
        role=A2ARole.AGENT,
        parts=[A2APart(mediaType="application/json", data=data)],
    )


def _artifact(
    *,
    result: AgreementResult,
    agreement_id: str,
    terms: AgreementTerms | None,
    terms_hash: str | None,
    rationale: str,
) -> A2AArtifact:
    data = TermSheetArtifactData(
        result=result,
        agreementId=agreement_id,
        terms=terms,
        termsHash=terms_hash,
        rationale=rationale,
    )
    return A2AArtifact(
        artifactId=f"artifact-{uuid4()}",
        name="Negotiation Result",
        parts=[
            A2APart(
                mediaType="application/json",
                data=data.model_dump(by_alias=True, mode="json"),
            )
        ],
    )
