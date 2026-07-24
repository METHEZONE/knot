"""knot 블록체인 백엔드 패키지.

- ``knot.payments`` — pay.sh / x402 유료 API 자율 결제 (결제 흐름 1)
- ``knot.escrow``   — knot-escrow 온체인 클라이언트, 마일스톤 정산 (결제 흐름 2)
- ``knot.identity`` — 온체인 신원/평판 조회

아키텍처·인터페이스 계약: ../../docs/architecture.md
"""

__all__ = ["payments", "escrow", "identity"]
