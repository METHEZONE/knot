//! knot 마일스톤 에스크로 프로그램
//!
//! 브랜드가 캠페인 총액(USDC-SPL) + 브랜드측 플랫폼 수수료를 vault에 예치하고,
//! 마일스톤 단위로 크리에이터에게 정산한다. 정산 시 **양측 수수료**(브랜드측 위에 얹기 +
//! 크리에이터측 차감)를 온체인에서 자동 스킴해 트레저리로 보낸다.
//! 브랜드 에이전트(agent_authority)는 `auto_approve_cap` 이내면 사람 개입 없이 릴리스 가능.
//! 합의된 텀시트 지문(terms_hash)을 온체인 기록, 환불은 타임락 경과 후 가능.
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, TransferChecked};

declare_id!("Aj63B5hLtvJdNQiAi61rMrgfW3pt8Lak3GQB59B6jysj");

pub const MAX_MILESTONES: usize = 8;
pub const BPS_DENOM: u64 = 10_000;

/// Agreement 에스크로 중개 수수료 상한 (10%).
///
/// 수수료율은 에이전트가 계약별로 협상하지만(docs/17 D1), 브랜드 에이전트가 상한 없이
/// 올리는 것을 온체인에서 막는다. 오프체인 정책 엔진과 이 상한이 이중 방어다.
pub const MAX_AGREEMENT_FEE_BPS: u16 = 1_000;

/// 환불 타임락 하한 (1일).
///
/// 타임락을 0 으로 협상하면 크리에이터가 작업할 시간도 없이 브랜드가 환불을 트리거할 수
/// 있다. 협상 가능하되 이 하한은 온체인에서 강제한다.
pub const MIN_REFUND_TIMELOCK_SECS: i64 = 86_400;

/// amount * bps / 10000 (u128 중간연산으로 오버플로 회피)
fn apply_bps(amount: u64, bps: u16) -> Result<u64> {
    Ok(((amount as u128)
        .checked_mul(bps as u128)
        .ok_or(EscrowError::Overflow)?
        / (BPS_DENOM as u128)) as u64)
}

#[program]
pub mod knot_escrow {
    use super::*;

    /// 플랫폼 설정 1회 초기화(관리자). 양측 수수료율 + 트레저리 토큰계정 주소.
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        brand_fee_bps: u16,
        creator_fee_bps: u16,
    ) -> Result<()> {
        require!(
            brand_fee_bps <= BPS_DENOM as u16 && creator_fee_bps <= BPS_DENOM as u16,
            EscrowError::BadFee
        );
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.treasury = ctx.accounts.treasury.key();
        config.brand_fee_bps = brand_fee_bps;
        config.creator_fee_bps = creator_fee_bps;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    /// 캠페인 생성 + (딜 총액 + 브랜드측 수수료)를 vault에 예치. 수수료율·트레저리·terms_hash 스냅샷.
    pub fn initialize_campaign(
        ctx: Context<InitializeCampaign>,
        campaign_id: u64,
        milestone_amounts: Vec<u64>,
        auto_approve_cap: u64,
        terms_hash: [u8; 32],
        refund_timelock_secs: i64,
    ) -> Result<()> {
        require!(!milestone_amounts.is_empty(), EscrowError::NoMilestones);
        require!(
            milestone_amounts.len() <= MAX_MILESTONES,
            EscrowError::TooManyMilestones
        );

        let config = &ctx.accounts.config;
        let mut total = 0u64;
        let mut brand_fee_total = 0u64;
        for &amount in milestone_amounts.iter() {
            total = total.checked_add(amount).ok_or(EscrowError::Overflow)?;
            brand_fee_total = brand_fee_total
                .checked_add(apply_bps(amount, config.brand_fee_bps)?)
                .ok_or(EscrowError::Overflow)?;
        }
        let deposit = total.checked_add(brand_fee_total).ok_or(EscrowError::Overflow)?;

        let campaign = &mut ctx.accounts.campaign;
        campaign.brand = ctx.accounts.brand.key();
        campaign.creator = ctx.accounts.creator.key();
        campaign.agent_authority = ctx.accounts.agent_authority.key();
        campaign.mint = ctx.accounts.mint.key();
        campaign.vault = ctx.accounts.vault.key();
        campaign.treasury = config.treasury;
        campaign.campaign_id = campaign_id;
        campaign.total_amount = total;
        campaign.released_amount = 0;
        campaign.auto_approve_cap = auto_approve_cap;
        campaign.brand_fee_bps = config.brand_fee_bps;
        campaign.creator_fee_bps = config.creator_fee_bps;
        campaign.terms_hash = terms_hash;
        campaign.status = CampaignStatus::Active;
        campaign.bump = ctx.bumps.campaign;
        campaign.vault_auth_bump = ctx.bumps.vault_authority;
        campaign.refund_available_at = Clock::get()?
            .unix_timestamp
            .checked_add(refund_timelock_secs)
            .ok_or(EscrowError::Overflow)?;
        campaign.milestones = milestone_amounts
            .iter()
            .map(|&amount| Milestone {
                amount,
                status: MilestoneStatus::Pending,
            })
            .collect();

        // 브랜드(에이전트) 토큰계정 → vault : 딜 총액 + 브랜드측 수수료
        let cpi = CpiContext::new(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.funder_token.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.funder.to_account_info(),
            },
        );
        token::transfer(cpi, deposit)?;

        emit!(CampaignInitialized {
            campaign: campaign.key(),
            brand: campaign.brand,
            creator: campaign.creator,
            total_amount: total,
            deposit,
        });
        Ok(())
    }

    /// 크리에이터가 마일스톤 완료 제출.
    pub fn submit_milestone(ctx: Context<UpdateCampaign>, index: u8) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        require!(
            ctx.accounts.signer.key() == campaign.creator,
            EscrowError::Unauthorized
        );
        let m = campaign
            .milestones
            .get_mut(index as usize)
            .ok_or(EscrowError::BadIndex)?;
        require!(m.status == MilestoneStatus::Pending, EscrowError::BadState);
        m.status = MilestoneStatus::Submitted;
        Ok(())
    }

    /// 마일스톤 승인 + 정산. 크리에이터에게 (금액 − 크리에이터측 수수료), 트레저리에 (양측 수수료 합).
    pub fn approve_and_release(ctx: Context<ApproveAndRelease>, index: u8) -> Result<()> {
        let signer = ctx.accounts.signer.key();
        let campaign_key = ctx.accounts.campaign.key();
        let vault_auth_bump = ctx.accounts.campaign.vault_auth_bump;

        let (milestone_amount, creator_fee, platform_cut) = {
            let campaign = &ctx.accounts.campaign;
            let m = campaign
                .milestones
                .get(index as usize)
                .ok_or(EscrowError::BadIndex)?;
            require!(m.status == MilestoneStatus::Submitted, EscrowError::BadState);

            let is_brand = signer == campaign.brand;
            let is_agent = signer == campaign.agent_authority;
            require!(is_brand || is_agent, EscrowError::Unauthorized);
            if is_agent && !is_brand {
                require!(
                    m.amount <= campaign.auto_approve_cap,
                    EscrowError::ExceedsCap
                );
            }
            let creator_fee = apply_bps(m.amount, campaign.creator_fee_bps)?;
            let brand_fee = apply_bps(m.amount, campaign.brand_fee_bps)?;
            let platform_cut = creator_fee.checked_add(brand_fee).ok_or(EscrowError::Overflow)?;
            (m.amount, creator_fee, platform_cut)
        };
        let creator_net = milestone_amount
            .checked_sub(creator_fee)
            .ok_or(EscrowError::Overflow)?;

        let seeds: &[&[u8]] = &[b"vault-auth", campaign_key.as_ref(), &[vault_auth_bump]];
        let signer_seeds = &[seeds];

        // vault → 크리에이터 (net)
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.creator_token.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
                signer_seeds,
            ),
            creator_net,
        )?;
        // vault → 트레저리 (브랜드측 + 크리에이터측 수수료)
        if platform_cut > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.key(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.treasury_token.to_account_info(),
                        authority: ctx.accounts.vault_authority.to_account_info(),
                    },
                    signer_seeds,
                ),
                platform_cut,
            )?;
        }

        // 상태 갱신
        let campaign = &mut ctx.accounts.campaign;
        campaign.milestones[index as usize].status = MilestoneStatus::Released;
        campaign.released_amount = campaign
            .released_amount
            .checked_add(milestone_amount)
            .ok_or(EscrowError::Overflow)?;
        let completed = campaign.released_amount >= campaign.total_amount;
        if completed {
            campaign.status = CampaignStatus::Completed;
        }

        // 크리에이터 평판 갱신 (실수령액 기준)
        let rep = &mut ctx.accounts.creator_reputation;
        rep.wallet = campaign.creator;
        rep.total_settled = rep
            .total_settled
            .checked_add(creator_net)
            .ok_or(EscrowError::Overflow)?;
        if rep.bump == 0 {
            rep.bump = ctx.bumps.creator_reputation;
        }
        if completed {
            rep.campaigns_completed = rep.campaigns_completed.saturating_add(1);
        }

        emit!(MilestoneReleased {
            campaign: campaign_key,
            index,
            creator_net,
            platform_cut,
            by_agent: signer != campaign.brand,
        });
        Ok(())
    }

    /// 타임락 경과 후 vault 잔액을 브랜드에 환불(분쟁/미완료 경로).
    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let campaign_key = ctx.accounts.campaign.key();
        let vault_auth_bump = ctx.accounts.campaign.vault_auth_bump;
        require!(
            Clock::get()?.unix_timestamp >= ctx.accounts.campaign.refund_available_at,
            EscrowError::TimelockActive
        );
        let remaining = ctx.accounts.vault.amount;
        require!(remaining > 0, EscrowError::NothingToRefund);

        let seeds: &[&[u8]] = &[b"vault-auth", campaign_key.as_ref(), &[vault_auth_bump]];
        let signer_seeds = &[seeds];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.brand_token.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
                signer_seeds,
            ),
            remaining,
        )?;
        ctx.accounts.campaign.status = CampaignStatus::Cancelled;
        Ok(())
    }

    /// Agreement별 escrow PDA를 만들고 Brand/Creator/Settlement authority 및 마일스톤 금액을 고정한다.
    /// 이 instruction은 자금을 이동하지 않는다.
    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        agreement_hash: [u8; 32],
        milestone_amounts: Vec<u64>,
        total_amount: u64,
        terms_hash: [u8; 32],
        fee_bps: u16,
        refund_timelock_secs: i64,
    ) -> Result<()> {
        require!(!milestone_amounts.is_empty(), EscrowError::NoMilestones);
        require!(
            milestone_amounts.len() <= MAX_MILESTONES,
            EscrowError::TooManyMilestones
        );
        let sum = milestone_amounts.iter().try_fold(0u64, |acc, amount| {
            acc.checked_add(*amount).ok_or(EscrowError::Overflow)
        })?;
        require!(sum == total_amount, EscrowError::AmountMismatch);
        // 협상된 값이지만 온체인 상한·하한을 넘을 수 없다 (docs/17 D1).
        require!(fee_bps <= MAX_AGREEMENT_FEE_BPS, EscrowError::BadFee);
        require!(
            refund_timelock_secs >= MIN_REFUND_TIMELOCK_SECS,
            EscrowError::TimelockActive
        );
        // 수수료는 마일스톤별로 계산해 합산한다. 총액에 한 번 적용하면 릴리즈 시점의
        // 마일스톤별 합과 반올림 때문에 어긋나 vault 에 먼지가 남거나 부족해진다.
        let mut fee_total: u64 = 0;
        for amount in milestone_amounts.iter() {
            let fee = apply_bps(*amount, fee_bps)?;
            fee_total = fee_total.checked_add(fee).ok_or(EscrowError::Overflow)?;
        }

        let escrow = &mut ctx.accounts.escrow;
        escrow.agreement_hash = agreement_hash;
        escrow.brand_authority = ctx.accounts.brand_authority.key();
        escrow.creator_destination = ctx.accounts.creator_destination.key();
        escrow.settlement_authority = ctx.accounts.settlement_authority.key();
        escrow.usdc_mint = ctx.accounts.mint.key();
        escrow.vault_token_account = ctx.accounts.vault.key();
        escrow.platform_treasury = ctx.accounts.platform_treasury.key();
        escrow.total_amount = total_amount;
        escrow.funded_amount = 0;
        escrow.released_amount = 0;
        escrow.refunded_amount = 0;
        escrow.fee_total_amount = fee_total;
        escrow.fee_paid_amount = 0;
        escrow.fee_bps = fee_bps;
        escrow.refund_approved = false;
        escrow.refund_available_at = Clock::get()?
            .unix_timestamp
            .checked_add(refund_timelock_secs)
            .ok_or(EscrowError::Overflow)?;
        escrow.terms_hash = terms_hash;
        escrow.status = AgreementEscrowStatus::Created;
        escrow.bump = ctx.bumps.escrow;
        escrow.milestones = milestone_amounts
            .iter()
            .map(|amount| AgreementEscrowMilestone {
                amount: *amount,
                status: AgreementMilestoneStatus::Pending,
            })
            .collect();

        emit!(AgreementEscrowInitialized {
            escrow: escrow.key(),
            brand_authority: escrow.brand_authority,
            creator_destination: escrow.creator_destination,
            total_amount,
        });
        Ok(())
    }

    /// Brand Phantom signer의 USDC ATA에서 Agreement vault ATA로 전체 보상금을 예치한다.
    pub fn fund_escrow(ctx: Context<FundEscrow>, amount: u64) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(
            ctx.accounts.brand_authority.key() == escrow.brand_authority,
            EscrowError::Unauthorized
        );
        require!(
            ctx.accounts.brand_token.owner == ctx.accounts.brand_authority.key(),
            EscrowError::Unauthorized
        );
        require!(ctx.accounts.brand_token.mint == escrow.usdc_mint, EscrowError::MintMismatch);
        require!(ctx.accounts.vault.mint == escrow.usdc_mint, EscrowError::MintMismatch);
        require!(ctx.accounts.vault.owner == escrow.key(), EscrowError::BadVault);
        // N2: 수수료는 브랜드 부담이다. 크리에이터는 협상액을 그대로 받으므로 브랜드가
        // 협상액 + 수수료를 예치한다.
        let required = escrow
            .total_amount
            .checked_add(escrow.fee_total_amount)
            .ok_or(EscrowError::Overflow)?;
        require!(amount == required, EscrowError::AmountMismatch);
        require!(escrow.funded_amount == 0, EscrowError::BadState);
        require!(
            escrow.status == AgreementEscrowStatus::Created,
            EscrowError::BadState
        );

        token::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.brand_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.brand_authority.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;

        escrow.funded_amount = amount;
        escrow.status = AgreementEscrowStatus::Funded;

        emit!(AgreementEscrowFunded {
            escrow: escrow.key(),
            brand_authority: escrow.brand_authority,
            amount,
        });
        Ok(())
    }

    /// 검증 정책을 통과한 마일스톤만 Settlement authority가 release 가능하도록 표시한다.
    pub fn verify_milestone(ctx: Context<UpdateAgreementEscrowMilestone>, index: u8) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(
            ctx.accounts.settlement_authority.key() == escrow.settlement_authority,
            EscrowError::Unauthorized
        );
        let milestone = escrow
            .milestones
            .get_mut(index as usize)
            .ok_or(EscrowError::BadIndex)?;
        require!(
            milestone.status == AgreementMilestoneStatus::Pending
                || milestone.status == AgreementMilestoneStatus::Submitted,
            EscrowError::BadState
        );
        milestone.status = AgreementMilestoneStatus::Verified;
        Ok(())
    }

    /// 검증 완료 마일스톤 금액만 Creator Phantom 수령 ATA로 정산한다.
    pub fn release_milestone(ctx: Context<ReleaseAgreementMilestone>, index: u8) -> Result<()> {
        let escrow_key = ctx.accounts.escrow.key();
        let escrow_info = ctx.accounts.escrow.to_account_info();
        let escrow = &mut ctx.accounts.escrow;
        require!(
            ctx.accounts.settlement_authority.key() == escrow.settlement_authority,
            EscrowError::Unauthorized
        );
        require!(
            escrow.status == AgreementEscrowStatus::Funded
                || escrow.status == AgreementEscrowStatus::PartiallyReleased,
            EscrowError::BadState
        );
        require!(ctx.accounts.vault.mint == escrow.usdc_mint, EscrowError::MintMismatch);
        require!(ctx.accounts.vault.owner == escrow_key, EscrowError::BadVault);
        require!(
            ctx.accounts.creator_token.owner == escrow.creator_destination,
            EscrowError::Unauthorized
        );
        require!(
            ctx.accounts.creator_destination.key() == escrow.creator_destination,
            EscrowError::Unauthorized
        );
        require!(
            ctx.accounts.creator_token.mint == escrow.usdc_mint,
            EscrowError::MintMismatch
        );

        // 트레저리 토큰계정이 저장된 수취 주소의 것인지 확인한다. 수취인 고정이 깨지면
        // 커스터디 해당성 논거도 함께 무너진다 (docs/17 P9.1).
        require!(
            ctx.accounts.platform_treasury.key() == escrow.platform_treasury,
            EscrowError::BadTreasury
        );
        require!(
            ctx.accounts.treasury_token.owner == escrow.platform_treasury,
            EscrowError::BadTreasury
        );
        require!(
            ctx.accounts.treasury_token.mint == escrow.usdc_mint,
            EscrowError::MintMismatch
        );

        let amount = {
            let milestone = escrow
                .milestones
                .get(index as usize)
                .ok_or(EscrowError::BadIndex)?;
            require!(
                milestone.status == AgreementMilestoneStatus::Verified,
                EscrowError::BadState
            );
            milestone.amount
        };
        // N2: 수수료는 브랜드가 예치에 얹어 냈으므로 크리에이터는 협상액을 그대로 받는다.
        // 수수료를 크리에이터 몫에서 빼면 "합의한 금액보다 덜 받았다" 가 되어 협상 신뢰가
        // 깨진다.
        let fee = apply_bps(amount, escrow.fee_bps)?;
        let agreement_hash = escrow.agreement_hash;
        let escrow_bump = escrow.bump;
        let creator_destination = escrow.creator_destination;

        let seeds: &[&[u8]] = &[b"escrow", agreement_hash.as_ref(), &[escrow_bump]];
        let signer_seeds = &[seeds];
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.creator_token.to_account_info(),
                    authority: escrow_info.clone(),
                },
                signer_seeds,
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;
        // 수수료는 릴리즈 시점에만 나간다. 그래서 환불되는 금액에는 수수료가 붙지 않고,
        // 별도 환불 로직이 필요 없다 (docs/17 §0.5).
        if fee > 0 {
            token::transfer_checked(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.key(),
                    TransferChecked {
                        from: ctx.accounts.vault.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        to: ctx.accounts.treasury_token.to_account_info(),
                        authority: escrow_info,
                    },
                    signer_seeds,
                ),
                fee,
                ctx.accounts.mint.decimals,
            )?;
        }

        escrow.milestones[index as usize].status = AgreementMilestoneStatus::Released;
        escrow.released_amount = escrow
            .released_amount
            .checked_add(amount)
            .ok_or(EscrowError::Overflow)?;
        escrow.fee_paid_amount = escrow
            .fee_paid_amount
            .checked_add(fee)
            .ok_or(EscrowError::Overflow)?;
        // 완료 판정은 vault 에서 나간 총액(크리에이터 몫 + 수수료)으로 한다.
        let spent = escrow
            .released_amount
            .checked_add(escrow.fee_paid_amount)
            .ok_or(EscrowError::Overflow)?;
        escrow.status = if spent >= escrow.funded_amount {
            AgreementEscrowStatus::Released
        } else {
            AgreementEscrowStatus::PartiallyReleased
        };

        emit!(AgreementEscrowMilestoneReleased {
            escrow: escrow_key,
            index,
            creator_destination,
            amount,
        });
        Ok(())
    }

    /// 브랜드가 환불을 명시 승인한다 — 타임락을 기다리지 않는 빠른 경로 (docs/17 P0).
    ///
    /// 플랫폼이 단독으로 환불하지 못하게 하는 장치다. 실제 환불은 settlement_authority 가
    /// 실행하지만, 타임락 이전에는 이 플래그 없이는 실행할 수 없다.
    pub fn approve_refund(ctx: Context<ApproveAgreementRefund>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(
            ctx.accounts.brand_authority.key() == escrow.brand_authority,
            EscrowError::Unauthorized
        );
        require!(
            escrow.status == AgreementEscrowStatus::Funded
                || escrow.status == AgreementEscrowStatus::PartiallyReleased,
            EscrowError::BadState
        );
        escrow.refund_approved = true;
        Ok(())
    }

    /// 미지급 잔액을 브랜드 지갑으로 환불한다 (docs/17 D2).
    ///
    /// 서명자는 settlement_authority 다. 브랜드 키로 서명하게 두면, 브랜드 지갑이 플랫폼
    /// 커스터디일 때 플랫폼이 환불권을 쥐고 SELF 일 때는 "사람 승인 0회" 전제가 깨진다
    /// (docs/17 P0). 대신 온체인 선행조건 둘 중 하나를 반드시 만족해야 한다:
    ///
    ///   1. 브랜드가 approve_refund 로 명시 승인했다 (빠른 경로)
    ///   2. refund_available_at 타임락이 지났다 (백스톱)
    ///
    /// 타임락 백스톱이 있어서 자금이 영구히 묶이는 상태가 구조적으로 없다.
    pub fn refund_remaining(ctx: Context<RefundAgreementEscrowRemaining>) -> Result<()> {
        let escrow_key = ctx.accounts.escrow.key();
        let escrow_info = ctx.accounts.escrow.to_account_info();
        let escrow = &mut ctx.accounts.escrow;
        require!(
            ctx.accounts.settlement_authority.key() == escrow.settlement_authority,
            EscrowError::Unauthorized
        );
        require!(
            escrow.refund_approved
                || Clock::get()?.unix_timestamp >= escrow.refund_available_at,
            EscrowError::TimelockActive
        );
        require!(ctx.accounts.vault.mint == escrow.usdc_mint, EscrowError::MintMismatch);
        require!(ctx.accounts.vault.owner == escrow_key, EscrowError::BadVault);
        // 수취인은 계정에 고정된 브랜드 주소다. 임의 주소로 보낼 수 없다 (docs/17 P9.1).
        require!(
            ctx.accounts.brand_token.owner == escrow.brand_authority,
            EscrowError::Unauthorized
        );
        require!(ctx.accounts.brand_token.mint == escrow.usdc_mint, EscrowError::MintMismatch);
        // 이미 나간 수수료도 빼야 한다. 안 그러면 vault 잔액보다 많이 환불하려 해서 실패한다.
        let remaining = escrow.remaining_amount()?;
        require!(remaining > 0, EscrowError::NothingToRefund);

        let agreement_hash = escrow.agreement_hash;
        let escrow_bump = escrow.bump;
        let seeds: &[&[u8]] = &[b"escrow", agreement_hash.as_ref(), &[escrow_bump]];
        let signer_seeds = &[seeds];
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.brand_token.to_account_info(),
                    authority: escrow_info,
                },
                signer_seeds,
            ),
            remaining,
            ctx.accounts.mint.decimals,
        )?;
        escrow.refunded_amount = escrow
            .refunded_amount
            .checked_add(remaining)
            .ok_or(EscrowError::Overflow)?;
        escrow.status = AgreementEscrowStatus::Refunded;
        Ok(())
    }
}

// ===================== Accounts =====================

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    /// CHECK: 플랫폼 수수료 수취 토큰계정(USDC). 주소만 기록.
    pub treasury: UncheckedAccount<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + Config::MAX_SIZE,
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, Config>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(campaign_id: u64)]
pub struct InitializeCampaign<'info> {
    /// CHECK: 브랜드(당사자) 지갑 주소만 저장 + campaign PDA seed
    pub brand: UncheckedAccount<'info>,

    /// CHECK: 크리에이터 지갑 주소만 저장(수취인)
    pub creator: UncheckedAccount<'info>,

    /// CHECK: 브랜드 에이전트 키(자율 릴리스 서명자)
    pub agent_authority: UncheckedAccount<'info>,

    /// 락을 서명·펀딩하는 주체 = brand(사람) 또는 agent_authority(에이전트). rent payer.
    /// top-up 모델에선 에이전트가 자기 예산으로 자동 락. cap 초과 딜은 상위(백엔드/UX)에서 brand 서명 유도.
    #[account(
        mut,
        constraint = funder.key() == brand.key() || funder.key() == agent_authority.key() @ EscrowError::Unauthorized,
    )]
    pub funder: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = funder_token.mint == mint.key() @ EscrowError::MintMismatch,
        constraint = funder_token.owner == funder.key() @ EscrowError::Unauthorized,
    )]
    pub funder_token: Account<'info, TokenAccount>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = funder,
        space = 8 + Campaign::MAX_SIZE,
        seeds = [b"campaign", brand.key().as_ref(), &campaign_id.to_le_bytes()],
        bump,
    )]
    pub campaign: Account<'info, Campaign>,

    /// CHECK: vault 토큰계정의 권한 PDA
    #[account(seeds = [b"vault-auth", campaign.key().as_ref()], bump)]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = funder,
        seeds = [b"vault", campaign.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = vault_authority,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct UpdateCampaign<'info> {
    pub signer: Signer<'info>,
    #[account(mut)]
    pub campaign: Account<'info, Campaign>,
}

#[derive(Accounts)]
pub struct ApproveAndRelease<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut, has_one = vault @ EscrowError::BadVault)]
    pub campaign: Account<'info, Campaign>,

    /// CHECK: vault 권한 PDA (seeds로 검증)
    #[account(seeds = [b"vault-auth", campaign.key().as_ref()], bump = campaign.vault_auth_bump)]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = creator_token.mint == campaign.mint @ EscrowError::MintMismatch,
        constraint = creator_token.owner == campaign.creator @ EscrowError::Unauthorized,
    )]
    pub creator_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = treasury_token.key() == campaign.treasury @ EscrowError::BadTreasury,
        constraint = treasury_token.mint == campaign.mint @ EscrowError::MintMismatch,
    )]
    pub treasury_token: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + Reputation::MAX_SIZE,
        seeds = [b"rep", campaign.creator.as_ref()],
        bump,
    )]
    pub creator_reputation: Account<'info, Reputation>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(mut)]
    pub brand: Signer<'info>,

    #[account(mut, has_one = brand @ EscrowError::Unauthorized, has_one = vault @ EscrowError::BadVault)]
    pub campaign: Account<'info, Campaign>,

    /// CHECK: vault 권한 PDA (seeds로 검증)
    #[account(seeds = [b"vault-auth", campaign.key().as_ref()], bump = campaign.vault_auth_bump)]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = brand_token.mint == campaign.mint @ EscrowError::MintMismatch,
        constraint = brand_token.owner == brand.key() @ EscrowError::Unauthorized,
    )]
    pub brand_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(agreement_hash: [u8; 32])]
pub struct InitializeEscrow<'info> {
    #[account(mut)]
    pub brand_authority: Signer<'info>,

    /// CHECK: Creator destination wallet address is stored and later constrained by token owner.
    pub creator_destination: UncheckedAccount<'info>,

    /// CHECK: Backend/settlement signer authorized by the Agreement verification policy.
    pub settlement_authority: UncheckedAccount<'info>,

    /// CHECK: 중개 수수료 수취 주소. 지출하지 않는 수취 전용 지갑이다 (docs/17 D4).
    pub platform_treasury: UncheckedAccount<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = brand_authority,
        space = 8 + AgreementEscrow::MAX_SIZE,
        seeds = [b"escrow", agreement_hash.as_ref()],
        bump,
    )]
    pub escrow: Account<'info, AgreementEscrow>,

    #[account(
        init_if_needed,
        payer = brand_authority,
        associated_token::mint = mint,
        associated_token::authority = escrow,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundEscrow<'info> {
    #[account(mut)]
    pub brand_authority: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = brand_token.owner == brand_authority.key() @ EscrowError::Unauthorized,
        constraint = brand_token.mint == mint.key() @ EscrowError::MintMismatch,
    )]
    pub brand_token: Account<'info, TokenAccount>,

    #[account(mut)]
    pub escrow: Account<'info, AgreementEscrow>,

    #[account(
        mut,
        constraint = vault.key() == escrow.vault_token_account @ EscrowError::BadVault,
        constraint = vault.owner == escrow.key() @ EscrowError::BadVault,
        constraint = vault.mint == mint.key() @ EscrowError::MintMismatch,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateAgreementEscrowMilestone<'info> {
    pub settlement_authority: Signer<'info>,
    #[account(mut)]
    pub escrow: Account<'info, AgreementEscrow>,
}

#[derive(Accounts)]
pub struct ReleaseAgreementMilestone<'info> {
    #[account(mut)]
    pub settlement_authority: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub escrow: Account<'info, AgreementEscrow>,

    #[account(
        mut,
        constraint = vault.key() == escrow.vault_token_account @ EscrowError::BadVault,
        constraint = vault.owner == escrow.key() @ EscrowError::BadVault,
        constraint = vault.mint == mint.key() @ EscrowError::MintMismatch,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: Stored creator wallet authority.
    pub creator_destination: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = settlement_authority,
        associated_token::mint = mint,
        associated_token::authority = creator_destination,
    )]
    pub creator_token: Account<'info, TokenAccount>,

    /// CHECK: 저장된 트레저리 주소와 대조한다.
    pub platform_treasury: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = settlement_authority,
        associated_token::mint = mint,
        associated_token::authority = platform_treasury,
    )]
    pub treasury_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// 브랜드가 환불을 명시 승인한다. 자금을 이동시키지 않는다.
#[derive(Accounts)]
pub struct ApproveAgreementRefund<'info> {
    pub brand_authority: Signer<'info>,

    #[account(mut)]
    pub escrow: Account<'info, AgreementEscrow>,
}

#[derive(Accounts)]
pub struct RefundAgreementEscrowRemaining<'info> {
    /// 환불 실행자. 브랜드 키가 아니다 (docs/17 P0) — 온체인 선행조건이 임의성을 막는다.
    #[account(mut)]
    pub settlement_authority: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub escrow: Account<'info, AgreementEscrow>,

    #[account(
        mut,
        constraint = vault.key() == escrow.vault_token_account @ EscrowError::BadVault,
        constraint = vault.owner == escrow.key() @ EscrowError::BadVault,
        constraint = vault.mint == mint.key() @ EscrowError::MintMismatch,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = brand_token.owner == escrow.brand_authority @ EscrowError::Unauthorized,
        constraint = brand_token.mint == mint.key() @ EscrowError::MintMismatch,
    )]
    pub brand_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// ===================== State =====================

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub treasury: Pubkey, // 플랫폼 수수료 수취 토큰계정
    pub brand_fee_bps: u16,
    pub creator_fee_bps: u16,
    pub bump: u8,
}
impl Config {
    pub const MAX_SIZE: usize = 32 + 32 + 2 + 2 + 1;
}

#[account]
pub struct Campaign {
    pub brand: Pubkey,
    pub creator: Pubkey,
    pub agent_authority: Pubkey,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub treasury: Pubkey,
    pub campaign_id: u64,
    pub total_amount: u64,
    pub released_amount: u64,
    pub auto_approve_cap: u64,
    pub brand_fee_bps: u16,
    pub creator_fee_bps: u16,
    pub terms_hash: [u8; 32],
    pub refund_available_at: i64,
    pub status: CampaignStatus,
    pub bump: u8,
    pub vault_auth_bump: u8,
    pub milestones: Vec<Milestone>,
}
impl Campaign {
    // 6*Pubkey(192) + 4*u64(32) + 2*u16(4) + [u8;32](32) + i64(8) + status(1)+bump(1)+vault_auth_bump(1) + Vec(4 + MAX*Milestone)
    pub const MAX_SIZE: usize =
        32 * 6 + 8 * 4 + 2 * 2 + 32 + 8 + 1 + 1 + 1 + 4 + MAX_MILESTONES * Milestone::SIZE;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub struct Milestone {
    pub amount: u64,
    pub status: MilestoneStatus,
}
impl Milestone {
    pub const SIZE: usize = 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MilestoneStatus {
    Pending,
    Submitted,
    Approved,
    Released,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum CampaignStatus {
    Active,
    Completed,
    Cancelled,
}

#[account]
pub struct Reputation {
    pub wallet: Pubkey,
    pub campaigns_completed: u64,
    pub total_settled: u64,
    pub rating: u16,
    pub bump: u8,
}
impl Reputation {
    pub const MAX_SIZE: usize = 32 + 8 + 8 + 2 + 1;
}

#[account]
pub struct AgreementEscrow {
    pub agreement_hash: [u8; 32],
    pub brand_authority: Pubkey,
    pub creator_destination: Pubkey,
    pub settlement_authority: Pubkey,
    pub usdc_mint: Pubkey,
    pub vault_token_account: Pubkey,
    /// 중개 수수료 수취 주소. 지출하지 않는 수취 전용 지갑이다 (docs/17 D4).
    pub platform_treasury: Pubkey,
    /// 크리에이터가 받을 금액의 합. 수수료는 포함하지 않는다.
    pub total_amount: u64,
    pub funded_amount: u64,
    /// 크리에이터에게 나간 누적액.
    pub released_amount: u64,
    pub refunded_amount: u64,
    /// 트레저리로 나갈 수수료 총액 (init 에서 마일스톤별로 계산해 합산).
    pub fee_total_amount: u64,
    /// 트레저리로 나간 누적 수수료.
    pub fee_paid_amount: u64,
    /// 이 시점 이후에는 브랜드 승인 없이도 환불을 트리거할 수 있다 (docs/17 D1·P0).
    pub refund_available_at: i64,
    /// 협상된 중개 수수료율. MAX_AGREEMENT_FEE_BPS 이내 (docs/17 D5).
    pub fee_bps: u16,
    /// 브랜드가 켜는 빠른 환불 경로 (docs/17 P0).
    pub refund_approved: bool,
    pub terms_hash: [u8; 32],
    pub status: AgreementEscrowStatus,
    pub bump: u8,
    pub milestones: Vec<AgreementEscrowMilestone>,
}

impl AgreementEscrow {
    // pubkey 6 + u64 6 + i64 1 + u16 1 + bool 1 + hash 2 + status/bump 2 + vec len 4
    pub const MAX_SIZE: usize = 32
        + 32 * 6
        + 8 * 6
        + 8
        + 2
        + 1
        + 32
        + 1
        + 1
        + 4
        + MAX_MILESTONES * AgreementEscrowMilestone::SIZE;

    /// vault 에 남아 있어야 하는 잔액. 크리에이터 몫 + 아직 안 낸 수수료.
    pub fn remaining_amount(&self) -> Result<u64> {
        let after_release = self
            .funded_amount
            .checked_sub(self.released_amount)
            .ok_or(EscrowError::Overflow)?;
        let after_fee = after_release
            .checked_sub(self.fee_paid_amount)
            .ok_or(EscrowError::Overflow)?;
        let remaining = after_fee
            .checked_sub(self.refunded_amount)
            .ok_or(EscrowError::Overflow)?;
        Ok(remaining)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub struct AgreementEscrowMilestone {
    pub amount: u64,
    pub status: AgreementMilestoneStatus,
}

impl AgreementEscrowMilestone {
    pub const SIZE: usize = 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum AgreementMilestoneStatus {
    Pending,
    Submitted,
    Verified,
    Released,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum AgreementEscrowStatus {
    Created,
    Funded,
    PartiallyReleased,
    Released,
    Refunded,
    Cancelled,
}

// ===================== Events =====================

#[event]
pub struct CampaignInitialized {
    pub campaign: Pubkey,
    pub brand: Pubkey,
    pub creator: Pubkey,
    pub total_amount: u64,
    pub deposit: u64,
}

#[event]
pub struct MilestoneReleased {
    pub campaign: Pubkey,
    pub index: u8,
    pub creator_net: u64,
    pub platform_cut: u64,
    pub by_agent: bool,
}

#[event]
pub struct AgreementEscrowInitialized {
    pub escrow: Pubkey,
    pub brand_authority: Pubkey,
    pub creator_destination: Pubkey,
    pub total_amount: u64,
}

#[event]
pub struct AgreementEscrowFunded {
    pub escrow: Pubkey,
    pub brand_authority: Pubkey,
    pub amount: u64,
}

#[event]
pub struct AgreementEscrowMilestoneReleased {
    pub escrow: Pubkey,
    pub index: u8,
    pub creator_destination: Pubkey,
    pub amount: u64,
}

// ===================== Errors =====================

#[error_code]
pub enum EscrowError {
    #[msg("마일스톤이 하나도 없음")]
    NoMilestones,
    #[msg("마일스톤 개수 초과")]
    TooManyMilestones,
    #[msg("산술 오버플로")]
    Overflow,
    #[msg("권한 없음")]
    Unauthorized,
    #[msg("잘못된 마일스톤 인덱스")]
    BadIndex,
    #[msg("현재 상태에서 불가능한 전이")]
    BadState,
    #[msg("에이전트 자율 릴리스 한도 초과")]
    ExceedsCap,
    #[msg("mint 불일치")]
    MintMismatch,
    #[msg("vault 불일치")]
    BadVault,
    #[msg("트레저리 불일치")]
    BadTreasury,
    #[msg("수수료율이 범위를 벗어남")]
    BadFee,
    #[msg("환불 타임락이 아직 지나지 않음")]
    TimelockActive,
    #[msg("환불할 잔액 없음")]
    NothingToRefund,
    #[msg("금액 불일치")]
    AmountMismatch,
}
