import { describe, expect, it } from 'vitest';
import {
  DETECTION_GUIDANCE,
  findingContentForDetection,
  guidanceForDetection,
} from './detectionGuidance';
import { compositeProfile } from './composite';
import { WUI_CLASSES } from '@/features/computer-vision/services/wuiDetector';
import type { GuidelineProfile } from './types';
import type { DetectedRisk } from '@/shared/types';

const risk = (sourceClass?: string): DetectedRisk => ({
  type: 'Firewood / stored combustibles',
  confidence: 0.8,
  severity: 'high',
  description: 'Stored combustibles near the structure.',
  sourceClass,
});

describe('DETECTION_GUIDANCE', () => {
  it('covers every detector class', () => {
    for (const c of WUI_CLASSES) {
      expect(DETECTION_GUIDANCE[c], `missing guidance for ${c}`).toBeDefined();
    }
  });

  it('references only checklist item ids that exist in the composite profile', () => {
    // The anti-string-matching guarantee: every mapped id resolves against
    // the baseline profile, so no detection can point at a phantom item.
    const compositeIds = new Set(compositeProfile.checklistItems.map((i) => i.id));
    for (const [cls, entry] of Object.entries(DETECTION_GUIDANCE)) {
      for (const id of entry.itemIds) {
        expect(compositeIds.has(id), `${cls} → unknown item '${id}'`).toBe(true);
      }
    }
  });

  it('agrees with the composite items on category', () => {
    for (const [cls, entry] of Object.entries(DETECTION_GUIDANCE)) {
      for (const id of entry.itemIds) {
        const item = compositeProfile.checklistItems.find((i) => i.id === id)!;
        expect(item.category, `${cls} → ${id} category mismatch`).toBe(entry.category);
      }
    }
  });
});

describe('guidanceForDetection', () => {
  it('resolves items from the active profile', () => {
    const g = guidanceForDetection('firewood', compositeProfile)!;
    expect(g.category).toBe('defensible-space');
    expect(g.items[0]?.id).toBe('zone0-clear');
  });

  it('returns null for unknown or absent source classes (DeepLab risks)', () => {
    expect(guidanceForDetection(undefined, compositeProfile)).toBeNull();
    expect(guidanceForDetection('High Vegetation Density', compositeProfile)).toBeNull();
  });

  it('degrades gracefully when a state profile dropped a mapped item', () => {
    const stripped: GuidelineProfile = {
      ...compositeProfile,
      checklistItems: compositeProfile.checklistItems.filter((i) => i.id !== 'zone0-clear'),
    };
    const g = guidanceForDetection('firewood', stripped)!;
    expect(g.items).toHaveLength(0);
    expect(g.category).toBe('defensible-space'); // falls back to the entry's category
  });
});

describe('findingContentForDetection', () => {
  it('cites the profile label, checklist question, and standard', () => {
    const content = findingContentForDetection(risk('firewood'), compositeProfile)!;
    expect(content.category).toBe('defensible-space');
    expect(content.description).toContain('Stored combustibles near the structure.');
    expect(content.description).toContain(`Check (${compositeProfile.label}):`);
    expect(content.description).toContain('ember-resistant zone');
    expect(content.description).toContain('IBHS Zone 0');
  });

  it('returns null for non-WUI risks so callers keep their legacy mapping', () => {
    expect(findingContentForDetection(risk(undefined), compositeProfile)).toBeNull();
  });
});
