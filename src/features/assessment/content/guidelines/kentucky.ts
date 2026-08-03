import { compositeProfile } from './composite';
import { deriveProfile } from './derive';

/**
 * Kentucky — KY Division of Forestry "Woodland Home Wildfire Hazard
 * Assessment" (a scored yes/no instrument; voluntary). Distinct numbers:
 * 12-ft × 14.5-ft driveway, gates 30 ft back / 2 ft wider / opening inward,
 * firewood and LP tanks 50 ft out with 15 ft cleared, shrubs 5 ft from
 * structures, wooden fences 10-12 ft from the home, 1/8-inch attic and
 * under-deck mesh, chimney spark arrestor + cap.
 */
export const kentuckyProfile = deriveProfile(compositeProfile, {
  id: 'us-ky',
  stateCode: 'KY',
  label: 'Kentucky',
  authority: 'KY Division of Forestry · Woodland Home Assessment',
  basis: 'guidance',
  basisNote:
    'The Kentucky Division of Forestry\'s Woodland Home Wildfire Hazard Assessment is the state\'s own scored inspection standard — these items mirror its criteria. Voluntary; Kentucky\'s only binding fire rules are seasonal burn-time restrictions.',
  sources: [
    { title: 'KY Woodland Home Wildfire Hazard Assessment (PDF)', url: 'https://eec.ky.gov/Natural-Resources/Forestry/Documents/Woodland%20Home%20Wildfire%20Hazard%20Assessment%20-%20(pdf%20format).pdf' },
    { title: 'Kentucky Firewise Program', url: 'https://eec.ky.gov/Natural-Resources/Forestry/wildland-fire-management/Pages/Kentucky-Firewise-Program.aspx' },
  ],
  upsertItems: [
    {
      id: 'zone0-clear',
      category: 'defensible-space',
      question:
        'Are shrubs kept at least 5 ft from structures, with pea gravel or lava rock in place of combustible mulch against the house?',
      helpText:
        'The KY Woodland Home Assessment scores foundation plantings: shrubs 5+ ft out and noncombustible rock instead of mulch beds against the walls.',
      weight: 3,
      standard: 'KY Woodland Home Assessment',
    },
    {
      id: 'ky-firewood-lp',
      category: 'defensible-space',
      question:
        'Are firewood stacks and LP tanks at least 50 ft from structures, with 15 ft of cleared space around the tank?',
      helpText:
        'Kentucky\'s assessment uses a 50-ft setback for firewood and LP tanks — stricter than the common 30 ft — and penalizes overgrown vegetation around tanks.',
      weight: 1,
      standard: 'KY Woodland Home Assessment',
    },
    {
      id: 'fence-attachment',
      category: 'defensible-space',
      question:
        'Are wooden fences and trellises either noncombustible or kept 10-12 ft away from the home?',
      helpText:
        'The KY assessment scores attached wooden fences/trellises as a direct flame path — keep them 10-12 ft off the structure or use noncombustible materials.',
      weight: 2,
      standard: 'KY Woodland Home Assessment',
    },
    {
      id: 'ky-spark-arrestor',
      category: 'roof-structure',
      question: 'Does the chimney have a spark arrestor and cap, with boxed eaves and clean gutters?',
      helpText:
        'KY\'s assessment credits a chimney spark arrestor + cap, boxed (soffited) eaves, and debris-free gutters.',
      weight: 1,
      standard: 'KY Woodland Home Assessment',
    },
    {
      id: 'deck-under-clear',
      category: 'roof-structure',
      question:
        'Is the deck underside screened with lattice plus 1/8-inch mesh, and free of stored combustibles?',
      helpText:
        'The KY assessment scores under-deck screening (lattice backed by 1/8-inch metal mesh) and no combustible storage beneath.',
      weight: 2,
      standard: 'KY Woodland Home Assessment',
    },
    {
      id: 'vents-screened',
      category: 'ember-intrusion',
      question: 'Are attic vents covered with 1/8-inch metal mesh?',
      helpText:
        'KY\'s assessment requires 1/8-inch mesh on attic vents; ember-rated vents (ASTM E2886) exceed this and are better still.',
      weight: 3,
      standard: 'KY Woodland Home Assessment',
    },
    {
      id: 'zone2-reduced',
      category: 'defensible-space',
      question: 'Is defensible space maintained to 100 ft (30-100 ft rates moderate; under 30 ft is high hazard)?',
      helpText:
        'The KY scoring bands: 100+ ft of defensible space scores best, 30-100 ft moderate, under 30 ft worst.',
      weight: 2,
      standard: 'KY Woodland Home Assessment',
    },
    {
      id: 'driveway-clearance',
      category: 'access-evacuation',
      question:
        'Is the driveway at least 12 ft wide with 14.5 ft of vertical clearance, and any gate 30 ft from the road, 2 ft wider than the drive, opening inward?',
      helpText:
        'KY\'s assessment scores driveway geometry (12 ft × 14.5 ft), gate placement/width/swing, and a key box if the gate locks.',
      weight: 2,
      standard: 'KY Woodland Home Assessment',
    },
    {
      id: 'address-visible',
      category: 'access-evacuation',
      question: 'Is the address on the home and mailbox in 4-inch reflective letters?',
      helpText: 'Reflective 4-inch lettering at both locations is scored by the KY assessment.',
      weight: 1,
      standard: 'KY Woodland Home Assessment',
    },
  ],
});
