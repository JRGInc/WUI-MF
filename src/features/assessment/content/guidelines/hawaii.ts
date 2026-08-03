import { compositeProfile } from './composite';
import { deriveProfile } from './derive';

/**
 * Hawaii — post-Lahaina, Act 302 (SLH 2025) added HRS §132-O directing the
 * State Fire Marshal to establish minimum defensible-space requirements with
 * civil fines, but rulemaking was incomplete as of Aug 2026 — no enforceable
 * statewide numbers yet. This profile keeps the national composite items and
 * flags the pending state minimums; revisit once the rules are adopted.
 */
export const hawaiiProfile = deriveProfile(compositeProfile, {
  id: 'us-hi',
  stateCode: 'HI',
  label: 'Hawaii',
  authority: 'HI State Fire Marshal (HRS §132-O, rules pending) · Firewise',
  basis: 'partial-mandate',
  basisNote:
    'After the 2023 Maui fires, Hawaii enacted HRS §132-O directing the State Fire Marshal to set minimum defensible-space requirements with civil fines — but the rules were still in development as of August 2026, so this checklist uses national baseline numbers plus Hawaii-specific fuels guidance in the meantime.',
  sources: [
    { title: 'Hawaii Wildfire Management Organization', url: 'https://www.hawaiiwildfire.org/' },
    { title: 'Act 302 (SLH 2025) — HRS §132-O', url: 'https://data.capitol.hawaii.gov/sessions/sessionlaws/Years/SLH2025/SLH2025_Act302.pdf' },
  ],
  upsertItems: [
    {
      id: 'hi-grass-fuels',
      category: 'vegetation',
      question:
        'Are non-native grasses (guinea, buffel, fountain grass) mowed short and cleared back from the home?',
      helpText:
        'Fallow non-native grasslands drove the 2023 Maui fires. Keep grass short and create wide green or hardscaped breaks between grassland and the home; HWMO (Hawaii Wildfire Management Organization) publishes local guidance. Statewide minimums under HRS §132-O are in rulemaking and counties may adopt stricter rules.',
      weight: 2,
      standard: 'HWMO · HRS §132-O (rules pending)',
    },
  ],
});
