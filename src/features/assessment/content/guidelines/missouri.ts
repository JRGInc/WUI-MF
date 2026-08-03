import { compositeProfile } from './composite';
import { deriveProfile } from './derive';

/**
 * Missouri — MDC "Wildfire Strikes Home" plus MU Extension guidance
 * (voluntary). Distinct: 50-ft woodpile setback (stricter than the usual
 * 30 ft) and 16-ft access roads/gates.
 */
export const missouriProfile = deriveProfile(compositeProfile, {
  id: 'us-mo',
  stateCode: 'MO',
  label: 'Missouri',
  authority: 'Missouri Dept. of Conservation · MU Extension',
  basis: 'guidance',
  basisNote:
    'Missouri\'s numbers come from the Department of Conservation and University of Missouri Extension publications. Voluntary; no statewide mandate.',
  sources: [
    { title: 'MDC — Wildfire Prevention', url: 'https://mdc.mo.gov/your-property/fire-management/wildfire-prevention' },
    { title: 'MU Extension — Protecting Your Home from Wildfire', url: 'https://extension.missouri.edu/news/protecting-your-home-and-buildings-from-wildfire' },
  ],
  upsertItems: [
    {
      id: 'zone1-maintained',
      category: 'defensible-space',
      question:
        'Is there a maintained lawn for 30 ft around the structure, mowed to 4 inches or less, with no firewood, hay, or fuel tanks in the 5-30 ft band?',
      helpText:
        'MDC and MU Extension: a 30-ft mowed lawn, grass at 4 inches or under, and combustible storage (including hay — a Missouri-specific fuel) kept out of the 5-30 ft zone.',
      weight: 2,
      standard: 'MDC · MU Extension',
    },
    {
      id: 'mo-woodpile',
      category: 'defensible-space',
      question: 'Are woodpiles at least 50 ft from structures?',
      helpText: 'MDC uses a 50-ft woodpile setback — stricter than the common 30 ft.',
      weight: 1,
      standard: 'MDC Wildfire Strikes Home',
    },
    {
      id: 'veg-tree-spacing',
      category: 'vegetation',
      question: 'Are evergreens pruned up at least 6 ft, with ladder fuels removed under trees?',
      helpText: 'MDC pruning standard; remove shrubs growing beneath tree canopies.',
      weight: 2,
      standard: 'MDC Wildfire Strikes Home',
    },
    {
      id: 'driveway-clearance',
      category: 'access-evacuation',
      question:
        'Are access roads and gates at least 16 ft wide, with the driveway marked and a truck turnaround available?',
      helpText:
        'MU Extension calls for 16-ft access roads/gates; MDC adds a marked driveway and space for engines to turn around.',
      weight: 2,
      standard: 'MU Extension · MDC',
    },
  ],
});
