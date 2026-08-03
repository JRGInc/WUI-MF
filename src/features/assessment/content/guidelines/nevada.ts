import { compositeProfile } from './composite';
import { deriveProfile } from './derive';

/**
 * Nevada — "Living With Fire" (UNR Extension + NV Division of Forestry,
 * Defensible Space Guide SP-23-07). Voluntary statewide, with narrow NRS
 * 472.041/472.500 abatement hooks in designated hazardous areas. Ecosystem-
 * specific: sagebrush/cheatgrass and pinyon-juniper rules alongside pine.
 */
export const nevadaProfile = deriveProfile(compositeProfile, {
  id: 'us-nv',
  stateCode: 'NV',
  label: 'Nevada',
  authority: 'Living With Fire (UNR/NDF) SP-23-07',
  basis: 'guidance',
  basisNote:
    'Nevada\'s guidance comes from the "Living With Fire" program (University of Nevada, Reno Extension with the NV Division of Forestry) — voluntary, though state law lets the Forester Firewarden order hazard abatement in designated hazardous areas.',
  sources: [
    { title: 'Living With Fire — Defensible Space Guide (SP-23-07)', url: 'https://extension.unr.edu/publication.aspx?PubID=5522' },
    { title: 'Wildfire Home Retrofit Guide (SP-20-11)', url: 'https://extension.unr.edu/publication.aspx?PubID=3810' },
  ],
  upsertItems: [
    {
      id: 'zone0-clear',
      category: 'defensible-space',
      question:
        'Is the 0-5 ft ember-resistant zone hardscape only — no wood mulch, woodpiles, or junipers, and nothing woody under windows, vents, or inside corners?',
      helpText:
        'Living With Fire Zone 0: hardscape the first 5 ft, and remove ornamental junipers within 30 ft of the home — they are Nevada\'s signature "gasoline plant." Any plants kept near the house should stay under 18 inches.',
      weight: 3,
      standard: 'Living With Fire Zone 0',
    },
    {
      id: 'nv-zone1',
      category: 'defensible-space',
      question:
        'In Zone 1 (5-30 ft), is vegetation in separated islands, wood mulch at most 1 inch deep, and cheatgrass cleared within 30 ft?',
      helpText:
        'Living With Fire Zone 1: lean/clean/green vegetation islands, branches trimmed 10 ft from the home, chimney, deck, roof, and other trees, wood mulch limited to 1 inch depth, firewood 30 ft out, and 10 ft cleared around propane. In sagebrush areas keep plants under 2 ft and clear cheatgrass.',
      weight: 2,
      standard: 'Living With Fire Zone 1',
    },
    {
      id: 'zone2-reduced',
      category: 'defensible-space',
      question:
        'In Zone 2 (30-100+ ft), are shrubs separated by 2x their height, canopies ~10 ft apart, and pinyon/juniper thinned to 1.5-2x tree height?',
      helpText:
        'Living With Fire Zone 2: shrub separation of twice their height, ~10 ft average canopy spacing, pinyon-juniper thinned to 1.5-2x tree height, pine-needle depth under 3 inches, grass mowed to 4 inches — extending to 200 ft for shrub/woodland fuels on slopes over 20%. Never remove more than 1/3 of a tree\'s branches.',
      weight: 2,
      standard: 'Living With Fire Zone 2',
    },
    {
      id: 'zone1-maintained',
      category: 'defensible-space',
      question:
        'Do outbuildings 30+ ft away have their own ember-resistant zone, with firewood at least 30 ft from the house?',
      helpText:
        'Living With Fire treats sheds and detached garages as separate ignition points needing their own 0-5 ft zone.',
      weight: 1,
      standard: 'Living With Fire',
    },
    {
      id: 'vents-screened',
      category: 'ember-intrusion',
      question: 'Are vents 1/8-inch metal mesh or ember-rated?',
      helpText:
        'The Nevada Wildfire Home Retrofit Guide (SP-20-11) calls for 1/8-inch metal vent mesh or ember-rated vents, gap blocking, and a noncombustible zone under decks.',
      weight: 3,
      standard: 'NV Retrofit Guide SP-20-11',
    },
  ],
});
