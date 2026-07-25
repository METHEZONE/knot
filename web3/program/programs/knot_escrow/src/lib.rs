use anchor_lang::prelude::*;

declare_id!("Knot111111111111111111111111111111111111111");

#[program]
pub mod knot_escrow {
    use super::*;

    pub fn initialize_escrow(_ctx: Context<InitializeEscrow>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeEscrow {}
