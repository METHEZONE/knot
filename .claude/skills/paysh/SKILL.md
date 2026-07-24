---
name: paysh
description: pay.sh(x402/MPP)로 에이전트가 유료 API를 USDC-SPL로 자율 결제. "pay.sh", "유료 API 결제", "x402", "Pay MCP", "sandbox 결제" 관련 작업에 사용. (해커톤 가산점 스택)
---

# paysh — pay.sh / x402 결제 (결제 흐름 1)

pay.sh = Solana 재단+Google Cloud의 x402 게이트웨이. 에이전트 지갑이 신원, 계정/API키 없이
호출당 USDC-SPL 결제. **주최사 제품이라 사용 시 해커톤 가산점.**

## 설치 / 버전
```bash
npm install -g @solana/pay      # 최초 실행 시 실제 pay 바이너리 자동 다운로드
pay --version                   # 0.21.x
```

## sandbox 먼저 (펀딩 불필요 — 개발/데모 기본값)
```bash
pay --sandbox fetch https://debugger.pay.sh/mpp/quote/AAPL
pay --sandbox curl  https://debugger.pay.sh/mpp/quote/AAPL   # curl 패스스루도 가능
pay --sandbox skills                 # 유료 API 제공자 카탈로그
pay --sandbox skills search nansen
```

## 실지갑 (mainnet 결제 시)
```bash
pay setup            # 키페어 생성(OS 키체인) + MCP 설정 + 에이전트 skill 설치
pay setup --update   # 계정 새로 만들지 않고 MCP 설정만 재설치
pay topup            # Venmo/PayPal/모바일 지갑에서 충전
pay account list
```

## Pay MCP (에이전트 네이티브 연동)
`.mcp.json`에 sandbox MCP 서버 등록됨 → Claude Code/Cursor가 Pay 도구를 자동 사용:
```json
{ "mcpServers": { "pay": { "command": "pay", "args": ["--sandbox", "mcp"] } } }
```
직접 실행: `pay --sandbox mcp`.

## Python에서 (backend)
```python
from knot.payments import paysh
res = paysh.fetch("https://<paid-api>", sandbox=True)   # PayResult(ok, returncode, body, stderr)
cat = paysh.skills("gemini", sandbox=True)
```
> Python용 x402+Solana 직접 SDK는 미성숙 → pay CLI/MCP로 우회(언어 무관).
