"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  Clock,
  User,
  Eye,
  RefreshCw,
  AlertCircle,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/stores/toast-store";

interface BugReport {
  id: string;
  description: string;
  imageUrl: string | null;
  imageUrls?: string[];
  user: {
    id: string;
    email: string;
    name: string;
  } | null;
  createdAt: string;
  status?: string;
}

export function AdminBugReportsClient() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"unresolved" | "resolved">("unresolved");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Poll for realtime updates every 5 seconds
  const { data: reports = [], isLoading, isFetching, error } = useQuery<BugReport[]>({
    queryKey: ["bug-reports", activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/bug-report${activeTab === "resolved" ? "?all=true" : ""}`);
      if (!res.ok) {
        throw new Error("Không thể tải danh sách báo cáo lỗi.");
      }
      const data = await res.json();
      
      // If activeTab is "resolved", show resolved reports, otherwise show unresolved (no status or status !== resolved)
      if (activeTab === "resolved") {
        return (data as BugReport[]).filter((r: BugReport) => r.status === "resolved");
      }
      return data as BugReport[];
    },
    refetchInterval: 5000, // 5s polling
  });

  // Mutation to update report status (e.g. resolve it)
  const resolveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch("/api/bug-report", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Không thể cập nhật trạng thái báo cáo lỗi.");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(
        activeTab === "unresolved" 
          ? "Đã đánh dấu báo cáo lỗi là Đã giải quyết!" 
          : "Đã khôi phục báo cáo lỗi về trạng thái Chưa giải quyết!"
      );
      queryClient.invalidateQueries({ queryKey: ["bug-reports"] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Đã xảy ra lỗi.";
      toast.error(message);
    },
  });

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <main className="min-h-screen pb-16">
      {/* Banner / Header */}
      <section className="relative min-h-[12rem] overflow-hidden border-b border-stone-800">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: "url('/assets/dashboard-banner.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0e0f0f] via-[#0e0f0f]/84 to-[#0e0f0f]/20" />
        <div className="relative mx-auto flex max-w-7xl flex-col justify-end px-4 pt-12 pb-6 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold tracking-[0.18em] text-blue-300 uppercase flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
              </span>
              Trang quản trị Admin
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-stone-50 sm:text-4xl">
              Quản lý Báo cáo Lỗi
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-300">
              Xem và xử lý các phản hồi, báo cáo lỗi từ người dùng CS2 Tracker theo thời gian thực (tự động cập nhật mỗi 5 giây).
            </p>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Tabs */}
          <div className="flex gap-2 rounded-lg border border-stone-800 bg-stone-900/50 p-1">
            <button
              onClick={() => setActiveTab("unresolved")}
              className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "unresolved"
                  ? "bg-accent text-accent-foreground"
                  : "text-stone-400 hover:text-stone-200"
              }`}
            >
              <AlertCircle className="size-3.5" />
              Chưa giải quyết
            </button>
            <button
              onClick={() => setActiveTab("resolved")}
              className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "resolved"
                  ? "bg-accent text-accent-foreground"
                  : "text-stone-400 hover:text-stone-200"
              }`}
            >
              <CheckCircle className="size-3.5" />
              Đã giải quyết
            </button>
          </div>

          {/* Realtime Status Indicator */}
          <div className="flex items-center gap-2 text-xs text-stone-400">
            {isFetching && !isLoading && (
              <RefreshCw className="size-3 animate-spin text-blue-300" />
            )}
            <span>Tự động cập nhật sau mỗi 5s</span>
          </div>
        </div>

        {/* Loading / Error States */}
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <RefreshCw className="size-8 animate-spin text-stone-500" />
          </div>
        ) : error ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-950/20 p-6 text-center">
            <AlertCircle className="size-8 text-red-400" />
            <h3 className="font-semibold text-red-200">Lỗi tải dữ liệu</h3>
            <p className="text-xs text-red-300">{(error as Error).message}</p>
          </div>
        ) : reports.length === 0 ? (
          /* Empty State */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex h-80 flex-col items-center justify-center gap-4 rounded-xl border border-stone-850 bg-stone-950/20 p-8 text-center"
          >
            <div className="rounded-full bg-emerald-500/10 p-4">
              <Check className="size-8 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-stone-200">
                {activeTab === "unresolved"
                  ? "Tuyệt vời! Không còn báo cáo lỗi chưa giải quyết."
                  : "Chưa có báo cáo lỗi nào được đánh dấu giải quyết."}
              </h3>
              <p className="mt-1 text-xs text-stone-400 max-w-sm mx-auto">
                {activeTab === "unresolved"
                  ? "Tất cả các lỗi hệ thống đều đã được xử lý xong xuôi."
                  : "Các báo cáo lỗi sau khi hoàn thành sẽ xuất hiện tại đây."}
              </p>
            </div>
          </motion.div>
        ) : (
          /* Reports Grid */
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {reports.map((report) => (
                <motion.div
                  key={report.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="flex h-full flex-col overflow-hidden border border-stone-800 bg-stone-900/40 transition-all duration-300 hover:border-stone-700/60">
                    {/* Header */}
                    <div className="border-b border-stone-800 bg-stone-950/20 px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="rounded-full bg-stone-850 p-2 text-stone-400">
                            <User className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="truncate text-xs font-bold text-stone-200">
                              {report.user ? report.user.name : "Khách ẩn danh"}
                            </h4>
                            <p className="truncate text-[10px] text-stone-400">
                              {report.user ? report.user.email : "Không có email"}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className="inline-flex items-center gap-1 text-[10px] text-stone-400">
                            <Clock className="size-3" />
                            {formatDate(report.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 px-5 py-4 space-y-4">
                      <p className="text-xs text-stone-200 whitespace-pre-wrap leading-relaxed">
                        {report.description}
                      </p>

                      {/* Image Attachment */}
                      {report.imageUrls && report.imageUrls.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                          {report.imageUrls.map((url, idx) => (
                            <div 
                              key={idx}
                              onClick={() => setSelectedImage(url)}
                              className="group relative cursor-pointer overflow-hidden rounded-xl border border-stone-850 bg-[#07090d] p-1.5 flex items-center justify-center h-32 transition-all hover:border-stone-700 hover:shadow-lg"
                            >
                              <img
                                src={url}
                                alt={`Bug report screenshot ${idx + 1}`}
                                className="h-full w-full object-contain rounded-lg transition-transform duration-300 group-hover:scale-[1.02]"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-stone-950/50 opacity-0 transition-opacity group-hover:opacity-100">
                                <span className="flex items-center gap-1.5 rounded-full bg-stone-900/90 px-3 py-1.5 text-[10px] font-semibold text-stone-200 shadow-md shadow-black/40">
                                  <Eye className="size-3.5" /> Phóng to
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        report.imageUrl && (
                          <div 
                            onClick={() => setSelectedImage(report.imageUrl)}
                            className="group relative cursor-pointer overflow-hidden rounded-xl border border-stone-850 bg-[#07090d] p-1.5 flex items-center justify-center h-48 transition-all hover:border-stone-700 hover:shadow-lg"
                          >
                            <img
                              src={report.imageUrl}
                              alt="Bug report screenshot"
                              className="h-full w-full object-contain rounded-lg transition-transform duration-300 group-hover:scale-[1.02]"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-stone-950/50 opacity-0 transition-opacity group-hover:opacity-100">
                              <span className="flex items-center gap-1.5 rounded-full bg-stone-900/90 px-3 py-1.5 text-[10px] font-semibold text-stone-200 shadow-md shadow-black/40">
                                <Eye className="size-3.5" /> Phóng to ảnh
                              </span>
                            </div>
                          </div>
                        )
                      )}
                    </div>

                    {/* Footer / Actions */}
                    <div className="border-t border-stone-800 bg-stone-950/10 px-5 py-3.5 flex items-center justify-between">
                      <div className="text-[10px] text-stone-400">
                        ID: <span className="font-mono">{report.id}</span>
                      </div>
                      
                      {activeTab === "unresolved" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={resolveMutation.isPending}
                          onClick={() => resolveMutation.mutate({ id: report.id, status: "resolved" })}
                          className="h-8 px-3.5 text-xs font-semibold border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-500/10 transition-all"
                        >
                          {resolveMutation.isPending && resolveMutation.variables?.id === report.id ? (
                            <RefreshCw className="size-3.5 animate-spin" />
                          ) : (
                            <Check className="size-3.5" />
                          )}
                          Đã giải quyết
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={resolveMutation.isPending}
                          onClick={() => resolveMutation.mutate({ id: report.id, status: "pending" })}
                          className="h-8 px-3.5 text-xs font-semibold border-stone-750 bg-stone-850 hover:border-stone-700 text-stone-300 transition-all"
                        >
                          {resolveMutation.isPending && resolveMutation.variables?.id === report.id ? (
                            <RefreshCw className="size-3.5 animate-spin" />
                          ) : (
                            <Clock className="size-3.5" />
                          )}
                          Mở lại lỗi
                        </Button>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* Lightbox Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-2 border-stone-800 bg-stone-950">
          <DialogHeader className="sr-only">
            <DialogTitle>Ảnh chụp màn hình lỗi</DialogTitle>
            <DialogDescription>Chi tiết hình ảnh đính kèm lỗi</DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[80vh] items-center justify-center overflow-hidden rounded-lg">
            {selectedImage && (
              <img
                src={selectedImage}
                alt="Bug report screenshot full view"
                className="max-h-full max-w-full object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
