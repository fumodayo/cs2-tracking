"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { BugReportDialog } from "@/components/bug-report-dialog";
import { AlertTriangle, ExternalLink } from "lucide-react";

// Premium Custom SVG Icons
const DiscordIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 127.14 96.36" fill="currentColor" {...props}>
    <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,7.06-11.47,68.35,68.35,0,0,1-11.85-5.71c1-.74,2-1.5,3-2.28a74.86,74.86,0,0,0,74.07,0c1,.78,2,1.54,3,2.28a68.64,68.64,0,0,1-11.85,5.71,77.7,77.7,0,0,0,7.06,11.47,105.73,105.73,0,0,0,31.54-18.83C129,54.65,123.5,31.58,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z"/>
  </svg>
);

const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

export function AppFooter() {
  const { t } = useTranslation();
  const [bugDialogOpen, setBugDialogOpen] = useState(false);
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Logo & About */}
          <div className="space-y-4">
            <Link
              href="/portfolio"
              className="flex items-center gap-2 text-base font-semibold tracking-[0.16em] text-foreground uppercase hover:text-accent transition-colors"
            >
              <img src="/favicon.svg" alt="CS2 Tracker Logo" className="size-6 object-contain" />
              <span>CS2 Tracker</span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              {t("footer.about")}
            </p>
            {/* Social Links */}
            <div className="flex items-center gap-4 pt-2">
              <a
                href="https://discord.gg/cs2-tracking"
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-accent transition-all duration-200 hover:scale-110"
                aria-label="Discord"
              >
                <DiscordIcon className="size-5" />
              </a>
              <a
                href="https://x.com/cs2_tracking"
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-accent transition-all duration-200 hover:scale-110"
                aria-label="Twitter / X"
              >
                <TwitterIcon className="size-4.5" />
              </a>
            </div>
          </div>

          {/* Support Actions */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold tracking-wider text-foreground uppercase">
              Support
            </h3>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setBugDialogOpen(true)}
                className="inline-flex items-center gap-2 rounded-md border border-danger-border bg-danger-muted px-3.5 py-1.5 text-xs font-semibold text-danger transition-all duration-200 hover:bg-danger/18 hover:scale-[1.02] active:scale-[0.98]"
              >
                <AlertTriangle className="size-3.5" />
                {t("footer.reportBug")}
              </button>

              <div className="pt-2">
                <a
                  href="https://www.exchangerate-api.com"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t("footer.rateApi")}
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="mt-8 border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>{t("footer.copyright", { year: currentYear })}</p>
        </div>
      </div>

      <BugReportDialog open={bugDialogOpen} onOpenChange={setBugDialogOpen} />
    </footer>
  );
}
