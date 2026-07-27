// Phantom(브라우저 지갑) 연결 — 유저 소유(비수탁) 지갑. window에 주입되는 Phantom provider를
// 직접 사용하므로 추가 의존성 없음. (에이전트 지갑=SM 커스터디와 구분: docs/WALLET_AND_MONEY_FLOW.md)

export type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString(): string } | null;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  disconnect: () => Promise<void>;
};

function getProvider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    solana?: PhantomProvider;
    phantom?: { solana?: PhantomProvider };
  };
  const provider = w.phantom?.solana ?? w.solana;
  return provider?.isPhantom ? provider : null;
}

export function isPhantomAvailable(): boolean {
  return getProvider() !== null;
}

/** Phantom 팝업으로 연결하고 지갑 주소(base58)를 반환. 미설치 시 에러. */
export async function connectPhantom(): Promise<string> {
  const provider = getProvider();
  if (!provider) {
    throw new Error(
      "Phantom 지갑이 설치되어 있지 않습니다. https://phantom.app 에서 설치 후 다시 시도해주세요.",
    );
  }
  const { publicKey } = await provider.connect();
  return publicKey.toString();
}

export async function disconnectPhantom(): Promise<void> {
  await getProvider()?.disconnect();
}
