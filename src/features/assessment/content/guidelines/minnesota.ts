import { compositeProfile } from './composite';
import { deriveProfile } from './derive';

/**
 * Minnesota — MN DNR "Firewise in Minnesota" (voluntary). Distinct zone
 * system (Intensive 30 ft / Extensive next 70-100 ft, 200+ ft high-risk)
 * with unusually specific numbers: 1-2 inch intensive-zone grass, 25-ft
 * firewood setback, and detailed driveway geometry.
 */
export const minnesotaProfile = deriveProfile(compositeProfile, {
  id: 'us-mn',
  stateCode: 'MN',
  label: 'Minnesota',
  authority: 'MN DNR Firewise in Minnesota',
  basis: 'guidance',
  basisNote:
    'The Minnesota DNR publishes its own zone system and numbers under "Firewise in Minnesota." Voluntary; Minnesota\'s binding fire rules cover burning permits only.',
  sources: [
    { title: 'MN DNR — Defensible Space', url: 'https://www.dnr.state.mn.us/firewise/livingwithfire/space.html' },
    { title: 'MN DNR — 50 Things You Can Do', url: 'https://www.dnr.state.mn.us/firewise/50things.html' },
  ],
  upsertItems: [
    {
      id: 'zone0-clear',
      category: 'defensible-space',
      question: 'Is nothing planted within 3-5 ft of the structure, with noncombustible ground cover there?',
      helpText:
        'MN DNR: keep the first 3-5 ft unplanted. Decks less than 5 ft off the ground should be enclosed with 1/8-inch mesh.',
      weight: 3,
      standard: 'MN DNR Firewise',
    },
    {
      id: 'zone1-maintained',
      category: 'defensible-space',
      question:
        'In the Intensive Zone (30 ft), is the lawn green and mowed to 1-2 inches, with conifers pruned up at least 8 ft?',
      helpText:
        'MN DNR Intensive Zone: 1-2 inch grass, conifer crowns at least 10 ft apart, pruning to 8 ft, and no branches within 10 ft of the roof (20 ft clearance around chimneys).',
      weight: 2,
      standard: 'MN DNR Firewise · Intensive Zone',
    },
    {
      id: 'zone2-reduced',
      category: 'defensible-space',
      question:
        'In the Extensive Zone (next 70-100 ft; 200+ ft in high-risk areas), is grass under 6-8 inches with conifers pruned to 10 ft?',
      helpText:
        'MN DNR Extensive Zone: grass at 6-8 inches or less, pruning to 10 ft but never more than 1/3 of the live crown, and continued crown spacing.',
      weight: 2,
      standard: 'MN DNR Firewise · Extensive Zone',
    },
    {
      id: 'mn-firewood',
      category: 'defensible-space',
      question:
        'Is firewood at least 25 ft from the structure with 10 ft of cleared space around piles (propane 10 ft out, also cleared)?',
      helpText: 'MN DNR uses a 25-ft firewood setback with a 10-ft clear ring around piles and tanks.',
      weight: 1,
      standard: 'MN DNR Firewise',
    },
    {
      id: 'driveway-clearance',
      category: 'access-evacuation',
      question:
        'Is the driveway at least 12 ft wide (20 ft if longer than 150 ft) with 14 ft of overhead clearance and a turnaround?',
      helpText:
        'MN DNR driveway standards: 12-ft width (20 ft on drives over 150 ft), 14-ft vertical clearance, a 30-ft-radius turnaround or 60-ft hammerhead, turnouts every 400 ft on drives over 800 ft, and gates at least 10 ft wide set back 30 ft.',
      weight: 2,
      standard: 'MN DNR Firewise',
    },
    {
      id: 'mn-pump',
      category: 'water-supply',
      question:
        'Is there a non-electric (gas) pump able to draw from your water source, with at least 100 ft of hose?',
      helpText:
        'MN DNR recommends a pump that runs when the power fails, capable of running unattended, plus 100+ ft of hose reaching all sides of the home.',
      weight: 1,
      standard: 'MN DNR Firewise',
    },
  ],
});
