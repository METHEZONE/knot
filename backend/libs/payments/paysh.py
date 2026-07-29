from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass


class PayCliNotFound(RuntimeError):
    """Raised when the pay.sh CLI is not available on PATH."""


def _pay_bin() -> str:
    path = shutil.which("pay")
    if not path:
        raise PayCliNotFound("pay CLI was not found on PATH")
    return path


@dataclass(frozen=True)
class PayResult:
    ok: bool
    returncode: int
    body: str
    stderr: str


def fetch(resource_id: str, *, sandbox: bool = True, timeout_seconds: int = 90) -> PayResult:
    """Call one pay.sh/x402-priced resource through the pay CLI.

    The CLI handles the x402 challenge/payment flow. The caller decides whether
    the returned receipt is authoritative for display; it must never authorize
    matching, escrow lock, or release decisions.
    """
    args = [_pay_bin()]
    if sandbox:
        args.append("--sandbox")
    args += ["fetch", resource_id]
    proc = subprocess.run(
        args,
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
        check=False,
    )
    return PayResult(
        ok=proc.returncode == 0,
        returncode=proc.returncode,
        body=proc.stdout,
        stderr=proc.stderr,
    )
