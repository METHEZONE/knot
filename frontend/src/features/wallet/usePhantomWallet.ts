"use client";

import { useCallback, useState } from "react";
import { ProductApiClient } from "@/product/apiClient";
import { connectPhantom, disconnectPhantom, isPhantomAvailable, signPhantomMessage } from "./phantom";

type WalletStatus = "idle" | "connecting" | "proving" | "saving" | "error";

// Settings ▸ WALLET 카드에서 사용: Phantom 연결 → 지갑주소를 백엔드(POST /me/wallet)에 저장.
// (버튼 렌더/배치는 화면단에서 — feat/two-user-session 머지 후 얹으면 됨)
export function usePhantomWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<WalletStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async (): Promise<string | null> => {
    setStatus("connecting");
    setError(null);
    try {
      const pubkey = await connectPhantom();
      setAddress(pubkey);
      // 소유 증명: 서버 챌린지를 지갑으로 서명해야 주소가 등록된다. 플랫폼이 키를
      // 보관하지 않으므로 이 서명만이 주소 소유를 보장한다(docs/17 D7).
      setStatus("proving");
      const client = new ProductApiClient();
      const { challenge } = await client.createWalletChallenge(pubkey);
      const signature = await signPhantomMessage(challenge.message);
      setStatus("saving");
      await client.saveWalletAddress(pubkey, {
        challengeId: challenge.challengeId,
        signature,
      });
      setStatus("idle");
      return pubkey;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("error");
      return null;
    }
  }, []);

  const disconnect = useCallback(async (): Promise<void> => {
    await disconnectPhantom();
    setAddress(null);
    setStatus("idle");
  }, []);

  return {
    address,
    status,
    error,
    available: isPhantomAvailable(),
    connect,
    disconnect,
  };
}
