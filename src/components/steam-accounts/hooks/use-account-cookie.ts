"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQueryClient, UseQueryResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "@/stores";
import { getErrorMessage } from "@/utils/error";
import {
  checkSteamCookieStatus,
  updateSteamAccountCookie,
  STEAM_ACCOUNTS_QUERY_KEY,
} from "@/lib/api-client/steam-accounts-api";
import type { SteamAccountDto } from "@/lib/api-client/steam-accounts-api";

interface UseAccountCookieProps {
  accountsQuery: UseQueryResult<SteamAccountDto[], unknown>;
}

export function useAccountCookie({ accountsQuery }: UseAccountCookieProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [showCookies, setShowCookies] = useState<Record<string, boolean>>({});
  const [cookieInputs, setCookieInputs] = useState<Record<string, string>>({});
  const [parentalInputs, setParentalInputs] = useState<Record<string, string>>({});
  const [sessionIdInputs, setSessionIdInputs] = useState<Record<string, string>>({});

  const [cookieStatuses, setCookieStatuses] = useState<
    Record<
      string,
      {
        status: "idle" | "loading" | "live" | "expired" | "error";
        message?: string;
      }
    >
  >({});
  const [checkCooldowns, setCheckCooldowns] = useState<Record<string, number>>({});
  const checkCooldownsRef = useRef(checkCooldowns);

  useEffect(() => {
    checkCooldownsRef.current = checkCooldowns;
  }, [checkCooldowns]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCheckCooldowns((prev) => {
        const next = { ...prev };
        let updated = false;
        for (const key of Object.keys(next)) {
          if (next[key] > 0) {
            next[key] -= 1;
            updated = true;
          } else {
            delete next[key];
            updated = true;
          }
        }
        return updated ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCheckCookie = useCallback(
    async (accountId: string) => {
      if (checkCooldownsRef.current[accountId] > 0) return;

      setCookieStatuses((prev) => ({
        ...prev,
        [accountId]: { status: "loading" },
      }));

      try {
        const data = await checkSteamCookieStatus(accountId);
        if (data.isValid) {
          setCookieStatuses((prev) => ({
            ...prev,
            [accountId]: { status: "live" },
          }));
          accountsQuery.refetch();
          toast.success(t("dashboard.cookieWorking", "Cookie is working properly!"));
        } else if (data.isExpired) {
          setCookieStatuses((prev) => ({
            ...prev,
            [accountId]: {
              status: "expired",
              message: data.message || t("dashboard.cookieExpiredStatus", "Cookie expired"),
            },
          }));
          accountsQuery.refetch();
          toast.error(t("dashboard.cookieExpiredError", "Cookie has expired!"));
        } else {
          setCookieStatuses((prev) => ({
            ...prev,
            [accountId]: {
              status: "error",
              message: data.message || t("dashboard.cookieCheckError", "Verification error"),
            },
          }));
          accountsQuery.refetch();
          toast.error(data.message || t("dashboard.cookieVerificationFailed", "Cookie verification failed."));
        }
      } catch {
        setCookieStatuses((prev) => ({
          ...prev,
          [accountId]: { status: "error", message: t("dashboard.networkConnectionError", "Network connection error") },
        }));
        accountsQuery.refetch();
        toast.error(t("common.serverConnectionError", "Cannot connect to server."));
      } finally {
        setCheckCooldowns((prev) => ({ ...prev, [accountId]: 15 }));
      }
    },
    [accountsQuery, t],
  );

  const updateCookieMutation = useMutation({
    mutationFn: (payload: { id: string; steamCookie: string }) =>
      updateSteamAccountCookie(payload, t("dashboard.cannotUpdateCookie")),
    onSuccess: (data, variables) => {
      const accountId = variables.id;
      setCookieInputs((prev) => {
        const next = { ...prev };
        delete next[accountId];
        return next;
      });
      setParentalInputs((prev) => {
        const next = { ...prev };
        delete next[accountId];
        return next;
      });
      setSessionIdInputs((prev) => {
        const next = { ...prev };
        delete next[accountId];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: STEAM_ACCOUNTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["portfolio-storage-units"] });
      toast.success(t("dashboard.cookieSaved"));
    },
    onError: (err) => {
      toast.error(t("dashboard.cookieError"), {
        description: getErrorMessage(err),
      });
    },
  });

  const getUnsavedCookie = useCallback(
    (account: { id: string; steamCookie?: string | null }) => {
      const getVal = (raw: string, key: string) => {
        if (raw.includes(";")) {
          const match = raw.split(";").find((p) =>
            p
              .trim()
              .toLowerCase()
              .startsWith(key + "="),
          );
          return match ? match.split("=").slice(1).join("=").trim() : "";
        }
        if (key === "steamloginsecure") {
          return raw.toLowerCase().startsWith("steamloginsecure=")
            ? raw.substring(17).trim()
            : raw.trim();
        }
        return "";
      };

      const parsedLoginSecure = account.steamCookie
        ? getVal(account.steamCookie, "steamloginsecure")
        : "";
      const parsedParental = account.steamCookie
        ? getVal(account.steamCookie, "steamparental")
        : "";
      const parsedSessionId = account.steamCookie
        ? getVal(account.steamCookie, "sessionid")
        : "";

      const hasUnsavedCookieChange =
        cookieInputs[account.id] !== undefined &&
        cookieInputs[account.id] !== parsedLoginSecure;
      const hasUnsavedParentalChange =
        parentalInputs[account.id] !== undefined &&
        parentalInputs[account.id] !== parsedParental;
      const hasUnsavedSessionIdChange =
        sessionIdInputs[account.id] !== undefined &&
        sessionIdInputs[account.id] !== parsedSessionId;

      if (
        !hasUnsavedCookieChange &&
        !hasUnsavedParentalChange &&
        !hasUnsavedSessionIdChange
      ) {
        return null;
      }

      const sLogin = cookieInputs[account.id] ?? parsedLoginSecure;
      const sParental = parentalInputs[account.id] ?? parsedParental;
      const sSessionId = sessionIdInputs[account.id] ?? parsedSessionId;
      const combined =
        `steamLoginSecure=${sLogin}` +
        (sParental ? `; steamparental=${sParental}` : "") +
        (sSessionId ? `; sessionid=${sSessionId}` : "");
      return combined;
    },
    [cookieInputs, parentalInputs, sessionIdInputs],
  );

  return {
    showCookies,
    setShowCookies,
    cookieInputs,
    setCookieInputs,
    parentalInputs,
    setParentalInputs,
    sessionIdInputs,
    setSessionIdInputs,
    cookieStatuses,
    setCookieStatuses,
    checkCooldowns,
    setCheckCooldowns,
    handleCheckCookie,
    updateCookieMutation,
    getUnsavedCookie,
  };
}
