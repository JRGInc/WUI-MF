import { compositeProfile } from './composite';
import { deriveProfile } from './derive';

/**
 * Florida — Florida Forest Service (FDACS) "Be Wildfire Ready" guidance
 * (voluntary; F.S. ch. 590 grants FFS prevention powers but imposes no
 * homeowner mandate). FFS uses a 4-zone system: Zone 1 0-30 ft defensible
 * space, Zone 2 30-60 ft fuel reduction (grass ≤4 in), Zone 3 60-100 ft
 * transition, Zone 4 100+ ft perimeter.
 */
export const floridaProfile = deriveProfile(compositeProfile, {
  id: 'us-fl',
  stateCode: 'FL',
  label: 'Florida',
  authority: 'Florida Forest Service (FDACS) · Be Wildfire Ready',
  basis: 'guidance',
  basisNote:
    'The Florida Forest Service publishes its own four-zone defensible-space system under "Be Wildfire Ready" — voluntary; Florida law grants the FFS prevention and burn-regulation powers but imposes no homeowner defensible-space requirement.',
  sources: [
    { title: 'FFS — Prepare Your Yard', url: 'https://www.fdacs.gov/Forest-Wildfire/Wildland-Fire/Fire-Prevention/Be-Wildfire-Ready/Prepare-Your-Yard' },
    { title: 'FFS — Prepare Your Home', url: 'https://www.fdacs.gov/Forest-Wildfire/Wildland-Fire/Fire-Prevention/Be-Wildfire-Ready/Prepare-Your-Home' },
  ],
  upsertItems: [
    {
      id: 'zone1-maintained',
      category: 'defensible-space',
      question:
        'Is Zone 1 (0-30 ft) clear of dead vegetation — yard, roof, gutters, window sills, and under decks — with tree canopies 10 ft apart?',
      helpText:
        'Florida Forest Service Zone 1: remove all dead vegetation, keep branches from overhanging the roof, keep dead branches 10 ft from the chimney, and maintain at least 10 ft between tree canopies.',
      weight: 2,
      standard: 'FFS Be Wildfire Ready · Zone 1',
    },
    {
      id: 'zone2-reduced',
      category: 'defensible-space',
      question:
        'In Zone 2 (30-60 ft), is annual grass mowed to 4 inches or less with separation between shrubs and trees?',
      helpText:
        'Florida Forest Service Zone 2 (fuel reduction): grass at 4 inches max, horizontal and vertical separation between shrubs and trees, and fallen leaves, needles, twigs, and cones removed. Zone 3 (60-100 ft) continues the spacing and clears low vegetation under pines.',
      weight: 2,
      standard: 'FFS Be Wildfire Ready · Zones 2-3',
    },
    {
      id: 'windows-multiPane',
      category: 'ember-intrusion',
      question:
        'Are windows dual-pane tempered glass, with shutters and insect screens?',
      helpText:
        'Florida Forest Service recommends dual-pane tempered windows plus shutters and insect screens to resist radiant heat and ember entry.',
      weight: 2,
      standard: 'FFS Prepare Your Home',
    },
    {
      id: 'driveway-clearance',
      category: 'access-evacuation',
      question:
        'Is the driveway trimmed to 13.5 ft of vertical clearance with 10 ft of horizontal clearance on each side?',
      helpText:
        'Florida Forest Service asks for 10 ft of horizontal clearance either side of the traveled way and vegetation trimmed to 13.5 ft overhead so fire apparatus can reach the home, with gates wide enough for emergency vehicles.',
      weight: 2,
      standard: 'FFS Prepare Your Home',
    },
  ],
  upsertRecommendationRules: [
    {
      category: 'defensible-space',
      threshold: 7,
      priority: 'immediate',
      title: 'Work the Florida Four Zones',
      description:
        'Clear the 0-5 ft strip to noncombustible ground, remove all dead vegetation in Zone 1 (0-30 ft), mow Zone 2 (30-60 ft) grass to 4 inches with shrub/tree separation, and thin low vegetation under pines in Zone 3 (60-100 ft).',
      estimatedCost: '$500-2000',
    },
  ],
});
