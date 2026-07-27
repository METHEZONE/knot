"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  authConfigurationError,
  currentIdToken,
  firebaseConfigured,
  observeFirebaseUser,
  signOutFirebase,
} from "@/auth/firebaseClient";
import { getDashboardPath, type AuthStatus } from "@/auth/authState";
import { ProductApiClient, type CurrentUserContext } from "@/product/apiClient";

ProductApiClient.setAuthTokenProvider(currentIdToken);

type AuthContextValue = {
  status: AuthStatus;
  context: CurrentUserContext | null;
  error: string | null;
  dashboardPath: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = firebaseConfigured();
  const [status, setStatus] = useState<AuthStatus>(configured ? "loading" : "unauthenticated");
  const [context, setContext] = useState<CurrentUserContext | null>(null);
  const [error, setError] = useState<string | null>(configured ? null : authConfigurationError());
  const contextRef = useRef<CurrentUserContext | null>(null);
  const initializedRef = useRef(!configured);

  const refresh = useCallback(async () => {
    const accountContext = await new ProductApiClient().getMe();
    contextRef.current = accountContext;
    initializedRef.current = true;
    setContext(accountContext);
    setStatus("authenticated");
    setError(null);
  }, []);

  const logout = useCallback(async () => {
    await signOutFirebase();
    contextRef.current = null;
    initializedRef.current = true;
    setContext(null);
    setStatus("unauthenticated");
  }, []);

  useEffect(() => {
    if (!configured) return;
    const unsubscribe = observeFirebaseUser((user) => {
      if (!user) {
        contextRef.current = null;
        initializedRef.current = true;
        setContext(null);
        setStatus("unauthenticated");
        setError(null);
        return;
      }
      if (!initializedRef.current && !contextRef.current) {
        setStatus("loading");
      }
      void refresh().catch((caught) => {
        initializedRef.current = true;
        if (!contextRef.current) {
          setContext(null);
          setStatus("unauthenticated");
        }
        setError(caught instanceof Error ? caught.message : String(caught));
      });
    });
    return unsubscribe;
  }, [configured, refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      context,
      error,
      dashboardPath: getDashboardPath(context?.account.role),
      refresh,
      logout,
    }),
    [context, error, logout, refresh, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}

export function useCurrentUser() {
  return useAuth().context;
}

export function useCurrentRole() {
  return useAuth().context?.account.role ?? null;
}
