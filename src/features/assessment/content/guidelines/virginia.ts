import { compositeProfile } from './composite';
import { deriveProfile } from './derive';

/**
 * Virginia — Virginia Department of Forestry "Protect Your Property" /
 * Firewise Virginia (voluntary). Distinct numbers: 3-inch lawn, 20-ft chimney
 * clearance, downhill thinning emphasis, 12-ft × 14-ft driveway with a
 * 10,000-lb-rated bridge/culvert, 4-inch numbers at the house AND driveway
 * entrance, propane 10 ft out on a 10-ft gravel perimeter, dry hydrants.
 */
export const virginiaProfile = deriveProfile(compositeProfile, {
  id: 'us-va',
  stateCode: 'VA',
  label: 'Virginia',
  authority: 'Virginia Department of Forestry · Firewise Virginia',
  basis: 'guidance',
  basisNote:
    'The Virginia Department of Forestry publishes its own defensible-space, access, and water-supply numbers (including the rural Dry Hydrant Program). Voluntary; no statewide mandate.',
  sources: [
    { title: 'VDOF — Protect Your Property', url: 'https://dof.virginia.gov/wildland-prescribed-fire/wildfire-preparation/protect-your-property/' },
    { title: 'VDOF — Take Action to Be Firewise', url: 'https://dof.virginia.gov/wildland-prescribed-fire/wildfire-preparation/take-action-to-be-firewise/' },
  ],
  upsertItems: [
    {
      id: 'zone1-maintained',
      category: 'defensible-space',
      question:
        'Is there a green, watered lawn for 30 ft around the home, cut to 3 inches or less?',
      helpText:
        'VDOF asks for a 30-ft green belt mowed to 3 inches (tighter than the common 4-inch rule), with fuels thinned from 30 ft out to 100 ft — prioritizing the downhill side, where fire climbs fastest.',
      weight: 2,
      standard: 'VDOF Protect Your Property',
    },
    {
      id: 'va-propane',
      category: 'defensible-space',
      question:
        'Is the propane tank at least 10 ft from the house with a 10-ft gravel perimeter around it?',
      helpText: 'VDOF: 10 ft of separation and a 10-ft noncombustible gravel ring around the tank.',
      weight: 1,
      standard: 'VDOF Protect Your Property',
    },
    {
      id: 'veg-overhang',
      category: 'vegetation',
      question:
        'Are branches trimmed 20 ft back from chimneys and clear of the roof, with trees pruned up 6-10 ft?',
      helpText:
        'VDOF uses a 20-ft chimney clearance. Fall leaf season matters in Virginia — clean gutters and the roof each October.',
      weight: 2,
      standard: 'VDOF Protect Your Property',
    },
    {
      id: 'driveway-clearance',
      category: 'access-evacuation',
      question:
        'Is the driveway 12 ft wide and pruned to 14 ft overhead, with any bridge/culvert rated for 10,000 lb and a truck turnaround near the house?',
      helpText:
        'VDOF driveway standards: 12-ft width, 14-ft overhead clearance, gates at least 10 ft wide set back 30 ft from the road, a gravel turnaround near the house, and driveway bridges rated for a 10,000-lb engine.',
      weight: 2,
      standard: 'VDOF Protect Your Property',
    },
    {
      id: 'address-visible',
      category: 'access-evacuation',
      question:
        'Are 4-inch house numbers posted both on the home and at the driveway entrance?',
      helpText: 'VDOF asks for numbers in both places so crews can confirm the address at the road and at the house.',
      weight: 1,
      standard: 'VDOF Protect Your Property',
    },
    {
      id: 'water-source',
      category: 'water-supply',
      question:
        'Is there a water source for firefighting — hydrant, or a pond/stream with a dry-hydrant drafting point?',
      helpText:
        'VDOF runs a rural Dry Hydrant Program: a permanent drafting pipe in a pond lets engines refill without a municipal hydrant. A pool or cistern within reach also helps.',
      weight: 2,
      standard: 'VDOF Dry Hydrant Program',
    },
    {
      id: 'hose-available',
      category: 'water-supply',
      question: 'Do you have at least 100 ft of garden hose that can reach all areas of your home?',
      helpText: 'VDOF recommends a minimum of 100 ft of hose with proper fittings.',
      weight: 1,
      standard: 'VDOF Protect Your Property',
    },
  ],
});
