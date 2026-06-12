import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  HomeIcon,
  ClipboardDocumentCheckIcon,
  MapIcon,
  CameraIcon,
  AcademicCapIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
  SignalIcon,
  SignalSlashIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOffline } from '@/app/providers/OfflineProvider';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'New Assessment', href: '/assessment/new', icon: ClipboardDocumentCheckIcon },
  { name: 'Risk Map', href: '/map', icon: MapIcon },
  { name: 'AR View', href: '/ar', icon: CameraIcon },
  { name: 'Training', href: '/training', icon: AcademicCapIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { isOnline, isSyncing, pendingOperations } = useOffline();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen">
      {/* Mobile sidebar */}
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setSidebarOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-900/80" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                <Transition.Child
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                    <button
                      type="button"
                      className="-m-2.5 p-2.5"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="sr-only">Close sidebar</span>
                      <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                    </button>
                  </div>
                </Transition.Child>

                <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white dark:bg-gray-900 px-6 pb-4">
                  <div className="flex h-16 shrink-0 items-center">
                    <span className="text-xl font-bold text-fire-600">FireRisk</span>
                  </div>
                  <nav className="flex flex-1 flex-col">
                    <ul role="list" className="flex flex-1 flex-col gap-y-7">
                      <li>
                        <ul role="list" className="-mx-2 space-y-1">
                          {navigation.map((item) => (
                            <li key={item.name}>
                              <NavLink
                                to={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={({ isActive }) =>
                                  `group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold ${
                                    isActive
                                      ? 'bg-fire-50 text-fire-600 dark:bg-fire-900/20 dark:text-fire-400'
                                      : 'text-gray-700 hover:text-fire-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                                  }`
                                }
                              >
                                <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                                {item.name}
                              </NavLink>
                            </li>
                          ))}
                        </ul>
                      </li>
                      <li className="mt-auto">
                        <button
                          onClick={handleSignOut}
                          className="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-gray-700 hover:bg-gray-50 hover:text-fire-600 dark:text-gray-300 dark:hover:bg-gray-800 w-full"
                        >
                          <ArrowRightOnRectangleIcon
                            className="h-6 w-6 shrink-0"
                            aria-hidden="true"
                          />
                          Sign out
                        </button>
                      </li>
                    </ul>
                  </nav>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 pb-4">
          <div className="flex h-16 shrink-0 items-center">
            <span className="text-xl font-bold text-fire-600">FireRisk</span>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <NavLink
                        to={item.href}
                        className={({ isActive }) =>
                          `group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold ${
                            isActive
                              ? 'bg-fire-50 text-fire-600 dark:bg-fire-900/20 dark:text-fire-400'
                              : 'text-gray-700 hover:text-fire-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                          }`
                        }
                      >
                        <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                        {item.name}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </li>

              {/* User info */}
              <li className="mt-auto">
                <div className="mb-4 px-2 py-3 rounded-md bg-gray-50 dark:bg-gray-800">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {user?.email}
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-gray-700 hover:bg-gray-50 hover:text-fire-600 dark:text-gray-300 dark:hover:bg-gray-800 w-full"
                >
                  <ArrowRightOnRectangleIcon className="h-6 w-6 shrink-0" aria-hidden="true" />
                  Sign out
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 dark:text-gray-300 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
          </button>

          {/* Separator */}
          <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 lg:hidden" aria-hidden="true" />

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1" />

            {/* Online/Offline indicator */}
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <SignalIcon className="h-5 w-5 text-green-500" />
                ) : (
                  <SignalSlashIcon className="h-5 w-5 text-gray-400" />
                )}
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
                {pendingOperations > 0 && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                    {isSyncing ? 'Syncing...' : `${pendingOperations} pending`}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-10">
          <div className="px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
