import { compositeProfile } from './composite';
import { deriveProfile } from './derive';

/**
 * North Carolina — N.C. Forest Service "Resist Wildfire North Carolina" and
 * the NCFS/NC State Extension "Fire-Resistant Landscaping in North Carolina"
 * publication (voluntary; NC leads the nation in WUI acreage). Distinct
 * numbers: 100 ft defensible space in all directions (up to 200 ft on slopes
 * steeper than 20%), a strict 0-5 ft litter rule, and combustibles ≥30 ft.
 */
export const northCarolinaProfile = deriveProfile(compositeProfile, {
  id: 'us-nc',
  stateCode: 'NC',
  label: 'North Carolina',
  authority: 'N.C. Forest Service · Resist Wildfire NC',
  basis: 'guidance',
  basisNote:
    'North Carolina — the state with the most WUI acreage in the country — publishes its own numbers through the N.C. Forest Service\'s "Resist Wildfire NC" program and the Fire-Resistant Landscaping publication. Voluntary; no statewide mandate.',
  sources: [
    { title: 'Resist Wildfire North Carolina', url: 'https://www.ncagr.gov/divisions/nc-forest-service/resist-wildfire-north-carolina' },
    { title: 'Fire-Resistant Landscaping in NC', url: 'https://ncagr.gov/divisions/nc-forest-service/fire-resistant-landscaping-nc/download?attachment=' },
  ],
  upsertItems: [
    {
      id: 'zone0-clear',
      category: 'defensible-space',
      question:
        'Is the 0-5 ft zone noncombustible (rock, gravel, pavers) and completely free of needles, leaves, branches, and cones — including on decks, patios, and fences?',
      helpText:
        'NCFS guidance is strict about the first 5 ft: noncombustible ground cover, ALL organic litter removed (even debris accumulating in mulch), and nothing combustible against the walls.',
      weight: 3,
      standard: 'NCFS Fire-Resistant Landscaping',
    },
    {
      id: 'zone1-maintained',
      category: 'defensible-space',
      question:
        'In the 5-30 ft zone, are combustible items (wood scraps, leaf piles, fuel tanks, boats, RVs) kept at least 30 ft from the house?',
      helpText:
        'NCFS: use low-flammability ground covers in the 5-30 ft band and move stored combustibles at least 30 ft out — uphill of the home where possible.',
      weight: 2,
      standard: 'NCFS Fire-Resistant Landscaping',
    },
    {
      id: 'zone2-reduced',
      category: 'defensible-space',
      question:
        'Is defensible space maintained 100 ft in all directions (up to 200 ft on slopes steeper than 20%), with turf mowed to 4 inches or less?',
      helpText:
        'NCFS calls for 100 ft of defensible space on gentle terrain and up to 200 ft on steep slopes, since fire runs faster uphill. Keep grass inside the space at 4 inches or less; dead snags belong only at the 80-100 ft fringe.',
      weight: 2,
      standard: 'NCFS Resist Wildfire NC',
    },
    {
      id: 'veg-tree-spacing',
      category: 'vegetation',
      question:
        'Are trees pruned 6-10 ft up (never more than 1/3 of tree height), with shrubs at least 10 ft below the lowest branches?',
      helpText:
        'NCFS ladder-fuel rules: prune 6-10 ft (≤1/3 of the tree\'s height), keep 10 ft between shrub tops and the lowest tree branches, and keep tree drip lines at least 10 ft from the structure.',
      weight: 2,
      standard: 'NCFS Fire-Resistant Landscaping',
    },
  ],
  upsertRecommendationRules: [
    {
      category: 'defensible-space',
      threshold: 7,
      priority: 'immediate',
      title: 'Extend Defensible Space to the NC Standard',
      description:
        'Clear the 0-5 ft strip of all litter and combustible mulch, move stored combustibles 30 ft out, and extend maintained defensible space to 100 ft — 200 ft on slopes steeper than 20%, working the downhill side first.',
      estimatedCost: '$500-2500',
    },
  ],
});
