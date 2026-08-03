import { compositeProfile } from './composite';
import { deriveProfile } from './derive';

/**
 * Maine — Maine Forest Service (DACF) homeowner guidance (voluntary):
 * 30-ft green lawn, conifer thinning 30-100 ft, 20-ft chimney clearance,
 * driveway 12 ft wide with 14 ft overhead clearance, gates ≥10 ft set back
 * 30 ft from the road, ≥100 ft of garden hose, 4-inch house numbers,
 * chimney/foundation screens ≤1/2 inch, deck enclosure mesh 1/8 inch,
 * propane tanks ≥10 ft from the house on gravel.
 */
export const maineProfile = deriveProfile(compositeProfile, {
  id: 'us-me',
  stateCode: 'ME',
  label: 'Maine',
  authority: 'Maine Forest Service (DACF)',
  basis: 'guidance',
  basisNote:
    'The Maine Forest Service publishes its own homeowner numbers (driveway geometry, screening, clearances) plus a Maine fire-resistant plant list and a defensible-space chipping program. Voluntary; no statewide mandate.',
  sources: [
    { title: 'Maine Forest Service — Tips for Homeowners', url: 'https://www.maine.gov/dacf/mfs/forest_protection/firewise/homeowners.html' },
  ],
  upsertItems: [
    {
      id: 'zone1-maintained',
      category: 'defensible-space',
      question: 'Is there a green, mowed lawn (or equivalent low fuel) for 30 ft around the home?',
      helpText:
        'Maine Forest Service recommends a watered/green 30-ft belt around the house, with the first 5 ft noncombustible, and conifers thinned and pruned from 30 ft out to 100 ft.',
      weight: 2,
      standard: 'Maine Forest Service',
    },
    {
      id: 'me-propane',
      category: 'defensible-space',
      question: 'Are propane tanks at least 10 ft from the house, sitting on gravel or another noncombustible pad?',
      helpText:
        'Maine Forest Service asks for 10 ft of separation with a noncombustible surface under the tank; keep vegetation cleared around it.',
      weight: 1,
      standard: 'Maine Forest Service',
    },
    {
      id: 'veg-overhang',
      category: 'vegetation',
      question: 'Are branches trimmed back at least 20 ft from chimneys, with no limbs over the roof?',
      helpText:
        'Maine guidance uses a 20-ft chimney clearance (wider than the national 10 ft) because of long-needle conifer torching.',
      weight: 2,
      standard: 'Maine Forest Service',
    },
    {
      id: 'me-chimney-screen',
      category: 'roof-structure',
      question:
        'Do chimney outlets and foundation openings have screens with openings of 1/2 inch or less?',
      helpText:
        'Maine Forest Service recommends spark screening on chimneys and foundation openings (≤1/2 inch), and 1/8-inch metal mesh where decks are enclosed.',
      weight: 1,
      standard: 'Maine Forest Service',
    },
    {
      id: 'deck-under-clear',
      category: 'roof-structure',
      question:
        'Is the area under decks/porches free of combustibles, with any enclosure done in 1/8-inch metal mesh?',
      helpText:
        'No stored items, firewood, or leaf litter under decks; if you skirt or screen the deck, use 1/8-inch noncombustible mesh so embers and debris stay out.',
      weight: 2,
      standard: 'Maine Forest Service · IBHS',
    },
    {
      id: 'driveway-clearance',
      category: 'access-evacuation',
      question:
        'Is the driveway at least 12 ft wide with 14 ft of overhead clearance, and any gate at least 10 ft wide set back 30 ft from the road?',
      helpText:
        'Maine Forest Service driveway standards let fire apparatus reach the home: 12-ft width, 14-ft overhead clearance, 10-ft gates set back 30 ft so trucks can pull off the road while the gate opens.',
      weight: 2,
      standard: 'Maine Forest Service',
    },
    {
      id: 'address-visible',
      category: 'access-evacuation',
      question: 'Are house numbers at least 4 inches tall and clearly visible from the road?',
      helpText: 'Reflective 4-inch numbers on a contrasting background help responders find you.',
      weight: 1,
      standard: 'Maine Forest Service',
    },
    {
      id: 'hose-available',
      category: 'water-supply',
      question: 'Do you have at least 100 ft of garden hose that can reach all areas of your home?',
      helpText: 'Maine Forest Service recommends a minimum of 100 ft of hose with proper fittings.',
      weight: 1,
      standard: 'Maine Forest Service',
    },
  ],
});
