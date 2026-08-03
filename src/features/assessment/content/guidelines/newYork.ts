import { compositeProfile } from './composite';
import { deriveProfile } from './derive';

/**
 * New York — NYS DEC "FIREWISE New York" homeowner guidance (voluntary, but
 * DEC publishes its own numbers): 0-30 ft "lean, clean and green", 30-100 ft
 * managed spacing (~30 ft between conifer crowns, 20 ft between individual
 * trees or 30 ft between 2-3-tree clusters), pruning to 6-10 ft, 1/8-inch
 * vent screening, and 30-ft setbacks for propane tanks and firewood.
 */
export const newYorkProfile = deriveProfile(compositeProfile, {
  id: 'us-ny',
  stateCode: 'NY',
  label: 'New York',
  authority: 'NYS DEC FIREWISE New York',
  basis: 'guidance',
  basisNote:
    'The NYS Department of Environmental Conservation publishes its own FIREWISE New York numbers (zones, spacing, screening). Voluntary; no statewide mandate.',
  sources: [
    { title: 'DEC — FIREWISE New York for Homeowners', url: 'https://dec.ny.gov/nature/forests-trees/wildfires/firewise-new-york/homeowners' },
  ],
  upsertItems: [
    {
      id: 'zone1-maintained',
      category: 'defensible-space',
      question:
        'Is the 0-30 ft zone around the home "lean, clean and green" — low fuel, no dead material, and watered?',
      helpText:
        'DEC\'s FIREWISE New York uses a 0-30 ft primary zone: remove dead vegetation and leaf litter, keep plantings low and green, and keep the first 5 ft noncombustible.',
      weight: 2,
      standard: 'DEC FIREWISE New York',
    },
    {
      id: 'zone2-reduced',
      category: 'defensible-space',
      question:
        'In the 30-100 ft zone, are trees spaced per DEC guidance (20 ft between individual trees, 30 ft between small clusters)?',
      helpText:
        'DEC recommends about 30 ft between conifer crowns, and in the 30-100 ft zone either 20 ft between individual trees or 30 ft between clusters of 2-3 trees. High-hazard properties should continue thinning out to 200 ft.',
      weight: 2,
      standard: 'DEC FIREWISE New York',
    },
    {
      id: 'ny-propane-firewood',
      category: 'defensible-space',
      question:
        'Are propane tanks and firewood stacks kept at least 30 ft from the home?',
      helpText:
        'DEC guidance sets a 30-ft setback for propane tanks, and for firewood stacks during fire season. Clear vegetation around tanks.',
      weight: 1,
      standard: 'DEC FIREWISE New York',
    },
    {
      id: 'veg-tree-spacing',
      category: 'vegetation',
      question:
        'Are conifer crowns spaced ~30 ft apart with lower limbs pruned 6-10 ft above the ground?',
      helpText:
        'DEC recommends about 30 ft between conifer crowns and pruning the lowest limbs to 6-10 ft to break up ladder fuels.',
      weight: 2,
      standard: 'DEC FIREWISE New York',
    },
    {
      id: 'roof-rated',
      category: 'roof-structure',
      question:
        'Is the roof composition shingle, metal, clay, or cement tile (not wood shake)?',
      helpText:
        'DEC lists composition shingle, metal, clay, and cement tile as recommended roofing; walls of stucco, stone, brick, or block resist ignition.',
      weight: 3,
      standard: 'DEC FIREWISE New York',
    },
    {
      id: 'vents-screened',
      category: 'ember-intrusion',
      question: 'Are all vent openings screened with 1/8-inch or smaller metal mesh?',
      helpText:
        'DEC guidance calls for screening vents to 1/8 inch or smaller; ember-rated vents (ASTM E2886) exceed this and are better still.',
      weight: 3,
      standard: 'DEC FIREWISE New York',
    },
    {
      id: 'windows-multiPane',
      category: 'ember-intrusion',
      question: 'Do you have double-paned or tempered glass windows?',
      helpText: 'DEC recommends double-paned or tempered glass; single panes can fail under radiant heat.',
      weight: 2,
      standard: 'DEC FIREWISE New York',
    },
  ],
});
