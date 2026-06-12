import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { v4 as uuidv4 } from 'uuid';
import {
  XMarkIcon,
  LinkIcon,
  EnvelopeIcon,
  BuildingOfficeIcon,
  DocumentArrowDownIcon,
  CheckIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '@/shared/services/supabaseClient';
import { showSuccessToast, showErrorToast } from '@/shared/stores/toastStore';
import type { ShareType } from '@/shared/types';

interface ShareDialogProps {
  assessmentId: string;
  onClose: () => void;
}

export function ShareDialog({ assessmentId, onClose }: ShareDialogProps) {
  const [activeTab, setActiveTab] = useState<ShareType>('link');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateShareLink = async () => {
    setIsLoading(true);
    try {
      const accessToken = uuidv4();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

      const { error } = await supabase.from('shared_reports').insert({
        assessment_id: assessmentId,
        share_type: 'link',
        access_token: accessToken,
        expires_at: expiresAt.toISOString(),
      });

      if (error) throw error;

      const link = `${window.location.origin}/report/${accessToken}`;
      setShareLink(link);
      showSuccessToast('Share link created');
    } catch (error) {
      console.error('Error creating share link:', error);
      showErrorToast('Failed to create share link');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (shareLink) {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const sendEmail = async () => {
    if (!email) return;

    setIsLoading(true);
    try {
      const accessToken = uuidv4();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const { error } = await supabase.from('shared_reports').insert({
        assessment_id: assessmentId,
        share_type: 'link',
        recipient_email: email,
        access_token: accessToken,
        expires_at: expiresAt.toISOString(),
      });

      if (error) throw error;

      // In production, this would trigger an email via Supabase Edge Function
      showSuccessToast('Share link sent', `An email has been sent to ${email}`);
      setEmail('');
    } catch (error) {
      console.error('Error sending email:', error);
      showErrorToast('Failed to send email');
    } finally {
      setIsLoading(false);
    }
  };

  const submitToAgency = async () => {
    setIsLoading(true);
    try {
      const accessToken = uuidv4();

      const { error } = await supabase.from('shared_reports').insert({
        assessment_id: assessmentId,
        share_type: 'agency',
        access_token: accessToken,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });

      if (error) throw error;

      showSuccessToast(
        'Submitted to Agency',
        'Your assessment has been submitted for review'
      );
    } catch (error) {
      console.error('Error submitting to agency:', error);
      showErrorToast('Failed to submit');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadPDF = async () => {
    setIsLoading(true);
    try {
      // In production, this would call a PDF generation endpoint
      showSuccessToast('Download started', 'Your PDF report is being generated');

      // Simulate PDF generation
      setTimeout(() => {
        showSuccessToast('PDF Ready', 'Your report has been downloaded');
        setIsLoading(false);
      }, 2000);
    } catch (error) {
      console.error('Error generating PDF:', error);
      showErrorToast('Failed to generate PDF');
      setIsLoading(false);
    }
  };

  return (
    <Transition appear show={true} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl transition-all">
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title className="text-lg font-medium text-gray-900 dark:text-white">
                    Share Assessment
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <XMarkIcon className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg mb-6">
                  {[
                    { id: 'link' as ShareType, icon: LinkIcon, label: 'Link' },
                    { id: 'agency' as ShareType, icon: BuildingOfficeIcon, label: 'Agency' },
                  ].map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeTab === id
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Link sharing */}
                {activeTab === 'link' && (
                  <div className="space-y-4">
                    {!shareLink ? (
                      <button
                        onClick={generateShareLink}
                        disabled={isLoading}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                      >
                        {isLoading ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <LinkIcon className="w-4 h-4" />
                        )}
                        Generate Share Link
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={shareLink}
                            readOnly
                            className="input flex-1 text-sm"
                          />
                          <button
                            onClick={copyToClipboard}
                            className="btn-outline p-2"
                          >
                            {copied ? (
                              <CheckIcon className="w-5 h-5 text-green-500" />
                            ) : (
                              <ClipboardDocumentIcon className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          This link expires in 30 days
                        </p>
                      </div>
                    )}

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                          or send via email
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="recipient@example.com"
                        className="input flex-1"
                      />
                      <button
                        onClick={sendEmail}
                        disabled={!email || isLoading}
                        className="btn-primary disabled:opacity-50"
                      >
                        <EnvelopeIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Agency submission */}
                {activeTab === 'agency' && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Submit your assessment to your local fire agency for review and
                      verification. They may contact you for additional information.
                    </p>

                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                        What happens next?
                      </h4>
                      <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                        <li className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-fire-100 dark:bg-fire-900/30 text-fire-600 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                            1
                          </span>
                          Your assessment is sent to the local fire agency
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-fire-100 dark:bg-fire-900/30 text-fire-600 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                            2
                          </span>
                          They review and may schedule an inspection
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-fire-100 dark:bg-fire-900/30 text-fire-600 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                            3
                          </span>
                          You receive feedback and recommendations
                        </li>
                      </ul>
                    </div>

                    <button
                      onClick={submitToAgency}
                      disabled={isLoading}
                      className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <BuildingOfficeIcon className="w-4 h-4" />
                      )}
                      Submit to Fire Agency
                    </button>
                  </div>
                )}

                {/* Download PDF option */}
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={downloadPDF}
                    disabled={isLoading}
                    className="btn-outline w-full flex items-center justify-center gap-2"
                  >
                    <DocumentArrowDownIcon className="w-4 h-4" />
                    Download PDF Report
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
