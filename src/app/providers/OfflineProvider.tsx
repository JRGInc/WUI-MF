import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import {
  db,
  syncPendingOperations,
  pullRemoteData,
  queueSyncOperation,
} from '@/shared/services/offlineStorage';
import { useAuth } from './AuthProvider';
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
  const { user } = useAuth();
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

  // Auto-sync when online and signed in: pushes the queue, then pulls the user's
  // remote records into Dexie. Runs on mount and whenever connectivity or the
  // user changes.
  useEffect(() => {
    if (isOnline && user) {
      syncNow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, user]);

  const syncNow = useCallback(async () => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);
    try {
      await syncPendingOperations(); // push local changes
      if (user) await pullRemoteData(user.id); // pull remote into Dexie
      setLastSyncTime(new Date());
      const count = await db.syncQueue.count();
      setPendingOperations(count);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline, user]);

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
