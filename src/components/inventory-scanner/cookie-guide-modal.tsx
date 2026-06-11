"use client";

import React, { useState } from "react";
import { Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface CookieGuideModalProps {
  open: boolean;
  onClose: () => void;
}

export function CookieGuideModal({ open, onClose }: CookieGuideModalProps) {
  const [activeStep, setActiveStep] = useState<number>(1);

  const steps = [
    {
      id: 1,
      title: "Đăng nhập Steam trên Trình duyệt",
      desc: "Truy cập steamcommunity.com trên trình duyệt máy tính của bạn và tiến hành đăng nhập tài khoản Steam.",
      tip: "Đảm bảo bạn đăng nhập trên trình duyệt Web (Chrome, Edge, Cốc Cốc...), không phải ứng dụng Steam PC.",
      screenTitle: "Steam Community Login",
    },
    {
      id: 2,
      title: "Mở Developer Tools (F12)",
      desc: "Nhấn phím F12 trên bàn phím (hoặc click chuột phải vào trang web chọn 'Kiểm tra' / 'Inspect') để mở bảng công cụ.",
      tip: "Bảng DevTools sẽ hiện ra ở phía dưới hoặc bên phải màn hình trình duyệt của bạn.",
      screenTitle: "Inspect Element (F12)",
    },
    {
      id: 3,
      title: "Tìm đến danh sách Cookies",
      desc: "Chọn tab 'Application' ở thanh menu trên cùng, sau đó mở rộng mục 'Cookies' ở danh sách bên trái và click chọn 'https://steamcommunity.com'.",
      tip: "Trên trình duyệt Firefox hoặc một số phiên bản, tab này có thể tên là 'Storage'.",
      screenTitle: "DevTools > Application",
    },
    {
      id: 4,
      title: "Sao chép steamLoginSecure",
      desc: "Tại bảng dữ liệu hiển thị, tìm dòng có cột Name là 'steamLoginSecure'. Click đúp vào ô Value tương ứng và sao chép (Ctrl + C) toàn bộ mã.",
      tip: "Mã cookie này rất dài và bắt đầu bằng SteamID của bạn. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.",
      screenTitle: "Copy steamLoginSecure",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="border-stone-850 flex max-h-[95vh] max-w-5xl flex-col overflow-hidden rounded-2xl bg-[#06080c]/98 p-6 text-stone-100 shadow-[0_30px_90px_rgba(0,0,0,0.95)] backdrop-blur-3xl">
        <div className="grid flex-1 grid-cols-1 items-center gap-8 overflow-y-auto pr-1 lg:grid-cols-12">
          {/* Left Column: Premium PC Monitor Mockup (takes 7 columns) */}
          <div className="relative flex flex-col items-center justify-center p-2 select-none lg:col-span-7">
            {/* Ambient background glow */}
            <div className="pointer-events-none absolute top-1/2 left-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-[100px]" />

            {/* High-Fidelity Monitor Frame */}
            <div className="relative flex aspect-[16/10] w-full max-w-[540px] flex-col justify-between overflow-hidden rounded-xl border-4 border-stone-800 bg-[#030508] p-1.5 shadow-2xl ring-8 ring-stone-900/30 transition-transform duration-300 hover:scale-[1.01]">
              
              {/* Screen Glare reflection line */}
              <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-tr from-transparent via-white/[0.01] to-white/[0.03]" />

              {/* Screen Bezel Notch / Camera */}
              <div className="absolute top-0.5 left-1/2 z-30 flex -translate-x-1/2 items-center justify-center">
                <span className="size-1 rounded-full bg-stone-900" />
              </div>

              {/* Simulated Screen Content Container */}
              <div className="border-stone-850 relative flex flex-1 flex-col justify-between overflow-hidden rounded-lg border bg-[#0c0e12]">
                {/* PC Browser Header */}
                <div className="border-stone-850/80 flex items-center justify-between border-b bg-[#12161f] px-3 py-2 select-none">
                  {/* Circle Dots */}
                  <div className="flex shrink-0 gap-1.5">
                    <span className="size-2 rounded-full bg-red-500/40" />
                    <span className="size-2 rounded-full bg-yellow-500/40" />
                    <span className="size-2 rounded-full bg-emerald-500/40" />
                  </div>
                  {/* Address bar */}
                  <div className="border-stone-850 mx-auto flex max-w-[260px] flex-1 items-center gap-1.5 truncate rounded border bg-stone-950 px-2 py-1 font-mono text-[9px] text-stone-400">
                    <Shield className="size-2.5 text-emerald-500" />
                    <span className="text-emerald-500">https://</span>
                    steamcommunity.com/login
                  </div>
                  <span className="shrink-0 rounded bg-stone-800/80 px-1.5 py-0.5 font-mono text-[8px] font-bold text-stone-400 select-none">
                    Bước {activeStep}
                  </span>
                </div>

                {/* Simulated Content container with AnimatePresence */}
                <div className="relative flex min-h-0 flex-1 flex-col justify-between bg-stone-950/20 p-4 overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeStep}
                      initial={{ opacity: 0, x: 15 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -15 }}
                      transition={{ duration: 0.22, ease: "easeInOut" }}
                      className="flex flex-1 flex-col justify-between"
                    >
                      {/* Step 1 Content: Login Page */}
                      {activeStep === 1 && (
                        <div className="flex flex-1 flex-col items-center justify-center space-y-3 py-2 text-center">
                          <div className="relative w-full max-w-[220px] rounded-lg border border-stone-855 bg-[#171a21] p-4 shadow-xl">
                            <div className="mb-3 font-mono text-[8px] font-bold tracking-widest text-stone-500 uppercase">
                              Đăng nhập Steam
                            </div>

                            <div className="space-y-2 text-left">
                              <div className="border-stone-800 flex h-6 items-center rounded border bg-stone-900 px-2 font-mono text-[7.5px] text-stone-500 select-none">
                                Tên tài khoản
                              </div>
                              <div className="border-stone-800 flex h-6 items-center rounded border bg-stone-900 px-2 font-mono text-[7.5px] text-stone-500 select-none">
                                ••••••••••••
                              </div>
                            </div>

                            <div className="relative mt-3.5 flex h-7 w-full items-center justify-center rounded bg-gradient-to-r from-blue-500 to-sky-500 text-[8.5px] font-black tracking-wider text-stone-950 uppercase shadow-[0_0_12px_rgba(59,130,246,0.15)]">
                              Đăng Nhập
                              {/* Pulsing indicator */}
                              <div className="absolute -right-1.5 -bottom-1.5 flex flex-col items-center z-10">
                                <span className="absolute size-2.5 animate-ping rounded-full border border-white bg-blue-400/80" />
                                <svg
                                  className="relative size-3.5 translate-x-0.5 translate-y-0.5 fill-white stroke-stone-950 stroke-2 text-stone-950"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M4.5 2v17.5l5.2-5.2h6.8l-12-12.3z" />
                                </svg>
                              </div>
                            </div>
                          </div>
                          <p className="px-4 text-[9px] leading-relaxed font-semibold text-stone-400">
                            Nhập tài khoản Steam trên phiên bản Web để trình duyệt
                            tạo Cookie lưu phiên làm việc.
                          </p>
                        </div>
                      )}

                      {/* Step 2 Content: Press F12 */}
                      {activeStep === 2 && (
                        <div className="flex h-full flex-1 flex-col justify-between">
                          {/* Top: Steam Web View */}
                          <div className="relative flex flex-1 flex-col items-center justify-center p-2 opacity-40">
                            <div className="border-stone-850 w-full max-w-[160px] rounded border bg-[#171a21] p-2.5 text-center">
                              <span className="font-mono text-[8px] font-bold text-emerald-400">
                                ✓ Đã đăng nhập
                              </span>
                            </div>

                            {/* Press F12 indicator */}
                            <div className="absolute top-1/2 left-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-xl border border-blue-500/25 bg-stone-900/95 px-3.5 py-2 shadow-2xl">
                              <span className="animate-pulse rounded-lg border border-blue-500/30 bg-stone-950 px-2.5 py-1 font-mono text-[10px] font-black text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                                F12
                              </span>
                              <span className="text-[7.5px] font-bold tracking-wider text-stone-400 uppercase mt-0.5">
                                Nhấn phím F12
                              </span>
                            </div>
                          </div>

                          {/* Bottom: DevTools panel split */}
                          <div className="border-stone-850 flex h-[65px] flex-col overflow-hidden rounded-b border-t bg-[#161a23]">
                            <div className="border-stone-850/50 flex items-center gap-3 border-b bg-[#11141c] px-2.5 py-1 font-mono text-[7px] text-stone-500">
                              <span>Elements</span>
                              <span>Console</span>
                              <span className="border-b border-blue-500/80 font-bold text-blue-400 pb-0.5">
                                Application
                              </span>
                              <span>Network</span>
                            </div>
                            <div className="flex flex-1 gap-2.5 p-1.5 font-mono text-[6.5px] text-stone-600">
                              <div className="border-stone-850/30 w-1/3 space-y-0.5 border-r bg-[#131720] p-1">
                                <span className="font-bold text-stone-500">Cookies</span>
                              </div>
                              <div className="flex flex-1 items-center justify-center text-stone-500 italic">
                                Đang tải cấu trúc dữ liệu...
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Step 3 Content: Select Cookies Tab */}
                      {activeStep === 3 && (
                        <div className="flex h-full flex-1 flex-col overflow-hidden rounded border border-stone-800 bg-[#161a23]">
                          <div className="border-stone-850/60 flex items-center gap-3 border-b bg-[#11141c] px-2.5 py-1.5 font-mono text-[7.5px] text-stone-500 select-none">
                            <span>Console</span>
                            <span className="border-b border-blue-500/80 font-black text-blue-400 pb-0.5">
                              Application
                            </span>
                            <span>Network</span>
                          </div>

                          <div className="flex flex-1 overflow-hidden font-mono text-[7.5px]">
                            {/* Sidebar */}
                            <div className="w-[115px] shrink-0 space-y-1.5 border-r border-[#11141c] bg-[#131720] p-2.5 text-stone-500">
                              <div className="text-[6.5px] font-bold text-stone-600 uppercase">
                                Storage
                              </div>
                              <div className="pl-1 text-stone-600">Local Storage</div>
                              <div className="flex items-center gap-0.5 pl-1 font-bold text-stone-400">
                                ▼ Cookies
                              </div>
                              <div className="ml-2 flex items-center justify-between rounded border border-blue-500/20 bg-blue-500/10 px-1 py-0.5 font-black text-blue-300">
                                <span>steamcommunity.com</span>
                                <span className="mr-0.5 size-1 rounded-full bg-blue-400 animate-ping" />
                              </div>
                            </div>

                            {/* Workspace indicator */}
                            <div className="flex flex-1 flex-col items-center justify-center bg-stone-950/20 p-3 text-center">
                              <span className="text-[8px] font-black text-stone-300">
                                Chọn Cookies {"->"} steamcommunity.com
                              </span>
                              <span className="mt-1.5 text-[6.5px] text-stone-600 leading-relaxed max-w-[150px]">
                                Để mở rộng danh sách cookie và tìm steamLoginSecure
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Step 4 Content: Copy steamLoginSecure Row */}
                      {activeStep === 4 && (
                        <div className="flex h-full flex-1 flex-col overflow-hidden rounded border border-stone-800 bg-[#161a23]">
                          <div className="border-stone-850/60 justify-between border-b bg-[#11141c] px-2.5 py-1.5 font-mono text-[7.5px] text-stone-500 select-none">
                            <span>Application / Cookies / steamcommunity.com</span>
                          </div>

                          <div className="flex flex-1 flex-col font-mono text-[7px]">
                            <div className="border-stone-850/80 grid grid-cols-12 border-b bg-stone-900 px-2.5 py-1 font-bold text-stone-600">
                              <div className="col-span-4">Name</div>
                              <div className="col-span-8">Value</div>
                            </div>
                            <div className="divide-stone-850/40 flex-1 divide-y overflow-y-auto">
                              <div className="grid grid-cols-12 px-2.5 py-1.5 text-stone-500">
                                <div className="col-span-4">sessionid</div>
                                <div className="col-span-8 truncate">
                                  f5ea081395f190e21da90a42
                                </div>
                              </div>

                              {/* Active secure row highlighted */}
                              <div className="relative grid grid-cols-12 border-y border-blue-500/20 bg-blue-500/10 px-2.5 py-2 font-bold text-blue-200">
                                <div className="col-span-4 text-blue-300 self-center">
                                  steamLoginSecure
                                </div>
                                <div className="col-span-8 flex max-w-[150px] shrink-0 items-center justify-between truncate rounded border border-blue-500/40 bg-blue-500/20 px-1.5 py-0.5 text-[6.5px] text-blue-100 select-all">
                                  <span>7656119899...</span>
                                  <span className="shrink-0 rounded bg-blue-500 px-1.5 py-0.5 text-[5.5px] leading-none font-black text-stone-950 uppercase shadow-[0_0_8px_rgba(59,130,246,0.3)]">
                                    copied
                                  </span>
                                </div>

                                {/* Pointer cursor */}
                                <div className="absolute top-0 right-4 bottom-0 flex items-center justify-center">
                                  <svg
                                    className="size-3.5 fill-white stroke-stone-950 stroke-2 text-stone-950 animate-bounce"
                                    viewBox="0 0 24 24"
                                  >
                                    <path d="M4.5 2v17.5l5.2-5.2h6.8l-12-12.3z" />
                                  </svg>
                                </div>
                              </div>

                              <div className="grid grid-cols-12 px-2.5 py-1.5 text-stone-500">
                                <div className="col-span-4">steamCountry</div>
                                <div className="col-span-8 truncate">
                                  VN%7Cc83f443b7e7a898f
                                </div>
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

            {/* Monitor Stand Base */}
            <div className="bg-stone-800 relative z-10 mx-auto -mt-1.5 h-3.5 w-18 shrink-0 border-x border-stone-750" />
            <div className="relative z-10 mx-auto h-2.5 w-36 shrink-0 rounded-t-lg bg-stone-750 shadow-lg" />
          </div>

          {/* Right Column: Premium Timeline Structure (takes 5 columns) */}
          <div className="flex h-full min-h-[460px] flex-col justify-between pl-2 lg:col-span-5">
            {/* Header section */}
            <div className="mb-6">
              <DialogTitle className="font-sans text-2xl font-black tracking-wide text-stone-100 uppercase">
                Hướng dẫn tìm cookies
              </DialogTitle>
              <DialogDescription className="sr-only">
                Hướng dẫn từng bước cách tìm và sao chép cookie steamLoginSecure từ trình duyệt web.
              </DialogDescription>
              <div className="mt-2 h-1.5 w-14 rounded-full bg-gradient-to-r from-blue-500 to-sky-400" />
            </div>

            {/* Timeline Steps wrapper */}
            <div className="relative flex-1 space-y-4 pl-4">
              
              {/* Thin Vertical Line connecting steps */}
              <div className="absolute top-[22px] bottom-[22px] left-[31px] z-0 w-0.5 bg-stone-850" />

              {/* Active connecting line overlay that grows based on activeStep */}
              <motion.div
                className="absolute left-[31px] z-0 w-0.5 bg-gradient-to-b from-blue-500 to-sky-400"
                initial={{ height: 0 }}
                animate={{ height: `calc((100% - 44px) * ${(activeStep - 1) / 3})` }}
                transition={{ type: "spring", stiffness: 80, damping: 15 }}
                style={{
                  top: "22px"
                }}
              />

              {steps.map((step) => {
                const isActiveOrCompleted = step.id <= activeStep;
                const isActive = activeStep === step.id;

                return (
                  <div
                    key={step.id}
                    onClick={() => setActiveStep(step.id)}
                    className="group relative z-10 flex cursor-pointer items-start gap-4 transition-all duration-300"
                  >
                    {/* Circle Node */}
                    <div className="flex size-9 shrink-0 items-center justify-center select-none pt-1">
                      {isActiveOrCompleted ? (
                        /* Active/Completed circle structure (solid blue) */
                        <div className="relative flex size-9 items-center justify-center select-none">
                          {isActive && (
                            <span className="absolute size-9 rounded-full bg-blue-500/20 animate-ping duration-1000" />
                          )}
                          <div className="relative flex size-8 items-center justify-center rounded-full bg-blue-500 text-xs font-black text-stone-950 shadow-[0_0_15px_rgba(59,130,246,0.35)] transition-all duration-300">
                            {step.id}
                          </div>
                        </div>
                      ) : (
                        /* Inactive circle structure */
                        <div className="flex size-7 items-center justify-center rounded-full border border-stone-800 bg-stone-950 font-mono text-xs font-bold text-stone-500 transition-all duration-300 group-hover:border-stone-700 group-hover:text-stone-300">
                          {step.id}
                        </div>
                      )}
                    </div>

                    {/* Step Details Card */}
                    <div
                      className={`flex-1 rounded-xl border p-3.5 transition-all duration-300 ${
                        isActiveOrCompleted
                          ? "border-blue-500/20 bg-blue-500/[0.02] shadow-[0_4px_20px_rgba(59,130,246,0.03)]"
                          : "border-transparent bg-transparent hover:border-stone-850/40 hover:bg-stone-900/10"
                      }`}
                    >
                      <h3
                        className={`text-sm font-extrabold tracking-wide uppercase transition-colors ${
                          isActiveOrCompleted
                            ? "text-blue-400"
                            : "text-stone-300 group-hover:text-stone-200"
                        }`}
                      >
                        {step.title}
                      </h3>

                      <p
                        className={`mt-1 text-xs leading-relaxed transition-colors ${
                          isActiveOrCompleted
                            ? "font-medium text-stone-200"
                            : "text-stone-500 group-hover:text-stone-400"
                        }`}
                      >
                        {step.desc}
                      </p>

                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Safety disclaimer banner */}
        <div className="mt-6 rounded-xl border border-amber-500/10 bg-amber-500/[0.02] p-4 backdrop-blur-md">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10">
              <Shield className="h-4.5 w-4.5 text-amber-500" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-amber-500 uppercase tracking-wide">Cam kết bảo mật</h5>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-600/90 font-medium">
                Mã cookie này chỉ dùng để truy xuất danh mục vật phẩm công khai trên Steam của bạn. Hệ thống hoàn toàn không lưu trữ mã này trên máy chủ và không chia sẻ với bất kỳ bên thứ ba nào dưới bất kỳ hình thức nào.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
