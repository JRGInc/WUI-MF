import type {
  ChecklistItem,
  GuidelineBasis,
  GuidelineProfile,
  GuidelineSource,
  RecommendationRule,
} from './types';

export interface ProfileOverrides {
  id: string;
  stateCode: string;
  label: string;
  authority: string;
  basis: GuidelineBasis;
  basisNote: string;
  sources: GuidelineSource[];
  /** Items to add or replace. An item whose `id` exists in the base replaces
   * it in place; new ids are appended after the last item of their category
   * so the checklist stays grouped. */
  upsertItems?: ChecklistItem[];
  /** Ids of base items to drop. */
  removeItemIds?: string[];
  /** Rules to add or replace, matched by category+title; otherwise appended. */
  upsertRecommendationRules?: RecommendationRule[];
}

/**
 * Build a state profile as a delta from another profile (normally the
 * composite). Most states differ from the national baseline in a handful of
 * items and citations; expressing them as overrides keeps the per-state files
 * small and means baseline improvements flow through automatically.
 */
export function deriveProfile(
  base: GuidelineProfile,
  overrides: ProfileOverrides
): GuidelineProfile {
  const removed = new Set(overrides.removeItemIds ?? []);
  const items = base.checklistItems.filter((item) => !removed.has(item.id));

  for (const upsert of overrides.upsertItems ?? []) {
    const existing = items.findIndex((item) => item.id === upsert.id);
    if (existing !== -1) {
      items[existing] = upsert;
      continue;
    }
    // Append after the last item of the same category (or at the end).
    let insertAt = items.length;
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].category === upsert.category) {
        insertAt = i + 1;
        break;
      }
    }
    items.splice(insertAt, 0, upsert);
  }

  const rules = [...base.recommendationRules];
  for (const upsert of overrides.upsertRecommendationRules ?? []) {
    const existing = rules.findIndex((rule) => rule.category === upsert.category);
    if (existing !== -1) rules[existing] = upsert;
    else rules.push(upsert);
  }

  return {
    id: overrides.id,
    stateCode: overrides.stateCode,
    label: overrides.label,
    authority: overrides.authority,
    basis: overrides.basis,
    basisNote: overrides.basisNote,
    sources: overrides.sources,
    checklistItems: items,
    recommendationRules: rules,
  };
}
