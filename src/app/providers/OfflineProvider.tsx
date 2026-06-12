import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { db, syncPendingOperations, queueSyncOperation } from '@/shared/services/offlineStorage';
import { SyncOperation } from '@/shared/types';

interface OfflineContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingOperations: number;
  lastSyncTime: Date | null;
  syncNow: () => Promise<void>;
  queueOperation: (operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>) => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingOperations, setPendingOperations] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Update online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Count pending operations
  useEffect(() => {
    const updatePendingCount = async () => {
      const count = await db.syncQueue.count();
      setPendingOperations(count);
    };

    updatePendingCount();

    // Subscribe to db changes
    const intervalId = setInterval(updatePendingCount, 5000);
    return () => clearInterval(intervalId);
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingOperations > 0) {
      syncNow();
    }
  }, [isOnline]);

  const syncNow = useCallback(async () => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);
    try {
      await syncPendingOperations();
      setLastSyncTime(new Date());
      const count = await db.syncQueue.count();
      setPendingOperations(count);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline]);

  const queueOperation = useCallback(
    async (operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>) => {
      await queueSyncOperation(operation);
      setPendingOperations((prev) => prev + 1);

      // Try to sync immediately if online
      if (isOnline) {
        syncNow();
      }
    },
    [isOnline, syncNow]
  );

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingOperations,
        lastSyncTime,
        syncNow,
        queueOperation,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}
