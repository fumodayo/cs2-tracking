'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { BugReportDialog } from '@/components/bug-report-dialog';
import { ExternalLink, Facebook, Github, Mail, Package, MessageSquare } from 'lucide-react';

// Icon SVG tùy chỉnh chất lượng cao
const DiscordIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 127.14 96.36" fill="currentColor" {...props}>
    <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,7.06-11.47,68.35,68.35,0,0,1-11.85-5.71c1-.74,2-1.5,3-2.28a74.86,74.86,0,0,0,74.07,0c1,.78,2,1.54,3,2.28a68.64,68.64,0,0,1-11.85,5.71,77.7,77.7,0,0,0,7.06,11.47,105.73,105.73,0,0,0,31.54-18.83C129,54.65,123.5,31.58,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z" />
  </svg>
);

const ZaloIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    <path d="M9 9.5h6l-6 5h6" />
  </svg>
);

export function AppFooter() {
  const { t } = useTranslation();
  const [bugDialogOpen, setBugDialogOpen] = useState(false);
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-stone-850 border-t bg-stone-950/40 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-16">
          {/* Cột trái: biểu trưng và giới thiệu */}
          <div className="space-y-4 text-left">
            <Link href="/portfolio" className="group flex w-fit items-center gap-2">
              <div className="flex size-6 shrink-0 items-center justify-center rounded bg-blue-600 text-white transition-transform duration-200 group-hover:scale-105">
                <Package className="size-4" />
              </div>
              <span className="text-foreground text-sm font-bold tracking-[0.16em] uppercase transition-colors duration-200 group-hover:text-blue-400">
                CS2 TRACKER
              </span>
            </Link>
            <p className="max-w-md text-sm leading-relaxed text-stone-400">{t('footer.about')}</p>
            {/* Liên kết mạng xã hội */}
            <div className="flex items-center gap-4 pt-2">
              <a
                href="https://discord.gg/cs2-tracking"
                target="_blank"
                rel="noreferrer"
                className="text-stone-500 transition-all duration-200 hover:scale-110 hover:text-stone-300"
                aria-label={t('footer.discord')}
              >
                <DiscordIcon className="size-5" />
              </a>
              <a
                href="https://www.facebook.com/buisonthai.fumodayo/"
                target="_blank"
                rel="noreferrer"
                className="text-stone-500 transition-all duration-200 hover:scale-110 hover:text-stone-300"
                aria-label={t('footer.facebook')}
              >
                <Facebook className="size-4.5" />
              </a>
              <a
                href="https://fumodayo.vercel.app/en"
                target="_blank"
                rel="noreferrer"
                className="text-stone-500 transition-all duration-200 hover:scale-110 hover:text-stone-300"
                aria-label={t('footer.github')}
              >
                <Github className="size-4.5" />
              </a>
              <a
                href="mailto:sonthai1310.works@gmail.com"
                className="text-stone-500 transition-all duration-200 hover:scale-110 hover:text-stone-300"
                aria-label={t('footer.gmail')}
              >
                <Mail className="size-4.5" />
              </a>
              <a
                href="https://zalo.me/"
                target="_blank"
                rel="noreferrer"
                className="text-stone-500 transition-all duration-200 hover:scale-110 hover:text-stone-300"
                aria-label={t('footer.zalo')}
              >
                <ZaloIcon className="size-5" />
              </a>
            </div>
          </div>

          {/* Cột phải: hỗ trợ */}
          <div className="space-y-4 text-left">
            <h3 className="text-foreground text-sm font-bold tracking-[0.16em] uppercase">
              {t('footer.supportTitle', 'HỖ TRỢ')}
            </h3>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setBugDialogOpen(true)}
                className="hover:bg-stone-850 inline-flex items-center gap-2 rounded-md border border-stone-800 bg-stone-900/40 px-3.5 py-1.5 text-xs font-semibold text-stone-300 transition-all duration-200 hover:border-stone-700 hover:text-stone-100 active:scale-[0.98]"
              >
                <MessageSquare className="size-3.5 text-stone-400" />
                {t('footer.reportBug')}
              </button>

              <div className="pt-2">
                <a
                  href="https://www.exchangerate-api.com"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-stone-500 transition-colors hover:text-stone-300"
                >
                  {t('footer.rateApi')}
                  <ExternalLink className="size-3 text-stone-500" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bản quyền cuối trang */}
        <div className="border-stone-850 mt-8 border-t pt-6 text-left text-xs text-stone-500">
          <p>{t('footer.copyright', { year: currentYear })}</p>
        </div>
      </div>

      <BugReportDialog open={bugDialogOpen} onOpenChange={setBugDialogOpen} />
    </footer>
  );
}
