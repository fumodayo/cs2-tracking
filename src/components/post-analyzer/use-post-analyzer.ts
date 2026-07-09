'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import type { PostAnalysisDto, PostAnalysisHistoryItemDto } from '@/types/post-analysis';
import { formatDateTimeVi as formatHistoryDate } from '@/utils/date';
import { parseFacebookHtmlSource, extractSteamUrl } from '@/services/parser/facebook-parser';
import { translateAccountError } from '@/components/inventory-scanner/utils';
import {
  analyzePost,
  deletePostAnalysisHistoryItem,
  fetchPostAnalysisHistory,
  type UploadedPostImage,
} from './post-analyzer-api';

export type { UploadedPostImage } from './post-analyzer-api';

export const SAMPLE_POST = `Xin phép AD
Em cần bay hết hòm + laptop như trên ảnh ạ
Rate 0.68 mk lấy all 0.65 ạ
x1 dead hand
x6 dream
x4 recoil
x3 revo
x2 fracture`;

export function usePostAnalyzer() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [text, setText] = useState(SAMPLE_POST);
  const [analysis, setAnalysis] = useState<PostAnalysisDto | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [image, setImage] = useState<UploadedPostImage | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Các biến state mới cho parse HTML Facebook
  const [activeTab, setActiveTab] = useState<'manual' | 'facebook'>('manual');
  const [htmlSource, setHtmlSource] = useState('');
  const [extractedData, setExtractedData] = useState<{
    text: string;
    author: string;
    imageUrls: string[];
    postTime?: string;
    authorUrl?: string;
    postUrl?: string;
    steamUrl?: string;
  } | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzingHtml, setIsAnalyzingHtml] = useState(false);
  const [editableText, setEditableText] = useState('');
  const [cacheNotification, setCacheNotification] = useState<{
    message: string;
    item?: PostAnalysisHistoryItemDto;
    isManualMatch?: boolean;
  } | null>(null);
  const [chatGptJsonInput, setChatGptJsonInput] = useState('');
  const [isImportingChatGpt, setIsImportingChatGpt] = useState(false);
  const [deletedMockIds, setDeletedMockIds] = useState<string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const historyQuery = useQuery({
    queryKey: ['post-analysis-history'],
    queryFn: () => fetchPostAnalysisHistory(t),
    staleTime: 5 * 60 * 1000,
  });

  const history = useMemo(() => {
    const dbHistory = historyQuery.data ?? [];
    return dbHistory.filter((item) => !deletedMockIds.includes(item.id));
  }, [historyQuery.data, deletedMockIds]);
  const historyErrorMessage = historyQuery.error
    ? historyQuery.error instanceof Error
      ? historyQuery.error.message
      : t('postAnalyzer.unableToLoadHistory')
    : null;

  const analyzeMutation = useMutation({
    mutationFn: (args: { text: string; image: UploadedPostImage | null; force?: boolean }) =>
      analyzePost({ ...args, t }),
    onSuccess: async (nextAnalysis) => {
      await queryClient.invalidateQueries({
        queryKey: ['post-analysis-history'],
      });
      const nextHistory = await fetchPostAnalysisHistory(t);

      setAnalysis(nextAnalysis);
      setSelectedHistoryId(nextHistory[0]?.id ?? null);
      setError(null);

      if (nextAnalysis.cacheStatus === 'hit') {
        const matchingItem = nextHistory.find(
          (h) => h.analysis.totalSteamValue === nextAnalysis.totalSteamValue && h.text === text
        );
        setCacheNotification({
          message: t('postAnalyzer.matchingPostFoundAutoLoad'),
          item: matchingItem,
          isManualMatch: true,
        });
      } else {
        setCacheNotification(null);
      }
    },
    onError: (analyzeError) => {
      setAnalysis(null);
      setSelectedHistoryId(null);
      setError(
        analyzeError instanceof Error
          ? translateAccountError(analyzeError.message, t)
          : t('postAnalyzer.unableToAnalyzePost')
      );
      setCacheNotification(null);
    },
  });

  const deleteHistoryMutation = useMutation({
    mutationFn: (id: string) => deletePostAnalysisHistoryItem(id, t),
    onSuccess: async (_result, id) => {
      await queryClient.invalidateQueries({
        queryKey: ['post-analysis-history'],
      });
      if (selectedHistoryId === id) {
        setSelectedHistoryId(null);
      }
      setCacheNotification(null);
    },
    onError: (deleteError) => {
      setError(
        deleteError instanceof Error
          ? translateAccountError(deleteError.message, t)
          : t('postAnalyzer.unableToDeleteHistory')
      );
    },
  });

  const selectedHistory = useMemo(
    () => history.find((item) => item.id === selectedHistoryId) ?? null,
    [history, selectedHistoryId]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCacheNotification(null);
    analyzeMutation.mutate({ text, image });
  }

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    await processImageFile(file);
  }

  async function processImageFile(file: File | undefined) {
    if (!file) {
      return;
    }

    setIsDraggingImage(false);
    setError(null);

    if (!/^image\/(?:png|jpe?g|webp)$/.test(file.type)) {
      setImage(null);
      setError(t('postAnalyzer.invalidImageFormat'));
      return;
    }

    if (file.size > 6 * 1024 * 1024) {
      setImage(null);
      setError(t('postAnalyzer.imageTooLarge'));
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const data = dataUrl.split(',').pop() ?? '';
      setImage({
        fileName: file.name,
        mimeType: file.type,
        data,
        previewUrl: dataUrl,
      });
    } catch {
      setImage(null);
      setError(t('postAnalyzer.unableToReadImage'));
    }
  }

  function handleImageDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDraggingImage(true);
  }

  function handleImageDragLeave(event: React.DragEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDraggingImage(false);
  }

  function handleImageDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingImage(false);
    void processImageFile(event.dataTransfer.files?.[0]);
  }

  async function handlePaste(event: React.ClipboardEvent<HTMLFormElement>) {
    const items = event.clipboardData?.items;
    if (!items) {
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          await processImageFile(file);
          break;
        }
      }
    }
  }

  function clearImage() {
    setImage(null);
  }

  function loadHistoryItem(item: PostAnalysisHistoryItemDto) {
    setText(item.text);
    setAnalysis({
      ...item.analysis,
      imageCloudinaryUrl: item.analysis.imageCloudinaryUrl ?? item.imageCloudinaryUrl,
    });
    setImage(null);
    setSelectedHistoryId(item.id);
    setError(null);
    setCacheNotification(null);
    setHistoryOpen(false);
  }

  function deleteHistoryItem(id: string) {
    // Item lịch sử demo chỉ nằm ở client, nên ẩn local thay vì gọi API.
    if (id === 'sample-history-item') {
      setDeletedMockIds((prev) => [...prev, id]);
      if (selectedHistoryId === id) {
        setSelectedHistoryId(null);
        setAnalysis(null);
      }
      return;
    }
    deleteHistoryMutation.mutate(id);
  }

  async function handleExtractHtml(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!htmlSource.trim()) return;

    setIsExtracting(true);
    setError(null);
    setExtractedData(null);
    setSelectedImages([]);

    // Lên lịch xử lý ở frame kế tiếp để đảm bảo UI render vòng xoay tải
    setTimeout(() => {
      try {
        const extracted = parseFacebookHtmlSource(htmlSource);
        setExtractedData(extracted);
        setEditableText(extracted.text);

        if (extracted.imageUrls.length > 0) {
          setSelectedImages(extracted.imageUrls);
        }

        const postUrl = extracted.postUrl;
        // Tự nạp bài Facebook khớp chính xác để user không tốn lượt phân tích trùng.
        if (postUrl) {
          fetch(`/api/post/history?postUrl=${encodeURIComponent(postUrl)}`)
            .then((res) => res.json())
            .then((data) => {
              if (data.item) {
                const historyItem = data.item;
                setAnalysis({
                  ...historyItem.analysis,
                  imageCloudinaryUrl:
                    historyItem.analysis.imageCloudinaryUrl ?? historyItem.imageCloudinaryUrl,
                  cacheStatus: 'hit',
                });
                setSelectedHistoryId(historyItem.id);
                setCacheNotification({
                  message: t('postAnalyzer.historyDuplicateAutoLoad', {
                    date: formatHistoryDate(historyItem.updatedAt),
                  }),
                  item: historyItem,
                });
              }
            })
            .catch((e) => console.error('Lỗi khi kiểm tra trùng lặp lịch sử bài viết:', e));
        }
      } catch (err) {
        console.error('Client-side extraction failed:', err);
        setError(err instanceof Error ? err.message : t('postAnalyzer.failedToExtractHtml'));
      } finally {
        setIsExtracting(false);
      }
    }, 50);
  }

  async function handleAnalyzeHtml(event: React.FormEvent<HTMLFormElement> | null, force = false) {
    if (event) event.preventDefault();
    if (!editableText.trim()) return;

    setIsAnalyzingHtml(true);
    setError(null);
    setCacheNotification(null);

    try {
      const response = await fetch('/api/post/analyze-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: editableText,
          imageUrls: selectedImages,
          author: extractedData?.author,
          postTime: extractedData?.postTime,
          authorUrl: extractedData?.authorUrl,
          postUrl: extractedData?.postUrl,
          steamUrl: extractedData?.steamUrl || extractSteamUrl(editableText) || undefined,
          force,
        }),
      });

      const nextAnalysis = await response.json();
      if (!response.ok) {
        throw new Error(nextAnalysis.message ?? t('postAnalyzer.failedToAnalyzePrice'));
      }

      await queryClient.invalidateQueries({
        queryKey: ['post-analysis-history'],
      });
      const nextHistory = await fetchPostAnalysisHistory(t);

      setAnalysis(nextAnalysis);
      setSelectedHistoryId(nextHistory[0]?.id ?? null);

      if (nextAnalysis.cacheStatus === 'hit') {
        // Cache hit có thể đến từ bài viết khớp chính xác hoặc tổng vật phẩm tương đương.
        const matchingItem = nextHistory.find(
          (h) =>
            h.id === nextHistory[0]?.id ||
            h.analysis.totalSteamValue === nextAnalysis.totalSteamValue
        );
        setCacheNotification({
          message: t('postAnalyzer.matchingPostFoundAutoLoad'),
          item: matchingItem,
        });
      } else {
        setCacheNotification(null);
        setExtractedData(null);
        setHtmlSource('');
        setSelectedImages([]);
      }
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? translateAccountError(err.message, t)
          : t('postAnalyzer.failedToAnalyzeGeneral')
      );
    } finally {
      setIsAnalyzingHtml(false);
    }
  }

  async function handleImportChatGptJson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chatGptJsonInput.trim()) return;

    setIsImportingChatGpt(true);
    setError(null);
    setCacheNotification(null);

    try {
      const trimmedInput = chatGptJsonInput.trim();
      let parsedJson: Record<string, unknown> | null = null;

      try {
        parsedJson = JSON.parse(trimmedInput);
      } catch {
        // Output ChatGPT thường được dán kèm markdown fence hoặc phần giải thích xung quanh.
        // Thử trích JSON trong markdown fence: ```json ... ``` hoặc ``` ... ```
        const markdownMatch = trimmedInput.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (markdownMatch && markdownMatch[1]) {
          try {
            parsedJson = JSON.parse(markdownMatch[1].trim());
          } catch {
            // continue
          }
        }

        // Nếu chưa resolve được, thử khớp block { ... } đầu tiên
        if (!parsedJson) {
          const curlyMatch = trimmedInput.match(/\{[\s\S]*\}/);
          if (curlyMatch && curlyMatch[0]) {
            try {
              parsedJson = JSON.parse(curlyMatch[0].trim());
            } catch {
              // continue
            }
          }
        }
      }

      if (!parsedJson || typeof parsedJson !== 'object') {
        throw new Error(t('postAnalyzer.invalidJsonFromGemini'));
      }

      const response = await fetch('/api/post/analyze-chatgpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: activeTab === 'facebook' ? editableText : text,
          chatGptJson: parsedJson,
          author: extractedData?.author,
          postTime: extractedData?.postTime,
          authorUrl: extractedData?.authorUrl,
          postUrl: extractedData?.postUrl,
          steamUrl:
            extractedData?.steamUrl ||
            extractSteamUrl(activeTab === 'facebook' ? editableText : text) ||
            undefined,
        }),
      });

      const nextAnalysis = await response.json();
      if (!response.ok) {
        throw new Error(nextAnalysis.message ?? t('postAnalyzer.failedToAnalyzeGeminiData'));
      }

      await queryClient.invalidateQueries({
        queryKey: ['post-analysis-history'],
      });
      const nextHistory = await fetchPostAnalysisHistory(t);

      setAnalysis(nextAnalysis);
      setSelectedHistoryId(nextHistory[0]?.id ?? null);
      setChatGptJsonInput('');
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? translateAccountError(err.message, t)
          : t('postAnalyzer.invalidJsonGeneral')
      );
    } finally {
      setIsImportingChatGpt(false);
    }
  }

  function toggleImageSelection(url: string) {
    setSelectedImages((prev) => {
      if (prev.includes(url)) {
        return prev.filter((item) => item !== url);
      } else {
        return [...prev, url];
      }
    });
  }

  return {
    // Các state
    text,
    setText,
    analysis,
    setAnalysis,
    selectedHistoryId,
    setSelectedHistoryId,
    image,
    setImage,
    isDraggingImage,
    setIsDraggingImage,
    error,
    setError,
    activeTab,
    setActiveTab,
    htmlSource,
    setHtmlSource,
    extractedData,
    setExtractedData,
    selectedImages,
    setSelectedImages,
    isExtracting,
    setIsExtracting,
    isAnalyzingHtml,
    setIsAnalyzingHtml,
    editableText,
    setEditableText,
    cacheNotification,
    setCacheNotification,
    chatGptJsonInput,
    setChatGptJsonInput,
    isImportingChatGpt,
    setIsImportingChatGpt,
    historyOpen,
    setHistoryOpen,

    // Giá trị tính toán
    history,
    historyErrorMessage,
    selectedHistory,
    historyQuery,
    analyzeMutation,
    deleteHistoryMutation,

    // Các handler
    handleSubmit,
    handleImageChange,
    processImageFile,
    handleImageDragOver,
    handleImageDragLeave,
    handleImageDrop,
    handlePaste,
    clearImage,
    loadHistoryItem,
    deleteHistoryItem,
    handleExtractHtml,
    handleAnalyzeHtml,
    handleImportChatGptJson,
    toggleImageSelection,
  };
}
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Invalid file result'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Cannot read file'));
    reader.readAsDataURL(file);
  });
}
