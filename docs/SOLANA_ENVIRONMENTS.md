# Solana 환경 — 로컬 샌드박스 & devnet

에스크로 정산은 **두 환경**으로 나눠 개발한다.

| 환경 | 무엇 | 누가 | RPC | 프로그램 id |
|---|---|---|---|---|
| **로컬 샌드박스** (localnet) | `solana-test-validator` — 각 개발자 로컬 클러스터. airdrop 무제한·무료, rate-limit 없음, 빠름 | 팀원 각자 로컬 | `http://127.0.0.1:8899` | 각 머신의 로컬 프로그램 키페어(비공유) |
| **공유 devnet** | 실제 Solana devnet — 데모/공유용 | 머지 후 1인(키페어 보유자) | `https://api.devnet.solana.com` | `Aj63B5hLtvJdNQiAi61rMrgfW3pt8Lak3GQB59B6jysj` (고정 declare_id) |

## 워크플로

```
각자 로컬(샌드박스)에서 개발·테스트  →  PR 머지  →  devnet 배포(데모)
```

### 1) 각 개발자 — 로컬 샌드박스 (원커맨드)

```bash
scripts/localnet_settlement.sh
```

이 스크립트가 알아서:
1. 프로그램 빌드 + `anchor keys sync`로 declare_id를 **이 머신의 로컬 프로그램 키페어**에 맞춤 (종료 시 커밋된 소스는 자동 복원 → devnet 프로그램 id 유지)
2. `solana-test-validator` 기동(이미 떠 있으면 재사용) + airdrop
3. 로컬 클러스터에 배포
4. `KNOT_RUN_LOCALNET=1`로 `test_escrow_devnet.py` 실행

각자 로컬 클러스터는 독립이라 **프로그램 id가 서로 달라도 무관**하다. 공유 devnet만 고정 id를 쓴다.

수동으로 돌리려면(밸리데이터를 직접 띄운 경우):
```bash
KNOT_RUN_LOCALNET=1 pytest backend/tests/test_escrow_devnet.py -q
```

### 2) 머지 후 — 공유 devnet 배포 (키페어 보유자 1인)

```bash
scripts/deploy_devnet.sh
# 지갑에 devnet SOL 필요(배포 rent ≈ 2.03 SOL) — 부족하면 https://faucet.solana.com
```
그 뒤 검증:
```bash
KNOT_RUN_DEVNET=1 pytest backend/tests/test_escrow_devnet.py -q
```

## 테스트의 환경 선택

`backend/tests/test_escrow_devnet.py`는 환경변수로 대상을 고른다 (gated — 평소 pytest 수트에선 skip):

- `KNOT_RUN_LOCALNET=1` → RPC 기본값 `http://127.0.0.1:8899` (로컬은 throttle 없음)
- `KNOT_RUN_DEVNET=1` → RPC 기본값 devnet (public devnet은 429 방지용 throttle+retry)
- `KNOT_DEVNET_RPC=<url>` 로 RPC 직접 지정 가능
- `KNOT_ESCROW_PROGRAM_ID=<id>` 로 프로그램 id override (로컬 스크립트가 자동 주입)

## 주의

- **devnet 전용** — mainnet 키/시크릿 커밋 금지. `target/`(빌드 산출물·키페어)은 gitignore.
- 로컬 스크립트는 `anchor keys sync`가 `programs/knot-escrow/src/lib.rs`·`Anchor.toml`을 잠시 수정하므로, 실행 전 그 두 파일에 커밋 안 된 변경이 없어야 한다(스크립트가 확인 후 종료 시 복원).
- devnet 프로그램 키페어는 `target/`(비추적)에 있어 보유자만 같은 id로 배포할 수 있다. 없으면 `anchor keys sync`로 새 id를 쓰고 settings/gateway/docs에 반영한다.
