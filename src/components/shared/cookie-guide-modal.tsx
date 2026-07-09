'use client';

import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface CookieGuideModalProps {
  open: boolean;
  onClose: () => void;
}

export function CookieGuideModal({ open, onClose }: CookieGuideModalProps) {
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState<number>(1);

  const steps = [
    {
      id: 1,
      title: t('cookieGuide.steps.1.title'),
      desc: t('cookieGuide.steps.1.desc'),
      tip: t('cookieGuide.steps.1.tip'),
      screenTitle: t('cookieGuide.steps.1.screenTitle'),
    },
    {
      id: 2,
      title: t('cookieGuide.steps.2.title'),
      desc: t('cookieGuide.steps.2.desc'),
      tip: t('cookieGuide.steps.2.tip'),
      screenTitle: t('cookieGuide.steps.2.screenTitle'),
    },
    {
      id: 3,
      title: t('cookieGuide.steps.3.title'),
      desc: t('cookieGuide.steps.3.desc'),
      tip: t('cookieGuide.steps.3.tip'),
      screenTitle: t('cookieGuide.steps.3.screenTitle'),
    },
    {
      id: 4,
      title: t('cookieGuide.steps.4.title'),
      desc: t('cookieGuide.steps.4.desc'),
      tip: t('cookieGuide.steps.4.tip'),
      screenTitle: t('cookieGuide.steps.4.screenTitle'),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="bg-card text-foreground shadow-soft flex max-h-[95vh] max-w-5xl flex-col overflow-hidden rounded-2xl border-stone-200 p-6 backdrop-blur-3xl dark:border-zinc-800/60 dark:shadow-[0_30px_90px_rgba(0,0,0,0.95)]">
        <div className="grid flex-1 grid-cols-1 items-center gap-8 overflow-y-auto pr-1 lg:grid-cols-12">
          {/* Cột trái: mockup màn hình PC cao cấp (chiếm 7 cột) */}
          <div className="relative flex flex-col items-center justify-center p-2 select-none lg:col-span-7">
            {/* Ánh sáng nền môi trường */}
            <div className="pointer-events-none absolute top-1/2 left-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-[100px]" />

            {/* Khung màn hình mô phỏng chi tiết */}
            <div className="relative flex aspect-[16/10] w-full max-w-[540px] flex-col justify-between overflow-hidden rounded-xl border-4 border-zinc-800 bg-[#030508] p-1.5 shadow-2xl ring-8 ring-zinc-900/30 transition-transform duration-300 hover:scale-[1.01]">
              {/* Đường phản chiếu trên màn hình */}
              <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-tr from-transparent via-white/[0.01] to-white/[0.03]" />

              {/* Notch / camera trên viền màn hình */}
              <div className="absolute top-0.5 left-1/2 z-30 flex -translate-x-1/2 items-center justify-center">
                <span className="size-1 rounded-full bg-zinc-900" />
              </div>

              {/* Container nội dung màn hình mô phỏng */}
              <div className="relative flex flex-1 flex-col justify-between overflow-hidden rounded-lg border border-zinc-800/60 bg-[#0c0e12]">
                {/* Phần đầu trình duyệt PC */}
                <div className="flex items-center justify-between border-b border-zinc-800/80 bg-[#12161f] px-3 py-2 select-none">
                  {/* Các chấm tròn */}
                  <div className="flex shrink-0 gap-1.5">
                    <span className="size-2 rounded-full bg-red-500/40" />
                    <span className="size-2 rounded-full bg-yellow-500/40" />
                    <span className="size-2 rounded-full bg-emerald-500/40" />
                  </div>
                  {/* Thanh địa chỉ */}
                  <div className="mx-auto flex max-w-[260px] flex-1 items-center gap-1.5 truncate rounded border border-zinc-800/60 bg-zinc-950 px-2 py-1 font-mono text-[9px] text-zinc-400">
                    <Shield className="size-2.5 text-emerald-500" />
                    <span className="text-emerald-500">https://</span>
                    steamcommunity.com/login
                  </div>
                  <span className="shrink-0 rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[8px] font-bold text-zinc-400 select-none">
                    {t('cookieGuide.stepPrefix')} {activeStep}
                  </span>
                </div>

                {/* Container nội dung mô phỏng với AnimatePresence */}
                <div className="relative flex min-h-0 flex-1 flex-col justify-between overflow-hidden bg-zinc-950/20 p-4">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeStep}
                      initial={{ opacity: 0, x: 15 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -15 }}
                      transition={{ duration: 0.22, ease: 'easeInOut' }}
                      className="flex flex-1 flex-col justify-between"
                    >
                      {/* Nội dung bước 1: trang đăng nhập */}
                      {activeStep === 1 && (
                        <div className="flex flex-1 flex-col items-center justify-center space-y-3 py-2 text-center">
                          <div className="relative w-full max-w-[220px] rounded-lg border border-zinc-800 bg-[#171a21] p-4 shadow-xl">
                            <div className="mb-3 font-mono text-[8px] font-bold tracking-widest text-zinc-500 uppercase">
                              {t('cookieGuide.steps.1.screenTitle')}
                            </div>

                            <div className="space-y-2 text-left">
                              <div className="flex h-6 items-center rounded border border-zinc-800 bg-zinc-900 px-2 font-mono text-[7.5px] text-zinc-500 select-none">
                                {t('cookieGuide.steps.1.usernamePlaceholder')}
                              </div>
                              <div className="flex h-6 items-center rounded border border-zinc-800 bg-zinc-900 px-2 font-mono text-[7.5px] text-zinc-500 select-none">
                                ••••••••••••
                              </div>
                            </div>

                            <div className="text-zinc-955 relative mt-3.5 flex h-7 w-full items-center justify-center rounded bg-gradient-to-r from-blue-500 to-sky-500 text-[8.5px] font-black tracking-wider uppercase shadow-[0_0_12px_rgba(59,130,246,0.15)]">
                              {t('cookieGuide.steps.1.btnText')}
                              {/* Chỉ báo nhấp nháy */}
                              <div className="absolute -right-1.5 -bottom-1.5 z-10 flex flex-col items-center">
                                <span className="absolute size-2.5 animate-ping rounded-full border border-white bg-blue-400/80" />
                                <svg
                                  className="relative size-3.5 translate-x-0.5 translate-y-0.5 fill-white stroke-zinc-950 stroke-2 text-zinc-950"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M4.5 2v17.5l5.2-5.2h6.8l-12-12.3z" />
                                </svg>
                              </div>
                            </div>
                          </div>
                          <p className="px-4 text-[9px] leading-relaxed font-semibold text-zinc-400">
                            {t('cookieGuide.steps.1.textHint')}
                          </p>
                        </div>
                      )}

                      {/* Nội dung bước 2: nhấn F12 */}
                      {activeStep === 2 && (
                        <div className="flex h-full flex-1 flex-col justify-between">
                          {/* Phần trên: Steam Web View */}
                          <div className="relative flex flex-1 flex-col items-center justify-center p-2 opacity-40">
                            <div className="w-full max-w-[160px] rounded border border-zinc-800/60 bg-[#171a21] p-2.5 text-center">
                              <span className="font-mono text-[8px] font-bold text-emerald-400">
                                {t('cookieGuide.steps.2.statusLogged')}
                              </span>
                            </div>

                            {/* Chỉ báo nhấn F12 */}
                            <div className="absolute top-1/2 left-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-xl border border-blue-500/25 bg-zinc-900/95 px-3.5 py-2 shadow-2xl">
                              <span className="animate-pulse rounded-lg border border-blue-500/30 bg-zinc-950 px-2.5 py-1 font-mono text-[10px] font-black text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                                F12
                              </span>
                              <span className="mt-0.5 text-[7.5px] font-bold tracking-wider text-zinc-400 uppercase">
                                {t('cookieGuide.steps.2.badgeText')}
                              </span>
                            </div>
                          </div>

                          {/* Phần dưới: panel DevTools chia đôi */}
                          <div className="flex h-[65px] flex-col overflow-hidden rounded-b border-t border-zinc-800/60 bg-[#161a23]">
                            <div className="flex items-center gap-3 border-b border-zinc-800/50 bg-[#11141c] px-2.5 py-1 font-mono text-[7px] text-zinc-500">
                              <span>Elements</span>
                              <span>Console</span>
                              <span className="border-b border-blue-500/80 pb-0.5 font-bold text-blue-400">
                                Application
                              </span>
                              <span>Network</span>
                            </div>
                            <div className="flex flex-1 gap-2.5 p-1.5 font-mono text-[6.5px] text-zinc-600">
                              <div className="w-1/3 space-y-0.5 border-r border-zinc-800/30 bg-[#131720] p-1">
                                <span className="font-bold text-zinc-500">Cookies</span>
                              </div>
                              <div className="flex flex-1 items-center justify-center text-zinc-500 italic">
                                {t('cookieGuide.steps.2.loadingStructure')}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Nội dung bước 3: chọn tab Cookies */}
                      {activeStep === 3 && (
                        <div className="flex h-full flex-1 flex-col overflow-hidden rounded border border-zinc-800 bg-[#161a23]">
                          <div className="flex items-center gap-3 border-b border-zinc-800/60 bg-[#11141c] px-2.5 py-1.5 font-mono text-[7.5px] text-zinc-500 select-none">
                            <span>Console</span>
                            <span className="border-b border-blue-500/80 pb-0.5 font-black text-blue-400">
                              Application
                            </span>
                            <span>Network</span>
                          </div>

                          <div className="flex flex-1 overflow-hidden font-mono text-[7.5px]">
                            {/* Sidebar */}
                            <div className="w-[115px] shrink-0 space-y-1.5 border-r border-[#11141c] bg-[#131720] p-2.5 text-zinc-500">
                              <div className="text-[6.5px] font-bold text-zinc-600 uppercase">
                                Storage
                              </div>
                              <div className="pl-1 text-zinc-600">Local Storage</div>
                              <div className="flex items-center gap-0.5 pl-1 font-bold text-zinc-400">
                                ▼ Cookies
                              </div>
                              <div className="ml-2 flex items-center justify-between rounded border border-blue-500/20 bg-blue-500/10 px-1 py-0.5 font-black text-blue-300">
                                <span>steamcommunity.com</span>
                                <span className="mr-0.5 size-1 animate-ping rounded-full bg-blue-400" />
                              </div>
                            </div>

                            {/* Chỉ báo workspace */}
                            <div className="flex flex-1 flex-col items-center justify-center bg-zinc-950/20 p-3 text-center">
                              <span className="text-[8px] font-black text-zinc-300">
                                {t('cookieGuide.steps.3.selectCookies')}
                              </span>
                              <span className="mt-1.5 max-w-[150px] text-[6.5px] leading-relaxed text-zinc-600">
                                {t('cookieGuide.steps.3.selectCookiesDesc')}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Nội dung bước 4: copy dòng steamLoginSecure */}
                      {activeStep === 4 && (
                        <div className="flex h-full flex-1 flex-col overflow-hidden rounded border border-zinc-800 bg-[#161a23]">
                          <div className="justify-between border-b border-zinc-800/60 bg-[#11141c] px-2.5 py-1.5 font-mono text-[7.5px] text-zinc-500 select-none">
                            <span>Application / Cookies / steamcommunity.com</span>
                          </div>

                          <div className="flex flex-1 flex-col font-mono text-[7px]">
                            <div className="grid grid-cols-12 border-b border-zinc-800/80 bg-[#1e2330] px-2.5 py-1 font-bold text-zinc-400">
                              <div className="col-span-4">Name</div>
                              <div className="col-span-8">Value</div>
                            </div>
                            <div className="flex-1 divide-y divide-[#1b2230]/40 overflow-y-auto">
                              <div className="grid grid-cols-12 px-2.5 py-1.5 text-zinc-500">
                                <div className="col-span-4">sessionid</div>
                                <div className="col-span-8 truncate">f5ea081395f190e21da90a42</div>
                              </div>

                              {/* Dòng bảo mật active được highlight */}
                              <div className="relative grid grid-cols-12 border-y border-blue-500/20 bg-blue-500/10 px-2.5 py-2 font-bold text-blue-200">
                                <div className="col-span-4 self-center text-blue-300">
                                  steamLoginSecure
                                </div>
                                <div className="col-span-8 flex max-w-[150px] shrink-0 items-center justify-between truncate rounded border border-blue-500/40 bg-blue-500/20 px-1.5 py-0.5 text-[6.5px] text-blue-100 select-all">
                                  <span>7656119899...</span>
                                  <span className="shrink-0 rounded bg-blue-500 px-1.5 py-0.5 text-[5.5px] leading-none font-black text-zinc-950 uppercase shadow-[0_0_8px_rgba(59,130,246,0.3)]">
                                    {t('cookieGuide.copied')}
                                  </span>
                                </div>

                                {/* Con trỏ pointer */}
                                <div className="absolute top-0 right-4 bottom-0 flex items-center justify-center">
                                  <svg
                                    className="size-3.5 animate-bounce fill-white stroke-zinc-950 stroke-2 text-zinc-950"
                                    viewBox="0 0 24 24"
                                  >
                                    <path d="M4.5 2v17.5l5.2-5.2h6.8l-12-12.3z" />
                                  </svg>
                                </div>
                              </div>

                              <div className="grid grid-cols-12 px-2.5 py-1.5 text-zinc-500">
                                <div className="col-span-4">steamCountry</div>
                                <div className="col-span-8 truncate">VN%7Cc83f443b7e7a898f</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Chân đế màn hình */}
            <div className="relative z-10 mx-auto -mt-1.5 h-3.5 w-18 shrink-0 border-x border-zinc-700 bg-zinc-800" />
            <div className="relative z-10 mx-auto h-2.5 w-36 shrink-0 rounded-t-lg bg-zinc-700 shadow-lg" />
          </div>

          {/* Cột phải: cấu trúc timeline cao cấp (chiếm 5 cột) */}
          <div className="flex h-full min-h-[460px] flex-col justify-between pl-2 lg:col-span-5">
            {/* Khu vực phần đầu */}
            <div className="mb-6">
              <DialogTitle className="text-foreground font-sans text-2xl font-black tracking-wide uppercase">
                {t('cookieGuide.title')}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {t('cookieGuide.description')}
              </DialogDescription>
              <div className="mt-2 h-1.5 w-14 rounded-full bg-gradient-to-r from-blue-500 to-sky-400" />
            </div>

            {/* Wrapper các bước timeline */}
            <div className="relative flex-1 space-y-4 pl-4">
              {/* Đường dọc mảnh nối các bước */}
              <div className="bg-border absolute top-[22px] bottom-[22px] left-[31px] z-0 w-0.5" />

              {/* Overlay đường nối active tăng theo activeStep */}
              <motion.div
                className="absolute left-[31px] z-0 w-0.5 bg-gradient-to-b from-blue-500 to-sky-400"
                initial={{ height: 0 }}
                animate={{ height: `calc((100% - 44px) * ${(activeStep - 1) / 3})` }}
                transition={{ type: 'spring', stiffness: 80, damping: 15 }}
                style={{
                  top: '22px',
                }}
              />

              {steps.map((step) => {
                const isActiveOrCompleted = step.id <= activeStep;
                const isActive = activeStep === step.id;

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStep(step.id)}
                    className="group relative z-10 flex w-full cursor-pointer items-start gap-4 border-none bg-transparent p-0 text-left transition-all duration-300"
                  >
                    {/* Circle Node */}
                    <div className="flex size-9 shrink-0 items-center justify-center pt-1 select-none">
                      {isActiveOrCompleted ? (
                        /* Cấu trúc vòng tròn active/hoàn tất (xanh đặc) */
                        <div className="relative flex size-9 items-center justify-center select-none">
                          {isActive && (
                            <span className="absolute size-9 animate-ping rounded-full bg-blue-500/20 duration-1000" />
                          )}
                          <div className="text-zinc-955 relative flex size-8 items-center justify-center rounded-full bg-blue-500 text-xs font-black shadow-[0_0_15px_rgba(59,130,246,0.35)] transition-all duration-300">
                            {step.id}
                          </div>
                        </div>
                      ) : (
                        /* Cấu trúc vòng tròn chưa active */
                        <div className="border-border bg-card text-muted-foreground group-hover:border-muted-foreground/30 group-hover:text-foreground flex size-7 items-center justify-center rounded-full border font-mono text-xs font-bold transition-all duration-300">
                          {step.id}
                        </div>
                      )}
                    </div>

                    {/* Step Details Card */}
                    <div
                      className={`flex-1 rounded-xl border p-3.5 transition-all duration-300 ${
                        isActive
                          ? 'border-blue-500/25 bg-blue-500/[0.04] shadow-sm dark:border-blue-500/20 dark:bg-blue-500/[0.02] dark:shadow-[0_4px_20px_rgba(59,130,246,0.03)]'
                          : isActiveOrCompleted
                            ? 'border-blue-500/15 bg-blue-500/[0.01] dark:border-blue-500/10 dark:bg-blue-500/[0.005]'
                            : 'hover:border-border border-transparent bg-transparent hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                      }`}
                    >
                      <h3
                        className={`text-sm font-extrabold tracking-wide uppercase transition-colors ${
                          isActiveOrCompleted
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-muted-foreground group-hover:text-foreground'
                        }`}
                      >
                        {step.title}
                      </h3>

                      <p
                        className={`mt-1 text-xs leading-relaxed transition-colors ${
                          isActiveOrCompleted
                            ? 'text-foreground/80 font-medium dark:text-zinc-200'
                            : 'text-muted-foreground/75 group-hover:text-muted-foreground'
                        }`}
                      >
                        {step.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Safety disclaimer banner */}
        <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4 backdrop-blur-md dark:bg-amber-500/[0.02]">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-500">
              <Shield className="h-4.5 w-4.5" />
            </div>
            <div>
              <h5 className="text-xs font-bold tracking-wide text-amber-700 uppercase dark:text-amber-500">
                {t('cookieGuide.securityTitle')}
              </h5>
              <p className="mt-1 text-[11px] leading-relaxed font-medium text-amber-800/90 dark:text-amber-500/80">
                {t('cookieGuide.securityDesc')}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
