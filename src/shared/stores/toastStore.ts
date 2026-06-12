import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { ToastMessage } from '../types';

interface ToastStore {
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = uuidv4();
    const newToast: ToastMessage = { ...toast, id };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    // Auto-remove after duration
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearToasts: () => {
    set({ toasts: [] });
  },
}));

// Helper functions for convenience
export function showSuccessToast(title: string, message?: string) {
  useToastStore.getState().addToast({ type: 'success', title, message });
}

export function showErrorToast(title: string, message?: string) {
  useToastStore.getState().addToast({ type: 'error', title, message });
}

export function showWarningToast(title: string, message?: string) {
  useToastStore.getState().addToast({ type: 'warning', title, message });
}

export function showInfoToast(title: string, message?: string) {
  useToastStore.getState().addToast({ type: 'info', title, message });
}
