import { compositeProfile } from './composite';
import { deriveProfile } from './derive';

/**
 * Iowa — Iowa DNR "Be Firewise" series (voluntary, older but still hosted by
 * the agency). Small delta from the national baseline: 100 ft defensible
 * space (200+ ft on slopes) and specific driveway numbers.
 */
export const iowaProfile = deriveProfile(compositeProfile, {
  id: 'us-ia',
  stateCode: 'IA',
  label: 'Iowa',
  authority: 'Iowa DNR Be Firewise',
  basis: 'guidance',
  basisNote:
    'The Iowa DNR\'s "Be Firewise" series provides the state\'s own defensible-space and driveway numbers. Voluntary; no statewide mandate.',
  sources: [
    { title: 'Iowa DNR — Fire Prevention', url: 'https://www.iowadnr.gov/programs-services/forestry-resources/fire-management-safety/fire-prevention' },
  ],
  upsertItems: [
    {
      id: 'zone2-reduced',
      category: 'defensible-space',
      question:
        'Is defensible space maintained to at least 100 ft (200+ ft on slopes)?',
      helpText:
        'Iowa DNR\'s Be Firewise series calls for 100 ft of defensible space, extended past 200 ft on sloped ground.',
      weight: 2,
      standard: 'Iowa DNR Be Firewise',
    },
    {
      id: 'driveway-clearance',
      category: 'access-evacuation',
      question:
        'Is the driveway at least 12 ft wide with 14 ft of overhead clearance (20 ft wide if over 150 ft long or curved)?',
      helpText: 'Iowa DNR Be Firewise Part 2 driveway standards for fire apparatus access.',
      weight: 2,
      standard: 'Iowa DNR Be Firewise',
    },
  ],
});
