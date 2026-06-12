export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-gray-200 dark:border-gray-700" />
          <div className="absolute top-0 left-0 h-12 w-12 rounded-full border-4 border-fire-600 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  };

  return (
    <div className="flex items-center justify-center">
      <div className="relative">
        <div className={`${sizeClasses[size]} rounded-full border-gray-200 dark:border-gray-700`} />
        <div
          className={`absolute top-0 left-0 ${sizeClasses[size]} rounded-full border-fire-600 border-t-transparent animate-spin`}
        />
      </div>
    </div>
  );
}
