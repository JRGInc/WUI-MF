import { compositeProfile } from './composite';
import { deriveProfile } from './derive';

/**
 * Colorado — MANDATORY statewide: the Colorado Wildfire Resiliency Code
 * (8 CCR 1507-39, from SB23-166), enforced by local AHJs from July 1, 2026 in
 * mapped WUI areas. Applies to new construction (plus large additions,
 * ≥25% reroofs/wall replacement) with an ongoing owner maintenance duty;
 * hardening tiers are Class 1 (low hazard) and Class 2 (moderate/high).
 * Section numbers below were cross-checked against the Estes Valley FPD
 * official overview — re-verify against the adopted 8 CCR 1507-39 text
 * before treating thresholds as final.
 */
export const coloradoProfile = deriveProfile(compositeProfile, {
  id: 'us-co',
  stateCode: 'CO',
  label: 'Colorado',
  authority: 'Colorado Wildfire Resiliency Code (8 CCR 1507-39) · CSFS',
  basis: 'mandatory',
  basisNote:
    'The Colorado Wildfire Resiliency Code (8 CCR 1507-39, from SB23-166) is enforced by local building authorities from July 1, 2026 in mapped WUI areas — it applies to new construction and major alterations, with an ongoing owner maintenance duty for defensible space.',
  sources: [
    { title: 'Wildfire Resiliency Code Board (DFPC)', url: 'https://dfpc.colorado.gov/WRCB' },
    { title: 'CSFS — Home Ignition Zone Guide', url: 'https://csfs.colostate.edu/wp-content/uploads/2021/04/2021_CSFS_HIZGuide_Web.pdf' },
  ],
  upsertItems: [
    {
      id: 'zone0-clear',
      category: 'defensible-space',
      question:
        'Is Zone 1 (0-5 ft) limited to noncombustible hard surfaces — no plantings, no combustible mulch, no new trees?',
      helpText:
        'The Colorado Wildfire Resiliency Code requires the first 5 ft around structures in mapped WUI areas to be noncombustible for all hazard classes, with tree crowns kept 10 ft from the structure.',
      weight: 3,
      standard: 'CWRC Ch. 5 Zone 1 (mandatory in mapped WUI)',
    },
    {
      id: 'fence-attachment',
      category: 'defensible-space',
      question:
        'Are fences and retaining walls within 8 ft of the structure noncombustible?',
      helpText:
        'The CWRC requires noncombustible fences and retaining walls within 8 ft of the structure — a combustible fence is a direct flame path to the wall.',
      weight: 2,
      standard: 'CWRC Ch. 5',
    },
    {
      id: 'zone1-maintained',
      category: 'defensible-space',
      question:
        'In Zone 2 (5-30 ft), is dead material removed with 10 ft of crown clearance maintained?',
      helpText:
        'CWRC Zone 2 (moderate/high hazard): remove dead vegetation and keep 10 ft between tree crowns and between crowns and the structure. Keep grass at 4 inches or less (CSFS guidance).',
      weight: 2,
      standard: 'CWRC Ch. 5 Zone 2 · CSFS HIZ',
    },
    {
      id: 'zone2-reduced',
      category: 'defensible-space',
      question: 'In Zone 3 (30-100 ft), are tree crowns spaced 6-10 ft apart?',
      helpText:
        'CWRC Zone 3 (moderate/high hazard) requires 6-10 ft crown spacing; CSFS guidance suggests wider spacing on slopes.',
      weight: 2,
      standard: 'CWRC Ch. 5 Zone 3',
    },
    {
      id: 'veg-tree-spacing',
      category: 'vegetation',
      question:
        'Are trees pruned up 6-10 ft (or 1/3 of height) with crowns 10 ft from the structure and from each other?',
      helpText:
        'CWRC ladder-fuel rules: prune to 6-10 ft or 1/3 of tree height, and hold 10 ft crown-to-structure and crown-to-crown clearance near the home.',
      weight: 2,
      standard: 'CWRC Ch. 5',
    },
    {
      id: 'roof-rated',
      category: 'roof-structure',
      question:
        'Is the roof Class A with roof-edge ember protection and noncombustible gutters/downspouts?',
      helpText:
        'CWRC Class 1 hardening (all mapped WUI new construction): Class A roof assembly, ember protection at roof edges, noncombustible gutters and downspouts, and chimney spark arrestors.',
      weight: 3,
      standard: 'CWRC §403 (Class 1)',
    },
    {
      id: 'vents-screened',
      category: 'ember-intrusion',
      question: 'Are vents fitted with ember-resistant screening of 1/8 inch or finer?',
      helpText:
        'CWRC Class 1 requires ember-resistant vent screening at 1/8 inch or finer; ember-rated vents (ASTM E2886) are the strongest option.',
      weight: 3,
      standard: 'CWRC §403',
    },
    {
      id: 'windows-multiPane',
      category: 'ember-intrusion',
      question: 'Are windows and doors 20-minute fire-rated (or tempered multi-pane)?',
      helpText:
        'CWRC Class 2 (moderate/high hazard) requires 20-minute-rated glazing and doors, plus garage-door ember seals, 6-inch wall flashing, and enclosed underfloors.',
      weight: 2,
      standard: 'CWRC §404 (Class 2)',
    },
  ],
  upsertRecommendationRules: [
    {
      category: 'defensible-space',
      threshold: 7,
      priority: 'immediate',
      title: 'Meet the Colorado Wildfire Resiliency Code Zones',
      description:
        'Colorado\'s statewide code (enforced from July 1, 2026 in mapped WUI areas) requires a noncombustible 0-5 ft Zone 1, dead-material removal with 10-ft crown clearance in Zone 2 (5-30 ft), and 6-10 ft crown spacing in Zone 3 (30-100 ft), with an ongoing owner maintenance duty.',
      estimatedCost: '$500-2500',
    },
    {
      category: 'ember-intrusion',
      threshold: 7,
      priority: 'short-term',
      title: 'Harden Ember Entry Points to CWRC Class Requirements',
      description:
        'Fit ember-resistant vent screening (≤1/8 inch), chimney spark arrestors, and — in moderate/high hazard areas — 20-minute-rated glazing/doors and garage-door ember seals per CWRC Class 2.',
      estimatedCost: '$300-1200',
    },
  ],
});
