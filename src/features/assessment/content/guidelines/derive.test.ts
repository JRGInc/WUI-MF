import { describe, expect, it } from 'vitest';
import { compositeProfile } from './composite';
import { deriveProfile } from './derive';

describe('deriveProfile', () => {
  it('replaces items in place and appends new items within their category', () => {
    const derived = deriveProfile(compositeProfile, {
      id: 'us-xx',
      stateCode: 'XX',
      label: 'Testland',
      authority: 'Test Forestry Board',
      basis: 'guidance',
      basisNote: 'Test guidance.',
      sources: [{ title: 'Test source', url: 'https://example.com' }],
      upsertItems: [
        {
          id: 'roof-rated',
          category: 'roof-structure',
          question: 'Replaced question?',
          weight: 3,
        },
        {
          id: 'xx-new-item',
          category: 'defensible-space',
          question: 'New state item?',
          weight: 2,
        },
      ],
      removeItemIds: ['hose-available'],
    });

    // Replacement kept the item's position relative to its neighbours.
    const replaced = derived.checklistItems.filter((i) => i.id === 'roof-rated');
    expect(replaced).toHaveLength(1);
    expect(replaced[0].question).toBe('Replaced question?');
    const baseOrder = compositeProfile.checklistItems
      .filter((i) => i.category === 'roof-structure')
      .map((i) => i.id);
    const derivedOrder = derived.checklistItems
      .filter((i) => i.category === 'roof-structure')
      .map((i) => i.id);
    expect(derivedOrder).toEqual(baseOrder);

    // New item sits directly after the last defensible-space item.
    const dsIndexes = derived.checklistItems
      .map((item, i) => (item.category === 'defensible-space' ? i : -1))
      .filter((i) => i !== -1);
    const newIndex = derived.checklistItems.findIndex((i) => i.id === 'xx-new-item');
    expect(newIndex).toBe(dsIndexes[dsIndexes.length - 1]);
    expect(dsIndexes[dsIndexes.length - 1] - dsIndexes[0]).toBe(dsIndexes.length - 1);

    // Removal applied; base profile untouched.
    expect(derived.checklistItems.find((i) => i.id === 'hose-available')).toBeUndefined();
    expect(compositeProfile.checklistItems.find((i) => i.id === 'hose-available')).toBeDefined();
    expect(
      compositeProfile.checklistItems.find((i) => i.id === 'roof-rated')?.question
    ).not.toBe('Replaced question?');
  });

  it('replaces recommendation rules by category and appends new ones', () => {
    const derived = deriveProfile(compositeProfile, {
      id: 'us-xx',
      stateCode: 'XX',
      label: 'Testland',
      authority: 'Test Forestry Board',
      basis: 'guidance',
      basisNote: 'Test guidance.',
      sources: [{ title: 'Test source', url: 'https://example.com' }],
      upsertRecommendationRules: [
        {
          category: 'defensible-space',
          threshold: 8,
          priority: 'immediate',
          title: 'State rule',
          description: 'State-specific text.',
        },
        {
          category: 'water-supply',
          threshold: 5,
          priority: 'long-term',
          title: 'New rule',
          description: 'Appended.',
        },
      ],
    });

    const ds = derived.recommendationRules.filter((r) => r.category === 'defensible-space');
    expect(ds).toHaveLength(1);
    expect(ds[0].title).toBe('State rule');
    expect(derived.recommendationRules.find((r) => r.category === 'water-supply')?.title).toBe(
      'New rule'
    );
    expect(derived.recommendationRules.length).toBe(
      compositeProfile.recommendationRules.length + 1
    );
  });
});
