import type { DetectedRisk, RiskCategory } from '@/shared/types';
import type { ChecklistItem, GuidelineProfile } from './types';
import type { WuiClass } from '@/features/computer-vision/services/wuiDetector';

/**
 * Typed bridge from WUI-detector classes to the jurisdiction's guideline
 * content: each detector class names its risk category and the checklist
 * items it should surface. This is the detection → guidance loop BFMA built
 * with GameObject-name string matching (which crashed on `stairs`); here the
 * map is keyed by the detector's class union, so a missing entry is a compile
 * error, and lookups resolve against the *active state profile* — a firewood
 * detection in California cites California's Zone 0 item, not a generic one.
 *
 * Item ids are the composite profile's ids, which state profiles reuse for
 * unchanged questions (see guidelines/index.ts); an id a profile dropped is
 * skipped gracefully.
 */

export interface DetectionGuidanceEntry {
  /** Fallback category when no mapped item exists in the active profile. */
  category: RiskCategory;
  /** Checklist items to surface, most relevant first. */
  itemIds: string[];
}

export const DETECTION_GUIDANCE: Record<WuiClass, DetectionGuidanceEntry> = {
  solar_panel: { category: 'roof-structure', itemIds: ['roof-rated'] },
  garage: { category: 'ember-intrusion', itemIds: ['gaps-sealed'] },
  pergola: { category: 'defensible-space', itemIds: ['zone0-clear'] },
  trellis: { category: 'defensible-space', itemIds: ['zone0-clear'] },
  fence: { category: 'defensible-space', itemIds: ['fence-attachment'] },
  tree: { category: 'vegetation', itemIds: ['veg-overhang', 'veg-tree-spacing'] },
  window: { category: 'ember-intrusion', itemIds: ['windows-multiPane'] },
  plant: { category: 'defensible-space', itemIds: ['zone0-clear', 'zone1-maintained'] },
  door: { category: 'ember-intrusion', itemIds: ['gaps-sealed'] },
  vehicle: { category: 'access-evacuation', itemIds: ['driveway-clearance'] },
  roof: { category: 'roof-structure', itemIds: ['roof-rated'] },
  skylight: { category: 'roof-structure', itemIds: ['roof-rated'] },
  firewood: { category: 'defensible-space', itemIds: ['zone0-clear'] },
  furniture: { category: 'defensible-space', itemIds: ['zone0-clear'] },
  siding: { category: 'roof-structure', itemIds: ['siding-noncombustible'] },
  deck: { category: 'roof-structure', itemIds: ['deck-under-clear', 'deck-surface'] },
  gutter: { category: 'roof-structure', itemIds: ['gutters-clean'] },
  vent: { category: 'ember-intrusion', itemIds: ['vents-screened'] },
  stairs: { category: 'roof-structure', itemIds: ['deck-under-clear'] },
};

export interface DetectionGuidance {
  category: RiskCategory;
  /** The active profile's checklist items for this detection (may be empty). */
  items: ChecklistItem[];
}

/**
 * Guideline guidance for a detector class under the active profile, or null
 * for an unknown/absent sourceClass (e.g. risks from the DeepLab path).
 * The category comes from the first matched item when one exists, so the
 * finding always files under the same category as the checklist question it
 * cites.
 */
export function guidanceForDetection(
  sourceClass: string | undefined,
  profile: GuidelineProfile
): DetectionGuidance | null {
  if (!sourceClass || !(sourceClass in DETECTION_GUIDANCE)) return null;
  const entry = DETECTION_GUIDANCE[sourceClass as WuiClass];
  const items = entry.itemIds
    .map((id) => profile.checklistItems.find((item) => item.id === id))
    .filter((item): item is ChecklistItem => item !== undefined);
  return { category: items[0]?.category ?? entry.category, items };
}

/**
 * Category + description for persisting a detection as a Finding: the
 * detector's hazard explanation, followed by the jurisdiction's checklist
 * question (with its authoritative standard) so the finding carries the
 * localized "what to verify" alongside the "what was seen".
 */
export function findingContentForDetection(
  risk: DetectedRisk,
  profile: GuidelineProfile
): { category: RiskCategory; description: string } | null {
  const guidance = guidanceForDetection(risk.sourceClass, profile);
  if (!guidance) return null;
  const item = guidance.items[0];
  let description = risk.description;
  if (item) {
    description += `\n\nCheck (${profile.label}): ${item.question}`;
    if (item.standard) description += ` [${item.standard}]`;
  }
  return { category: guidance.category, description };
}
