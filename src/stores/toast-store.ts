import { useSyncExternalStore } from 'react';
import { ReactNode } from 'react';

export type ToastType = 'loading' | 'success' | 'error' | 'info';

export type Toast = {
  id: string;
  type: ToastType;
  title: string;
  description?: ReactNode;
  duration?: number; // Thời lượng theo ms, 0 nghĩa là không tự tắt.
  action?: {
    label: string;
    icon?: ReactNode;
    onClick: () => void | Promise<void>;
  };
  onClick?: () => void;
  path?: string;
};
let toasts: Toast[] = [];
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

export const toastStore = {
  getToasts() {
    return toasts;
  },
  add(toast: Omit<Toast, 'id'> & { id?: string }) {
    const id = toast.id || Math.random().toString(36).slice(2);
    const newToast: Toast = { ...toast, id };

    toasts = [...toasts, newToast];
    notify();

    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => toastStore.dismiss(id), newToast.duration);
    }

    return id;
  },
  update(id: string, props: Partial<Omit<Toast, 'id'>>) {
    toasts = toasts.map((t) => (t.id === id ? { ...t, ...props } : t));
    notify();

    if (props.duration && props.duration > 0) {
      setTimeout(() => toastStore.dismiss(id), props.duration);
    }
  },
  dismiss(id: string) {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useToasts() {
  return useSyncExternalStore(toastStore.subscribe, toastStore.getToasts, toastStore.getToasts);
}

export const toast = {
  loading: (title: string, props?: Omit<Toast, 'id' | 'type' | 'title'>) =>
    toastStore.add({ type: 'loading', title, duration: 0, ...props }),
  success: (title: string, props?: Omit<Toast, 'id' | 'type' | 'title'>) =>
    toastStore.add({ type: 'success', title, duration: 5000, ...props }),
  error: (title: string, props?: Omit<Toast, 'id' | 'type' | 'title'>) =>
    toastStore.add({ type: 'error', title, duration: 5000, ...props }),
  info: (title: string, props?: Omit<Toast, 'id' | 'type' | 'title'>) =>
    toastStore.add({ type: 'info', title, duration: 5000, ...props }),
  dismiss: toastStore.dismiss,
};
