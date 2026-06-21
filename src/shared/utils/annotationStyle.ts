import type { AnnotationContent, AnnotationType, RiskLevel } from '@/shared/types';

// Single source of truth for how annotations look in both the map markers and
// the AR overlay, so a "high-risk note" reads the same in either view.

export const RISK_CSS: Record<RiskLevel, string> = {
  low: '#22c55e',
  moderate: '#eab308',
  high: '#f97316',
  extreme: '#dc2626',
};

/** Same palette as RISK_CSS, as 0xRRGGBB ints for three.js materials. */
export const RISK_HEX: Record<RiskLevel, number> = {
  low: 0x22c55e,
  moderate: 0xeab308,
  high: 0xf97316,
  extreme: 0xdc2626,
};

export const TYPE_GLYPH: Record<AnnotationType, string> = {
  'risk-marker': '▲',
  measurement: '↔',
  'photo-location': '◎',
  recommendation: '✓',
  note: '✎',
};

/** Risk level an annotation renders as (defaults to moderate when unset). */
export function annotationRisk(content: AnnotationContent): RiskLevel {
  return content.riskLevel ?? 'moderate';
}
