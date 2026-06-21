import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface LegalLayoutProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

/**
 * Shared shell for the public legal pages (Terms of Service, Privacy Policy).
 * Renders outside the authenticated <Layout/> so it is reachable pre-login and
 * from the consent checkboxes on the auth screens.
 */
export function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            to="/"
            className="text-sm font-medium text-fire-600 hover:text-fire-500"
          >
            &larr; Back to app
          </Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {title}
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Last updated: {lastUpdated}
          </p>
        </div>

        <div className="space-y-6 text-sm leading-6 text-gray-700 dark:text-gray-300 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-gray-900 dark:[&_h2]:text-white [&_h3]:mt-4 [&_h3]:font-semibold [&_h3]:text-gray-900 dark:[&_h3]:text-white [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_a]:text-fire-600 [&_a:hover]:text-fire-500 [&_strong]:text-gray-900 dark:[&_strong]:text-white">
          {children}
        </div>
      </div>
    </div>
  );
}
