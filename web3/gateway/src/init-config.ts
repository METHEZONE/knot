import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
import { getAccount, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { loadConfig } from "./config.js";

async function main() {
  const config = loadConfig({
    ...process.env,
    SOLANA_CLUSTER: process.env.SOLANA_CLUSTER ?? "devnet",
    SOLANA_RPC_URL: process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
    KNOT_WEB3_SIGNING_MODE: process.env.KNOT_WEB3_SIGNING_MODE ?? "devnet"
  });
  const admin = loadKeypair(
    process.env.KNOT_ADMIN_KEYPAIR_JSON ?? process.env.KNOT_BRAND_KEYPAIR_JSON,
    process.env.KNOT_ADMIN_KEYPAIR_PATH ?? process.env.KNOT_BRAND_KEYPAIR_PATH ?? process.env.ANCHOR_WALLET,
    "admin"
  );
  const connection = new Connection(config.solanaRpcUrl, "confirmed");
  const programId = new PublicKey(config.allowedProgramId);
  const mint = new PublicKey(config.allowedMint);
  const configPda = pda(["config"], programId);
  const existing = await connection.getAccountInfo(configPda);
  if (existing) {
    const treasuryToken = new PublicKey(existing.data.subarray(40, 72));
    const treasury = await getAccount(connection, treasuryToken);
    if (!treasury.mint.equals(mint)) {
      throw new Error(
        `Escrow config already exists with mint ${treasury.mint.toBase58()}, expected ${mint.toBase58()}`
      );
    }
    console.log(
      JSON.stringify(
        {
          status: "EXISTS",
          programId: programId.toBase58(),
          config: configPda.toBase58(),
          treasuryToken: treasuryToken.toBase58(),
          mint: mint.toBase58()
        },
        null,
        2
      )
    );
    return;
  }

  const treasuryToken = (
    await getOrCreateAssociatedTokenAccount(connection, admin, mint, admin.publicKey)
  ).address;
  const signature = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(
      new TransactionInstruction({
        programId,
        data: Buffer.concat([disc("initialize_config"), u16(0), u16(0)]),
        keys: [
          { pubkey: admin.publicKey, isSigner: true, isWritable: true },
          { pubkey: treasuryToken, isSigner: false, isWritable: false },
          { pubkey: configPda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
        ]
      })
    ),
    [admin],
    { commitment: "confirmed" }
  );
  console.log(
    JSON.stringify(
      {
        status: "INITIALIZED",
        signature,
        explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=${config.solanaCluster}`,
        programId: programId.toBase58(),
        config: configPda.toBase58(),
        treasuryToken: treasuryToken.toBase58(),
        mint: mint.toBase58()
      },
      null,
      2
    )
  );
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

function disc(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function u16(value: number): Buffer {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
