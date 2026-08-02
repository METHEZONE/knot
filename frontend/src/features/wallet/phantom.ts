import { Buffer } from "buffer";
import { Connection, Transaction } from "@solana/web3.js";

export type PhantomWallet = {
  address: string;
};

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  connect(options?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
  disconnect?: () => Promise<void>;
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
  const provider = scoped.phantom?.solana ?? scoped.solana;
  return provider?.isPhantom ? provider : null;
}

export async function connectPhantomWallet(): Promise<PhantomWallet> {
  const provider = await waitForPhantomProvider();
  if (!provider) {
    throw new Error("Phantom 지갑을 찾을 수 없습니다. 브라우저 확장 프로그램을 설치해 주세요.");
  }
  try {
    const response = await provider.connect();
    return { address: response.publicKey.toString() };
  } catch (caught) {
    throw normalizeWalletError(caught, "Phantom 연결이 취소되었거나 실패했습니다.");
  }
}

export function isPhantomAvailable(): boolean {
  return getPhantomProvider() !== null;
}

export async function connectPhantom(): Promise<string> {
  const wallet = await connectPhantomWallet();
  return wallet.address;
}

export async function disconnectPhantom(): Promise<void> {
  await getPhantomProvider()?.disconnect?.();
}

export async function sendPreparedSolanaTransaction(input: {
  transactionBase64: string;
  recentBlockhash: string;
  lastValidBlockHeight: number;
  rpcUrl?: string;
}) {
  const provider = await waitForPhantomProvider();
  if (!provider) {
    throw new Error("Phantom 지갑을 찾을 수 없습니다.");
  }
  const transaction = Transaction.from(Buffer.from(input.transactionBase64, "base64"));
  if (!provider.signTransaction) {
    if (provider.signAndSendTransaction) {
      try {
        const { signature } = await provider.signAndSendTransaction(transaction);
        await confirmSignature(signature, input);
        return signature;
      } catch (caught) {
        throw normalizeWalletError(caught, "Phantom transaction 전송이 실패했습니다.");
      }
    }
    throw new Error("현재 Phantom provider가 Solana transaction signing을 지원하지 않습니다.");
  }
  try {
    const signed = await provider.signTransaction(transaction);
    const connection = new Connection(input.rpcUrl ?? defaultRpcUrl(), "confirmed");
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
    });
    await confirmSignature(signature, input);
    return signature;
  } catch (caught) {
    throw normalizeWalletError(caught, "Phantom transaction 서명 또는 전송이 실패했습니다.");
  }
}

async function waitForPhantomProvider(timeoutMs = 1500) {
  const immediate = getPhantomProvider();
  if (immediate) return immediate;
  if (typeof window === "undefined") return null;
  return new Promise<PhantomProvider | null>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener("phantom#initialized", finish);
      resolve(getPhantomProvider());
    };
    window.addEventListener("phantom#initialized", finish, { once: true });
    window.setTimeout(finish, timeoutMs);
  });
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

function normalizeWalletError(caught: unknown, fallback: string) {
  if (isWalletUserRejection(caught)) {
    return new Error("Phantom에서 사용자가 요청을 취소했습니다.");
  }
  if (caught instanceof Error && caught.message) return caught;
  return new Error(fallback);
}

function isWalletUserRejection(caught: unknown) {
  if (typeof caught !== "object" || caught === null) return false;
  const code = "code" in caught ? (caught as { code?: unknown }).code : null;
  return code === 4001 || code === "4001";
}
