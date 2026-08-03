import { compositeProfile } from './composite';
import { deriveProfile } from './derive';

/**
 * Arizona — DFFM "Homeowners' Firewise Guide for Arizona" plus UA Extension
 * az1290 (CSFS-derived numbers). Voluntary; WUI codes are local-option
 * (Flagstaff, Prescott). Distinct numbers: slope-adjusted Zone 2 to
 * 75-125 ft, 6-8 inch grass, "diameter + 7" stem spacing.
 */
export const arizonaProfile = deriveProfile(compositeProfile, {
  id: 'us-az',
  stateCode: 'AZ',
  label: 'Arizona',
  authority: 'AZ DFFM Firewise Guide · UA Extension az1290',
  basis: 'guidance',
  basisNote:
    'Arizona has no statewide mandate; these items follow the Department of Forestry and Fire Management\'s Firewise guide and the University of Arizona Extension defensible-space publication (az1290). Flagstaff and Prescott have local WUI codes — check locally.',
  sources: [
    { title: 'AZ DFFM — Firewise', url: 'https://dffm.az.gov/fire/prevention/firewise' },
    { title: 'UA Extension az1290 — Defensible Space', url: 'https://extension.arizona.edu/sites/extension.arizona.edu/files/pubs/az1290.pdf' },
  ],
  upsertItems: [
    {
      id: 'zone0-clear',
      category: 'defensible-space',
      question:
        'Is there nothing combustible within 3-5 ft of the structure — no plants, mulch, or stored items?',
      helpText:
        'Arizona guidance keeps the immediate 3-5 ft clear of anything ignitable; gravel or decomposed granite works well in desert landscaping.',
      weight: 3,
      standard: 'AZ DFFM · az1290',
    },
    {
      id: 'zone1-maintained',
      category: 'defensible-space',
      question:
        'Is Zone 1 (30 ft) maintained lean and clean, with firewood and propane at least 30 ft out (10 ft of clearance around the tank)?',
      helpText:
        'az1290: 30-ft Zone 1 with grass kept to 6-8 inches maximum, and combustible storage (firewood, propane) moved 30 ft from the home.',
      weight: 2,
      standard: 'az1290',
    },
    {
      id: 'zone2-reduced',
      category: 'defensible-space',
      question:
        'Does fuel reduction extend 75-125 ft total, adjusted for slope (further downhill on steeper ground)?',
      helpText:
        'az1290 slope-adjusts Zone 2: about 75 ft on flat ground up to 125 ft on steep slopes (e.g. a 20% slope calls for ~90 ft uphill and ~104 ft downhill). In Zone 3, use "trunk diameter + 7 ft" stem spacing when thinning.',
      weight: 2,
      standard: 'az1290',
    },
    {
      id: 'veg-tree-spacing',
      category: 'vegetation',
      question:
        'Are tree crowns 10 ft apart and trees pruned up 10 ft (or 1/3 of height)?',
      helpText: 'az1290 crown spacing and pruning standard for ponderosa and chaparral country.',
      weight: 2,
      standard: 'az1290',
    },
  ],
});
