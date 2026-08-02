import { readFileSync } from "node:fs";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
import { loadConfig } from "./config.js";

type Check = {
  name: string;
  ok: boolean;
  detail: string;
};

const MIN_AGENT_SOL_LAMPORTS = 30_000_000n;

async function main() {
  const config = loadConfig({
    ...process.env,
    SOLANA_CLUSTER: process.env.SOLANA_CLUSTER ?? "devnet",
    SOLANA_RPC_URL: process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
    KNOT_WEB3_SIGNING_MODE: process.env.KNOT_WEB3_SIGNING_MODE ?? "devnet"
  });
  const expectedDeposit = parseUsdc(process.env.KNOT_PREFLIGHT_ESCROW_AMOUNT_USDC ?? "20");
  const checks: Check[] = [];
  const connection = new Connection(config.solanaRpcUrl, "confirmed");

  let programId: PublicKey | null = null;
  let mint: PublicKey | null = null;
  let agent: Keypair | null = null;

  try {
    programId = new PublicKey(config.allowedProgramId);
    checks.push({ name: "programId", ok: true, detail: programId.toBase58() });
  } catch (error) {
    checks.push({ name: "programId", ok: false, detail: errorDetail(error) });
  }

  try {
    mint = new PublicKey(config.allowedMint);
    checks.push({ name: "mint", ok: true, detail: mint.toBase58() });
  } catch (error) {
    checks.push({ name: "mint", ok: false, detail: errorDetail(error) });
  }

  for (const [name, json, path] of [
    ["brand", config.brandKeypairJson, config.brandKeypairPath],
    ["creator", config.creatorKeypairJson, config.creatorKeypairPath],
    ["agent", config.agentKeypairJson, config.agentKeypairPath]
  ] as const) {
    try {
      const keypair = loadKeypair(json, path, name);
      checks.push({ name: `${name}Signer`, ok: true, detail: keypair.publicKey.toBase58() });
      if (name === "agent") {
        agent = keypair;
      }
    } catch (error) {
      checks.push({ name: `${name}Signer`, ok: false, detail: errorDetail(error) });
    }
  }

  if (programId) {
    try {
      const account = await connection.getAccountInfo(programId);
      checks.push({
        name: "programAccount",
        ok: Boolean(account?.executable),
        detail: account?.executable ? "executable program account found" : "program account missing or not executable"
      });
    } catch (error) {
      checks.push({ name: "programAccount", ok: false, detail: errorDetail(error) });
    }
  }

  if (programId && mint) {
    try {
      const configPda = pda(["config"], programId);
      const configInfo = await connection.getAccountInfo(configPda);
      if (!configInfo) {
        checks.push({ name: "escrowConfig", ok: false, detail: `missing config PDA ${configPda.toBase58()}` });
      } else {
        const treasuryToken = new PublicKey(configInfo.data.subarray(40, 72));
        const treasury = await getAccount(connection, treasuryToken, "confirmed", TOKEN_PROGRAM_ID);
        const brandFeeBps = configInfo.data.readUInt16LE(72);
        checks.push({
          name: "escrowConfig",
          ok: treasury.mint.equals(mint),
          detail: `config=${configPda.toBase58()} treasury=${treasuryToken.toBase58()} mint=${treasury.mint.toBase58()} brandFeeBps=${brandFeeBps}`
        });
      }
    } catch (error) {
      checks.push({ name: "escrowConfig", ok: false, detail: errorDetail(error) });
    }
  }

  if (agent && mint) {
    try {
      const lamports = BigInt(await connection.getBalance(agent.publicKey, "confirmed"));
      checks.push({
        name: "agentSol",
        ok: lamports >= MIN_AGENT_SOL_LAMPORTS,
        detail: `${Number(lamports) / LAMPORTS_PER_SOL} SOL`
      });
    } catch (error) {
      checks.push({ name: "agentSol", ok: false, detail: errorDetail(error) });
    }

    try {
      const ata = await getAssociatedTokenAddress(mint, agent.publicKey);
      let amount = 0n;
      try {
        const account = await getAccount(connection, ata, "confirmed", TOKEN_PROGRAM_ID);
        amount = account.amount;
      } catch {
        amount = 0n;
      }
      checks.push({
        name: "agentUsdc",
        ok: amount >= expectedDeposit,
        detail: `${formatUsdc(amount)} USDC at ${ata.toBase58()} (required ${formatUsdc(expectedDeposit)})`
      });
    } catch (error) {
      checks.push({ name: "agentUsdc", ok: false, detail: errorDetail(error) });
    }
  }

  const ok = checks.every((check) => check.ok);
  console.log(
    JSON.stringify(
      {
        ok,
        cluster: config.solanaCluster,
        rpcUrl: config.solanaRpcUrl,
        signingMode: config.signingMode,
        autoMintOnLock: config.autoMintOnLock,
        autoSolTopupOnLock: config.autoSolTopupOnLock,
        expectedEscrowAmountUsdc: formatUsdc(expectedDeposit),
        checks
      },
      null,
      2
    )
  );
  if (!ok) {
    process.exitCode = 1;
  }
}

function loadKeypair(json: string | undefined, path: string | undefined, label: string): Keypair {
  const raw = json ?? (path ? readFileSync(path, "utf8") : undefined);
  if (!raw) {
    throw new Error(`${label} keypair is not configured`);
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} keypair must be a JSON array`);
  }
  return Keypair.fromSecretKey(Uint8Array.from(parsed as number[]));
}

function pda(seeds: Array<string | Buffer>, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    seeds.map((seed) => (typeof seed === "string" ? Buffer.from(seed) : seed)),
    programId
  )[0];
}

function parseUsdc(value: string): bigint {
  const [whole, fraction = ""] = value.trim().split(".");
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction) || fraction.length > 6) {
    throw new Error(`Invalid USDC amount: ${value}`);
  }
  return BigInt(whole) * 1_000_000n + BigInt((fraction + "000000").slice(0, 6));
}

function formatUsdc(value: bigint): string {
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
  console.error(errorDetail(error));
  process.exit(1);
});
