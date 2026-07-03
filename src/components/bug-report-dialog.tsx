'use client';

import { useState, useRef, DragEvent, ChangeEvent, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, X, Loader2, Eye, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast, toastStore } from '@/stores';

interface BugReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BugReportDialog({ open, onOpenChange }: BugReportDialogProps) {
  const { t } = useTranslation();
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<Array<{ base64: string; mimeType: string }>>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setDescription('');
    setImages([]);
    setIsDragActive(false);
  };

  // Load draft or reset state when dialog opens
  useEffect(() => {
    if (open) {
      try {
        const savedDraft = localStorage.getItem('bug_report_draft');
        if (savedDraft) {
          const draft = JSON.parse(savedDraft);
          if (typeof draft.description === 'string') {
            setDescription(draft.description);
          }
          if (Array.isArray(draft.images)) {
            setImages(draft.images);
          }
          return;
        }
      } catch (e) {
        console.error('Failed to load bug report draft from localStorage', e);
      }

      // Default reset if no draft found
      resetForm();
    }
  }, [open]);

  // Save state to localStorage as draft
  useEffect(() => {
    if (open) {
      const isDefault = !description.trim() && images.length === 0;
      try {
        if (isDefault) {
          localStorage.removeItem('bug_report_draft');
        } else {
          const draft = { description, images };
          try {
            localStorage.setItem('bug_report_draft', JSON.stringify(draft));
          } catch {
            // If quota exceeded (due to large images), fall back to saving only the description
            const textOnlyDraft = { description, images: [] };
            localStorage.setItem('bug_report_draft', JSON.stringify(textOnlyDraft));
          }
        }
      } catch (e) {
        console.error('Failed to update bug report draft in localStorage', e);
      }
    }
  }, [open, description, images]);

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

  const handleCancel = () => {
    if (isSubmitting) return;
    try {
      localStorage.removeItem('bug_report_draft');
    } catch {
      // ignore
    }
    resetForm();
    onOpenChange(false);
  };

  const processFiles = useCallback(
    (files: File[]) => {
      const validFiles = files.filter((file) => {
        if (!file.type.startsWith('image/')) {
          toast.error(t('bugReport.notAnImage', { name: file.name }), {
            description: t('bugReport.notAnImageDesc'),
          });
          return false;
        }

        if (file.size > 5 * 1024 * 1024) {
          toast.error(t('bugReport.imageTooLarge', { name: file.name }), {
            description: t('bugReport.imageTooLargeDesc'),
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
    },
    [t]
  );

  // Listen for paste event to capture screenshots
  useEffect(() => {
    if (!open) return;

    const handlePaste = (e: ClipboardEvent) => {
      if (isSubmitting) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        processFiles(files);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [open, isSubmitting, processFiles]);

  // Listen for left/right arrow keys when Lightbox is open
  useEffect(() => {
    if (lightboxIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) => (prev !== null && prev < images.length - 1 ? prev + 1 : prev));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [lightboxIndex, images.length]);

  const handleDrag = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLElement>) => {
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
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error(t('bugReport.descRequired'));
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(t('bugReport.submitting'));

    try {
      const response = await fetch('/api/bug-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description,
          images, // array of { base64, mimeType }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorKey = data.message ? `bugReport.errors.${data.message}` : 'bugReport.error';
        throw new Error(
          t(errorKey, { defaultValue: data.message || (t('bugReport.error') as string) }) as string
        );
      }

      toastStore.update(toastId, {
        type: 'success',
        title: t('bugReport.success'),
        duration: 4000,
      });

      try {
        localStorage.removeItem('bug_report_draft');
      } catch {
        // ignore
      }
      onOpenChange(false);
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('bugReport.error');
      toastStore.update(toastId, {
        type: 'error',
        title: t('bugReport.error'),
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
        <DialogContent className="max-w-lg shadow-xl sm:rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg font-bold">
              {t('bugReport.title')}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground mt-1.5 text-xs">
              {t('bugReport.desc')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div
              className={`space-y-4 transition-all duration-350 ${isResetting ? 'animate-reset-flash' : ''}`}
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="bug-description"
                  className="text-muted-foreground text-xs font-semibold"
                >
                  {t('bugReport.descriptionLabel')} <span className="text-red-500">*</span>
                </label>
                <Textarea
                  id="bug-description"
                  required
                  rows={4}
                  placeholder={t('bugReport.descriptionPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                  className="resize-none rounded-lg text-sm"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-muted-foreground text-xs font-semibold">
                    {t('bugReport.imageLabel')}
                  </label>
                  {images.length > 0 && (
                    <button
                      type="button"
                      onClick={triggerFileInput}
                      disabled={isSubmitting}
                      className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300"
                    >
                      <Upload className="size-3.5" />
                      {t('bugReport.addImage')}
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
                  <button
                    type="button"
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={triggerFileInput}
                    className={`flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all duration-200 ${
                      isDragActive
                        ? 'border-accent bg-accent/10'
                        : 'border-border bg-muted/30 hover:border-accent hover:bg-accent/5'
                    }`}
                  >
                    <Upload className="size-6 text-stone-500" />
                    <span className="mt-2 px-4 text-center text-xs text-stone-400">
                      {t('bugReport.dragDrop')}
                    </span>
                    <span className="mt-1 text-[10px] font-medium text-stone-500">
                      {t('bugReport.pasteHint')}
                    </span>
                  </button>
                ) : (
                  <div className="mt-2 grid max-h-56 grid-cols-2 gap-3 overflow-y-auto pr-1">
                    {images.map((img, index) => (
                      <div
                        key={index}
                        className="group border-border bg-muted/20 hover:border-accent/40 relative flex h-28 items-center justify-center overflow-hidden rounded-lg border p-1.5 transition-all"
                      >
                        <img
                          src={img.base64}
                          alt={t('bugReport.uploadPreviewAlt', 'Upload preview {{number}}', {
                            number: index + 1,
                          })}
                          className="h-full w-full rounded object-contain"
                        />
                        <div className="bg-foreground/60 absolute inset-0 flex items-center justify-center gap-3 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => setLightboxIndex(index)}
                            className="bg-background/90 text-foreground hover:bg-background hover:text-accent flex size-7 cursor-pointer items-center justify-center rounded-full transition-colors"
                            title={t('bugReportsAdmin.zoomInImage')}
                          >
                            <Eye className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(index)}
                            disabled={isSubmitting}
                            className="flex size-7 cursor-pointer items-center justify-center rounded-full bg-red-950/90 text-red-400 transition-colors hover:bg-red-900 hover:text-red-300 disabled:opacity-50"
                            title={t('bugReport.clearImage')}
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border-border mt-6 flex items-center justify-end gap-3 border-t pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsResetting(true);
                  try {
                    localStorage.removeItem('bug_report_draft');
                  } catch {
                    /* ignore */
                  }
                  resetForm();
                  setTimeout(() => setIsResetting(false), 400);
                }}
                disabled={isSubmitting}
                className="mr-auto h-9 text-xs text-stone-400 hover:bg-stone-900/20 hover:text-stone-200"
              >
                {t('bugReport.reset')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="h-9 text-xs"
              >
                {t('bugReport.cancel')}
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="h-9 min-w-28 text-xs font-semibold"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" />
                    {t('bugReport.submitting')}
                  </span>
                ) : (
                  t('bugReport.submit')
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Lightbox Preview Dialog */}
      <Dialog
        open={lightboxIndex !== null}
        onOpenChange={(open) => !open && setLightboxIndex(null)}
      >
        <DialogContent className="z-[9999] flex h-[92vh] max-w-[95vw] flex-col justify-between overflow-hidden border-none bg-transparent p-0 shadow-none sm:rounded-2xl md:h-[90vh] md:max-w-[90vw] lg:max-w-[85vw] [&>button[aria-label='Close']]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>{t('bugReport.viewScreenshot')}</DialogTitle>
            <DialogDescription>{t('bugReport.viewScreenshotDesc')}</DialogDescription>
          </DialogHeader>

          {/* Center Area: Image + Nav Arrows */}
          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            {/* Left Chevron */}
            {lightboxIndex !== null && lightboxIndex > 0 && (
              <button
                type="button"
                onClick={() => setLightboxIndex(lightboxIndex - 1)}
                className="absolute top-1/2 left-6 z-50 flex size-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/5 bg-white/5 text-white/80 shadow-xl backdrop-blur transition-all duration-300 hover:bg-white/10 hover:text-white active:scale-95"
              >
                <ChevronLeft className="size-6" />
              </button>
            )}

            {/* Main Image */}
            <div className="flex h-full w-full items-center justify-center p-6 md:p-8">
              {lightboxIndex !== null && images[lightboxIndex] && (
                <div className="group relative max-h-full max-w-full">
                  <img
                    src={images[lightboxIndex].base64}
                    alt={`Screenshot ${lightboxIndex + 1}`}
                    className="max-h-[72vh] max-w-full rounded-xl border border-white/5 object-contain shadow-2xl select-none"
                  />
                  {/* Action Buttons directly on top-right of image */}
                  <div className="absolute top-3 right-3 z-50 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = images[lightboxIndex].base64;
                        link.download = `screenshot_${lightboxIndex + 1}.png`;
                        link.click();
                      }}
                      className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-black/70 text-white/80 shadow-lg backdrop-blur transition duration-200 hover:bg-black/90 hover:text-white"
                      title={t('bugReport.downloadImage', 'Tải xuống')}
                    >
                      <Download className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLightboxIndex(null)}
                      className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-black/70 text-white/80 shadow-lg backdrop-blur transition duration-200 hover:bg-black/90 hover:text-white"
                      title={t('bugReport.cancel')}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Chevron */}
            {lightboxIndex !== null && lightboxIndex < images.length - 1 && (
              <button
                type="button"
                onClick={() => setLightboxIndex(lightboxIndex + 1)}
                className="absolute top-1/2 right-6 z-50 flex size-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/5 bg-white/5 text-white/80 shadow-xl backdrop-blur transition-all duration-300 hover:bg-white/10 hover:text-white active:scale-95"
              >
                <ChevronRight className="size-6" />
              </button>
            )}
          </div>

          {/* Bottom Thumbnails List */}
          {images.length > 1 && (
            <div className="z-10 flex justify-center pt-2 pb-6">
              <div className="no-scrollbar flex max-w-[80%] items-center gap-3 overflow-x-auto rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-2 shadow-xl backdrop-blur-md">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    className={`relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-300 hover:scale-105 active:scale-95 ${
                      lightboxIndex === idx
                        ? 'border-accent shadow-accent/20 scale-105 opacity-100 shadow-lg'
                        : 'border-transparent opacity-40 hover:opacity-80'
                    }`}
                  >
                    <img
                      src={img.base64}
                      alt={`Thumbnail ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
