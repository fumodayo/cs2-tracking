"use client";

import React from "react";
import { Key } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { ClientSessionUser } from "@/components/auth/use-session";

interface ScannerToolbarProps {
  user: ClientSessionUser | null;
  onShowGuestKeyModal: () => void;
}

export function ScannerToolbar({ user, onShowGuestKeyModal }: ScannerToolbarProps) {
  const { t } = useTranslation();

  return (
    <section className="relative min-h-[16rem] overflow-hidden border-b border-stone-800">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-40"
        style={{ backgroundImage: "url('/assets/dashboard-banner.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-hero-scrim via-hero-scrim to-transparent" />
      <div className="relative mx-auto flex max-w-7xl flex-col justify-end px-4 pt-16 pb-8 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold tracking-[0.18em] text-accent uppercase">
            {t("inventoryScanner.toolTitle")}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">
            {t("inventoryScanner.title")}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            {t("inventoryScanner.description")}
          </p>
          {!user && (
            <div className="mt-5">
              <Button
                variant="secondary"
                onClick={onShowGuestKeyModal}
                className="cursor-pointer"
              >
                <Key className="size-4 text-accent" />
                <span>{t("inventoryScanner.configApiKeyGuest")}</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
