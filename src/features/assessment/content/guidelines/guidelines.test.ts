import { describe, expect, it } from 'vitest';
import type { CategoryScores, RiskCategory } from '@/shared/types';
import {
  STATE_GUIDELINE_PROFILES,
  compositeProfile,
  generateRecommendations,
  guidelineProfileById,
  resolveGuidelineProfile,
} from './index';

const ALL_CATEGORIES: RiskCategory[] = [
  'defensible-space',
  'roof-structure',
  'vegetation',
  'access-evacuation',
  'water-supply',
  'ember-intrusion',
];

const allProfiles = [compositeProfile, ...STATE_GUIDELINE_PROFILES];

describe('guideline profiles', () => {
  it.each(allProfiles.map((p) => [p.id, p] as const))(
    '%s covers all six risk categories',
    (_id, profile) => {
      // The overall score averages all six categories; a profile without
      // items in a category would silently zero that category's score.
      const covered = new Set(profile.checklistItems.map((i) => i.category));
      for (const category of ALL_CATEGORIES) {
        expect(covered, `missing items for ${category}`).toContain(category);
      }
    }
  );

  it.each(allProfiles.map((p) => [p.id, p] as const))(
    '%s has unique item ids and positive weights',
    (_id, profile) => {
      const ids = profile.checklistItems.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const item of profile.checklistItems) {
        expect(item.weight).toBeGreaterThan(0);
      }
    }
  );

  it('profile ids are unique across the registry', () => {
    const ids = allProfiles.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(allProfiles.map((p) => [p.id, p] as const))(
    '%s declares user-facing provenance',
    (_id, profile) => {
      expect(profile.basisNote.length).toBeGreaterThan(20);
      expect(profile.sources.length).toBeGreaterThan(0);
      for (const source of profile.sources) {
        expect(source.url).toMatch(/^https:\/\//);
        expect(source.title.length).toBeGreaterThan(0);
      }
    }
  );
});

describe('resolveGuidelineProfile', () => {
  it('returns state profiles for covered states', () => {
    expect(resolveGuidelineProfile('CA').id).toBe('us-ca');
    expect(resolveGuidelineProfile('GA').id).toBe('us-ga');
  });

  it('falls back to the composite for uncovered or unknown states', () => {
    expect(resolveGuidelineProfile('TX').id).toBe('composite');
    expect(resolveGuidelineProfile(null).id).toBe('composite');
    expect(resolveGuidelineProfile(undefined).id).toBe('composite');
  });

  it('looks up persisted profiles by id with composite fallback', () => {
    expect(guidelineProfileById('us-ca').id).toBe('us-ca');
    expect(guidelineProfileById('composite').id).toBe('composite');
    expect(guidelineProfileById('us-zz').id).toBe('composite');
    expect(guidelineProfileById(undefined).id).toBe('composite');
  });
});

describe('generateRecommendations', () => {
  const scores = (overrides: Partial<CategoryScores>): CategoryScores => ({
    defensibleSpace: 10,
    roofAndStructure: 10,
    vegetationManagement: 10,
    accessAndEvacuation: 10,
    waterSupply: 10,
    emberIntrusion: 10,
    ...overrides,
  });

  it('emits a recommendation only for categories below their threshold', () => {
    const recs = generateRecommendations(compositeProfile, scores({ defensibleSpace: 3 }));
    expect(recs).toHaveLength(1);
    expect(recs[0].category).toBe('defensible-space');
    expect(recs[0].id).toBeTruthy();
  });

  it('emits nothing when every category meets its threshold', () => {
    expect(generateRecommendations(compositeProfile, scores({}))).toHaveLength(0);
  });
});
