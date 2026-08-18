# KNOT - Improved Pitch Deck (멘토링 피드백 반영)

**"Agents negotiate. Creators create. Solana settles."**

*Solana Foundation + Google Cloud Korea AI Hackathon 2026*
*데모데이: 2026-08-07(금)*

---

## 1. 문제 정의 (The Problem)

크리에이터 협찬은 **DM 협상 → 수동 송금 → 사후 분쟁**이라는 비효율적인 프로세스로 진행됩니다.

### 브랜드의 고통
- ❌ 수백 명의 크리에이터에게 일일이 DM 보내기
- ❌ 협상에 며칠씩 소요
- ❌ 콘텐츠 게시 전 전액 지급 → 미이행 위험
- ❌ 분쟁 시 환불 불가능

### 크리에이터의 고통
- ❌ 작업 완료 후 대금 지연 (평균 30일 이상)
- ❌ 부당한 환불 요구 (일방적 계약 파기)
- ❌ 브랜드 신뢰성 검증 불가

---

## 2. 해결책 (The Solution)

**KNOT = AI 에이전트가 협상하고, Solana가 조건부 정산하는 플랫폼**

### 핵심 차별점
1. **Agent 자율 협상** - 사람 개입 없이 가격/납기/조건 협상
2. **pay.sh 신뢰 검증** - 가짜 인플루언서/저품질 콘텐츠 자동 필터링
3. **3단계 에스크로** - 환불 방지 + 분쟁 해결 시스템
4. **72시간 타임락** - 마지막 20% 보류로 이의 제기 기간 보장

---

## 3. 기술 아키텍처 (멘토링 피드백 해결)

### 3.1 Agent 신뢰성 증명 ✅

**문제**: AI가 정말 신뢰할 수 있나?
**해결**: pay.sh로 외부 검증 API를 구매해서 증명

```python
# 1. Creator 진위 검증 (Nansen/HypeAuditor API)
receipt = verify_creator(
    profile_url="https://instagram.com/creator_handle",
    max_price_usdc=0.10,  # $0.10 per verification
)
# → bot_percentage: 0.12 (12% 가짜 팔로워)
# → engagement_quality: "high"
# → 자동 필터링: bot > 25% 제외

# 2. Content 품질 검증 (Brandwatch API)
receipt = verify_content(
    content_url="https://instagram.com/p/abc123",
    brand_keywords=["product_name"],
    max_price_usdc=0.50,  # $0.50 per verification
)
# → sentiment_score: 0.85 (긍정적)
# → brand_mention_found: true
# → quality_score: 0.92 (고품질)
```

**결과**: 사람 없이도 신뢰할 수 있는 매칭/검증

---

### 3.2 환불 방지 시스템 ✅

**문제**: 브랜드가 콘텐츠 받고 환불 요구
**해결**: 3단계 마일스톤 + 분쟁 시스템

| 마일스톤 | 금액 | 트리거 | 환불 방지 효과 |
|---------|------|--------|---------------|
| 계약 체결 | 30% | Agreement 생성 시 | 브랜드 환불 불가, 크리에이터 30% 보장 |
| 검증 통과 | 50% | pay.sh 콘텐츠 검증 통과 시 | 크리에이터 80% 확보 |
| 타임락 만료 | 20% | 72시간 경과 + 분쟁 없음 | 크리에이터 100% 수령 |

**분쟁 제기 시스템**:
- 브랜드/크리에이터 누구나 이의 제기 가능
- 소액(< $100): Gemini 자동 중재
- 중액/고액: 사람 검토 필요
- 분쟁 제기 시 마일스톤 자동 동결 (frozen=true)

---

### 3.3 금액별 차등 자동화 ✅

**문제**: 모든 거래를 자동화하면 위험
**해결**: 금액에 따른 3단계 정책

| 금액 | 자동화 레벨 | 설명 |
|------|------------|------|
| < $100 | FULL_AUTO | 완전 자동, 사람 개입 없음 |
| $100-500 | HUMAN_REVIEW | 검토 필요, 수동 승인 |
| >= $500 | HUMAN_SIGNATURE | 사람 서명 필수 |

```python
automation_level = _determine_automation_level(amount_usdc)
if automation_level != AutomationLevel.FULL_AUTO:
    raise HUMAN_APPROVAL_REQUIRED
```

**리스크 관리**: 소액 건만 자동화 → 안전성 확보

---

## 4. 데모 시나리오 (3분)

### Before: 기존 방식 (30일 소요)
1. 브랜드: 수백 개 DM 발송 (1주일)
2. 크리에이터: 협상 (3-5일)
3. 계약서 작성 (2일)
4. 전액 선지급 → 콘텐츠 제작 (1주일)
5. 게시 확인 → 정산 (30일+)

**문제점**: 시간 낭비 + 환불 분쟁 + 대금 지연

---

### After: KNOT (3시간 소요)

#### 0:00 - 브랜드 캠페인 생성
```
브랜드: "예산 $2,000로 뷰티 인플루언서 3명 섭외"
→ Brand Agent 생성 (자동)
```

#### 0:10 - Agent 자동 매칭
```python
# 1. Discovery (pay.sh Creator 검증)
candidates = discover_creators(category="beauty", limit=100)
verified = verify_creators(candidates)  # $0.10 × 100 = $10

# 2. Ranking (bot < 25% 필터링)
top_20 = rank_by_quality(verified)

# 3. Negotiation (자동 협상)
for creator in top_20:
    offer = build_initial_terms(budget=800)
    response = creator_agent.negotiate(offer)
    if response.accepted:
        agreements.append(create_agreement(response.terms))
```

**결과**: 10분 만에 3명 매칭 완료 (사람 개입 0회)

#### 0:30 - 에스크로 예치
```
브랜드: Phantom으로 $2,400 USDC 예치
→ 30% ($720) 즉시 릴리즈 (계약 체결)
```

#### 1주일 후 - 콘텐츠 게시
```
크리에이터: Instagram 포스트 URL 제출
→ pay.sh Content 검증 ($0.50 × 3 = $1.50)
→ 품질/브랜드 언급 확인
→ 50% ($1,200) 자동 릴리즈 (검증 통과)
```

#### 72시간 후 - 타임락 만료
```
분쟁 제기 없음 확인
→ 20% ($480) 자동 릴리즈 (타임락 만료)
→ 크리에이터 100% 수령 완료
```

**효과**:
- 시간: 30일 → 3시간 (협상) + 1주일 (제작) = 총 8일
- 비용: 중개 수수료 0% (pay.sh 검증 $11.50만 지출)
- 환불 분쟁: 0건 (3단계 마일스톤)

---

## 5. PMF 검증 계획

### 파일럿 프로그램 (2주)
- **참여자**: 크리에이터 5명 + 브랜드 2곳
- **범위**: 뷰티/패션 카테고리 한정
- **목표**:
  - 자동 협상 성공률 > 60%
  - 정산 시간 < 3일
  - 분쟁 발생률 < 10%

### 측정 지표
| 지표 | 목표 | 검증 방법 |
|------|------|----------|
| Agent 협상 성공률 | > 60% | Firestore negotiations 컬렉션 분석 |
| pay.sh 검증 정확도 | > 85% | 수동 검증 vs. pay.sh 결과 비교 |
| 정산 시간 | < 3일 | settlement createdAt - agreement createdAt |
| 사용자 만족도 | > 4.0/5.0 | 사후 설문조사 |

---

## 6. 해커톤 심사 기준 대응

### ✅ Agent Autonomy (자율성)
- **증명**: pay.sh 검증 API 실제 호출 코드
- **데모**: 사람 클릭 없이 매칭 → 협상 → 정산

### ✅ pay.sh / x402 Integration
- **사용처 1**: Creator 검증 (Nansen API, $0.10/call)
- **사용처 2**: Content 검증 (Brandwatch API, $0.50/call)
- **코드**: `backend/libs/payments/paysh.py`

### ✅ Solana / USDC 활용
- **에스크로**: Anchor 프로그램 (3단계 마일스톤)
- **결제 토큰**: USDC-SPL (devnet)
- **네트워크**: Solana devnet
- **코드**: `programs/knot-escrow/src/lib.rs`

### ✅ 실제 문제 해결
- **문제**: 크리에이터 협찬의 신뢰/환불/지연 문제
- **해결**: Agent 검증 + 조건부 에스크로
- **검증**: 파일럿 프로그램 계획

---

## 7. 기술 스택

| Layer | Stack | 구현 상태 |
|-------|-------|----------|
| Frontend | Next.js 16, React 19, Phantom | ✅ 완료 |
| Auth | Firebase Auth | ✅ 완료 |
| API | FastAPI, Firestore | ✅ 완료 |
| Agent | Brand Agent, Creator Agent, HTTP A2A | ✅ 완료 |
| AI | Gemini (profile analysis, dispute resolution) | ✅ 완료 |
| **Agent Payment** | **pay.sh / x402** | ✅ **완료 (멘토링 반영)** |
| Web3 | Solana Anchor, USDC, Web3 Gateway | ✅ 완료 |

---

## 8. 왜 On-chain인가?

### Q: 왜 블록체인이 필요한가?

**A: AI 에이전트는 법인이 아니라 은행 계좌를 만들 수 없습니다.**

- 에이전트가 유료 검증 API를 구매하려면 → **pay.sh 지갑** 필요
- 에이전트가 조건부 정산을 실행하려면 → **프로그램 제어 가능한 에스크로** 필요
- 합의 내용을 나중에 바꿀 수 없게 하려면 → **immutable agreement hash** 필요

**Solana 선택 이유**:
- ✅ 낮은 수수료 (0.00025 SOL ≈ $0.01)
- ✅ 빠른 확정 (< 1초)
- ✅ USDC 네이티브 지원 (가격 변동 없음)
- ✅ pay.sh 공식 지원 (Solana Foundation 제품)

---

## 9. 향후 계획

### Phase 1: MVP (해커톤)
- [x] Agent 협상 시스템
- [x] pay.sh 검증 통합
- [x] 3단계 에스크로
- [x] 분쟁 시스템
- [ ] 파일럿 프로그램 (2주)

### Phase 2: PMF (3개월)
- [ ] 카테고리 확장 (뷰티 → 패션, 푸드)
- [ ] 크리에이터 100명+ 온보딩
- [ ] 브랜드 10곳+ 파트너십
- [ ] 수익 모델 검증 (플랫폼 수수료 2-3%)

### Phase 3: Scale (6개월)
- [ ] MPC 지갑 (Web3Auth) - 블록체인 장벽 제거
- [ ] 글로벌 확장 (한국 → 일본, 미국)
- [ ] 결제 라이선스 검토

---

## 10. 팀 & 연락처

- **블록체인 백엔드**: 효창 (Solana Anchor, pay.sh 통합)
- **에이전트 시스템**: 예원 (A2A, AI 검증)
- **프론트엔드/UX**: 민성 (Next.js, Phantom 연동)

**GitHub**: [github.com/your-team/knot](https://github.com/your-team/knot)
**Demo**: [knot.example.com](https://knot.example.com)

---

## 요약: KNOT가 해결하는 멘토링 피드백

| 피드백 | 문제 | KNOT 해결 방법 |
|--------|------|--------------|
| Agent 신뢰성 | AI를 어떻게 믿나? | pay.sh로 외부 API 검증 (Nansen, Brandwatch) |
| 환불 문제 | 브랜드 일방적 환불 | 3단계 마일스톤 (30%/50%/20%) + 분쟁 시스템 |
| 자동화 증거 | 정말 자동인가? | 실제 코드 + 데모 플로우 |
| PMF 검증 | 진짜 쓸 사람 있나? | 파일럿 프로그램 (5 creators, 2 brands, 2주) |
| 법적 문제 | 결제 라이선스 | devnet only, "정보 중개" 포지셔닝 |
| 지갑 허들 | 블록체인 복잡 | 향후 Web3Auth MPC 지갑 (Phase 2) |

**"Agents negotiate. Creators create. Solana settles."**
