import { compositeProfile } from './composite';
import { deriveProfile } from './derive';

/**
 * Tennessee — TN Division of Forestry "Protect Your Home from Wildfire"
 * (TN Fire Adapted Communities; voluntary). Distinct numbers: 15-ft chimney
 * clearance, 12-ft × 15-ft driveway, 1/8-inch metal vent screening, metal
 * window screens.
 */
export const tennesseeProfile = deriveProfile(compositeProfile, {
  id: 'us-tn',
  stateCode: 'TN',
  label: 'Tennessee',
  authority: 'TN Division of Forestry · Fire Adapted Communities',
  basis: 'guidance',
  basisNote:
    'The Tennessee Division of Forestry publishes its own home-protection numbers through the TN Fire Adapted Communities program. Voluntary; no statewide mandate.',
  sources: [
    { title: 'TN — Protect Your Home from Wildfire', url: 'https://www.tn.gov/tnwildlandfire/prevention/tennessee-fire-adapted-communities/protect-your-home-from-wildfire.html' },
  ],
  upsertItems: [
    {
      id: 'zone1-maintained',
      category: 'defensible-space',
      question:
        'Is there a "lean, clean and green" defensible space of at least 30 ft, with firewood stored 30+ ft from the home?',
      helpText:
        'TN Division of Forestry: keep at least 30 ft lean/clean/green and reduce fuels out to 100-200 ft where the lot allows. Firewood belongs at least 30 ft out, and nothing combustible under decks.',
      weight: 2,
      standard: 'TN Division of Forestry',
    },
    {
      id: 'veg-overhang',
      category: 'vegetation',
      question:
        'Are branches cut back 10 ft from the roof and 15 ft from the chimney, with tree limbs pruned at least 6 ft up?',
      helpText:
        'TN guidance uses a 15-ft chimney clearance (wider than the national 10 ft), no branches within 10  ft of the roof, and lowest tree branches at least 6 ft above the ground.',
      weight: 2,
      standard: 'TN Division of Forestry',
    },
    {
      id: 'vents-screened',
      category: 'ember-intrusion',
      question:
        'Are vents covered with 1/8-inch or finer metal screening, and are window screens metal (not nylon)?',
      helpText:
        'TN Division of Forestry calls for 1/8-inch metal vent screening and metal window screens — nylon melts. Ember-rated vents (ASTM E2886) exceed this and are better still.',
      weight: 3,
      standard: 'TN Division of Forestry',
    },
    {
      id: 'driveway-clearance',
      category: 'access-evacuation',
      question:
        'Is the driveway at least 12 ft wide with 15 ft of vertical clearance for emergency vehicles?',
      helpText: 'TN guidance: 12-ft width and 15-ft overhead clearance so engines can reach the home.',
      weight: 2,
      standard: 'TN Division of Forestry',
    },
  ],
});
