import { compositeProfile } from './composite';
import { deriveProfile } from './derive';

/**
 * Alaska — DNR Division of Forestry "Firewise Alaska" (voluntary). Boreal-
 * specific: black/white spruce are the hazard trees (deciduous birch/aspen
 * are the safe ones), so the near-home rule is "no conifers," and access
 * numbers are unusually concrete (18-ft driveway, 60-ft turnaround).
 */
export const alaskaProfile = deriveProfile(compositeProfile, {
  id: 'us-ak',
  stateCode: 'AK',
  label: 'Alaska',
  authority: 'Alaska DNR Division of Forestry · Firewise Alaska',
  basis: 'guidance',
  basisNote:
    'Alaska\'s Division of Forestry publishes Firewise Alaska guidance tuned to boreal fuels (spruce vs. birch/aspen). Voluntary — and state grants of up to $2,500 help with spruce removal near homes.',
  sources: [
    { title: 'Firewise Alaska (DNR Division of Forestry)', url: 'https://forestry.alaska.gov/fire/firewise' },
  ],
  upsertItems: [
    {
      id: 'zone1-maintained',
      category: 'defensible-space',
      question:
        'Within 30 ft (100 ft downhill on steep slopes), are all conifers removed — keeping only low plants (<18 in) and spaced deciduous trees?',
      helpText:
        'Firewise Alaska Zone 1: no spruce within 30 ft of buildings. Deciduous trees (birch, aspen) may stand at the zone edge with 20-ft trunk / 10-ft crown spacing. No wooden walkways or wood-chip paths leading to the house.',
      weight: 3,
      standard: 'Firewise Alaska Zone 1',
    },
    {
      id: 'zone2-reduced',
      category: 'defensible-space',
      question:
        'In the next 60 ft (Zone 2), are crowns 10 ft apart, trees limbed up 8 ft, and shrubs spaced 2-3x their height?',
      helpText:
        'Firewise Alaska Zone 2 spacing; in Zone 3 beyond, thin spruce stands and mow tall grass. Prune no more than 1/4 of a tree\'s crown per year.',
      weight: 2,
      standard: 'Firewise Alaska Zone 2',
    },
    {
      id: 'ak-black-spruce',
      category: 'vegetation',
      question: 'Are black spruce removed or heavily thinned within 100 ft of the home?',
      helpText:
        'Black spruce is Alaska\'s most explosive fuel — it carries crown fire even at low wind. State grants (up to $2,500) help cover removal within 100 ft.',
      weight: 2,
      standard: 'Firewise Alaska',
    },
    {
      id: 'veg-tree-spacing',
      category: 'vegetation',
      question: 'Are trees over 20 ft tall limbed up 8 ft, with no branches within 10 ft of buildings?',
      helpText: 'Firewise Alaska pruning standard for boreal conifers.',
      weight: 2,
      standard: 'Firewise Alaska',
    },
    {
      id: 'driveway-clearance',
      category: 'access-evacuation',
      question:
        'Is the driveway at least 18 ft wide and all-weather, with 15 ft of overhead clearance and a 60-ft-radius turnaround on dead ends?',
      helpText:
        'Firewise Alaska access standards are wider than most states because engines and water tenders must operate far from hydrants; two escape routes are recommended.',
      weight: 2,
      standard: 'Firewise Alaska',
    },
  ],
});
