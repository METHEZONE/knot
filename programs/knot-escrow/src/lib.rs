//! knot 마일스톤 에스크로 프로그램
//!
//! 브랜드가 캠페인 총액(USDC-SPL) + 브랜드측 플랫폼 수수료를 vault에 예치하고,
//! 마일스톤 단위로 크리에이터에게 정산한다. 정산 시 **양측 수수료**(브랜드측 위에 얹기 +
//! 크리에이터측 차감)를 온체인에서 자동 스킴해 트레저리로 보낸다.
//! 브랜드 에이전트(agent_authority)는 `auto_approve_cap` 이내면 사람 개입 없이 릴리스 가능.
//! 합의된 텀시트 지문(terms_hash)을 온체인 기록, 환불은 타임락 경과 후 가능.
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("HeviXng9rwLz5sNDY6tixkYiW4kwxXRv5iFDo5xf3z4v");

pub const MAX_MILESTONES: usize = 8;
pub const BPS_DENOM: u64 = 10_000;

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
}
