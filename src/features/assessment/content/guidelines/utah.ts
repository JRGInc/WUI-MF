import { compositeProfile } from './composite';
import { deriveProfile } from './derive';

/**
 * Utah — MANDATORY statewide: the Utah WUI Code (2006 IWUIC with Utah
 * amendments, Utah Code 15A-2-103) plus HB 48 (effective Jan 1, 2026), which
 * requires every city/county to adopt WUI maps and enforce the code. Existing
 * homes in the state high-risk WUI pay a wildfire-mitigation fee on property
 * taxes (reduced by completed mitigation); insurers must use the state map.
 */
export const utahProfile = deriveProfile(compositeProfile, {
  id: 'us-ut',
  stateCode: 'UT',
  label: 'Utah',
  authority: 'Utah WUI Code (IWUIC) · FFSL · HB 48 (2025)',
  basis: 'mandatory',
  basisNote:
    'The Utah WUI Code is enforced through local adoption required by HB 48 (effective Jan 1, 2026). Homes in the state high-risk WUI pay a wildfire-mitigation fee on property taxes — completing the mitigation in this checklist can reduce it.',
  sources: [
    { title: 'FFSL — WUI Risk & HB 48', url: 'https://ffsl.utah.gov/wuirisk' },
    { title: 'Utah Wildfire Risk Map', url: 'https://wildfirerisk.utah.gov/' },
  ],
  upsertItems: [
    {
      id: 'zone0-clear',
      category: 'defensible-space',
      question:
        'Are combustible plants and wood mulch kept out of the first 5 ft of walls, eaves, and decks, with no tree within 10 ft of the structure?',
      helpText:
        'Utah WUI Code §603: no combustible vegetation or wood mulch within 5 ft of the structure and no trees within 10 ft. Completed mitigation can reduce the HB 48 wildfire fee for homes in the high-risk WUI.',
      weight: 3,
      standard: 'Utah WUI Code §603 (mandatory)',
    },
    {
      id: 'zone1-maintained',
      category: 'defensible-space',
      question:
        'Is defensible space maintained to the hazard-class distance — 30 ft (moderate), 50 ft (high), or 100 ft (extreme) — with grass mowed to 4 inches within 30 ft?',
      helpText:
        'Utah WUI Code §603 scales the defensible-space distance with hazard severity. FFSL guidance adds 4-inch grass within 30 ft and canopy spacing of 12 ft at 30-60 ft and 6 ft at 60-100 ft.',
      weight: 2,
      standard: 'Utah WUI Code §603 · FFSL',
    },
    {
      id: 'ut-firewood',
      category: 'defensible-space',
      question:
        'Is firewood stored at least 20 ft from structures, 15 ft from tree crowns, and never under decks or eaves?',
      helpText: 'Utah WUI Code §607 sets firewood placement rules.',
      weight: 1,
      standard: 'Utah WUI Code §607',
    },
    {
      id: 'veg-tree-spacing',
      category: 'vegetation',
      question:
        'Are tree limbs removed below 6 ft, with 10 ft of crown clearance from structures and chimneys, and roofs kept clear of litter?',
      helpText: 'Utah WUI Code §604 maintenance rules for trees and roof litter.',
      weight: 2,
      standard: 'Utah WUI Code §604',
    },
    {
      id: 'ut-spark-arrester',
      category: 'roof-structure',
      question:
        'Do chimneys have spark arresters with mesh openings of 1/2 inch or less?',
      helpText: 'Utah WUI Code §605 requires spark arresters on solid-fuel chimneys.',
      weight: 1,
      standard: 'Utah WUI Code §605',
    },
    {
      id: 'vents-screened',
      category: 'ember-intrusion',
      question:
        'Are vents limited to 144 sq in with corrosion-resistant mesh of 1/4 inch or finer (1/8 inch in many jurisdictions)?',
      helpText:
        'Utah WUI Code §504 (ignition-resistant construction): vents ≤144 sq in with ≤1/4-inch mesh — many local amendments require 1/8 inch, and ember-rated vents are better still. Eave/soffit vents are prohibited in Class 1 construction.',
      weight: 3,
      standard: 'Utah WUI Code §504',
    },
    {
      id: 'windows-multiPane',
      category: 'ember-intrusion',
      question:
        'Are windows tempered or 20-minute rated, with exterior doors at least 1-3/4 inch solid core?',
      helpText: 'Utah WUI Code §504 glazing and door requirements for ignition-resistant construction.',
      weight: 2,
      standard: 'Utah WUI Code §504',
    },
    {
      id: 'driveway-clearance',
      category: 'access-evacuation',
      question:
        'Does access provide 20 ft of unobstructed width and 13\'6" vertical clearance, with turnarounds on drives over 150 ft?',
      helpText:
        'Utah WUI Code Ch. 4: 20-ft width, 13\'6" vertical clearance, turnarounds beyond 150 ft, passing turnouts beyond 500 ft, and address signage mounted at 7 ft.',
      weight: 2,
      standard: 'Utah WUI Code Ch. 4',
    },
    {
      id: 'water-source',
      category: 'water-supply',
      question: 'Is a hydrant or approved water supply available within 1,000 ft?',
      helpText: 'Utah WUI Code Ch. 4 water-supply standard; a pool, pond, or cistern that engines can draft from also helps.',
      weight: 2,
      standard: 'Utah WUI Code Ch. 4',
    },
  ],
  upsertRecommendationRules: [
    {
      category: 'defensible-space',
      threshold: 7,
      priority: 'immediate',
      title: 'Meet Utah WUI Code Defensible Space',
      description:
        'Clear combustibles from the first 5 ft, maintain the hazard-class distance (30/50/100 ft), and fix firewood placement (20 ft from structures). In the state high-risk WUI this also reduces your HB 48 wildfire-mitigation fee.',
      estimatedCost: '$500-2000',
    },
  ],
});
