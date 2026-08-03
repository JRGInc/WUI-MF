import { compositeProfile } from './composite';
import { deriveProfile } from './derive';

/**
 * Wisconsin — WI DNR "Preparing Your Property" series (Home Ignition Zone
 * Self-Check PUB FR-474; voluntary). Distinct: a 100-200 ft Structure
 * Ignition Zone (wider than NFPA's 100 ft), buildings within 30 ft treated
 * as one unit, boxed eaves, and a waterfront-home module (FR-419).
 */
export const wisconsinProfile = deriveProfile(compositeProfile, {
  id: 'us-wi',
  stateCode: 'WI',
  label: 'Wisconsin',
  authority: 'WI DNR Preparing Your Property (FR-474)',
  basis: 'guidance',
  basisNote:
    'The Wisconsin DNR publishes its own home-ignition-zone standards in the "Preparing Your Property" series (including the FR-474 self-check). Voluntary; no statewide mandate.',
  sources: [
    { title: 'WI DNR — Preparing Your Property', url: 'https://dnr.wisconsin.gov/topic/forestfire/preparing' },
    { title: 'WI DNR — Driveway Access', url: 'https://dnr.wisconsin.gov/topic/forestfire/drivewayaccess' },
  ],
  upsertItems: [
    {
      id: 'zone0-clear',
      category: 'defensible-space',
      question:
        'Is the 0-5 ft zone free of plants and wood mulch, with evergreens minimized within 30 ft?',
      helpText:
        'WI DNR: no plantings or wood mulch against the structure, and keep evergreens (the main ladder fuel in Wisconsin\'s pine belts) out of the first 30 ft. Outbuildings within 30 ft share the home\'s ignition zone — treat them as one unit.',
      weight: 3,
      standard: 'WI DNR FR-474',
    },
    {
      id: 'zone2-reduced',
      category: 'defensible-space',
      question:
        'Is the Structure Ignition Zone managed out to 100-200 ft — dead material removed and fuels broken up?',
      helpText:
        'Wisconsin\'s guidance extends the managed zone to 100-200 ft, wider than the national 100 ft, reflecting fast-moving crown fire in pine barrens. Firewood 30 ft out; 10 ft cleared around fuel tanks.',
      weight: 2,
      standard: 'WI DNR FR-474',
    },
    {
      id: 'gaps-sealed',
      category: 'ember-intrusion',
      question: 'Are eaves boxed (soffited) with 5/8-inch plywood or better, with all gaps sealed?',
      helpText:
        'WI DNR recommends boxing open eaves with 5/8-inch plywood or better so embers cannot lodge in rafter tails.',
      weight: 2,
      standard: 'WI DNR FR-474',
    },
    {
      id: 'vents-screened',
      category: 'ember-intrusion',
      question: 'Are vents screened with 1/8-inch metal mesh (1/4 inch at most)?',
      helpText:
        'WI DNR\'s self-check publication uses 1/8-inch mesh (its webpage says 1/4 inch — treat 1/8 as the target, 1/4 as the floor). Ember-rated vents exceed both.',
      weight: 3,
      standard: 'WI DNR FR-474',
    },
    {
      id: 'driveway-clearance',
      category: 'access-evacuation',
      question: 'Is the driveway at least 12 ft wide with 13.5 ft of overhead clearance?',
      helpText: 'WI DNR driveway access standard for fire apparatus.',
      weight: 2,
      standard: 'WI DNR driveway guidance',
    },
  ],
});
