"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Upload, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast, toastStore } from "@/utils/toast-store";

interface BugReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BugReportDialog({ open, onOpenChange }: BugReportDialogProps) {
  const { t } = useTranslation();
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setDescription("");
    setImage(null);
    setMimeType(null);
    setPreview(null);
    setIsDragActive(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
    resetForm();
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("bugReport.error"), {
        description: "Vui lòng chọn một file ảnh (PNG, JPG, WebP...).",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("bugReport.error"), {
        description: "Dung lượng ảnh vượt quá 5MB. Vui lòng chọn ảnh nhẹ hơn.",
      });
      return;
    }

    setMimeType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPreview(base64);
      setImage(base64);
    };
    reader.readAsDataURL(file);
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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleClearImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImage(null);
    setPreview(null);
    setMimeType(null);
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
          image,
          mimeType,
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
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("bugReport.title")}</DialogTitle>
          <DialogDescription>{t("bugReport.desc")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              {t("bugReport.descriptionLabel")} <span className="text-red-500">*</span>
            </label>
            <Textarea
              required
              rows={4}
              placeholder={t("bugReport.descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              className="resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              {t("bugReport.imageLabel")}
            </label>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={isSubmitting}
            />

            {!preview ? (
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={triggerFileInput}
                className={`flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all duration-200 ${
                  isDragActive
                    ? "border-accent bg-accent/10"
                    : "border-border bg-surface/20 hover:border-accent hover:bg-surface-hover/30"
                }`}
              >
                <Upload className="size-6 text-muted-foreground" />
                <span className="mt-2 text-xs text-muted-foreground px-4 text-center">
                  {t("bugReport.dragDrop")}
                </span>
              </div>
            ) : (
              <div className="relative mt-2 flex items-center justify-center rounded-lg border border-border bg-stone-950/20 p-2">
                <img
                  src={preview}
                  alt="Bug screenshot preview"
                  className="max-h-40 rounded object-contain"
                />
                <button
                  type="button"
                  onClick={handleClearImage}
                  disabled={isSubmitting}
                  className="absolute top-4 right-4 flex size-6 items-center justify-center rounded-full bg-stone-900/80 text-stone-200 hover:bg-stone-800 disabled:opacity-50"
                  title={t("bugReport.clearImage")}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              {t("bugReport.cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="min-w-28"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("bugReport.submitting")}
                </>
              ) : (
                t("bugReport.submit")
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
