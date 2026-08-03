import { compositeProfile } from './composite';
import { deriveProfile } from './derive';

/**
 * New Jersey — statewide voluntary guidance from the NJ Forest Fire Service
 * ("NJ Wildfire SMART": ≥30 ft buffer, 100 ft in the Pinelands), plus the
 * Pinelands Comprehensive Management Plan (N.J.A.C. 7:50-6.121-6.125), which
 * imposes mandatory fire standards on development approvals in the ~938k-acre
 * Pinelands Area: fuel breaks of 30/75/100 ft by hazard class, 25-ft
 * pine-to-pine spacing in extreme hazard, and a wood-shake roof prohibition.
 * The app resolves location to the state only, so Pinelands items are phrased
 * conditionally ("If in the Pinelands...") with a Yes/N.A. positive option.
 */
export const newJerseyProfile = deriveProfile(compositeProfile, {
  id: 'us-nj',
  stateCode: 'NJ',
  label: 'New Jersey',
  authority: 'NJ Forest Fire Service · Pinelands CMP (N.J.A.C. 7:50-6)',
  basis: 'partial-mandate',
  basisNote:
    'Statewide, New Jersey\'s defensible-space guidance (NJ Wildfire SMART) is voluntary. Inside the ~938,000-acre Pinelands Area, the Pinelands Comprehensive Management Plan imposes mandatory fire standards on development — fuel breaks, pine spacing, and roofing restrictions.',
  sources: [
    { title: 'NJ Wildfire SMART (NJ Forest Fire Service)', url: 'https://dep.nj.gov/parksandforests/wildfire/nj-wildfire-smart/' },
    { title: 'Pinelands Comprehensive Management Plan', url: 'https://www.nj.gov/pinelands/cmp/' },
  ],
  upsertItems: [
    {
      id: 'zone1-maintained',
      category: 'defensible-space',
      question:
        'Is there at least a 30-ft maintained buffer between the home and flammable vegetation (100 ft in the Pinelands)?',
      helpText:
        'NJ Forest Fire Service guidance calls for a minimum 30-ft defensible space in wooded areas, expanded to 100 ft in the Pinelands region. Keep the buffer free of leaves, pine needles, and twigs.',
      weight: 2,
      standard: 'NJ Wildfire SMART (NJFFS)',
    },
    {
      id: 'nj-pinelands-fuelbreak',
      category: 'defensible-space',
      question:
        'If the property is in the Pinelands Area, is the required fuel break maintained (30 ft moderate / 75 ft high / 100 ft extreme hazard) with annual understory maintenance?',
      helpText:
        'The Pinelands CMP (N.J.A.C. 7:50-6.124) requires development in moderate/high/extreme fire-hazard vegetation to keep a selectively-cleared fuel break — shrubs, understory, and ground cover pruned or mowed and maintained annually, all dead plant material removed.',
      weight: 2,
      positiveLabel: 'Yes / N.A.',
      standard: 'N.J.A.C. 7:50-6.124 (Pinelands, mandatory)',
    },
    {
      id: 'nj-pine-spacing',
      category: 'vegetation',
      question:
        'If in a Pinelands extreme-hazard area, are pines spaced so no pine tree is within 25 ft of another pine?',
      helpText:
        'The Pinelands CMP requires 25 ft of pine-to-pine spacing in extreme fire-hazard areas (immature/dwarf pine-oak, pine-scrub oak, pine lowlands) to prevent crown-fire runs.',
      weight: 1,
      positiveLabel: 'Yes / N.A.',
      standard: 'N.J.A.C. 7:50-6.124 (Pinelands, mandatory)',
    },
    {
      id: 'roof-rated',
      category: 'roof-structure',
      question:
        'Is the roof a fire-resistant material (Class A preferred — asphalt, tile, slate, cement shingle, or metal; NOT wood shake)?',
      helpText:
        'The Pinelands construction standards (N.J.A.C. 7:50-6.125) prohibit wood shingle/shake roofs in high or extreme hazard areas — even fire-retardant-treated — and require fire-resistant roof and exterior materials.',
      weight: 3,
      standard: 'N.J.A.C. 7:50-6.125 (Pinelands) · IBHS',
    },
    {
      id: 'driveway-clearance',
      category: 'access-evacuation',
      question:
        'Can fire apparatus reach the home — adequate driveway width/surface, and dead-end roads with a usable turnaround?',
      helpText:
        'NJFFS asks homeowners to ensure fire trucks can access driveways; the Pinelands CMP requires dead-end roads to terminate in a fire-apparatus turnaround and larger developments to provide two accessways.',
      weight: 2,
      standard: 'NJFFS · N.J.A.C. 7:50-6.124',
    },
  ],
  upsertRecommendationRules: [
    {
      category: 'defensible-space',
      threshold: 7,
      priority: 'immediate',
      title: 'Establish the NJ Defensible-Space Buffer',
      description:
        'Clear a maintained buffer of at least 30 ft between the home and flammable vegetation (100 ft in the Pinelands): remove leaves, pine needles, and dead material, and clear the 0-5 ft zone to noncombustible ground. In the Pinelands Area, fuel breaks of 30/75/100 ft by hazard class are mandatory for approved development and require annual maintenance.',
      estimatedCost: '$500-2000',
    },
  ],
});
