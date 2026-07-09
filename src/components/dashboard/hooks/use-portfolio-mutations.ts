import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast, toastStore } from '@/stores';
import { getErrorMessage } from '@/utils/error';
import { refreshBuffPrice } from '@/lib/api-client/buff-api';
import { mapWithConcurrency } from '@/services/parser/utils';
import { translateAccountError } from '@/components/inventory-scanner/utils';
import {
  PORTFOLIO_QUERY_KEY,
  refreshPortfolioPrices,
  addPortfolioItem,
  deletePortfolioItem,
  deleteManyPortfolioItems,
  updatePortfolioItem,
} from '@/lib/api-client/portfolio-api';
import type { PortfolioReportDto } from '@/types/report';

interface UsePortfolioMutationsProps {
  buffPricesCny: Record<string, number>;
  buffCnyToVndRate: number;
  mergeBuffPrices: (prices: Record<string, number>) => void;
  setDialogOpen: (open: boolean) => void;
  setError: (error: string | null) => void;
}

export function usePortfolioMutations({
  buffPricesCny,
  buffCnyToVndRate,
  mergeBuffPrices,
  setDialogOpen,
  setError,
}: UsePortfolioMutationsProps) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  function setMutationError(mutationError: unknown) {
    const msg = getErrorMessage(mutationError);
    setError(translateAccountError(msg, t));
  }

  // Hàm hỗ trợ chuẩn hóa callback toast khi tải, thành công và lỗi cho mutation
  const toastCallbacks = <TData, TVariables>(
    loadingKey: string,
    successKey: string,
    errorKey: string
  ) => {
    return {
      onMutate: () => {
        const id = toast.loading(t(loadingKey));
        return { toastId: id };
      },
      onSuccess: (
        _data: TData,
        _variables: TVariables,
        context: { toastId: string } | undefined
      ) => {
        if (context?.toastId) {
          toastStore.update(context.toastId, {
            type: 'success',
            title: t(successKey),
            duration: 4000,
          });
        }
      },
      onError: (err: unknown, _variables: TVariables, context: { toastId: string } | undefined) => {
        if (context?.toastId) {
          const msg = getErrorMessage(err);
          toastStore.update(context.toastId, {
            type: 'error',
            title: t(errorKey),
            description: translateAccountError(msg, t),
            duration: 5000,
          });
        }
        setMutationError(err);
      },
    };
  };

  const refreshCallbacks = toastCallbacks<PortfolioReportDto, void>(
    'dashboard.refreshingPrices',
    'dashboard.refreshSuccess',
    'dashboard.refreshError'
  );

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const report = await refreshPortfolioPrices();

      const uniqueMarketHashNames = Array.from(
        new Set(report.rows.map((row) => row.case.marketHashName).filter(Boolean))
      );

      const skinsToRefresh = uniqueMarketHashNames.filter((name) => {
        const prevPrice = buffPricesCny[name];
        return typeof prevPrice === 'number' && prevPrice > 0;
      });

      if (skinsToRefresh.length > 0) {
        const newPrices: Record<string, number> = {};
        const concurrency = 4;
        const items = [...skinsToRefresh];

        await mapWithConcurrency(items, concurrency, async (currentHashName) => {
          try {
            const data = await refreshBuffPrice(currentHashName, buffCnyToVndRate);
            if (data) {
              newPrices[currentHashName] = data.priceCny;
            }
          } catch (err) {
            console.error(`Failed to refresh Buff price for ${currentHashName}:`, err);
          }
        });

        if (Object.keys(newPrices).length > 0) {
          mergeBuffPrices(newPrices);
        }
      }

      return report;
    },
    onMutate: refreshCallbacks.onMutate,
    onSuccess: (report, variables, context) => {
      refreshCallbacks.onSuccess(report, variables, context);
      queryClient.setQueryData(PORTFOLIO_QUERY_KEY, report);
      setError(null);
    },
    onError: (err, variables, context) => {
      refreshCallbacks.onError(err, variables, context);
    },
  });

  const addCallbacks = toastCallbacks<PortfolioReportDto, Parameters<typeof addPortfolioItem>[0]>(
    'dashboard.savingItem',
    'dashboard.itemSaved',
    'dashboard.itemSaveError'
  );

  const addMutation = useMutation({
    mutationFn: addPortfolioItem,
    onMutate: addCallbacks.onMutate,
    onSuccess: (report, variables, context) => {
      addCallbacks.onSuccess(report, variables, context);
      queryClient.setQueryData(PORTFOLIO_QUERY_KEY, report);
      queryClient.invalidateQueries({ queryKey: ['portfolio-storage-units'] });
      setDialogOpen(false);
      setError(null);
    },
    onError: (err, variables, context) => {
      addCallbacks.onError(err, variables, context);
    },
  });

  const deleteCallbacks = toastCallbacks<PortfolioReportDto, string>(
    'dashboard.deletingItem',
    'dashboard.itemDeleted',
    'dashboard.itemDeleteError'
  );

  const deleteMutation = useMutation({
    mutationFn: deletePortfolioItem,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: PORTFOLIO_QUERY_KEY });
      const previousReport = queryClient.getQueryData<PortfolioReportDto>(PORTFOLIO_QUERY_KEY);
      if (previousReport) {
        queryClient.setQueryData<PortfolioReportDto>(PORTFOLIO_QUERY_KEY, {
          ...previousReport,
          rows: previousReport.rows.filter((row) => row.item.id !== id),
        });
      }
      const toastContext = deleteCallbacks.onMutate();
      return { previousReport, toastId: toastContext.toastId };
    },
    onSuccess: (report, id, context) => {
      deleteCallbacks.onSuccess(report, id, context);
      queryClient.setQueryData(PORTFOLIO_QUERY_KEY, report);
      queryClient.invalidateQueries({ queryKey: ['portfolio-storage-units'] });
      setError(null);
    },
    onError: (err, id, context) => {
      if (context?.previousReport) {
        queryClient.setQueryData(PORTFOLIO_QUERY_KEY, context.previousReport);
      }
      deleteCallbacks.onError(err, id, context);
    },
  });

  const deleteManyCallbacks = toastCallbacks<PortfolioReportDto, string[]>(
    'dashboard.deletingItems',
    'dashboard.itemsDeleted',
    'dashboard.itemsDeleteError'
  );

  const deleteManyMutation = useMutation({
    mutationFn: deleteManyPortfolioItems,
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: PORTFOLIO_QUERY_KEY });
      const previousReport = queryClient.getQueryData<PortfolioReportDto>(PORTFOLIO_QUERY_KEY);
      if (previousReport) {
        queryClient.setQueryData<PortfolioReportDto>(PORTFOLIO_QUERY_KEY, {
          ...previousReport,
          rows: previousReport.rows.filter((row) => !ids.includes(row.item.id)),
        });
      }
      const toastContext = deleteManyCallbacks.onMutate();
      return { previousReport, toastId: toastContext.toastId };
    },
    onSuccess: (report, ids, context) => {
      deleteManyCallbacks.onSuccess(report, ids, context);
      queryClient.setQueryData(PORTFOLIO_QUERY_KEY, report);
      queryClient.invalidateQueries({ queryKey: ['portfolio-storage-units'] });
      setError(null);
    },
    onError: (err, ids, context) => {
      if (context?.previousReport) {
        queryClient.setQueryData(PORTFOLIO_QUERY_KEY, context.previousReport);
      }
      deleteManyCallbacks.onError(err, ids, context);
    },
  });

  const updateCallbacks = toastCallbacks<
    PortfolioReportDto,
    Parameters<typeof updatePortfolioItem>[0]
  >('dashboard.updatingItem', 'dashboard.itemUpdated', 'dashboard.itemUpdateError');

  const updateMutation = useMutation({
    mutationFn: updatePortfolioItem,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: PORTFOLIO_QUERY_KEY });
      const previousReport = queryClient.getQueryData<PortfolioReportDto>(PORTFOLIO_QUERY_KEY);
      if (previousReport) {
        queryClient.setQueryData<PortfolioReportDto>(PORTFOLIO_QUERY_KEY, {
          ...previousReport,
          rows: previousReport.rows.map((row) => {
            if (row.item.id === variables.id) {
              const updatedItem = { ...row.item };
              if (variables.buyPrice !== undefined) updatedItem.buyPrice = variables.buyPrice;
              if (variables.quantity !== undefined) updatedItem.quantity = variables.quantity;
              if (variables.note !== undefined) updatedItem.note = variables.note;
              return {
                ...row,
                item: updatedItem,
                investedValue: updatedItem.buyPrice * updatedItem.quantity,
              };
            }
            return row;
          }),
        });
      }
      const toastContext = updateCallbacks.onMutate();
      return { previousReport, toastId: toastContext.toastId };
    },
    onSuccess: (report, variables, context) => {
      updateCallbacks.onSuccess(report, variables, context);
      queryClient.setQueryData(PORTFOLIO_QUERY_KEY, report);
      queryClient.invalidateQueries({ queryKey: ['portfolio-storage-units'] });
      setError(null);
    },
    onError: (err, variables, context) => {
      if (context?.previousReport) {
        queryClient.setQueryData(PORTFOLIO_QUERY_KEY, context.previousReport);
      }
      updateCallbacks.onError(err, variables, context);
    },
  });

  return {
    addMutation,
    deleteMutation,
    deleteManyMutation,
    updateMutation,
    refreshMutation,
  };
}
