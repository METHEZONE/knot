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
  signMessage?: (message: Uint8Array, display?: "utf8" | "hex") => Promise<{ signature: Uint8Array }>;
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
    throw new Error("지갑을 찾을 수 없습니다. 브라우저 지갑 확장 프로그램을 설치해 주세요.");
  }
  try {
    const response = await provider.connect();
    return { address: response.publicKey.toString() };
  } catch (caught) {
    throw normalizeWalletError(caught, "지갑 연결이 취소되었거나 실패했습니다.");
  }
}

export function isPhantomAvailable(): boolean {
  return getPhantomProvider() !== null;
}

export async function connectPhantom(): Promise<string> {
  const wallet = await connectPhantomWallet();
  return wallet.address;
}

/**
 * 지갑 소유 증명용 메시지 서명.
 *
 * 플랫폼이 유저 키를 보관하지 않으므로(docs/17 D7) 주소를 등록할 때 그 주소의 키를
 * 유저가 실제로 가졌는지 서명으로 증명해야 한다. 자금을 이동시키지 않는 서명이다.
 */
export async function signPhantomMessage(message: string): Promise<string> {
  const provider = await waitForPhantomProvider();
  if (!provider) {
    throw new Error("지갑을 찾을 수 없습니다. 브라우저 지갑 확장 프로그램을 설치해 주세요.");
  }
  if (!provider.signMessage) {
    throw new Error("이 지갑은 메시지 서명을 지원하지 않아 지갑 소유 확인을 할 수 없습니다.");
  }
  try {
    const encoded = new TextEncoder().encode(message);
    const { signature } = await provider.signMessage(encoded, "utf8");
    return encodeBase58(signature);
  } catch (caught) {
    throw normalizeWalletError(caught, "지갑 소유 확인 서명에 실패했습니다.");
  }
}

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** 서버가 기대하는 base58 서명 문자열. 의존성을 늘리지 않으려고 직접 인코딩한다. */
function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  const digits: number[] = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  // 선행 0 바이트는 base58 에서 '1' 로 보존된다.
  let leadingZeros = 0;
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) leadingZeros += 1;
  return "1".repeat(leadingZeros) + digits.reverse().map((d) => BASE58_ALPHABET[d]).join("");
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
    throw new Error("지갑을 찾을 수 없습니다.");
  }
  const transaction = Transaction.from(Buffer.from(input.transactionBase64, "base64"));
  if (!provider.signTransaction) {
    if (provider.signAndSendTransaction) {
      try {
        const { signature } = await provider.signAndSendTransaction(transaction);
        await confirmSignature(signature, input);
        return signature;
      } catch (caught) {
        throw normalizeWalletError(caught, "거래 전송이 실패했습니다.");
      }
    }
    throw new Error("현재 지갑에서 거래 서명을 사용할 수 없습니다.");
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
    throw normalizeWalletError(caught, "거래 서명 또는 전송이 실패했습니다.");
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
    throw new Error(`거래가 실패했습니다: ${JSON.stringify(result.value.err)}`);
  }
}

function defaultRpcUrl() {
  return process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
}

function normalizeWalletError(caught: unknown, fallback: string) {
  if (isWalletUserRejection(caught)) {
    return new Error("지갑에서 사용자가 요청을 취소했습니다.");
  }
  if (caught instanceof Error && caught.message) return caught;
  return new Error(fallback);
}

function isWalletUserRejection(caught: unknown) {
  if (typeof caught !== "object" || caught === null) return false;
  const code = "code" in caught ? (caught as { code?: unknown }).code : null;
  return code === 4001 || code === "4001";
}
