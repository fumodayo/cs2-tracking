import type { Metadata } from "next";
import { AppNav } from "@/components/app-nav";
import { AppFooter } from "@/components/app-footer";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/components/i18n-provider";
import { CurrencyProvider } from "@/components/currency-provider";
import { GlobalImportProgress } from "@/components/global-import-progress";
import { GlobalSyncProgress } from "@/components/global-sync-progress";
import { Toaster } from "@/components/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CS2 Case Tracker",
  description:
    "Theo dõi lời lỗ case CS2 theo giá mua và giá thị trường hiện tại.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>
        <I18nProvider>
          <ThemeProvider>
            <CurrencyProvider>
              <QueryProvider>
                <TooltipProvider>
                  <div className="flex min-h-screen flex-col">
                    <AppNav />
                    <main className="flex-1">{children}</main>
                    <AppFooter />
                  </div>
                  <GlobalImportProgress />
                  <GlobalSyncProgress />
                  <Toaster />
                  <SpeedInsights />
                </TooltipProvider>
              </QueryProvider>
            </CurrencyProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
