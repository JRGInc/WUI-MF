import { compositeProfile } from './composite';
import { deriveProfile } from './derive';

/**
 * Washington — RCW 19.27.560 (SB 6120, 2024) mandates hardening for building
 * permits in high/very-high hazard areas on the DNR statewide map (map final
 * Dec 2026; enforcement ~mid-2027; also triggered by ≥50% reroofs). The
 * statute covers structure hardening and driveway access only — defensible
 * space is NOT mandated statewide, so those items keep DNR "Wildfire Ready
 * Neighbors" (NFPA-baseline) guidance.
 */
export const washingtonProfile = deriveProfile(compositeProfile, {
  id: 'us-wa',
  stateCode: 'WA',
  label: 'Washington',
  authority: 'RCW 19.27.560 (hardening) · DNR Wildfire Ready Neighbors',
  basis: 'partial-mandate',
  basisNote:
    'Washington law (RCW 19.27.560) mandates home hardening for building permits in mapped high-hazard areas, but enforcement awaits the DNR statewide hazard map (expected ~2027) and covers structures and access only. Defensible-space items follow DNR\'s voluntary Wildfire Ready Neighbors guidance.',
  sources: [
    { title: 'RCW 19.27.560', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=19.27.560' },
    { title: 'DNR — Wildfire Ready Neighbors', url: 'https://wildfireready.dnr.wa.gov/' },
  ],
  upsertItems: [
    {
      id: 'roof-rated',
      category: 'roof-structure',
      question: 'Is the roof a Class A assembly (ASTM E108/UL 790) with roof-edge gaps firestopped?',
      helpText:
        'RCW 19.27.560 requires Class A roofing with roof-profile gaps firestopped at eave ends for permits in mapped high/very-high hazard areas (enforcement begins once the DNR map finalizes, ~2027). Reroofing half the roof or more triggers the requirement.',
      weight: 3,
      standard: 'RCW 19.27.560 (mapped hazard areas)',
    },
    {
      id: 'siding-noncombustible',
      category: 'roof-structure',
      question:
        'Are exterior walls ignition-resistant, noncombustible, heavy timber/log, or 1-hour rated from foundation to roof sheathing?',
      helpText: 'RCW 19.27.560 wall standard for mapped hazard areas.',
      weight: 2,
      standard: 'RCW 19.27.560',
    },
    {
      id: 'deck-under-clear',
      category: 'roof-structure',
      question:
        'Are decks ignition-resistant or heavy timber, with first-floor deck undersides screened with wire mesh and clear of stored combustibles?',
      helpText:
        'RCW 19.27.560 allows first-floor decks of 2-inch nominal lumber when the underside is screened with wire mesh; keep the area beneath free of combustibles either way.',
      weight: 2,
      standard: 'RCW 19.27.560',
    },
    {
      id: 'driveway-clearance',
      category: 'access-evacuation',
      question:
        'If the home sits more than 150 ft from a fire-apparatus road, is there a driveway — with a turnaround beyond 300 ft and turnouts on long narrow drives?',
      helpText:
        'RCW 19.27.560 access triggers: a driveway is required beyond 150 ft, a turnaround beyond 300 ft, and turnouts plus a turnaround when the drive exceeds 500 ft and is under 20 ft wide.',
      weight: 2,
      positiveLabel: 'Yes / N.A.',
      standard: 'RCW 19.27.560',
    },
  ],
});
