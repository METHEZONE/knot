import { Buffer } from "buffer";
import { Connection, Transaction } from "@solana/web3.js";

export type PhantomWallet = {
  address: string;
};

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  connect(options?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
  signAndSendTransaction?: (transaction: Transaction) => Promise<{ signature: string }>;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
};

type WindowWithSolana = Window & {
  phantom?: { solana?: PhantomProvider };
  solana?: PhantomProvider;
};

export function getPhantomProvider() {
  if (typeof window === "undefined") return null;
  const scoped = window as WindowWithSolana;
  return scoped.phantom?.solana ?? (scoped.solana?.isPhantom ? scoped.solana : null);
}

export async function connectPhantomWallet(): Promise<PhantomWallet> {
  const provider = getPhantomProvider();
  if (!provider) {
    throw new Error("Phantom 지갑을 찾을 수 없습니다. 브라우저 확장 프로그램을 설치해 주세요.");
  }
  const response = await provider.connect();
  return { address: response.publicKey.toString() };
}

export async function sendPreparedSolanaTransaction(input: {
  transactionBase64: string;
  recentBlockhash: string;
  lastValidBlockHeight: number;
  rpcUrl?: string;
}) {
  const provider = getPhantomProvider();
  if (!provider) {
    throw new Error("Phantom 지갑을 찾을 수 없습니다.");
  }
  const transaction = Transaction.from(Buffer.from(input.transactionBase64, "base64"));
  if (provider.signAndSendTransaction) {
    const { signature } = await provider.signAndSendTransaction(transaction);
    await confirmSignature(signature, input);
    return signature;
  }
  if (!provider.signTransaction) {
    throw new Error("현재 Phantom provider가 Solana transaction signing을 지원하지 않습니다.");
  }
  const signed = await provider.signTransaction(transaction);
  const connection = new Connection(input.rpcUrl ?? defaultRpcUrl(), "confirmed");
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
  });
  await confirmSignature(signature, input);
  return signature;
}

async function confirmSignature(
  signature: string,
  input: { recentBlockhash: string; lastValidBlockHeight: number; rpcUrl?: string },
) {
  const connection = new Connection(input.rpcUrl ?? defaultRpcUrl(), "confirmed");
  const result = await connection.confirmTransaction(
    {
      signature,
      blockhash: input.recentBlockhash,
      lastValidBlockHeight: input.lastValidBlockHeight,
    },
    "confirmed",
  );
  if (result.value.err) {
    throw new Error(`Solana transaction failed: ${JSON.stringify(result.value.err)}`);
  }
}

function defaultRpcUrl() {
  return process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
}
