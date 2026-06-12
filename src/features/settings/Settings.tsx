import { useState, useEffect } from 'react';
import {
  UserCircleIcon,
  BellIcon,
  ShieldCheckIcon,
  CloudIcon,
  MoonIcon,
  SunIcon,
  ComputerDesktopIcon,
  TrashIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/app/providers/AuthProvider';
import { useTheme } from '@/app/providers/ThemeProvider';
import { useOffline } from '@/app/providers/OfflineProvider';
import { supabase } from '@/shared/services/supabaseClient';
import { db } from '@/shared/services/offlineStorage';
import { showSuccessToast, showErrorToast } from '@/shared/stores/toastStore';

export default function Settings() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { isOnline, pendingOperations, syncNow, isSyncing } = useOffline();

  const [profile, setProfile] = useState({
    fullName: '',
    phone: '',
    address: '',
  });
  const [notifications, setNotifications] = useState({
    fireAlerts: true,
    assessmentReminders: true,
    trainingUpdates: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  async function loadProfile() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single();

      if (!error && data) {
        setProfile({
          fullName: (data as { full_name?: string }).full_name || '',
          phone: (data as { phone?: string }).phone || '',
          address: (data as { address?: string }).address || '',
        });
      } else {
        // Demo mode - use default profile
        setProfile({
          fullName: 'Dev User',
          phone: '',
          address: '',
        });
      }
    } catch (error) {
      console.log('Using demo profile');
      setProfile({
        fullName: 'Dev User',
        phone: '',
        address: '',
      });
    }
  }

  async function saveProfile() {
    setIsLoading(true);
    try {
      await supabase
        .from('profiles')
        .update({
          full_name: profile.fullName,
          phone: profile.phone,
          address: profile.address,
        })
        .eq('id', user!.id);

      showSuccessToast('Profile updated');
    } catch (error) {
      // In demo mode, just show success
      console.log('Demo mode: profile saved locally');
      showSuccessToast('Profile updated (demo mode)');
    } finally {
      setIsLoading(false);
    }
  }

  async function clearLocalData() {
    if (
      !confirm(
        'Are you sure you want to clear all local data? This cannot be undone.'
      )
    )
      return;

    try {
      await db.delete();
      await db.open();
      showSuccessToast('Local data cleared');
    } catch (error) {
      console.error('Error clearing data:', error);
      showErrorToast('Failed to clear data');
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your account and application preferences.
        </p>
      </div>

      {/* Profile Section */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <UserCircleIcon className="w-6 h-6 text-gray-400" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Profile</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="input bg-gray-50 dark:bg-gray-700"
            />
          </div>

          <div>
            <label className="label">Full Name</label>
            <input
              type="text"
              value={profile.fullName}
              onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
              className="input"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="label">Phone</label>
            <input
              type="tel"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              className="input"
              placeholder="(555) 555-5555"
            />
          </div>

          <div>
            <label className="label">Address</label>
            <input
              type="text"
              value={profile.address}
              onChange={(e) => setProfile({ ...profile, address: e.target.value })}
              className="input"
              placeholder="123 Main St, City, State"
            />
          </div>

          <button
            onClick={saveProfile}
            disabled={isLoading}
            className="btn-primary"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Appearance Section */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <MoonIcon className="w-6 h-6 text-gray-400" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Appearance</h2>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setTheme('light')}
            className={`p-4 rounded-lg border-2 text-center transition-colors ${
              theme === 'light'
                ? 'border-fire-500 bg-fire-50 dark:bg-fire-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <SunIcon className="w-6 h-6 mx-auto mb-2" />
            <span className="text-sm font-medium">Light</span>
          </button>

          <button
            onClick={() => setTheme('dark')}
            className={`p-4 rounded-lg border-2 text-center transition-colors ${
              theme === 'dark'
                ? 'border-fire-500 bg-fire-50 dark:bg-fire-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <MoonIcon className="w-6 h-6 mx-auto mb-2" />
            <span className="text-sm font-medium">Dark</span>
          </button>

          <button
            onClick={() => setTheme('system')}
            className={`p-4 rounded-lg border-2 text-center transition-colors ${
              theme === 'system'
                ? 'border-fire-500 bg-fire-50 dark:bg-fire-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <ComputerDesktopIcon className="w-6 h-6 mx-auto mb-2" />
            <span className="text-sm font-medium">System</span>
          </button>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <BellIcon className="w-6 h-6 text-gray-400" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Notifications
          </h2>
        </div>

        <div className="space-y-4">
          {[
            {
              key: 'fireAlerts',
              label: 'Fire Alerts',
              description: 'Get notified about fire activity in your area',
            },
            {
              key: 'assessmentReminders',
              label: 'Assessment Reminders',
              description: 'Reminders to update your property assessment',
            },
            {
              key: 'trainingUpdates',
              label: 'Training Updates',
              description: 'New courses and training content',
            },
          ].map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{label}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
              </div>
              <button
                onClick={() =>
                  setNotifications((prev) => ({
                    ...prev,
                    [key]: !prev[key as keyof typeof notifications],
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications[key as keyof typeof notifications]
                    ? 'bg-fire-600'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications[key as keyof typeof notifications]
                      ? 'translate-x-6'
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Sync Section */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <CloudIcon className="w-6 h-6 text-gray-400" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Data & Sync
          </h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Sync Status</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isOnline
                  ? pendingOperations > 0
                    ? `${pendingOperations} items pending sync`
                    : 'All data synced'
                  : 'Offline - sync when connected'}
              </p>
            </div>
            <button
              onClick={syncNow}
              disabled={!isOnline || isSyncing || pendingOperations === 0}
              className="btn-outline text-sm disabled:opacity-50"
            >
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={clearLocalData}
              className="flex items-center gap-2 text-red-600 hover:text-red-700"
            >
              <TrashIcon className="w-4 h-4" />
              Clear Local Data
            </button>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              This will remove all cached data and pending syncs
            </p>
          </div>
        </div>
      </div>

      {/* Privacy Section */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheckIcon className="w-6 h-6 text-gray-400" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Privacy & Security
          </h2>
        </div>

        <div className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
          <p>
            Your assessment data is stored securely and encrypted. Photos are analyzed
            on your device for privacy.
          </p>
          <div className="flex gap-4">
            <a href="#" className="text-fire-600 hover:text-fire-700">
              Privacy Policy
            </a>
            <a href="#" className="text-fire-600 hover:text-fire-700">
              Terms of Service
            </a>
          </div>
        </div>
      </div>

      {/* Sign Out */}
      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 py-3 text-red-600 hover:text-red-700 font-medium"
      >
        <ArrowRightOnRectangleIcon className="w-5 h-5" />
        Sign Out
      </button>
    </div>
  );
}
