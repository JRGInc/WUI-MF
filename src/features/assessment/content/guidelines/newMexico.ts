import { compositeProfile } from './composite';
import { deriveProfile } from './derive';

/**
 * New Mexico — EMNRD Forestry guidance plus the 2025 Wildfire Prepared Act
 * (SB 33): a voluntary, funded assessment/certification program using
 * IBHS-style standards (0-5 ft noncombustible zone). EMNRD's legacy pubs are
 * CSFS-derived. Note: EMNRD publications conflict on Zone 1 width (15 vs
 * 30 ft) — this profile uses the Living With Fire guide's 30 ft.
 */
export const newMexicoProfile = deriveProfile(compositeProfile, {
  id: 'us-nm',
  stateCode: 'NM',
  label: 'New Mexico',
  authority: 'EMNRD Forestry · Wildfire Prepared Act (SB 33, 2025)',
  basis: 'guidance',
  basisNote:
    'New Mexico\'s 2025 Wildfire Prepared Act created a voluntary, state-funded assessment and certification program under EMNRD Forestry; the numbers here follow EMNRD\'s published defensible-zone guidance. No requirements are enforced on homeowners.',
  sources: [
    { title: 'EMNRD — Living With Fire Guide', url: 'https://www.emnrd.nm.gov/sfd/fire-prevention-programs/living-with-fire-guide-new-mexico/' },
    { title: 'EMNRD — Creating Wildfire-Defensible Zones', url: 'https://www.emnrd.nm.gov/sfd/wp-content/uploads/sites/4/Wui_defzone.pdf' },
  ],
  upsertItems: [
    {
      id: 'zone0-clear',
      category: 'defensible-space',
      question:
        'Is the 0-5 ft zone noncombustible, with nothing flammable against walls or under windows?',
      helpText:
        'The Wildfire Prepared Act certification uses IBHS-style standards starting with a noncombustible 0-5 ft zone. State assessments and grants are available through EMNRD Forestry.',
      weight: 3,
      standard: 'NM Wildfire Prepared Act · IBHS',
    },
    {
      id: 'zone1-maintained',
      category: 'defensible-space',
      question:
        'Is Zone 1 (30 ft) clear of flammables, with grass kept to 6-8 inches and firewood/propane at least 30 ft out?',
      helpText:
        'EMNRD Living With Fire guidance: a 30-ft lean zone with any trees crown-isolated, grass at 6-8 inches, and combustible storage 30 ft from the home.',
      weight: 2,
      standard: 'EMNRD Living With Fire',
    },
    {
      id: 'zone2-reduced',
      category: 'defensible-space',
      question:
        'Does fuel reduction extend 75-125 ft (slope-adjusted), with "diameter + 7 ft" stem spacing when thinning?',
      helpText:
        'EMNRD\'s defensible-zone pub slope-adjusts the outer zone to 75-125 ft and uses trunk-diameter-plus-7-feet spacing between remaining stems.',
      weight: 2,
      standard: 'EMNRD Creating Wildfire-Defensible Zones',
    },
    {
      id: 'veg-tree-spacing',
      category: 'vegetation',
      question: 'Are tree crowns 10 ft apart and trees pruned up 10 ft (or 1/3 of height)?',
      helpText: 'EMNRD crown spacing and pruning standard.',
      weight: 2,
      standard: 'EMNRD Forestry',
    },
    {
      id: 'roof-rated',
      category: 'roof-structure',
      question: 'Is the roof at least Class B fire-rated — preferably Class A, never wood shake?',
      helpText: 'EMNRD guidance sets Class B as the floor and Class A as the goal.',
      weight: 3,
      standard: 'EMNRD Forestry',
    },
  ],
});
