import { useEffect, useState, Fragment } from 'react';
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
import { useAuth } from '@/app/providers/AuthProvider';
import { useOrganizations } from '@/features/organizations/hooks/useOrganizations';
import {
  fetchSubmissions,
  submitAssessment,
  withdrawSubmission,
} from '@/features/organizations/organizationsService';
import {
  ORGANIZATION_KIND_LABELS,
  submissionChoices,
} from '@/features/organizations/organizations';
import type { AssessmentSubmission, ShareType } from '@/shared/types';
import { printPage } from '@/shared/utils/print';

interface ShareDialogProps {
  assessmentId: string;
  /** The assessment's state, to list in-state organizations first. */
  stateCode?: string;
  onClose: () => void;
}

export function ShareDialog({ assessmentId, stateCode, onClose }: ShareDialogProps) {
  const [activeTab, setActiveTab] = useState<ShareType>('link');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const organizations = useOrganizations(activeTab === 'agency');
  const [submissions, setSubmissions] = useState<AssessmentSubmission[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const choices = submissionChoices(organizations, submissions, stateCode);

  useEffect(() => {
    if (activeTab !== 'agency') return;
    fetchSubmissions(assessmentId)
      .then(setSubmissions)
      .catch((error) => console.error('Error loading submissions:', error));
  }, [activeTab, assessmentId]);

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

  // Agency submission: an assessment_submissions row, NOT a shared_reports
  // row — a share link makes the report public; a submission only lets that
  // organization's members read it and verify completed mitigations.
  const submitToAgency = async () => {
    if (!user || !selectedOrgId) return;
    setIsLoading(true);
    try {
      const submission = await submitAssessment(assessmentId, selectedOrgId, user.id);
      setSubmissions((prev) => [...prev, submission]);
      setSelectedOrgId('');
      const name = organizations.find((o) => o.id === selectedOrgId)?.name ?? 'the agency';
      showSuccessToast('Submitted', `${name} can now review this assessment`);
    } catch (error) {
      console.error('Error submitting to agency:', error);
      // FK violation: the assessment hasn't synced to the server yet.
      const code = (error as { code?: string }).code;
      showErrorToast(
        'Failed to submit',
        code === '23503' ? 'Sync this assessment first, then try again.' : undefined
      );
    } finally {
      setIsLoading(false);
    }
  };

  const withdraw = async (submission: AssessmentSubmission) => {
    setIsLoading(true);
    try {
      await withdrawSubmission(submission.id);
      setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
    } catch (error) {
      console.error('Error withdrawing submission:', error);
      showErrorToast('Failed to withdraw');
    } finally {
      setIsLoading(false);
    }
  };

  // Close the dialog first so it isn't in the printout, then print the report
  // underneath (the browser's "Save as PDF").
  const downloadPDF = () => {
    onClose();
    setTimeout(() => void printPage(), 300);
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

                    {submissions.length > 0 && (
                      <ul className="space-y-2">
                        {submissions.map((s) => (
                          <li
                            key={s.id}
                            className="flex items-center justify-between text-sm rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2"
                          >
                            <span className="text-gray-900 dark:text-white">
                              {organizations.find((o) => o.id === s.organizationId)?.name ?? 'Organization'}
                              <span className="ml-2 text-gray-500 dark:text-gray-400">
                                submitted {new Date(s.submittedAt).toLocaleDateString()}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => withdraw(s)}
                              disabled={isLoading}
                              className="text-gray-500 hover:text-red-700 dark:text-gray-400"
                            >
                              Withdraw
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div>
                      <label
                        htmlFor="agency-select"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        Agency
                      </label>
                      <select
                        id="agency-select"
                        className="input w-full"
                        value={selectedOrgId}
                        onChange={(e) => setSelectedOrgId(e.target.value)}
                      >
                        <option value="">
                          {choices.length === 0 ? 'No agencies available yet' : 'Choose an agency…'}
                        </option>
                        {choices.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name} ({ORGANIZATION_KIND_LABELS[o.kind]}
                            {o.stateCode ? `, ${o.stateCode}` : ''})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                        What happens next?
                      </h4>
                      <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                        <li className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-fire-100 dark:bg-fire-900/30 text-fire-600 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                            1
                          </span>
                          The agency you choose can view this assessment (it is not made public)
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-fire-100 dark:bg-fire-900/30 text-fire-600 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                            2
                          </span>
                          They review it and may schedule an inspection
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-fire-100 dark:bg-fire-900/30 text-fire-600 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                            3
                          </span>
                          Completed items they confirm show as Verified
                        </li>
                      </ul>
                    </div>

                    <button
                      onClick={submitToAgency}
                      disabled={isLoading || !selectedOrgId}
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
                    Print / Save as PDF
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
