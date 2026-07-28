"use client";

import { useCallback, useState } from "react";
import { ProductApiClient } from "@/product/apiClient";
import { connectPhantom, disconnectPhantom, isPhantomAvailable } from "./phantom";

type WalletStatus = "idle" | "connecting" | "saving" | "error";

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
      setStatus("saving");
      await new ProductApiClient().saveWalletAddress(pubkey);
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
