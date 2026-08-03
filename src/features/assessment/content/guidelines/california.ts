import type { GuidelineProfile } from './types';

/**
 * California guideline set — the only state where defensible space is a legal
 * requirement (PRC 4291: 100 ft or to the property line, enforced by CAL FIRE
 * in State Responsibility Areas). Zone 0 (0-5 ft ember-resistant zone, AB
 * 3074) is phasing in via Board of Forestry regulation. Building hardening
 * items reference the California Wildland-Urban Interface Code (CWUIC — which absorbed CBC Chapter 7A on Jan 1, 2026) and the
 * CA Fire Safe Regulations (14 CCR 1270+) for access and water.
 *
 * Items shared verbatim with the composite profile keep the same `id`, so a
 * checklist answered under one profile keeps those answers if the resolved
 * state changes mid-assessment.
 */
export const californiaProfile: GuidelineProfile = {
  id: 'us-ca',
  stateCode: 'CA',
  label: 'California',
  authority: 'CAL FIRE PRC 4291 · CWUIC · 14 CCR 1270',
  basis: 'mandatory',
  basisNote:
    'California law (Public Resources Code 4291) requires 100 ft of defensible space, enforced by CAL FIRE inspections in State Responsibility Areas. The 0-5 ft Zone 0 requirement (AB 3074/SB 504) is phasing in, and new WUI construction must meet the California Wildland-Urban Interface Code.',
  sources: [
    { title: 'CAL FIRE — Defensible Space', url: 'https://www.fire.ca.gov/dspace' },
    { title: 'Ready for Wildfire — Hardening Your Home', url: 'https://www.readyforwildfire.org/prepare-for-wildfire/hardening-your-home/' },
    { title: 'Board of Forestry — Zone 0 Regulation', url: 'https://bof.fire.ca.gov/projects-and-programs/defensible-space-zones-0-1-2/' },
  ],
  checklistItems: [
    // Defensible Space — legally required (PRC 4291)
    {
      id: 'zone0-clear',
      category: 'defensible-space',
      question:
        'Is the 0-5 ft "ember-resistant zone" cleared to bare mineral soil or noncombustible hardscape, with NO plants?',
      helpText:
        'California law (AB 3074/SB 504) adds Zone 0 to the defensible-space requirement — the Board of Forestry regulation is phasing in, applying to new construction first with a multi-year window for existing homes. Gravel, pavers, or concrete only; remove wood mulch, woody plants, dry grass, synthetic turf, and stored lumber within 5 ft, including under attached decks. Maintained trees may stay if no branches come within 5 ft of the roof or walls.',
      weight: 3,
      standard: 'CA AB 3074 / SB 504 · Zone 0 (phasing in)',
    },
    {
      id: 'zone0-mulch',
      category: 'defensible-space',
      question: 'Is all combustible mulch removed from within 5 ft of the home?',
      helpText:
        'Bark, wood chips, and rubber mulch ignite readily from embers. Replace with gravel or other noncombustible groundcover in the 0-5 ft zone.',
      weight: 2,
      standard: 'CA AB 3074 · Zone 0',
    },
    {
      id: 'fence-attachment',
      category: 'defensible-space',
      question:
        'Where a wood or vinyl fence meets the house, is there a 5-ft noncombustible section at the connection?',
      helpText:
        'Combustible fences act as a wick, carrying fire directly to the wall. The Zone 0 regulation targets combustible fences and gates attached to the structure — use metal or masonry for the last 5 ft.',
      weight: 2,
      standard: 'CA Zone 0 · IBHS WFPH',
    },
    {
      id: 'ca-zone1-lean-clean',
      category: 'defensible-space',
      question:
        'Is Zone 1 (5-30 ft) "lean, clean and green" — dead vegetation removed and plants separated from each other and the house?',
      helpText:
        'PRC 4291 requires removing all dead plants, grass, and weeds within 30 ft, keeping tree branches 10 ft from other trees, and moving flammable plants away from windows and other structures.',
      weight: 2,
      standard: 'CAL FIRE PRC 4291 Zone 1',
    },
    {
      id: 'ca-zone2-reduced',
      category: 'defensible-space',
      question:
        'In Zone 2 (30-100 ft), is annual grass mowed to 4 inches or less with fuel breaks between shrubs and trees?',
      helpText:
        'PRC 4291 requires reduced fuel out to 100 ft (or the property line): grass down to 4 inches, horizontal and vertical spacing between fuels (wider on slopes), and exposed wood piles given 10 ft of clearance.',
      weight: 2,
      standard: 'CAL FIRE PRC 4291 Zone 2',
    },
    {
      id: 'ca-firewood',
      category: 'defensible-space',
      question:
        'Are firewood and lumber stored at least 30 ft from the home (or with 10 ft of clearance in Zone 2)?',
      helpText:
        'Stacked firewood against the house is a direct ember target. Move it to Zone 2 with clear space around it.',
      weight: 1,
      standard: 'CAL FIRE PRC 4291',
    },

    // Roof & Structure
    {
      id: 'roof-rated',
      category: 'roof-structure',
      question: 'Is your roof made of Class A fire-rated material?',
      helpText:
        'Metal, tile, or composition shingles (not wood shake). California WUI building code (CWUIC, formerly CBC Chapter 7A) requires fire-rated roofing for new construction in WUI fire areas.',
      weight: 3,
      standard: 'CWUIC (formerly CBC 7A §705A)',
    },
    {
      id: 'gutters-clean',
      category: 'roof-structure',
      question: 'Are gutters and roof clear of debris?',
      helpText:
        'PRC 4291 requires keeping the roof and gutters free of leaves, needles, and other vegetative debris; noncombustible gutter guards help.',
      weight: 2,
      standard: 'CAL FIRE PRC 4291',
    },
    {
      id: 'siding-noncombustible',
      category: 'roof-structure',
      question: 'Is your siding made of fire-resistant material?',
      helpText: 'Stucco, brick, fiber cement, or treated wood',
      weight: 2,
      standard: 'CWUIC (formerly CBC 7A §707A)',
    },
    {
      id: 'deck-under-clear',
      category: 'roof-structure',
      question:
        'Is the area under and within 5 ft of attached decks/porches free of combustibles?',
      helpText:
        'Attached decks count as part of the structure and need their own 0-5 ft noncombustible zone. Remove stored items, vegetation, and mulch from beneath and beside the deck.',
      weight: 2,
      standard: 'CA Zone 0 · IBHS WFPH',
    },
    {
      id: 'deck-surface',
      category: 'roof-structure',
      question:
        'Are deck surfaces ignition-resistant, with metal flashing where the deck meets the wall?',
      helpText:
        'Walking surfaces within 10 ft of the home should be ignition-resistant/noncombustible (ASTM E2632/E2726), with 6-inch metal flashing at deck-to-wall intersections.',
      weight: 1,
      standard: 'CWUIC (formerly CBC 7A §709A)',
    },
    {
      id: 'ca-spark-arrester',
      category: 'roof-structure',
      question:
        'Do chimney and stovepipe outlets have an approved spark arrester (screen openings no larger than 1/2 inch)?',
      helpText:
        'PRC 4291 requires a spark arrester of nonflammable material on any chimney or stovepipe that burns solid fuel.',
      weight: 1,
      standard: 'CAL FIRE PRC 4291',
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
      id: 'ca-veg-tree-spacing',
      category: 'vegetation',
      question:
        'Are tree canopies spaced for the slope (10 ft apart on flat ground, more on slopes) and limbed up 6-10 ft?',
      helpText:
        'CAL FIRE spacing guidance scales with slope: 10 ft between canopies on flat to mild slopes, 20 ft on moderate slopes, 30 ft on steep slopes. Remove lower limbs (up to 6-10 ft, or 1/3 of the tree height for smaller trees) to break up ladder fuels.',
      weight: 2,
      standard: 'CAL FIRE PRC 4291',
    },
    {
      id: 'ca-veg-overhang',
      category: 'vegetation',
      question:
        'Are branches kept 10 ft away from the chimney and dead limbs cleared from over the roof?',
      helpText:
        'PRC 4291 explicitly requires 10 ft of clearance between chimney/stovepipe outlets and any vegetation, and removal of dead or dying limbs that overhang the roof.',
      weight: 2,
      standard: 'CAL FIRE PRC 4291',
    },

    // Ember Intrusion
    {
      id: 'ca-vents-sfm',
      category: 'ember-intrusion',
      question:
        'Are vents ember- and flame-resistant (State Fire Marshal listed / ASTM E2886), or at minimum 1/16-1/8 inch metal mesh?',
      helpText:
        'California WUI building code (CWUIC, formerly CBC Chapter 7A) requires WUI vents to resist ember and flame intrusion — SFM-listed vents are the compliant path for new construction. For retrofits, 1/16-1/8 inch noncombustible, corrosion-resistant metal mesh is the minimum.',
      weight: 3,
      standard: 'CWUIC (formerly CBC 7A §706A)',
    },
    {
      id: 'gaps-sealed',
      category: 'ember-intrusion',
      question: 'Are gaps in eaves and soffits sealed?',
      helpText: 'No openings for embers to enter',
      weight: 2,
    },
    {
      id: 'ca-windows',
      category: 'ember-intrusion',
      question:
        'Are windows dual-pane with at least one tempered pane (or otherwise fire-rated)?',
      helpText:
        'California WUI building code (CWUIC, formerly CBC Chapter 7A) requires exterior glazing in WUI areas to be multipane with at least one tempered pane, glass block, or 20-minute fire-rated. Single-pane windows can break from radiant heat and let fire inside.',
      weight: 2,
      standard: 'CWUIC (formerly CBC 7A §708A)',
    },

    // Access & Evacuation — CA Fire Safe Regulations (14 CCR 1270+)
    {
      id: 'ca-driveway',
      category: 'access-evacuation',
      question:
        'Does the driveway give fire apparatus a 10-ft lane with 14 ft horizontal and 13\'6" vertical clearance?',
      helpText:
        'The California Fire Safe Regulations set minimum driveway standards — a 10-ft traffic lane, 14 ft unobstructed horizontal and 13\'6" vertical clearance, gates 2 ft wider than the lane, and turnouts/turnarounds on long driveways.',
      weight: 2,
      standard: '14 CCR 1273.01 (Fire Safe Regulations)',
    },
    {
      id: 'ca-address-visible',
      category: 'access-evacuation',
      question:
        'Is the address displayed in at least 4-inch contrasting characters, visible from the road?',
      helpText:
        'The Fire Safe Regulations require addresses visible and legible from the road, with letters/numbers at least 4 inches tall on a contrasting background (reflective recommended).',
      weight: 1,
      standard: '14 CCR 1274',
    },
    {
      id: 'evacuation-plan',
      category: 'access-evacuation',
      question: 'Does your household have an evacuation plan?',
      helpText:
        'Including multiple routes and meeting points — see CAL FIRE "Ready, Set, Go!" for a template.',
      weight: 2,
    },

    // Water Supply
    {
      id: 'ca-water-source',
      category: 'water-supply',
      question:
        'Is there a water source usable for firefighting (hydrant, pool, pond, or tank) accessible to the property?',
      helpText:
        'The Fire Safe Regulations (14 CCR 1275) set emergency water standards for new development; for existing homes, a pool, pond, cistern, or hydrant within 1000 ft materially helps responders.',
      weight: 2,
      standard: '14 CCR 1275',
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
      title: 'Bring Defensible Space up to PRC 4291',
      description:
        'California law requires 100 ft of defensible space (or to the property line). Clear the 0-5 ft Zone 0 to noncombustible hardscape, make Zone 1 (5-30 ft) lean/clean/green, and reduce Zone 2 (30-100 ft) fuels — grass to 4 inches, spaced shrubs and trees. CAL FIRE defensible-space inspections check these items.',
      estimatedCost: '$500-2000',
    },
    {
      category: 'roof-structure',
      threshold: 7,
      priority: 'short-term',
      title: 'Upgrade Roof to Class A',
      description:
        'Replace wood shake roofing with Class A fire-rated material (metal, tile, or asphalt composition) per the CWUIC (formerly CBC Chapter 7A), and add a spark arrester to any solid-fuel chimney (required by PRC 4291).',
      estimatedCost: '$5000-15000',
    },
    {
      category: 'vegetation',
      threshold: 7,
      priority: 'immediate',
      title: 'Vegetation Management per CAL FIRE Spacing',
      description:
        'Remove dead vegetation, limb trees up 6-10 ft, keep branches 10 ft from the chimney, and space canopies for your slope (10 ft flat, up to 30 ft on steep slopes).',
      estimatedCost: '$200-1000',
    },
    {
      category: 'ember-intrusion',
      threshold: 7,
      priority: 'short-term',
      title: 'Install SFM-Listed Ember-Resistant Vents',
      description:
        'Replace standard vents with State Fire Marshal-listed ember- and flame-resistant vents (ASTM E2886) per the CWUIC (formerly CBC Chapter 7A); where retrofitting, use 1/16-1/8 inch noncombustible metal mesh at minimum.',
      estimatedCost: '$300-800',
    },
    {
      category: 'access-evacuation',
      threshold: 5,
      priority: 'short-term',
      title: 'Improve Fire Apparatus Access',
      description:
        'Widen/clear the driveway to the Fire Safe Regulation minimums (12 ft wide, 15 ft vertical clearance) and post 4-inch contrasting address characters visible from the road.',
      estimatedCost: '$100-3000',
    },
  ],
};
