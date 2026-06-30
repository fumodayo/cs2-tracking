"use client";

import { useCallback, useEffect, useState } from "react";

export type ClientSessionUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
};

type SessionResponse = {
  user: ClientSessionUser | null;
  googleConfigured: boolean;
  isAdmin: boolean;
};

export function useSession() {
  const [session, setSession] = useState<SessionResponse>({
    user: null,
    googleConfigured: true,
    isAdmin: false,
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Session request failed");
      }
      setSession((await response.json()) as SessionResponse);
    } catch {
      setSession({ user: null, googleConfigured: false, isAdmin: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Session request failed");
        }
        const nextSession = (await response.json()) as SessionResponse;
        if (!cancelled) {
          setSession(nextSession);
        }
      } catch {
        if (!cancelled) {
          setSession({ user: null, googleConfigured: false, isAdmin: false });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  return { ...session, loading, refresh };
}
