"""pay.sh (x402 / MPP) 연동 — 에이전트가 유료 API를 USDC-SPL로 자율 결제.

Python용 x402+Solana 직접 SDK는 아직 미성숙하므로(공식 문서 명시), 언어 무관한
`pay` CLI를 subprocess로 감싸 사용한다. 에이전트 네이티브 연동은 Pay MCP(.mcp.json)로도 가능.

sandbox 모드(`sandbox=True`)는 지갑 펀딩 없이 동작하므로 개발/데모 기본값.
실지갑은 `pay setup`(OS 키체인)으로 생성 후 `sandbox=False`.
"""
from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass


class PayCliNotFound(RuntimeError):
    """`pay` CLI가 PATH에 없을 때."""


def _pay_bin() -> str:
    p = shutil.which("pay")
    if not p:
        raise PayCliNotFound("`pay` CLI를 찾을 수 없음. `npm i -g @solana/pay` 후 재시도.")
    return p


@dataclass
class PayResult:
    ok: bool
    returncode: int
    body: str
    stderr: str


def fetch(url: str, *, sandbox: bool = True, timeout: int = 90) -> PayResult:
    """유료 API를 pay 내장 HTTP 클라이언트로 호출(402 결제 자동 처리).

    예) fetch("https://debugger.pay.sh/mpp/quote/AAPL")  # sandbox, 펀딩 불필요
    """
    args = [_pay_bin()]
    if sandbox:
        args.append("--sandbox")
    args += ["fetch", url]
    proc = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    return PayResult(
        ok=proc.returncode == 0,
        returncode=proc.returncode,
        body=proc.stdout,
        stderr=proc.stderr,
    )


def skills(query: str | None = None, *, sandbox: bool = True, timeout: int = 60) -> str:
    """pay 스킬 카탈로그(유료 API 제공자) 탐색/검색."""
    args = [_pay_bin()]
    if sandbox:
        args.append("--sandbox")
    args.append("skills")
    if query:
        args += ["search", query]
    proc = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    return proc.stdout
