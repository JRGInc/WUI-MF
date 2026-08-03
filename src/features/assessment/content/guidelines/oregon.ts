import { compositeProfile } from './composite';
import { deriveProfile } from './derive';

/**
 * Oregon — SB 83 (2025) repealed the statewide SB 762 mandates; the OSFM
 * Model Defensible Space Code (finalized May 19, 2026) and ORSC R327 home
 * hardening are now locally adoptable (mandatory in e.g. Ashland, Grants
 * Pass, Deschutes County). Items follow the OSFM model code numbers and are
 * phrased as guidance since applicability depends on local adoption.
 */
export const oregonProfile = deriveProfile(compositeProfile, {
  id: 'us-or',
  stateCode: 'OR',
  label: 'Oregon',
  authority: 'OSFM Model Defensible Space Code · ORSC R327 (local adoption)',
  basis: 'guidance',
  basisNote:
    'Oregon repealed its statewide wildfire mandates in 2025 (SB 83); the State Fire Marshal\'s Model Defensible Space Code (May 2026) and the R327 hardening standard now apply only where your city or county has adopted them — check locally. The numbers here follow those state-published codes.',
  sources: [
    { title: 'OSFM — Defensible Space', url: 'https://www.oregon.gov/osfm/wildfire/pages/defensiblespace.aspx' },
    { title: 'OSFM Model Defensible Space Code (2026)', url: 'https://www.oregon.gov/osfm/Docs/Model%20Defensible%20Space%20Code_FINAL.pdf' },
  ],
  upsertItems: [
    {
      id: 'zone0-clear',
      category: 'defensible-space',
      question:
        'Is the 5-ft zone around buildings and decks noncombustible — no vegetation, needles, bark mulch, firewood, or lumber?',
      helpText:
        'OSFM Model Code §301.2: gravel, concrete, or bare soil in the first 5 ft; bark mulch and stored wood are called out explicitly. Mandatory where your city/county has adopted the code.',
      weight: 3,
      standard: 'OSFM Model Code §301.2',
    },
    {
      id: 'zone1-maintained',
      category: 'defensible-space',
      question:
        'Is a fuel-modification perimeter maintained to the local hazard tier — 30 ft (moderate), 50 ft (high), or 100 ft (extreme)?',
      helpText:
        'OSFM Model Code §301.3 tiers the perimeter by locally designated hazard, never extending past the lot line. §401-403 add an ongoing maintenance duty and optional inspections.',
      weight: 2,
      standard: 'OSFM Model Code §301.3',
    },
    {
      id: 'veg-tree-spacing',
      category: 'vegetation',
      question:
        'Are crowns separated 10 ft from each other and from structures, with trees over 18 ft limbed to 6 ft (smaller trees to 1/3 height)?',
      helpText:
        'OSFM Model Code §301.4.1: 10-ft crown-to-crown and crown-to-structure/utility separation, 6-ft limbing for tall trees, 1/3-height limbing for short ones, and 10 ft of chimney clearance.',
      weight: 2,
      standard: 'OSFM Model Code §301.4.1',
    },
    {
      id: 'roof-rated',
      category: 'roof-structure',
      question:
        'Is the roof at least Class B (Class A preferred) with noncombustible gutters and debris guards — no wood shake?',
      helpText:
        'ORSC R327 (where locally adopted): minimum Class B roof with wood shake prohibited, noncombustible gutters with debris guards. Class A remains the strongest choice anywhere.',
      weight: 3,
      standard: 'ORSC R327 (local adoption)',
    },
    {
      id: 'vents-screened',
      category: 'ember-intrusion',
      question:
        'Are vents 1/16-1/8 inch metal mesh or ember-rated, with no eave/soffit vents unless ember-rated or 12+ ft above grade?',
      helpText:
        'ORSC R327 vent standard: 1/16-1/8 inch corrosion-resistant metal mesh or ember-rated vents; eave and soffit vents are restricted because they sit directly in the ember path.',
      weight: 3,
      standard: 'ORSC R327',
    },
    {
      id: 'windows-multiPane',
      category: 'ember-intrusion',
      question: 'Is glazing tempered, multilayer, or 20-minute fire-rated?',
      helpText: 'ORSC R327 glazing standard for hardened homes.',
      weight: 2,
      standard: 'ORSC R327',
    },
    {
      id: 'deck-surface',
      category: 'roof-structure',
      question:
        'Are deck surfaces ignition-resistant (ASTM E2632/E2726), with undersides protected where less than 12 ft above grade?',
      helpText:
        'ORSC R327 deck standard: tested walking surfaces and protected eaves/soffits/deck undersides below 12 ft.',
      weight: 1,
      standard: 'ORSC R327',
    },
  ],
});
