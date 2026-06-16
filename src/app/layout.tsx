/* eslint-disable react-refresh/only-export-components */
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
  title: {
    default: "CS2 Case Tracker",
    template: "%s | CS2 Case Tracker",
  },
  description:
    "Theo dõi lời lỗ, số lượng, giá trị đầu tư các hòm, capsule, sticker và skin CS2 theo thời gian thực (giá Steam & Buff163).",
  keywords: ["CS2", "Case Tracker", "Steam", "Buff163", "Đầu tư CS2", "CS:GO", "Theo dõi hòm CS2", "Lời lỗ CS2"],
  authors: [{ name: "CS2 Case Tracker Team" }],
  creator: "CS2 Case Tracker",
  publisher: "CS2 Case Tracker",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "CS2 Case Tracker - Công Cụ Theo Dõi Đầu Tư CS2",
    description:
      "Theo dõi lời lỗ, số lượng, giá trị đầu tư các hòm, capsule, sticker và skin CS2 theo thời gian thực (giá Steam & Buff163).",
    siteName: "CS2 Case Tracker",
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CS2 Case Tracker - Công Cụ Theo Dõi Đầu Tư CS2",
    description:
      "Theo dõi lời lỗ, số lượng, giá trị đầu tư các hòm, capsule, sticker và skin CS2 theo thời gian thực (giá Steam & Buff163).",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/css/flag-icons.min.css"
        />
      </head>
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
