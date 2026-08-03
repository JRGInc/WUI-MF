import type { GuidelineProfile } from './types';

/**
 * National composite guideline set — the fallback used when the property's
 * state has no dedicated profile. Blends IBHS Wildfire Prepared Home, NFPA
 * Firewise home-ignition-zone guidance, and California standards (the most
 * developed body of WUI regulation) where they generalize.
 */
export const compositeProfile: GuidelineProfile = {
  id: 'composite',
  stateCode: null,
  label: 'National composite',
  authority: 'IBHS · NFPA Firewise · CAL FIRE (composite)',
  basis: 'baseline',
  basisNote:
    'A national best-practice baseline compiled from NFPA Firewise USA home-ignition-zone guidance and IBHS Wildfire Prepared Home research. Used when your state has no wildfire guidance of its own — these practices are recommended, not legally required.',
  sources: [
    { title: 'NFPA Firewise USA', url: 'https://www.nfpa.org/education-and-research/wildfire/firewise-usa' },
    { title: 'IBHS Wildfire Prepared Home', url: 'https://wildfireprepared.org/' },
  ],
  checklistItems: [
    // Defensible Space — Zone 0 (0-5 ft) is the highest-impact zone
    {
      id: 'zone0-clear',
      category: 'defensible-space',
      question:
        'Is the 0-5 ft "ember-resistant zone" cleared to bare mineral soil or noncombustible hardscape, with NO plants?',
      helpText:
        'Gravel, pavers, concrete, or decomposed granite only. Remove ALL plants within 5 ft — even ones labeled "fire-resistant" are still combustible and can carry embers to the wall.',
      weight: 3,
      standard: 'IBHS Zone 0 · CA AB 3074 (phasing in)',
    },
    {
      id: 'zone0-mulch',
      category: 'defensible-space',
      question: 'Is all combustible mulch removed from within 5 ft of the home?',
      helpText:
        'Bark, wood chips, and rubber mulch ignite readily from embers. Replace with gravel or other noncombustible groundcover in the 0-5 ft zone.',
      weight: 2,
      standard: 'IBHS Zone 0 · CA AB 3074',
    },
    {
      id: 'fence-attachment',
      category: 'defensible-space',
      question:
        'Where a wood or vinyl fence meets the house, is there a 5-ft noncombustible section at the connection?',
      helpText:
        'Combustible fences act as a wick, carrying fire directly to the wall — a documented structure-to-structure ignition path. Use metal or masonry for the last 5 ft, and keep combustible fences/gates out of Zone 0.',
      weight: 2,
      standard: 'IBHS WFPH · NIST TN 2228',
    },
    {
      id: 'zone1-maintained',
      category: 'defensible-space',
      question: 'Is vegetation in Zone 1 (5-30 feet) properly spaced and maintained?',
      helpText: 'Trees should be 10 feet apart, shrubs limited in size',
      weight: 2,
      standard: 'CAL FIRE PRC 4291',
    },
    {
      id: 'zone2-reduced',
      category: 'defensible-space',
      question: 'Has fuel been reduced in Zone 2 (30-100 feet)?',
      helpText: 'Dead plants removed, grass kept short, spacing maintained',
      weight: 2,
      standard: 'CAL FIRE PRC 4291',
    },

    // Roof & Structure — includes attached decks (part of the building footprint)
    {
      id: 'roof-rated',
      category: 'roof-structure',
      question: 'Is your roof made of Class A fire-rated material?',
      helpText: 'Metal, tile, or composition shingles (not wood shake)',
      weight: 3,
      standard: 'CBC Chapter 7A',
    },
    {
      id: 'gutters-clean',
      category: 'roof-structure',
      question: 'Are gutters and roof clear of debris?',
      helpText:
        'Leaves, needles, and other combustibles removed; noncombustible gutter guards help',
      weight: 2,
    },
    {
      id: 'siding-noncombustible',
      category: 'roof-structure',
      question: 'Is your siding made of fire-resistant material?',
      helpText: 'Stucco, brick, fiber cement, or treated wood',
      weight: 2,
      standard: 'CBC Chapter 7A',
    },
    {
      id: 'deck-under-clear',
      category: 'roof-structure',
      question:
        'Is the area under and within 5 ft of attached decks/porches free of combustibles?',
      helpText:
        'Attached decks count as part of the structure and need their own 0-5 ft noncombustible zone. Remove stored items, vegetation, and mulch from beneath and beside the deck.',
      weight: 2,
      standard: 'CA AB 3074 · IBHS WFPH',
    },
    {
      id: 'deck-surface',
      category: 'roof-structure',
      question:
        'Are deck surfaces ignition-resistant, with metal flashing where the deck meets the wall?',
      helpText:
        'Walking surfaces within 10 ft of the home should be ignition-resistant/noncombustible (ASTM E2632/E2726), with 6-inch metal flashing at deck-to-wall intersections.',
      weight: 1,
      standard: 'CBC Chapter 7A §709A',
    },

    // Vegetation Management
    {
      id: 'veg-dead-removed',
      category: 'vegetation',
      question: 'Has all dead and dying vegetation been removed from the property?',
      helpText:
        'Dead plants, dry grass, fallen leaves, and needles are easily ignited by embers',
      weight: 2,
      standard: 'CAL FIRE PRC 4291',
    },
    {
      id: 'veg-tree-spacing',
      category: 'vegetation',
      question: 'Are tree canopies spaced apart and limbed up from the ground?',
      helpText:
        'Maintain ~10 ft between canopies and remove lower limbs (6-10 ft up) to break up "ladder fuels" that carry fire from the ground into the crowns.',
      weight: 2,
      standard: 'CAL FIRE PRC 4291',
    },
    {
      id: 'veg-overhang',
      category: 'vegetation',
      question: 'Are branches cut back from the roof and chimney?',
      helpText: 'No limbs overhanging the roof; keep branches at least 10 ft from the chimney',
      weight: 2,
      standard: 'CAL FIRE PRC 4291',
    },

    // Ember Intrusion
    {
      id: 'vents-screened',
      category: 'ember-intrusion',
      question:
        'Are vents WUI-rated ember- and flame-resistant (not just covered with mesh)?',
      helpText:
        'Standard 1/8-inch mesh slows but does not stop wind-driven embers. Use vents tested to ASTM E2886 / listed by the State Fire Marshal. Where only mesh is possible, use 1/16-1/8 inch noncombustible, corrosion-resistant metal mesh.',
      weight: 3,
      standard: 'CBC Chapter 7A §706A · IBHS WFPH',
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
      standard: 'CBC Chapter 7A',
    },

    // Access & Evacuation
    {
      id: 'driveway-clearance',
      category: 'access-evacuation',
      question: 'Is your driveway at least 12 feet wide with vertical clearance?',
      helpText: 'Fire trucks need clearance for access',
      weight: 2,
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
      helpText: 'Pool, pond, cistern, or hydrant within 1000 feet',
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
      title: 'Harden the 0-5 ft Ember-Resistant Zone',
      description:
        'Clear the 0-5 ft Zone 0 to bare soil or noncombustible hardscape — remove all plants, combustible mulch, and stored items. Add a 5-ft noncombustible section where any fence meets the house, and reduce fuel in Zones 1-2.',
      estimatedCost: '$500-2000',
    },
    {
      category: 'roof-structure',
      threshold: 7,
      priority: 'short-term',
      title: 'Upgrade Roof Materials',
      description:
        'Consider replacing wood shake roofing with Class A fire-rated materials.',
      estimatedCost: '$5000-15000',
    },
    {
      category: 'vegetation',
      threshold: 7,
      priority: 'immediate',
      title: 'Vegetation Management',
      description:
        'Trim tree branches to maintain 10-foot clearance from structures and remove ladder fuels.',
      estimatedCost: '$200-1000',
    },
    {
      category: 'ember-intrusion',
      threshold: 7,
      priority: 'short-term',
      title: 'Install WUI-Rated Ember-Resistant Vents',
      description:
        'Replace standard or mesh-only vents with WUI-rated ember- and flame-resistant vents tested to ASTM E2886 (State Fire Marshal listed). Plain 1/8-inch mesh does not stop wind-driven embers.',
      estimatedCost: '$300-800',
    },
  ],
};
