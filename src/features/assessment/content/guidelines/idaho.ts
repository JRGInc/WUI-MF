import { compositeProfile } from './composite';
import { deriveProfile } from './derive';

/**
 * Idaho — IDL "Wildfire Home Protection Zone Evaluation" (FMH 821), a scored
 * voluntary assessment with Idaho-specific numbers. Note Idaho's
 * noncombustible break is 0-4 ft (not the usual 5), and near-home pruning
 * heights are aggressive (18 ft within 30 ft of the home).
 */
export const idahoProfile = deriveProfile(compositeProfile, {
  id: 'us-id',
  stateCode: 'ID',
  label: 'Idaho',
  authority: 'Idaho Dept. of Lands FMH 821',
  basis: 'guidance',
  basisNote:
    'Idaho has no statewide wildfire mandate; these items follow the Idaho Department of Lands\' Wildfire Home Protection Zone Evaluation (FMH 821), the state\'s own scored assessment standard. Some cities (e.g. Boise) have adopted local WUI codes.',
  sources: [
    { title: 'IDL — Wildfire Home Protection Zone Evaluation (FMH 821)', url: 'https://www.idl.idaho.gov/wp-content/uploads/sites/2/2020/06/wildfire-home-protection-zone-evaluation.pdf' },
    { title: 'Idaho Firewise', url: 'https://idahofirewise.org/' },
  ],
  upsertItems: [
    {
      id: 'zone0-clear',
      category: 'defensible-space',
      question:
        'Is there a nonflammable break (gravel, concrete, bare soil) in the first 4 ft around the home?',
      helpText:
        'Idaho\'s FMH 821 evaluation uses a 0-4 ft nonflammable break. No wood fences attached to the structure; firewood 30+ ft out; propane 10 ft out with 10 ft of clearance.',
      weight: 3,
      standard: 'IDL FMH 821',
    },
    {
      id: 'veg-tree-spacing',
      category: 'vegetation',
      question:
        'Within 30 ft, are trees pruned up to 18 ft (or 1/3 of live crown), crowns 15 ft apart, and shrubs spaced at 2.5x their height?',
      helpText:
        'FMH 821 near-home standards: 18-ft pruning (or 1/3 of the live crown), 15-ft crown spacing, and 2.5x-height shrub spacing. From 30-100 ft: prune to 10 ft with 10-ft crown spacing.',
      weight: 2,
      standard: 'IDL FMH 821',
    },
    {
      id: 'vents-screened',
      category: 'ember-intrusion',
      question:
        'Are vents, eaves, and deck undersides screened with 1/8-inch or finer metal mesh, with metal window screens during fire season?',
      helpText:
        'FMH 821 scores 1/8-inch metal mesh on all openings and metal (not nylon) window screens. Wood shake roofs score automatic high risk.',
      weight: 3,
      standard: 'IDL FMH 821',
    },
    {
      id: 'driveway-clearance',
      category: 'access-evacuation',
      question:
        'Is the driveway over 12 ft wide with 20 ft of vegetation clearance along it, a turnaround, and two egress routes from the property?',
      helpText:
        'FMH 821 access scoring: >12-ft driveway, 20-ft vegetation clearance along the drive, turnarounds, a reflective noncombustible address sign, and two ways out.',
      weight: 2,
      standard: 'IDL FMH 821',
    },
    {
      id: 'water-source',
      category: 'water-supply',
      question:
        'Is there a scored water source — draftable pond/stream, 1,800+ gallon pool, 2,000-gallon reservoir, 25+ gpm well, or hydrant?',
      helpText:
        'FMH 821 credits specific water sources: a pond or stream engines can draft from, a pool of at least 1,800 gallons (12 ft × 36 in), a 2,000-gallon reservoir, a well producing 25 gpm, or a hydrant.',
      weight: 2,
      standard: 'IDL FMH 821',
    },
  ],
});
