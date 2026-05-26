import type { Metadata } from "next";
import { AppNav } from "@/components/app-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "CS2 Case Tracker",
  description: "Theo dõi lời lỗ case CS2 theo giá mua và giá thị trường hiện tại.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <AppNav />
        {children}
      </body>
    </html>
  );
}
