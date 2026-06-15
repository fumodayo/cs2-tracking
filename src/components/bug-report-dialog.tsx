"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Upload, X, Loader2, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast, toastStore } from "@/stores/toast-store";

interface BugReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BugReportDialog({ open, onOpenChange }: BugReportDialogProps) {
  const { t } = useTranslation();
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<Array<{ base64: string; mimeType: string }>>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setDescription("");
    setImages([]);
    setIsDragActive(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
    resetForm();
  };

  const processFiles = (files: File[]) => {
    const validFiles = files.filter((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`File "${file.name}" không phải là ảnh.`, {
          description: "Vui lòng chọn các file ảnh (PNG, JPG, WebP...).",
        });
        return false;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error(`Ảnh "${file.name}" quá lớn.`, {
          description: "Dung lượng mỗi ảnh không được vượt quá 5MB.",
        });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    let loadedCount = 0;
    const newImages: Array<{ base64: string; mimeType: string }> = [];

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        newImages.push({ base64, mimeType: file.type });
        loadedCount++;

        if (loadedCount === validFiles.length) {
          setImages((prev) => [...prev, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error(t("bugReport.descRequired"));
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(t("bugReport.submitting"));

    try {
      const response = await fetch("/api/bug-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description,
          images, // array of { base64, mimeType }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || t("bugReport.error"));
      }

      toastStore.update(toastId, {
        type: "success",
        title: t("bugReport.success"),
        duration: 4000,
      });

      onOpenChange(false);
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("bugReport.error");
      toastStore.update(toastId, {
        type: "error",
        title: t("bugReport.error"),
        description: message,
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg border-border bg-[#0c0f17]/98 text-stone-100 shadow-[0_25px_70px_rgba(0,0,0,0.9)] backdrop-blur-3xl sm:rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-stone-100 text-lg font-bold">{t("bugReport.title")}</DialogTitle>
            <DialogDescription className="text-stone-400 text-xs mt-1.5">{t("bugReport.desc")}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-450">
                {t("bugReport.descriptionLabel")} <span className="text-red-500">*</span>
              </label>
              <Textarea
                required
                rows={4}
                placeholder={t("bugReport.descriptionPlaceholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                className="resize-none border-stone-800 bg-stone-950/40 text-stone-200 placeholder:text-stone-600 focus:border-accent text-sm rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-stone-450">
                  {t("bugReport.imageLabel")}
                </label>
                {images.length > 0 && (
                  <button
                    type="button"
                    onClick={triggerFileInput}
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                  >
                    <Upload className="size-3.5" />
                    Thêm ảnh
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
                disabled={isSubmitting}
              />

              {images.length === 0 ? (
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={triggerFileInput}
                  className={`flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all duration-200 ${isDragActive
                    ? "border-accent bg-accent/10"
                    : "border-stone-800 bg-stone-950/30 hover:border-accent hover:bg-stone-900/10"
                    }`}
                >
                  <Upload className="size-6 text-stone-500" />
                  <span className="mt-2 text-xs text-stone-400 px-4 text-center">
                    {t("bugReport.dragDrop")}
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 mt-2 max-h-56 overflow-y-auto pr-1">
                  {images.map((img, index) => (
                    <div
                      key={index}
                      className="relative group rounded-lg border border-stone-800 bg-stone-950/40 p-1.5 flex items-center justify-center h-28 overflow-hidden transition-all hover:border-stone-700"
                    >
                      <img
                        src={img.base64}
                        alt={`Upload preview ${index + 1}`}
                        className="h-full w-full object-contain rounded"
                      />
                      <div className="absolute inset-0 bg-stone-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => setLightboxImage(img.base64)}
                          className="flex size-7 items-center justify-center rounded-full bg-stone-900/90 text-stone-200 hover:bg-stone-800 hover:text-stone-50 transition-colors cursor-pointer"
                          title="Phóng to ảnh"
                        >
                          <Eye className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          disabled={isSubmitting}
                          className="flex size-7 items-center justify-center rounded-full bg-red-950/90 text-red-400 hover:bg-red-900 hover:text-red-300 transition-colors cursor-pointer disabled:opacity-50"
                          title="Xóa ảnh"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-stone-900/60 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
                className="h-9 text-xs border-stone-800 bg-stone-900/40 hover:bg-stone-850 hover:text-stone-200"
              >
                {t("bugReport.cancel")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="min-w-28 h-9 text-xs font-semibold"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" />
                    {t("bugReport.submitting")}
                  </span>
                ) : (
                  t("bugReport.submit")
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Lightbox Preview Dialog */}
      <Dialog open={!!lightboxImage} onOpenChange={(open) => !open && setLightboxImage(null)}>
        <DialogContent className="max-w-4xl p-2 border-stone-800 bg-stone-950/98 shadow-2xl z-[9999] sm:rounded-xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Xem ảnh chụp màn hình</DialogTitle>
            <DialogDescription>Ảnh chụp màn hình lỗi ở kích thước đầy đủ</DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[80vh] items-center justify-center overflow-hidden rounded-lg">
            {lightboxImage && (
              <img
                src={lightboxImage}
                alt="Bug report screenshot full view"
                className="max-h-full max-w-full object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
