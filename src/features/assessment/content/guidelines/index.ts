import { v4 as uuidv4 } from 'uuid';
import type { CategoryScores, Recommendation, RiskCategory } from '@/shared/types';
import { compositeProfile } from './composite';
import { alaskaProfile } from './alaska';
import { arizonaProfile } from './arizona';
import { californiaProfile } from './california';
import { coloradoProfile } from './colorado';
import { floridaProfile } from './florida';
import { georgiaProfile } from './georgia';
import { hawaiiProfile } from './hawaii';
import { idahoProfile } from './idaho';
import { iowaProfile } from './iowa';
import { kentuckyProfile } from './kentucky';
import { maineProfile } from './maine';
import { minnesotaProfile } from './minnesota';
import { missouriProfile } from './missouri';
import { nevadaProfile } from './nevada';
import { newJerseyProfile } from './newJersey';
import { newMexicoProfile } from './newMexico';
import { newYorkProfile } from './newYork';
import { northCarolinaProfile } from './northCarolina';
import { oregonProfile } from './oregon';
import { tennesseeProfile } from './tennessee';
import { utahProfile } from './utah';
import { virginiaProfile } from './virginia';
import { washingtonProfile } from './washington';
import { wisconsinProfile } from './wisconsin';
import type { GuidelineProfile } from './types';

export type {
  ChecklistItem,
  GuidelineBasis,
  GuidelineProfile,
  GuidelineSource,
  RecommendationRule,
} from './types';
export { compositeProfile };

/** State-specific profiles. The composite profile is the fallback and is not
 * listed here — `resolveGuidelineProfile` returns it for unmatched states. */
export const STATE_GUIDELINE_PROFILES: GuidelineProfile[] = [
  alaskaProfile,
  arizonaProfile,
  californiaProfile,
  coloradoProfile,
  floridaProfile,
  georgiaProfile,
  hawaiiProfile,
  idahoProfile,
  iowaProfile,
  kentuckyProfile,
  maineProfile,
  minnesotaProfile,
  missouriProfile,
  nevadaProfile,
  newJerseyProfile,
  newMexicoProfile,
  newYorkProfile,
  northCarolinaProfile,
  oregonProfile,
  tennesseeProfile,
  utahProfile,
  virginiaProfile,
  washingtonProfile,
  wisconsinProfile,
];

/** The guideline set for a US state (USPS code), falling back to the national
 * composite when the state is unknown or has no dedicated profile. */
export function resolveGuidelineProfile(
  stateCode: string | null | undefined
): GuidelineProfile {
  if (!stateCode) return compositeProfile;
  return (
    STATE_GUIDELINE_PROFILES.find((p) => p.stateCode === stateCode) ??
    compositeProfile
  );
}

/** Profile by its persisted id (e.g. when re-displaying a saved assessment). */
export function guidelineProfileById(id: string | undefined): GuidelineProfile {
  if (!id) return compositeProfile;
  return (
    [compositeProfile, ...STATE_GUIDELINE_PROFILES].find((p) => p.id === id) ??
    compositeProfile
  );
}

const CATEGORY_TO_SCORE_KEY: Record<RiskCategory, keyof CategoryScores> = {
  'defensible-space': 'defensibleSpace',
  'roof-structure': 'roofAndStructure',
  vegetation: 'vegetationManagement',
  'access-evacuation': 'accessAndEvacuation',
  'water-supply': 'waterSupply',
  'ember-intrusion': 'emberIntrusion',
};

/** Apply the profile's recommendation rules to the category scores (0-10). */
export function generateRecommendations(
  profile: GuidelineProfile,
  scores: CategoryScores
): Recommendation[] {
  return profile.recommendationRules
    .filter((rule) => scores[CATEGORY_TO_SCORE_KEY[rule.category]] < rule.threshold)
    .map((rule) => ({
      id: uuidv4(),
      category: rule.category,
      priority: rule.priority,
      title: rule.title,
      description: rule.description,
      estimatedCost: rule.estimatedCost,
    }));
}
