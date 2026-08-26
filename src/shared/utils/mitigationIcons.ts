// Mitigation icon catalog for the map's quick-place palette. The set and
// naming mirror the original BFMA Unity app's map icon buttons (Debris —
// Foundation/Roof, Fire Ladder — Trim/Vegetation, Vegetation Overhang/
// Underhang, HIZ 0–5 ft / 5–30 ft) so the field vocabulary carries over.
// Guidance wording follows the composite inspection guidelines
// (features/assessment/content/guidelines/composite.ts). Lives in shared/
// because both the map and the AR view render annotations with these ids.

export interface MitigationIconDef {
  id: string;
  label: string;
  /** Emoji shown in the palette button and on the placed map marker. */
  glyph: string;
  /** One-line summary — palette tooltip and marker detail card. */
  description: string;
  /** When to place this icon — shown in the palette help panel and README. */
  guidance: string;
}

export const MITIGATION_ICONS: MitigationIconDef[] = [
  {
    id: 'foundation',
    label: 'Debris — foundation',
    glyph: '🧱',
    description: 'Combustible debris against the foundation',
    guidance:
      'Place where leaf litter, mulch, firewood, or stored items sit against the ' +
      'foundation or exterior walls. The 0–5 ft ember-resistant zone should be ' +
      'bare soil or noncombustible hardscape.',
  },
  {
    id: 'roof',
    label: 'Debris — roof',
    glyph: '🏠',
    description: 'Debris on the roof or in gutters',
    guidance:
      'Place where leaves, needles, or branches have collected on the roof, in ' +
      'gutters, or in roof valleys — wind-blown embers ignite this debris first.',
  },
  {
    id: 'ladder-trim',
    label: 'Fire ladder — trim',
    glyph: '✂️',
    description: 'Low tree limbs forming a fire ladder',
    guidance:
      'Place at trees whose lower limbs should be removed (limb up 6–10 ft) so ' +
      'ground fire cannot climb into the crown.',
  },
  {
    id: 'ladder-veg',
    label: 'Fire ladder — vegetation',
    glyph: '🌿',
    description: 'Understory vegetation forming a fire ladder',
    guidance:
      'Place at shrubs or small trees growing beneath a larger tree canopy. This ' +
      'understory carries ground fire up into the crowns and should be removed or ' +
      'thinned.',
  },
  {
    id: 'overhang',
    label: 'Vegetation overhang',
    glyph: '🌳',
    description: 'Branches overhanging the roof or structure',
    guidance:
      'Place where tree branches overhang the roofline, deck, or chimney. Trim to ' +
      'keep roughly 10 ft of clearance between branches and the structure.',
  },
  {
    id: 'underhang',
    label: 'Vegetation underhang',
    glyph: '🪵',
    description: 'Fuels beneath decks, eaves, or overhangs',
    guidance:
      'Place where vegetation or stored combustibles sit under a deck, porch, or ' +
      'eave — sheltered pockets where embers collect. Attached decks need their ' +
      'own 0–5 ft noncombustible zone.',
  },
  {
    id: 'hiz',
    label: 'HIZ 0–5 ft',
    glyph: '🔥',
    description: 'Other hazard in the 0–5 ft ember-resistant zone',
    guidance:
      'Place for any Zone 0 hazard not covered by another icon — combustible ' +
      'mulch, plants against walls, a wooden fence meeting the house, or items ' +
      'stored near vents.',
  },
  {
    id: 'hiz-30',
    label: 'HIZ 5–30 ft',
    glyph: '📏',
    description: 'Other hazard in the 5–30 ft intermediate zone',
    guidance:
      'Place for any Zone 1 hazard not covered by another icon — unspaced or ' +
      'unmaintained vegetation, tall grass, woodpiles, or other combustibles ' +
      'within 30 ft of the structure.',
  },
];

export function mitigationIconById(id?: string): MitigationIconDef | undefined {
  return id ? MITIGATION_ICONS.find((icon) => icon.id === id) : undefined;
}
