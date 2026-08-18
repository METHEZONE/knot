import base64
import json

from fastapi.testclient import TestClient

from apps.api.main import create_app
from libs.repositories.firestore_paths import FirestorePaths
from libs.repositories.seed import seed_demo_repository
from libs.repositories.store import InMemoryDocumentStore, KnotRepository
from libs.settings.config import Settings
from libs.web3.client import Web3GatewayError
from tests.wallet_test_helpers import connect_wallet

CLEAN_EVIDENCE_URL = "https://social.example/post/with-brand-and-ad"
BRAND_WALLET = "8keJx2mcKFENHcUs4ti79aUurAHrWt8Z4XcQTnKGKks6"
CREATOR_WALLET = "63T8p6c4p1fFC7HmYDEqNtyheqMxnYKmiGqTafpzh8zJ"
SETTLEMENT_AUTHORITY = "11111111111111111111111111111111"
BASE58_ALPHABET = set("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz")


def seeded(settings: Settings | None = None) -> tuple[TestClient, KnotRepository]:
    store = InMemoryDocumentStore()
    repository = KnotRepository(store)
    seed_demo_repository(repository)
    return TestClient(create_app(settings=settings, repository=repository)), repository


def seeded_gateway(monkeypatch) -> tuple[TestClient, KnotRepository]:
    """수동 릴리즈 엔드포인트를 검사하는 기본 픽스처.

    evidence 통과 시 자동 정산이 기본값이므로, 수동 경로 자체를 검증하는 테스트에서는
    자동 정산을 끄고 호출한다. 자동 정산 동작은 seeded_gateway_auto_settlement 로 검증한다.
    """
    install_confirmed_gateway(monkeypatch)
    return seeded(
        Settings(
            web3_mode="gateway",
            web3_gateway_base_url="http://web3-gateway.test",
            auto_settlement_on_evidence=False,
        )
    )


def seeded_gateway_auto_settlement(monkeypatch) -> tuple[TestClient, KnotRepository]:
    install_confirmed_gateway(monkeypatch)
    return seeded(
        Settings(
            web3_mode="gateway",
            web3_gateway_base_url="http://web3-gateway.test",
            auto_settlement_on_evidence=True,
        )
    )


def auth_headers(uid: str = "user-brand-1", email: str = "brand@example.com") -> dict[str, str]:
    header = _b64({"alg": "none", "typ": "JWT"})
    payload = _b64(
        {
            "sub": uid,
            "user_id": uid,
            "email": email,
            "aud": "knot-dev-503505",
        }
    )
    return {"Authorization": f"Bearer {header}.{payload}."}


def _b64(payload: dict[str, object]) -> str:
    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode("ascii")
    return encoded.rstrip("=")


def install_confirmed_gateway(monkeypatch, *, status: str = "CONFIRMED") -> None:
    class ConfirmedGatewayClient:
        def __init__(self, base_url: str) -> None:
            self.base_url = base_url

        def lock_escrow(
            self,
            *,
            idempotency_key: str,
            payload: dict[str, object],
        ) -> dict[str, object]:
            return {
                "status": status,
                "agreementId": payload["agreementId"],
                "escrowId": payload["escrowId"],
                "termsHash": payload["termsHash"],
                "lockedAmountBaseUnits": payload["expectedAmountBaseUnits"],
                "mint": payload["mint"],
                "programId": payload["programId"],
                "network": payload["network"],
                "idempotencyKey": idempotency_key,
                "signature": "lock-signature-confirmed" if status == "CONFIRMED" else None,
                "explorerUrl": (
                    "https://explorer.solana.com/tx/lock-signature-confirmed?cluster=devnet"
                    if status == "CONFIRMED"
                    else None
                ),
                "liveContext": {
                    "escrowId": payload["escrowId"],
                    "campaignId": "123",
                    "campaign": "campaign-pda",
                    "creator": "creator-wallet",
                    "creatorToken": "creator-token",
                    "agentAuthority": "agent-wallet",
                    "treasuryToken": "treasury-token",
                    "mint": payload["mint"],
                    "milestoneIds": payload["milestoneIds"],
                    "milestoneAmountsBaseUnits": payload["milestoneAmountsBaseUnits"],
                },
            }

        def release_milestone(
            self,
            *,
            escrow_id: str,
            milestone_id: str,
            idempotency_key: str,
            payload: dict[str, object],
        ) -> dict[str, object]:
            return {
                "status": status,
                "agreementId": payload["agreementId"],
                "escrowId": escrow_id,
                "milestoneId": milestone_id,
                "termsHash": payload["termsHash"],
                "releasedAmountBaseUnits": payload["expectedAmountBaseUnits"],
                "mint": payload["mint"],
                "programId": payload["programId"],
                "network": payload["network"],
                "idempotencyKey": idempotency_key,
                "signature": "release-signature-confirmed" if status == "CONFIRMED" else None,
                "explorerUrl": (
                    "https://explorer.solana.com/tx/release-signature-confirmed?cluster=devnet"
                    if status == "CONFIRMED"
                    else None
                ),
            }

    monkeypatch.setattr("apps.api.routes.Web3GatewayClient", ConfirmedGatewayClient)


def install_funding_gateway(monkeypatch) -> type:
    class FundingGatewayClient:
        prepare_payload: dict[str, object] = {}
        confirm_payload: dict[str, object] = {}

        def __init__(self, base_url: str) -> None:
            self.base_url = base_url

        def prepare_funding(
            self,
            *,
            idempotency_key: str,
            payload: dict[str, object],
        ) -> dict[str, object]:
            FundingGatewayClient.prepare_payload = {"idempotencyKey": idempotency_key, **payload}
            return {
                "status": "PREPARED",
                **payload,
                "brandTokenAccount": "brand-token-account",
                "escrowPda": "escrow-pda",
                "vaultTokenAccount": "vault-token-account",
                "brandUsdcBalanceBaseUnits": payload["totalAmountBaseUnits"],
                "estimatedNetworkFeeLamports": "5000",
                "transactionBase64": "AA==",
                "recentBlockhash": "blockhash",
                "lastValidBlockHeight": 123,
            }

        def confirm_funding(
            self,
            *,
            idempotency_key: str,
            payload: dict[str, object],
        ) -> dict[str, object]:
            FundingGatewayClient.confirm_payload = {"idempotencyKey": idempotency_key, **payload}
            return {
                "status": "CONFIRMED",
                "signature": payload["transactionSignature"],
                "explorerUrl": "https://explorer.solana.com/tx/funding-signature?cluster=devnet",
                "slot": 123,
                "brandDeltaBaseUnits": f"-{payload['totalAmountBaseUnits']}",
                "vaultDeltaBaseUnits": payload["totalAmountBaseUnits"],
                "liveContext": {
                    "agreementEscrowVersion": "v1",
                    "escrowId": payload["escrowId"],
                    "escrowPda": payload["escrowPda"],
                    "vaultTokenAccount": payload["vaultTokenAccount"],
                    "brandTokenAccount": payload["brandTokenAccount"],
                    "creatorDestination": payload["creatorDestination"],
                    "settlementAuthority": payload["settlementAuthority"],
                    "mint": payload["mint"],
                    "milestoneIds": payload["milestoneIds"],
                    "milestoneAmountsBaseUnits": payload["milestoneAmountsBaseUnits"],
                },
                **payload,
            }

    monkeypatch.setattr("apps.api.routes.Web3GatewayClient", FundingGatewayClient)
    return FundingGatewayClient


def install_failing_funding_gateway(monkeypatch, message: str) -> None:
    class FailingFundingGatewayClient:
        def __init__(self, base_url: str) -> None:
            self.base_url = base_url

        def prepare_funding(
            self,
            *,
            idempotency_key: str,
            payload: dict[str, object],
        ) -> dict[str, object]:
            raise Web3GatewayError(message)

    monkeypatch.setattr("apps.api.routes.Web3GatewayClient", FailingFundingGatewayClient)


def accepted_agreement(client: TestClient) -> dict[str, object]:
    match_run = client.post("/api/v1/promotions/promotion-001/matches:run").json()["data"][
        "matchRun"
    ]
    return client.post(f"/api/v1/match-runs/{match_run['matchRunId']}:start-negotiation").json()[
        "data"
    ]["agreement"]


def brand_owned_agreement_with_wallets(
    client: TestClient,
    repository: KnotRepository,
) -> dict[str, object]:
    agreement = accepted_agreement(client)
    brand = repository.get_raw_document(FirestorePaths.brand("brand-1"))
    creator = repository.get_raw_document(FirestorePaths.creator_profile("creator-001"))
    assert brand is not None
    assert creator is not None
    repository.save_raw_document(
        FirestorePaths.brand("brand-1"),
        {**brand, "walletAddress": BRAND_WALLET, "walletNetwork": "devnet"},
    )
    repository.save_raw_document(
        FirestorePaths.creator_profile("creator-001"),
        {**creator, "walletAddress": CREATOR_WALLET, "walletNetwork": "devnet"},
    )
    updated = {
        **agreement,
        "brandId": "brand-1",
        "creatorId": "creator-001",
        "creatorDestination": CREATOR_WALLET,
    }
    repository.save_raw_document(FirestorePaths.agreement(agreement["agreementId"]), updated)
    return updated


def pass_evidence(client: TestClient, agreement: dict[str, object], milestone_id: str) -> None:
    evidence = client.post(
        f"/api/v1/agreements/{agreement['agreementId']}/evidence",
        json={
            "url": CLEAN_EVIDENCE_URL,
            "submittedByAgentId": agreement["creatorAgentId"],
            "milestoneId": milestone_id,
        },
    ).json()["data"]["evidence"]
    verify = client.post(f"/api/v1/evidence/{evidence['evidenceId']}:verify")
    assert verify.status_code == 200


def lock(client: TestClient, agreement: dict[str, object], key: str) -> dict[str, object]:
    response = client.post(
        f"/api/v1/agreements/{agreement['agreementId']}/escrow:lock",
        headers={"Idempotency-Key": key},
    )
    assert response.status_code == 200, response.text
    return response.json()["data"]


def timeline_types(client: TestClient) -> list[str]:
    events = client.get("/api/v1/promotions/promotion-001/timeline").json()["data"]["events"]
    return [event["type"] for event in events]


def assert_base58_safe(value: str) -> None:
    assert value
    assert all(character in BASE58_ALPHABET for character in value)


def test_prepare_funding_uses_brand_and_creator_phantom_wallets(monkeypatch) -> None:
    gateway = install_funding_gateway(monkeypatch)
    client, repository = seeded(
        Settings(
            auth_mode="emulator",
            firebase_project_id="knot-dev-503505",
            web3_mode="gateway",
            web3_gateway_base_url="http://web3-gateway.test",
            settlement_authority=SETTLEMENT_AUTHORITY,
        )
    )
    agreement = brand_owned_agreement_with_wallets(client, repository)

    response = client.post(
        f"/api/v1/agreements/{agreement['agreementId']}/escrow/prepare",
        headers={**auth_headers(), "Idempotency-Key": "prepare-funding"},
    )

    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["escrow"]["status"] == "CREATED"
    assert data["escrow"]["brandAuthority"] == BRAND_WALLET
    assert data["escrow"]["creatorDestination"] == CREATOR_WALLET
    assert data["funding"]["status"] == "PREPARED"
    assert gateway.prepare_payload["brandAuthority"] == BRAND_WALLET
    assert gateway.prepare_payload["creatorDestination"] == CREATOR_WALLET
    assert_base58_safe(str(gateway.prepare_payload["escrowId"]))
    stored_agreement = repository.get_raw_document(
        FirestorePaths.agreement(agreement["agreementId"])
    )
    assert stored_agreement is not None
    assert stored_agreement["status"] == "FUNDING_REQUIRED"


def test_prepare_funding_replays_same_idempotency_key(monkeypatch) -> None:
    install_funding_gateway(monkeypatch)
    client, repository = seeded(
        Settings(
            auth_mode="emulator",
            firebase_project_id="knot-dev-503505",
            web3_mode="gateway",
            web3_gateway_base_url="http://web3-gateway.test",
            settlement_authority=SETTLEMENT_AUTHORITY,
        )
    )
    agreement = brand_owned_agreement_with_wallets(client, repository)
    path = f"/api/v1/agreements/{agreement['agreementId']}/escrow/prepare"
    headers = {**auth_headers(), "Idempotency-Key": "prepare-retry"}

    first = client.post(path, headers=headers)
    second = client.post(path, headers=headers)

    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    assert first.json()["data"]["escrow"]["escrowId"] == second.json()["data"]["escrow"]["escrowId"]


def test_prepare_funding_gateway_policy_failure_is_not_reported_as_bad_gateway(monkeypatch) -> None:
    install_failing_funding_gateway(
        monkeypatch,
        "409 Conflict: Brand USDC token account not found",
    )
    client, repository = seeded(
        Settings(
            auth_mode="emulator",
            firebase_project_id="knot-dev-503505",
            web3_mode="gateway",
            web3_gateway_base_url="http://web3-gateway.test",
            settlement_authority=SETTLEMENT_AUTHORITY,
        )
    )
    agreement = brand_owned_agreement_with_wallets(client, repository)

    response = client.post(
        f"/api/v1/agreements/{agreement['agreementId']}/escrow/prepare",
        headers={**auth_headers(), "Idempotency-Key": "prepare-policy-failure"},
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "FUNDING_PREPARE_FAILED"
    assert "Brand USDC token account not found" in response.json()["detail"]["detail"]


def test_confirm_funding_marks_escrow_funded_only_after_gateway_validation(monkeypatch) -> None:
    gateway = install_funding_gateway(monkeypatch)
    client, repository = seeded(
        Settings(
            auth_mode="emulator",
            firebase_project_id="knot-dev-503505",
            web3_mode="gateway",
            web3_gateway_base_url="http://web3-gateway.test",
            settlement_authority=SETTLEMENT_AUTHORITY,
        )
    )
    agreement = brand_owned_agreement_with_wallets(client, repository)
    prepare = client.post(
        f"/api/v1/agreements/{agreement['agreementId']}/escrow/prepare",
        headers={**auth_headers(), "Idempotency-Key": "prepare-funding-confirm"},
    )
    assert prepare.status_code == 200

    response = client.post(
        f"/api/v1/agreements/{agreement['agreementId']}/escrow/confirm",
        headers={**auth_headers(), "Idempotency-Key": "confirm-funding"},
        json={"transactionSignature": "funding-signature"},
    )

    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["escrow"]["status"] == "FUNDED"
    assert data["escrow"]["fundingTransactionSignature"] == "funding-signature"
    assert data["receipt"]["status"] == "CONFIRMED"
    assert gateway.confirm_payload["transactionSignature"] == "funding-signature"
    stored_agreement = repository.get_raw_document(
        FirestorePaths.agreement(agreement["agreementId"])
    )
    assert stored_agreement is not None
    assert stored_agreement["status"] == "FUNDED"


def test_prepare_funding_requires_brand_wallet(monkeypatch) -> None:
    install_funding_gateway(monkeypatch)
    client, repository = seeded(
        Settings(
            auth_mode="emulator",
            firebase_project_id="knot-dev-503505",
            web3_mode="gateway",
            web3_gateway_base_url="http://web3-gateway.test",
            settlement_authority=SETTLEMENT_AUTHORITY,
        )
    )
    agreement = accepted_agreement(client)
    updated = {**agreement, "brandId": "brand-1", "creatorId": "creator-001"}
    repository.save_raw_document(FirestorePaths.agreement(agreement["agreementId"]), updated)

    response = client.post(
        f"/api/v1/agreements/{agreement['agreementId']}/escrow/prepare",
        headers={**auth_headers(), "Idempotency-Key": "prepare-no-wallet"},
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "BRAND_WALLET_REQUIRED"


def test_lock_creates_escrow_with_confirmed_receipt_and_no_fee(monkeypatch) -> None:
    client, _ = seeded_gateway(monkeypatch)
    agreement = accepted_agreement(client)

    empty_response = client.get(f"/api/v1/agreements/{agreement['agreementId']}/escrow")
    assert empty_response.status_code == 200
    assert empty_response.json()["data"] == {"escrow": None, "settlements": []}

    data = lock(client, agreement, "lock-1")
    escrow = data["escrow"]
    assert escrow["status"] == "LOCKED"
    assert escrow["platformFeeBps"] == 0
    assert escrow["network"] == "solanaDevnet"
    assert escrow["releasedAmountBaseUnits"] == "0"
    assert int(escrow["lockedAmountBaseUnits"]) > 0
    assert escrow["termsHash"] == agreement["termsHash"]
    assert data["receipt"]["status"] == "CONFIRMED"
    assert data["receipt"]["signature"] == "lock-signature-confirmed"
    assert timeline_types(client).count("ESCROW_LOCKED") == 1

    escrow_response = client.get(f"/api/v1/agreements/{agreement['agreementId']}/escrow")
    assert escrow_response.status_code == 200
    assert escrow_response.json()["data"]["escrow"]["escrowId"] == escrow["escrowId"]
    assert escrow_response.json()["data"]["settlements"] == []


def test_lock_requires_idempotency_key() -> None:
    client, _ = seeded()
    agreement = accepted_agreement(client)
    response = client.post(f"/api/v1/agreements/{agreement['agreementId']}/escrow:lock")
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "VALIDATION_ERROR"


def test_lock_is_idempotent_on_repeated_key(monkeypatch) -> None:
    client, _ = seeded_gateway(monkeypatch)
    agreement = accepted_agreement(client)
    first = lock(client, agreement, "same-key")
    second = lock(client, agreement, "same-key")
    assert first["escrow"]["escrowId"] == second["escrow"]["escrowId"]
    assert timeline_types(client).count("ESCROW_LOCKED") == 1


def test_lock_conflicts_when_already_locked_with_different_key(monkeypatch) -> None:
    client, _ = seeded_gateway(monkeypatch)
    agreement = accepted_agreement(client)
    lock(client, agreement, "key-1")
    response = client.post(
        f"/api/v1/agreements/{agreement['agreementId']}/escrow:lock",
        headers={"Idempotency-Key": "key-2"},
    )
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "ESCROW_ALREADY_LOCKED"


def test_lock_blocked_when_auto_escrow_disabled() -> None:
    client, repository = seeded()
    promotion = repository.get_promotion("promotion-001")
    assert promotion is not None
    repository.save_promotion(
        promotion.model_copy(
            update={"autonomy": promotion.autonomy.model_copy(update={"auto_escrow": False})}
        )
    )
    agreement = accepted_agreement(client)
    response = client.post(
        f"/api/v1/agreements/{agreement['agreementId']}/escrow:lock",
        headers={"Idempotency-Key": "k"},
    )
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "POLICY_VIOLATION"


def test_lock_requires_web3_gateway_for_success() -> None:
    client, repository = seeded()
    agreement = accepted_agreement(client)

    response = client.post(
        f"/api/v1/agreements/{agreement['agreementId']}/escrow:lock",
        headers={"Idempotency-Key": "no-gateway"},
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "WEB3_GATEWAY_REQUIRED"
    assert repository.list_raw_documents("escrows") == []
    receipts = repository.list_raw_documents("transactionReceipts")
    assert len(receipts) == 1
    assert receipts[0]["status"] == "FAILED"
    operations = repository.list_raw_documents("paymentOperations")
    lock_operations = [
        operation
        for operation in operations
        if operation["operationType"] == "ESCROW_LOCK"
    ]
    assert len(lock_operations) == 1
    assert lock_operations[0]["status"] == "FAILED"


def test_authenticated_gateway_lock_requires_phantom_funding() -> None:
    client, _ = seeded(
        Settings(
            auth_mode="emulator",
            firebase_project_id="knot-dev-503505",
            web3_mode="gateway",
            web3_gateway_base_url="http://web3-gateway.test",
        )
    )
    agreement = accepted_agreement(client)

    response = client.post(
        f"/api/v1/agreements/{agreement['agreementId']}/escrow:lock",
        headers={**auth_headers(), "Idempotency-Key": "legacy-auth-lock"},
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "PHANTOM_FUNDING_REQUIRED"


def test_releasing_content_alone_leaves_the_deposit_unreleased(monkeypatch) -> None:
    """마일스톤이 계약금+잔금 2개이므로 잔금만 릴리즈하면 부분 릴리즈다 (docs/17 D3)."""
    client, _ = seeded_gateway(monkeypatch)
    agreement = accepted_agreement(client)
    escrow = lock(client, agreement, "lk")["escrow"]
    pass_evidence(client, agreement, "content")

    response = client.post(
        f"/api/v1/escrows/{escrow['escrowId']}/milestones/content:release",
        headers={"Idempotency-Key": "rel-content"},
    )
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["settlement"]["milestoneId"] == "content"
    assert data["settlement"]["status"] == "CONFIRMED"
    assert data["escrow"]["status"] == "PARTIALLY_RELEASED"
    assert data["escrow"]["releasedAmountBaseUnits"] == escrow["milestoneAmounts"]["content"]
    # 계약금이 아직 vault 에 남아 있다 — 종결 사유에 따라 크리에이터/브랜드로 갈린다.
    assert int(data["escrow"]["releasedAmountBaseUnits"]) < int(escrow["lockedAmountBaseUnits"])
    assert data["receipt"]["signature"] == "release-signature-confirmed"

    receipt_id = data["receipt"]["receiptId"]
    assert client.get(f"/api/v1/transaction-receipts/{receipt_id}").status_code == 200
    assert "MILESTONE_RELEASED" in timeline_types(client)


def test_authenticated_creator_release_requires_connected_wallet_match(
    monkeypatch,
) -> None:
    install_funding_gateway(monkeypatch)
    client, repository = seeded(
        Settings(
            auth_mode="emulator",
            firebase_project_id="knot-dev-503505",
            web3_mode="gateway",
            web3_gateway_base_url="http://web3-gateway.test",
            settlement_authority=SETTLEMENT_AUTHORITY,
        )
    )
    agreement = brand_owned_agreement_with_wallets(client, repository)
    prepare = client.post(
        f"/api/v1/agreements/{agreement['agreementId']}/escrow/prepare",
        headers={**auth_headers(), "Idempotency-Key": "prepare-release-wallet-check"},
    )
    assert prepare.status_code == 200
    confirm = client.post(
        f"/api/v1/agreements/{agreement['agreementId']}/escrow/confirm",
        headers={**auth_headers(), "Idempotency-Key": "confirm-release-wallet-check"},
        json={"transactionSignature": "funding-signature"},
    )
    assert confirm.status_code == 200
    escrow = confirm.json()["data"]["escrow"]
    pass_evidence(client, agreement, "content")
    creator_headers = auth_headers(uid="user-creator-001", email="creator@example.com")
    repository.save_raw_document(
        FirestorePaths.user("user-creator-001"),
        {
            "uid": "user-creator-001",
            "userId": "user-creator-001",
            "email": "creator@example.com",
            "displayName": "Creator owner",
            "role": "CREATOR",
            "onboardingStatus": "COMPLETED",
            "creatorId": "creator-001",
            "agentId": "creator-agent-001",
            "status": "ACTIVE",
        },
    )
    # 에스크로의 creator_destination 과 다른 지갑을 연결해 불일치를 만든다.
    _, wallet = connect_wallet(client, creator_headers)
    assert wallet.status_code == 200, wallet.text

    release = client.post(
        f"/api/v1/escrows/{escrow['escrowId']}/milestones/content:release",
        headers={**creator_headers, "Idempotency-Key": "release-wallet-mismatch"},
    )

    assert release.status_code == 409
    assert release.json()["detail"]["code"] == "CREATOR_WALLET_MISMATCH"


def test_release_blocked_without_passing_evidence(monkeypatch) -> None:
    client, _ = seeded_gateway(monkeypatch)
    agreement = accepted_agreement(client)
    escrow = lock(client, agreement, "lk")["escrow"]
    response = client.post(
        f"/api/v1/escrows/{escrow['escrowId']}/milestones/content:release",
        headers={"Idempotency-Key": "rel-content"},
    )
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "POLICY_VIOLATION"


def test_release_blocked_after_failed_evidence_without_settlement(monkeypatch) -> None:
    client, repository = seeded_gateway(monkeypatch)
    agreement = accepted_agreement(client)
    escrow = lock(client, agreement, "lk")["escrow"]
    evidence = client.post(
        f"/api/v1/agreements/{agreement['agreementId']}/evidence",
        json={
            "url": "https://social.example/post/missing-disclosure",
            "submittedByAgentId": agreement["creatorAgentId"],
            "milestoneId": "content",
        },
    ).json()["data"]["evidence"]
    # 공시 누락은 고칠 수 있는 결함이라 REVISION_REQUIRED 다 — 오류가 아니고 계약도 살아
    # 있지만, 검증을 통과하지 않았으므로 릴리즈는 여전히 막혀야 한다(docs/17 P1).
    verify = client.post(f"/api/v1/evidence/{evidence['evidenceId']}:verify")
    assert verify.status_code == 200, verify.text
    assert verify.json()["data"]["outcome"] == "REVISION_REQUIRED"

    response = client.post(
        f"/api/v1/escrows/{escrow['escrowId']}/milestones/content:release",
        headers={"Idempotency-Key": "rel-content"},
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "POLICY_VIOLATION"
    assert repository.list_raw_documents("settlements") == []
    persisted_escrow = repository.get_raw_document(f"escrows/{escrow['escrowId']}")
    assert persisted_escrow is not None
    assert persisted_escrow["status"] == "LOCKED"


def test_release_blocked_when_auto_release_disabled(monkeypatch) -> None:
    client, repository = seeded_gateway(monkeypatch)
    promotion = repository.get_promotion("promotion-001")
    assert promotion is not None
    repository.save_promotion(
        promotion.model_copy(
            update={"autonomy": promotion.autonomy.model_copy(update={"auto_release": False})}
        )
    )
    agreement = accepted_agreement(client)
    escrow = lock(client, agreement, "lk")["escrow"]
    pass_evidence(client, agreement, "content")
    response = client.post(
        f"/api/v1/escrows/{escrow['escrowId']}/milestones/content:release",
        headers={"Idempotency-Key": "rel"},
    )
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "POLICY_VIOLATION"


def test_releasing_deposit_and_content_completes_escrow(monkeypatch) -> None:
    """정상 완료는 계약금 + 잔금 둘 다 크리에이터에게 간다 (docs/17 §0.6 종결 매트릭스)."""
    client, _ = seeded_gateway(monkeypatch)
    agreement = accepted_agreement(client)
    escrow = lock(client, agreement, "lk")["escrow"]
    pass_evidence(client, agreement, "content")

    deposit = client.post(
        f"/api/v1/escrows/{escrow['escrowId']}/milestones/deposit:release",
        headers={"Idempotency-Key": "rel-deposit"},
    )
    assert deposit.status_code == 200, deposit.text
    assert deposit.json()["data"]["escrow"]["status"] == "PARTIALLY_RELEASED"

    final = client.post(
        f"/api/v1/escrows/{escrow['escrowId']}/milestones/content:release",
        headers={"Idempotency-Key": "rel-content"},
    ).json()["data"]
    assert final["escrow"]["status"] == "RELEASED"
    # released + refunded == funded 불변식: 환불이 없으므로 released == locked
    assert final["escrow"]["releasedAmountBaseUnits"] == escrow["lockedAmountBaseUnits"]


def test_lock_and_release_use_web3_gateway_when_enabled(monkeypatch) -> None:
    class FakeGatewayClient:
        lock_payload: dict[str, object] = {}
        release_payload: dict[str, object] = {}

        def __init__(self, base_url: str) -> None:
            self.base_url = base_url

        def lock_escrow(
            self,
            *,
            idempotency_key: str,
            payload: dict[str, object],
        ) -> dict[str, object]:
            FakeGatewayClient.lock_payload = {"idempotencyKey": idempotency_key, **payload}
            return {
                "status": "CONFIRMED",
                "agreementId": payload["agreementId"],
                "escrowId": payload["escrowId"],
                "termsHash": payload["termsHash"],
                "lockedAmountBaseUnits": payload["expectedAmountBaseUnits"],
                "mint": payload["mint"],
                "programId": payload["programId"],
                "network": payload["network"],
                "idempotencyKey": idempotency_key,
                "signature": "lock-signature-confirmed",
                "explorerUrl": "https://explorer.solana.com/tx/lock-signature-confirmed?cluster=devnet",
                "liveContext": {
                    "escrowId": payload["escrowId"],
                    "campaignId": "123",
                    "campaign": "campaign-pda",
                    "creator": "creator-wallet",
                    "creatorToken": "creator-token",
                    "agentAuthority": "agent-wallet",
                    "treasuryToken": "treasury-token",
                    "mint": payload["mint"],
                    "milestoneIds": payload["milestoneIds"],
                    "milestoneAmountsBaseUnits": payload["milestoneAmountsBaseUnits"],
                },
            }

        def release_milestone(
            self,
            *,
            escrow_id: str,
            milestone_id: str,
            idempotency_key: str,
            payload: dict[str, object],
        ) -> dict[str, object]:
            FakeGatewayClient.release_payload = {"idempotencyKey": idempotency_key, **payload}
            assert payload["escrowId"] == escrow_id
            assert payload["milestoneId"] == milestone_id
            assert payload["lockContext"]["campaign"] == "campaign-pda"
            return {
                "status": "CONFIRMED",
                "agreementId": payload["agreementId"],
                "escrowId": payload["escrowId"],
                "milestoneId": payload["milestoneId"],
                "termsHash": payload["termsHash"],
                "releasedAmountBaseUnits": payload["expectedAmountBaseUnits"],
                "mint": payload["mint"],
                "programId": payload["programId"],
                "network": payload["network"],
                "idempotencyKey": idempotency_key,
                "signature": "release-signature-confirmed",
                "explorerUrl": "https://explorer.solana.com/tx/release-signature-confirmed?cluster=devnet",
            }

    monkeypatch.setattr("apps.api.routes.Web3GatewayClient", FakeGatewayClient)
    client, _ = seeded(
        Settings(
            web3_mode="gateway",
            web3_gateway_base_url="http://web3-gateway.test",
            auto_settlement_on_evidence=False,
        )
    )
    agreement = accepted_agreement(client)

    lock_data = lock(client, agreement, "gateway-lock")
    lock_receipt = lock_data["receipt"]
    escrow = lock_data["escrow"]
    pass_evidence(client, agreement, "content")
    assert lock_receipt["gatewayReceipt"]["idempotencyKey"] == "gateway-lock"
    assert FakeGatewayClient.lock_payload["escrowId"] == escrow["escrowId"]
    assert_base58_safe(str(FakeGatewayClient.lock_payload["escrowId"]))
    assert FakeGatewayClient.lock_payload["expectedAmountBaseUnits"] == escrow[
        "lockedAmountBaseUnits"
    ]

    release = client.post(
        f"/api/v1/escrows/{escrow['escrowId']}/milestones/content:release",
        headers={"Idempotency-Key": "gateway-release"},
    )
    assert release.status_code == 200, release.text
    release_data = release.json()["data"]
    release_receipt = release_data["receipt"]
    assert release_receipt["gatewayReceipt"]["idempotencyKey"] == "gateway-release"
    assert release_receipt["gatewayReceipt"]["milestoneId"] == "content"
    assert FakeGatewayClient.release_payload["expectedAmountBaseUnits"] == escrow[
        "milestoneAmounts"
    ]["content"]


def test_evidence_pass_auto_settles_without_human_signature(monkeypatch) -> None:
    """evidence 통과만으로 마일스톤이 정산된다 — Phantom 클릭 없음."""
    client, repository = seeded_gateway_auto_settlement(monkeypatch)
    agreement = accepted_agreement(client)
    escrow = lock(client, agreement, "lk")["escrow"]

    pass_evidence(client, agreement, "content")

    # 정상 완료는 계약금까지 크리에이터에게 간다 (docs/17 §0.6). 계약금은 수락 시점에
    # 귀속만 확정되고 전송은 종결 시에 일어나므로, 잔금 검증 시점에 둘이 함께 나간다.
    settlements = repository.list_raw_documents("settlements")
    assert len(settlements) == 2
    assert {item["milestoneId"] for item in settlements} == {"deposit", "content"}
    assert all(item["status"] == "CONFIRMED" for item in settlements)

    stored = repository.get_raw_document(f"escrows/{escrow['escrowId']}")
    assert stored is not None
    assert stored["status"] == "RELEASED"
    assert stored["releasedAmountBaseUnits"] == escrow["lockedAmountBaseUnits"]
    assert "MILESTONE_RELEASED" in timeline_types(client)


def test_auto_settlement_reports_signer_and_is_not_repeated(monkeypatch) -> None:
    client, repository = seeded_gateway_auto_settlement(monkeypatch)
    agreement = accepted_agreement(client)
    escrow = lock(client, agreement, "lk")["escrow"]

    pass_evidence(client, agreement, "content")
    assert len(repository.list_raw_documents("settlements")) == 2

    # 이미 자동 정산된 마일스톤은 수동 릴리즈로 다시 지급되지 않는다 — 계약금도 마찬가지다.
    for milestone_id in ("content", "deposit"):
        replay = client.post(
            f"/api/v1/escrows/{escrow['escrowId']}/milestones/{milestone_id}:release",
            headers={"Idempotency-Key": f"manual-after-auto-{milestone_id}"},
        )
        assert replay.status_code == 409
        assert replay.json()["detail"]["code"] == "MILESTONE_ALREADY_RELEASED"
    assert len(repository.list_raw_documents("settlements")) == 2


def test_auto_settlement_failure_leaves_manual_release_available(monkeypatch) -> None:
    """자동 정산이 실패해도 evidence 검증은 통과하고 수동 경로가 살아 있어야 한다."""
    client, repository = seeded_gateway_auto_settlement(monkeypatch)
    agreement = accepted_agreement(client)
    escrow = lock(client, agreement, "lk")["escrow"]

    def exploding_release(*args, **kwargs):
        raise RuntimeError("gateway unavailable")

    monkeypatch.setattr("apps.api.routes._release_with_web3_gateway", exploding_release)
    pass_evidence(client, agreement, "content")

    assert repository.list_raw_documents("settlements") == []
    assert "MILESTONE_AUTO_RELEASE_DEFERRED" in timeline_types(client)

    monkeypatch.undo()
    install_confirmed_gateway(monkeypatch)
    for milestone_id in ("deposit", "content"):
        manual = client.post(
            f"/api/v1/escrows/{escrow['escrowId']}/milestones/{milestone_id}:release",
            headers={"Idempotency-Key": f"manual-fallback-{milestone_id}"},
        )
        assert manual.status_code == 200, manual.text
    assert manual.json()["data"]["escrow"]["status"] == "RELEASED"


def test_release_is_idempotent_on_repeated_key(monkeypatch) -> None:
    client, _ = seeded_gateway(monkeypatch)
    agreement = accepted_agreement(client)
    escrow = lock(client, agreement, "lk")["escrow"]
    pass_evidence(client, agreement, "content")
    path = f"/api/v1/escrows/{escrow['escrowId']}/milestones/content:release"
    first = client.post(path, headers={"Idempotency-Key": "rc"}).json()["data"]
    second = client.post(path, headers={"Idempotency-Key": "rc"}).json()["data"]
    assert first["settlement"]["settlementId"] == second["settlement"]["settlementId"]


def test_gateway_simulated_receipt_is_persisted_as_failed_lock(monkeypatch) -> None:
    install_confirmed_gateway(monkeypatch, status="SIMULATED")
    client, repository = seeded(
        Settings(web3_mode="gateway", web3_gateway_base_url="http://web3-gateway.test")
    )
    agreement = accepted_agreement(client)

    response = client.post(
        f"/api/v1/agreements/{agreement['agreementId']}/escrow:lock",
        headers={"Idempotency-Key": "simulated-gateway"},
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "WEB3_RECEIPT_INVALID"
    assert repository.list_raw_documents("escrows") == []
    receipts = repository.list_raw_documents("transactionReceipts")
    assert len(receipts) == 1
    assert receipts[0]["status"] == "FAILED"
