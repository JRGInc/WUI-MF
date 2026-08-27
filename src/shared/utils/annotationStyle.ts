import type { AnnotationContent, AnnotationType, RiskLevel } from '@/shared/types';
import { mitigationIconById, mitigationIconUrl } from './mitigationIcons';

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
  'mitigation-icon': '🛠',
};

// Mitigation icons mark an action to take, not a risk grade, so they get a
// fixed green instead of the risk palette (forest-600).
export const MITIGATION_CSS = '#16a34a';

/** Risk level an annotation renders as (defaults to moderate when unset). */
export function annotationRisk(content: AnnotationContent): RiskLevel {
  return content.riskLevel ?? 'moderate';
}

/** Marker tag color: green for mitigation icons, risk color otherwise. */
export function annotationColor(type: AnnotationType, content: AnnotationContent): string {
  return type === 'mitigation-icon' ? MITIGATION_CSS : RISK_CSS[annotationRisk(content)];
}

/** Marker glyph for non-image annotations (mitigation icons render artwork instead). */
export function annotationGlyph(type: AnnotationType): string {
  return TYPE_GLYPH[type] ?? '•';
}

/** Artwork URL for a mitigation-icon annotation; undefined for other types. */
export function annotationImage(content: AnnotationContent): string | undefined {
  const icon = mitigationIconById(content.iconId);
  return icon ? mitigationIconUrl(icon.id) : undefined;
}
