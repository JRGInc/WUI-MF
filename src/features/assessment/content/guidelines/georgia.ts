import type { GuidelineProfile } from './types';

/**
 * Georgia guideline set. Georgia has no defensible-space statute; the Georgia
 * Forestry Commission (GFC) promotes Firewise USA home-ignition-zone practices,
 * with Southeast-specific emphases: pine straw mulch (ubiquitous in Georgia
 * landscaping and highly ignitable), pine ladder fuels, and yard-debris
 * burning (the state's most common wildfire cause — GFC burn permits).
 *
 * Items shared verbatim with the composite profile keep the same `id`, so a
 * checklist answered under one profile keeps those answers if the resolved
 * state changes mid-assessment.
 */
export const georgiaProfile: GuidelineProfile = {
  id: 'us-ga',
  stateCode: 'GA',
  label: 'Georgia',
  authority: 'Georgia Forestry Commission · Firewise USA',
  basis: 'guidance',
  basisNote:
    'Georgia has no defensible-space law; the Georgia Forestry Commission promotes voluntary Firewise USA practices with Southeast-specific emphases (pine straw, ladder fuels, debris burning). Only outdoor-burning rules are legally binding.',
  sources: [
    { title: 'GFC — Firewise USA Program', url: 'https://gatrees.org/fire-prevention-suppression/firewise-usa-program/' },
    { title: 'GFC — Outdoor Burning Laws', url: 'https://gatrees.org/understanding-georgias-outdoor-burning-laws/' },
    { title: 'GEMA — Wildfires', url: 'https://gema.georgia.gov/wildfires' },
  ],
  checklistItems: [
    // Defensible Space — Firewise home ignition zones
    {
      id: 'zone0-clear',
      category: 'defensible-space',
      question:
        'Is the 0-5 ft immediate zone around the home noncombustible — no plants, and no pine straw or bark mulch?',
      helpText:
        'Use gravel, pavers, or concrete for the first 5 ft. Embers landing in foundation plantings and mulch beds are a leading ignition path in Southeastern homes.',
      weight: 3,
      standard: 'Firewise Immediate Zone · GFC',
    },
    {
      id: 'ga-pine-straw',
      category: 'defensible-space',
      question:
        'Is pine straw mulch kept at least 5 ft from all structures (and ideally out of the 0-30 ft zone)?',
      helpText:
        'Pine straw is the most flammable common mulch — USDA Forest Service testing found it has the fastest flame spread and highest flame lengths of any tested mulch. Never leave it against foundations, under decks, or touching siding; replace it with gravel near the house.',
      weight: 3,
      standard: 'USDA Forest Service research · Firewise Immediate Zone',
    },
    {
      id: 'fence-attachment',
      category: 'defensible-space',
      question:
        'Where a wood or vinyl fence meets the house, is there a 5-ft noncombustible section at the connection?',
      helpText:
        'Combustible fences act as a wick, carrying fire directly to the wall — a documented structure-to-structure ignition path. Use metal or masonry for the last 5 ft.',
      weight: 2,
      standard: 'IBHS WFPH · NIST TN 2228',
    },
    {
      id: 'ga-zone1-maintained',
      category: 'defensible-space',
      question:
        'In the 5-30 ft intermediate zone, is the lawn mowed (4 inches or less), with shrubs in small, separated groups?',
      helpText:
        'Keep grass short, break up continuous shrub beds, and keep the zone watered during drought. Clear vegetation from under and around any propane tanks.',
      weight: 2,
      standard: 'Firewise Intermediate Zone',
    },
    {
      id: 'ga-zone2-reduced',
      category: 'defensible-space',
      question:
        'In the 30-100 ft extended zone, are dead trees removed and heavy underbrush thinned?',
      helpText:
        'Remove leaf/needle litter buildup, dead trees, and dense understory so a ground fire cannot climb into the canopy near the home.',
      weight: 2,
      standard: 'Firewise Extended Zone',
    },

    // Roof & Structure
    {
      id: 'roof-rated',
      category: 'roof-structure',
      question: 'Is your roof made of Class A fire-rated material?',
      helpText: 'Metal, tile, or composition shingles (not wood shake)',
      weight: 3,
      standard: 'Firewise / IBHS',
    },
    {
      id: 'ga-gutters-clean',
      category: 'roof-structure',
      question:
        'Are the roof, gutters, and roof valleys clear of pine needles and leaf litter?',
      helpText:
        'Pine needles accumulate fast under Georgia pines and are the perfect ember bed. Clean at least twice a year and after storms; noncombustible gutter guards help.',
      weight: 2,
      standard: 'Firewise Immediate Zone',
    },
    {
      id: 'siding-noncombustible',
      category: 'roof-structure',
      question: 'Is your siding made of fire-resistant material?',
      helpText: 'Stucco, brick, fiber cement, or treated wood',
      weight: 2,
    },
    {
      id: 'deck-under-clear',
      category: 'roof-structure',
      question:
        'Is the area under and within 5 ft of attached decks/porches free of combustibles?',
      helpText:
        'No stored items, firewood, pine straw, or leaf litter under decks and porches — screen open under-deck areas with 1/8-inch metal mesh to keep embers and debris out.',
      weight: 2,
      standard: 'Firewise / IBHS WFPH',
    },

    // Vegetation Management
    {
      id: 'veg-dead-removed',
      category: 'vegetation',
      question: 'Has all dead and dying vegetation been removed from the property?',
      helpText:
        'Dead plants, dry grass, fallen leaves, and needles are easily ignited by embers',
      weight: 2,
      standard: 'Firewise / GFC',
    },
    {
      id: 'ga-ladder-fuels',
      category: 'vegetation',
      question:
        'Are pines and other trees limbed up 6-10 ft, with shrubs kept from growing under tree canopies?',
      helpText:
        'Southern pines readily carry ground fire into the crown via low limbs and understory shrubs. Prune lower limbs (up to 1/3 of tree height for smaller trees) and remove shrubs beneath trees.',
      weight: 2,
      standard: 'GFC Firewise guidance',
    },
    {
      id: 'veg-overhang',
      category: 'vegetation',
      question: 'Are branches cut back from the roof and chimney?',
      helpText: 'No limbs overhanging the roof; keep branches at least 10 ft from the chimney',
      weight: 2,
    },
    {
      id: 'ga-debris-burning',
      category: 'vegetation',
      question:
        'If yard debris is burned on the property, is it done legally and safely (GFC notification, cleared ring, attended, water at hand)?',
      helpText:
        'Escaped yard-debris burns are Georgia\'s leading wildfire cause. Burn only when allowed (check GFC burn rules for your county), 25+ ft from woodlands and 50+ ft from structures, in a cleared area, attended until dead out.',
      weight: 1,
      positiveLabel: 'Yes / N.A.',
      standard: 'GFC burn rules (O.C.G.A. §12-6-90)',
    },

    // Ember Intrusion
    {
      id: 'vents-screened',
      category: 'ember-intrusion',
      question:
        'Are vents WUI-rated ember- and flame-resistant (not just covered with mesh)?',
      helpText:
        'Standard 1/8-inch mesh slows but does not stop wind-driven embers. Use vents tested to ASTM E2886 where possible; otherwise 1/16-1/8 inch noncombustible, corrosion-resistant metal mesh.',
      weight: 3,
      standard: 'Firewise / IBHS WFPH',
    },
    {
      id: 'gaps-sealed',
      category: 'ember-intrusion',
      question: 'Are gaps in eaves and soffits sealed?',
      helpText: 'No openings for embers to enter',
      weight: 2,
    },
    {
      id: 'windows-multiPane',
      category: 'ember-intrusion',
      question: 'Do you have dual-pane or tempered glass windows?',
      helpText: 'Single-pane windows can break from radiant heat',
      weight: 2,
    },

    // Access & Evacuation
    {
      id: 'driveway-clearance',
      category: 'access-evacuation',
      question: 'Is your driveway at least 12 feet wide with vertical clearance?',
      helpText:
        'Rural Georgia fire apparatus needs a 12-ft travel way and about 14 ft of vertical clearance; trim overhanging limbs along the drive.',
      weight: 2,
      standard: 'Firewise community guidance',
    },
    {
      id: 'address-visible',
      category: 'access-evacuation',
      question: 'Is your address clearly visible from the road?',
      helpText: 'Use reflective numbers at least 4 inches tall',
      weight: 1,
    },
    {
      id: 'evacuation-plan',
      category: 'access-evacuation',
      question: 'Does your household have an evacuation plan?',
      helpText: 'Including multiple routes and meeting points',
      weight: 2,
    },

    // Water Supply
    {
      id: 'water-source',
      category: 'water-supply',
      question: 'Is there a reliable water source for firefighting?',
      helpText: 'Pool, pond, cistern, or hydrant within 1000 feet — farm ponds count; make sure a drafting point is accessible.',
      weight: 2,
    },
    {
      id: 'hose-available',
      category: 'water-supply',
      question: 'Do you have a garden hose that can reach all areas of your home?',
      helpText: 'At least 100 feet of hose with proper fittings',
      weight: 1,
    },
  ],
  recommendationRules: [
    {
      category: 'defensible-space',
      threshold: 7,
      priority: 'immediate',
      title: 'Clear the Immediate Zone — Especially Pine Straw',
      description:
        'Replace pine straw and bark mulch within 5 ft of all structures with gravel or hardscape, remove foundation plants from the first 5 ft, and break up continuous shrub beds in the 5-30 ft zone. Pine straw against the house is the most common preventable ignition path in Georgia.',
      estimatedCost: '$300-1500',
    },
    {
      category: 'roof-structure',
      threshold: 7,
      priority: 'short-term',
      title: 'Harden the Roof and Deck Edges',
      description:
        'Upgrade to Class A roofing when re-roofing, keep pine needles off the roof and out of gutters year-round, and screen open under-deck areas with metal mesh.',
      estimatedCost: '$500-15000',
    },
    {
      category: 'vegetation',
      threshold: 7,
      priority: 'immediate',
      title: 'Break Up Pine Ladder Fuels',
      description:
        'Limb pines up 6-10 ft, remove shrubs growing beneath tree canopies, and clear accumulated needle litter. If you burn yard debris, follow GFC burn rules — escaped debris burns are Georgia\'s top wildfire cause.',
      estimatedCost: '$200-1000',
    },
    {
      category: 'ember-intrusion',
      threshold: 7,
      priority: 'short-term',
      title: 'Screen Ember Entry Points',
      description:
        'Fit vents with ember-resistant models (ASTM E2886) or 1/16-1/8 inch metal mesh, and seal gaps in eaves, soffits, and under-deck openings.',
      estimatedCost: '$300-800',
    },
  ],
};
