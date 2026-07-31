from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from libs.domain.models import AgreementResult, AgreementTerms, Promotion

A2A_VERSION = "1.0"
NEGOTIATION_SCHEMA = "knot.negotiation.v1"
TERM_SHEET_SCHEMA = "knot.term-sheet.v1"


class A2AModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class A2ARole(StrEnum):
    USER = "ROLE_USER"
    AGENT = "ROLE_AGENT"


class A2ATaskState(StrEnum):
    SUBMITTED = "TASK_STATE_SUBMITTED"
    WORKING = "TASK_STATE_WORKING"
    INPUT_REQUIRED = "TASK_STATE_INPUT_REQUIRED"
    AUTH_REQUIRED = "TASK_STATE_AUTH_REQUIRED"
    COMPLETED = "TASK_STATE_COMPLETED"
    REJECTED = "TASK_STATE_REJECTED"
    FAILED = "TASK_STATE_FAILED"
    CANCELED = "TASK_STATE_CANCELED"


class NegotiationMessageType(StrEnum):
    OFFER = "OFFER"
    COUNTER = "COUNTER"
    ACCEPT = "ACCEPT"
    REJECT = "REJECT"
    ESCALATE = "ESCALATE"


class A2APart(A2AModel):
    media_type: str = Field(default="application/json", alias="mediaType")
    text: str | None = None
    raw: dict[str, Any] | None = None
    url: str | None = None
    data: dict[str, Any] | None = None

    @model_validator(mode="after")
    def validate_one_content_kind(self) -> "A2APart":
        values = [self.text, self.raw, self.url, self.data]
        if sum(value is not None for value in values) != 1:
            raise ValueError("A2A Part must contain exactly one of text, raw, url, or data")
        return self


class A2AMessage(A2AModel):
    message_id: str = Field(alias="messageId")
    context_id: str = Field(alias="contextId")
    task_id: str | None = Field(default=None, alias="taskId")
    role: A2ARole
    parts: list[A2APart]

    @model_validator(mode="after")
    def validate_parts(self) -> "A2AMessage":
        if not self.parts:
            raise ValueError("A2A Message must include at least one Part")
        return self


class NegotiationPayload(A2AModel):
    schema_: Literal["knot.negotiation.v1"] = Field(default="knot.negotiation.v1", alias="schema")
    type: NegotiationMessageType
    round: int = Field(ge=1)
    promotion: Promotion
    terms: AgreementTerms
    changed_fields: list[str] = Field(default_factory=list, alias="changedFields")
    rationale: str = ""


class A2ASendConfiguration(A2AModel):
    accepted_output_modes: list[str] = Field(default_factory=list, alias="acceptedOutputModes")


class A2ASendRequest(A2AModel):
    tenant: str
    message: A2AMessage
    configuration: A2ASendConfiguration = Field(default_factory=A2ASendConfiguration)
    metadata: dict[str, Any] = Field(default_factory=dict)


class A2ATaskStatus(A2AModel):
    state: A2ATaskState
    message: A2AMessage | None = None


class TermSheetArtifactData(A2AModel):
    schema_: Literal["knot.term-sheet.v1"] = Field(default="knot.term-sheet.v1", alias="schema")
    result: AgreementResult
    agreement_id: str = Field(alias="agreementId")
    terms: AgreementTerms | None = None
    terms_hash: str | None = Field(default=None, alias="termsHash")
    rationale: str = ""


class A2AArtifact(A2AModel):
    artifact_id: str = Field(alias="artifactId")
    name: str
    parts: list[A2APart]


class A2ATask(A2AModel):
    id: str
    context_id: str = Field(alias="contextId")
    status: A2ATaskStatus
    artifacts: list[A2AArtifact] = Field(default_factory=list)
    history: list[A2AMessage] = Field(default_factory=list)

    @property
    def terminal(self) -> bool:
        return self.status.state in {
            A2ATaskState.COMPLETED,
            A2ATaskState.REJECTED,
            A2ATaskState.FAILED,
            A2ATaskState.CANCELED,
        }
