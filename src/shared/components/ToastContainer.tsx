import { Fragment } from 'react';
import { Transition } from '@headlessui/react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useToastStore } from '@/shared/stores/toastStore';

const icons = {
  success: CheckCircleIcon,
  error: ExclamationCircleIcon,
  warning: ExclamationTriangleIcon,
  info: InformationCircleIcon,
};

const colors = {
  success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
  info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
};

const iconColors = {
  success: 'text-green-400 dark:text-green-500',
  error: 'text-red-400 dark:text-red-500',
  warning: 'text-yellow-400 dark:text-yellow-500',
  info: 'text-blue-400 dark:text-blue-500',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-0 flex items-end px-4 py-6 sm:items-start sm:p-6 z-50"
    >
      <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
        {toasts.map((toast) => {
          const Icon = icons[toast.type];
          return (
            <Transition
              key={toast.id}
              show={true}
              as={Fragment}
              enter="transform ease-out duration-300 transition"
              enterFrom="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
              enterTo="translate-y-0 opacity-100 sm:translate-x-0"
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div
                className={`pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg border shadow-lg ${colors[toast.type]}`}
              >
                <div className="p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <Icon className={`h-6 w-6 ${iconColors[toast.type]}`} aria-hidden="true" />
                    </div>
                    <div className="ml-3 w-0 flex-1 pt-0.5">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {toast.title}
                      </p>
                      {toast.message && (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {toast.message}
                        </p>
                      )}
                    </div>
                    <div className="ml-4 flex flex-shrink-0">
                      <button
                        type="button"
                        className="inline-flex rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-fire-500 focus:ring-offset-2"
                        onClick={() => removeToast(toast.id)}
                      >
                        <span className="sr-only">Close</span>
                        <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          );
        })}
      </div>
    </div>
  );
}
