//! knot 마일스톤 에스크로 프로그램
//!
//! 브랜드가 캠페인 총액(USDC-SPL)을 vault에 예치하고, 마일스톤 단위로
//! 크리에이터에게 정산한다. 브랜드 에이전트(agent_authority)는 `auto_approve_cap`
//! 이내 금액이면 사람 개입 없이 릴리스할 수 있다(자율 결제). 초과 시 브랜드 본인 서명 필요.
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("Hv74c9a4rKMHpsy7hgCj7a11tDRaAZG49Ss7bLscs5hu");

pub const MAX_MILESTONES: usize = 8;

#[program]
pub mod knot_escrow {
    use super::*;

    /// 캠페인 생성 + 총액을 vault에 예치. 마일스톤 스케줄과 에이전트 자율 한도를 온체인 기록.
    pub fn initialize_campaign(
        ctx: Context<InitializeCampaign>,
        campaign_id: u64,
        milestone_amounts: Vec<u64>,
        auto_approve_cap: u64,
    ) -> Result<()> {
        require!(!milestone_amounts.is_empty(), EscrowError::NoMilestones);
        require!(
            milestone_amounts.len() <= MAX_MILESTONES,
            EscrowError::TooManyMilestones
        );

        let total = milestone_amounts
            .iter()
            .try_fold(0u64, |acc, &a| acc.checked_add(a))
            .ok_or(EscrowError::Overflow)?;

        let campaign = &mut ctx.accounts.campaign;
        campaign.brand = ctx.accounts.brand.key();
        campaign.creator = ctx.accounts.creator.key();
        campaign.agent_authority = ctx.accounts.agent_authority.key();
        campaign.mint = ctx.accounts.mint.key();
        campaign.vault = ctx.accounts.vault.key();
        campaign.campaign_id = campaign_id;
        campaign.total_amount = total;
        campaign.released_amount = 0;
        campaign.auto_approve_cap = auto_approve_cap;
        campaign.status = CampaignStatus::Active;
        campaign.bump = ctx.bumps.campaign;
        campaign.vault_auth_bump = ctx.bumps.vault_authority;
        campaign.milestones = milestone_amounts
            .iter()
            .map(|&amount| Milestone {
                amount,
                status: MilestoneStatus::Pending,
            })
            .collect();

        // 브랜드 토큰계정 → vault 로 총액 예치
        let cpi = CpiContext::new(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.brand_token.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.brand.to_account_info(),
            },
        );
        token::transfer(cpi, total)?;

        emit!(CampaignInitialized {
            campaign: campaign.key(),
            brand: campaign.brand,
            creator: campaign.creator,
            total_amount: total,
        });
        Ok(())
    }

    /// 크리에이터가 마일스톤 완료를 제출(증빙은 오프체인 URL, 해시만 온체인 옵션).
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

    /// 마일스톤 승인 + 정산. 브랜드 또는 (cap 이내면) 브랜드 에이전트가 서명.
    pub fn approve_and_release(ctx: Context<ApproveAndRelease>, index: u8) -> Result<()> {
        let signer = ctx.accounts.signer.key();
        let campaign_key = ctx.accounts.campaign.key();
        let vault_auth_bump = ctx.accounts.campaign.vault_auth_bump;

        // 권한/상태 검증 + 금액 확보 (불변 참조 스코프)
        let amount = {
            let campaign = &ctx.accounts.campaign;
            let m = campaign
                .milestones
                .get(index as usize)
                .ok_or(EscrowError::BadIndex)?;
            require!(m.status == MilestoneStatus::Submitted, EscrowError::BadState);

            let is_brand = signer == campaign.brand;
            let is_agent = signer == campaign.agent_authority;
            require!(is_brand || is_agent, EscrowError::Unauthorized);
            // 에이전트 자율 릴리스는 한도 이내에서만
            if is_agent && !is_brand {
                require!(
                    m.amount <= campaign.auto_approve_cap,
                    EscrowError::ExceedsCap
                );
            }
            m.amount
        };

        // vault → 크리에이터 전송 (vault_authority PDA 서명)
        let seeds: &[&[u8]] = &[b"vault-auth", campaign_key.as_ref(), &[vault_auth_bump]];
        let signer_seeds = &[seeds];
        let cpi = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.creator_token.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(cpi, amount)?;

        // 상태 갱신
        let campaign = &mut ctx.accounts.campaign;
        campaign.milestones[index as usize].status = MilestoneStatus::Released;
        campaign.released_amount = campaign
            .released_amount
            .checked_add(amount)
            .ok_or(EscrowError::Overflow)?;
        let completed = campaign.released_amount >= campaign.total_amount;
        if completed {
            campaign.status = CampaignStatus::Completed;
        }

        // 크리에이터 평판 갱신
        let rep = &mut ctx.accounts.creator_reputation;
        rep.wallet = campaign.creator;
        rep.total_settled = rep
            .total_settled
            .checked_add(amount)
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
            amount,
            by_agent: signer != campaign.brand,
        });
        Ok(())
    }

    /// 미완료/취소 시 vault 잔액을 브랜드에 환불.
    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let campaign_key = ctx.accounts.campaign.key();
        let vault_auth_bump = ctx.accounts.campaign.vault_auth_bump;
        let remaining = ctx.accounts.vault.amount;
        require!(remaining > 0, EscrowError::NothingToRefund);

        let seeds: &[&[u8]] = &[b"vault-auth", campaign_key.as_ref(), &[vault_auth_bump]];
        let signer_seeds = &[seeds];
        let cpi = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.brand_token.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(cpi, remaining)?;

        ctx.accounts.campaign.status = CampaignStatus::Cancelled;
        Ok(())
    }
}

// ===================== Accounts =====================

#[derive(Accounts)]
#[instruction(campaign_id: u64)]
pub struct InitializeCampaign<'info> {
    #[account(mut)]
    pub brand: Signer<'info>,

    /// CHECK: 크리에이터 지갑 주소만 저장(수취인)
    pub creator: UncheckedAccount<'info>,

    /// CHECK: 브랜드 에이전트 키(자율 릴리스 서명자)
    pub agent_authority: UncheckedAccount<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = brand_token.mint == mint.key() @ EscrowError::MintMismatch,
        constraint = brand_token.owner == brand.key() @ EscrowError::Unauthorized,
    )]
    pub brand_token: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = brand,
        space = 8 + Campaign::MAX_SIZE,
        seeds = [b"campaign", brand.key().as_ref(), &campaign_id.to_le_bytes()],
        bump,
    )]
    pub campaign: Account<'info, Campaign>,

    /// CHECK: vault 토큰계정의 권한 PDA
    #[account(
        seeds = [b"vault-auth", campaign.key().as_ref()],
        bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = brand,
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
    #[account(
        seeds = [b"vault-auth", campaign.key().as_ref()],
        bump = campaign.vault_auth_bump,
    )]
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
    #[account(
        seeds = [b"vault-auth", campaign.key().as_ref()],
        bump = campaign.vault_auth_bump,
    )]
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
pub struct Campaign {
    pub brand: Pubkey,
    pub creator: Pubkey,
    pub agent_authority: Pubkey,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub campaign_id: u64,
    pub total_amount: u64,
    pub released_amount: u64,
    pub auto_approve_cap: u64,
    pub status: CampaignStatus,
    pub bump: u8,
    pub vault_auth_bump: u8,
    pub milestones: Vec<Milestone>,
}

impl Campaign {
    // 5*Pubkey + 4*u64 + status(1) + bump(1) + vault_auth_bump(1) + Vec(4 + MAX*Milestone)
    pub const MAX_SIZE: usize = 32 * 5 + 8 * 4 + 1 + 1 + 1 + 4 + MAX_MILESTONES * Milestone::SIZE;
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
}

#[event]
pub struct MilestoneReleased {
    pub campaign: Pubkey,
    pub index: u8,
    pub amount: u64,
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
    #[msg("환불할 잔액 없음")]
    NothingToRefund,
}
