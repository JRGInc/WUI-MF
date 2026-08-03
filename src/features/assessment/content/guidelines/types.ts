import type { RiskCategory } from '@/shared/types';

/** One yes/no inspection question. Weights are relative within a category —
 * scores normalize to 0-10 per category, so profiles may use any item count. */
export interface ChecklistItem {
  id: string;
  category: RiskCategory;
  question: string;
  helpText?: string;
  weight: number;
  positiveLabel?: string;
  negativeLabel?: string;
  // Authoritative standard backing the item (shown as a small provenance tag).
  standard?: string;
}

/** Emit a recommendation when the category's normalized score (0-10) falls
 * below `threshold`. */
export interface RecommendationRule {
  category: RiskCategory;
  threshold: number;
  priority: 'immediate' | 'short-term' | 'long-term';
  title: string;
  description: string;
  estimatedCost?: string;
}

/** Legal standing of a guideline set, shown to the user as provenance.
 * - mandatory: state statute/regulation homeowners must follow
 * - partial-mandate: legally binding only in part (a sub-region, a pending
 *   rulemaking, or hardening-only)
 * - guidance: the state's own published guidance, voluntary
 * - baseline: the national composite fallback */
export type GuidelineBasis = 'mandatory' | 'partial-mandate' | 'guidance' | 'baseline';

/** An official publication the guideline content is drawn from. */
export interface GuidelineSource {
  title: string;
  url: string;
}

/**
 * A jurisdiction's inspection guideline set. Profiles are selected by the
 * property's US state (`stateCode`); the composite profile (stateCode null)
 * is the fallback when no state-specific guidance exists.
 */
export interface GuidelineProfile {
  id: string;
  /** USPS state code this profile applies to; null for the composite fallback. */
  stateCode: string | null;
  /** Short label shown in the UI, e.g. "California". */
  label: string;
  /** The authority/standards behind the profile, shown as provenance. */
  authority: string;
  /** Legal standing of the guidelines. */
  basis: GuidelineBasis;
  /** One or two user-facing sentences on where these guidelines come from
   * and whether they are legally required. */
  basisNote: string;
  /** Official sources for further reading; shown as links in the UI. */
  sources: GuidelineSource[];
  checklistItems: ChecklistItem[];
  recommendationRules: RecommendationRule[];
}
