// Mitigation icon catalog for the map's quick-place palette. The icon set is
// the original BFMA Unity app's NAPSG-style map symbology — the PNGs in
// public/icons/mitigation/ are copied from bfma_gold
// Assets/Art/2D/MitigationIcons/_Round/, and the labels match the Unity map
// scene's icon list. Guidance wording follows the composite inspection
// guidelines (features/assessment/content/guidelines/composite.ts). Lives in
// shared/ because both the map and the AR view render annotations with these
// ids.

export type MitigationIconCategory =
  | 'debris'
  | 'vegetation'
  | 'structure'
  | 'access'
  | 'hazards'
  | 'zones';

export const MITIGATION_ICON_CATEGORIES: Record<MitigationIconCategory, string> = {
  debris: 'Debris',
  vegetation: 'Vegetation & fuels',
  structure: 'Structure & hardening',
  access: 'Access & water supply',
  hazards: 'Responder hazards',
  zones: 'Home ignition zones',
};

export interface MitigationIconDef {
  id: string;
  label: string;
  category: MitigationIconCategory;
  /** One-line summary — palette tooltip and marker detail card. */
  description: string;
  /** When to place this icon — shown in the palette help panel and README. */
  guidance: string;
}

/** The icon's artwork (id-named PNG under public/icons/mitigation/). */
export function mitigationIconUrl(id: string): string {
  return `/icons/mitigation/${id}.png`;
}

export const MITIGATION_ICONS: MitigationIconDef[] = [
  // ── Debris ────────────────────────────────────────────────────────────────
  {
    id: 'debris',
    label: 'Debris',
    category: 'debris',
    description: 'General combustible debris accumulation',
    guidance:
      'Place at combustible debris accumulations that no more specific icon covers.',
  },
  {
    id: 'foundation',
    label: 'Debris — foundation/deck',
    category: 'debris',
    description: 'Combustible debris against the foundation or deck',
    guidance:
      'Place where leaf litter, mulch, firewood, or stored items sit against the ' +
      'foundation, exterior walls, or deck. The 0–5 ft ember-resistant zone should ' +
      'be bare soil or noncombustible hardscape.',
  },
  {
    id: 'roof',
    label: 'Debris — roof/gutter',
    category: 'debris',
    description: 'Debris on the roof or in gutters',
    guidance:
      'Place where leaves, needles, or branches have collected on the roof, in ' +
      'gutters, or in roof valleys — wind-blown embers ignite this debris first.',
  },
  // ── Vegetation & fuels ────────────────────────────────────────────────────
  {
    id: 'ladder-trim',
    label: 'Fire ladder — trim',
    category: 'vegetation',
    description: 'Low tree limbs forming a fire ladder',
    guidance:
      'Place at trees whose lower limbs should be removed (limb up 6–10 ft) so ' +
      'ground fire cannot climb into the crown.',
  },
  {
    id: 'ladder-veg',
    label: 'Fire ladder — vegetation',
    category: 'vegetation',
    description: 'Understory vegetation forming a fire ladder',
    guidance:
      'Place at shrubs or small trees growing beneath a larger tree canopy. This ' +
      'understory carries ground fire up into the crowns and should be removed or ' +
      'thinned.',
  },
  {
    id: 'overhang',
    label: 'Vegetation overhang',
    category: 'vegetation',
    description: 'Branches overhanging the roof or structure',
    guidance:
      'Place where tree branches overhang the roofline, deck, or chimney. Trim to ' +
      'keep roughly 10 ft of clearance between branches and the structure.',
  },
  {
    id: 'underhang',
    label: 'Vegetation underhang',
    category: 'vegetation',
    description: 'Vegetation beneath eaves or overhangs',
    guidance:
      'Place where vegetation grows under eaves, overhangs, or against sheltered ' +
      'walls — pockets where embers collect.',
  },
  {
    id: 'vegetation-spacing',
    label: 'Vegetation spacing',
    category: 'vegetation',
    description: 'Plants or canopies spaced too closely',
    guidance:
      'Place in Zone 1 (5–30 ft) where shrubs or tree canopies are too close ' +
      'together — keep ~10 ft between canopies, more on slopes.',
  },
  {
    id: 'fuel-packet',
    label: 'Fuel packet',
    category: 'vegetation',
    description: 'Dense, connected pocket of fuels',
    guidance:
      'Place at a dense, continuous pocket of fuels (brush, slash, stacked ' +
      'materials) that can carry fire toward the structure.',
  },
  {
    id: 'proximity-fuel-source',
    label: 'Proximity to fuel source',
    category: 'vegetation',
    description: 'Structure close to a major fuel source',
    guidance:
      'Place where the structure sits close to a significant fuel source — a ' +
      'woodpile, brush field, or dense adjacent vegetation.',
  },
  {
    id: 'bedding-materials',
    label: 'Bedding materials',
    category: 'vegetation',
    description: 'Combustible mulch or bedding near the structure',
    guidance:
      'Place at planting beds with bark, wood-chip, or rubber mulch near the ' +
      'structure — replace with gravel or other noncombustible groundcover in the ' +
      '0–5 ft zone.',
  },
  // ── Structure & hardening ─────────────────────────────────────────────────
  {
    id: 'structure',
    label: 'Structure',
    category: 'structure',
    description: 'The primary structure being assessed',
    guidance: 'Place on the primary structure the assessment is anchored to.',
  },
  {
    id: 'secondary-structure',
    label: 'Secondary structure',
    category: 'structure',
    description: 'Outbuilding within the home ignition zone',
    guidance:
      'Place on sheds, garages, or other outbuildings within the HIZ — each needs ' +
      'its own clearance and can carry fire to the main structure.',
  },
  {
    id: 'structure-repair',
    label: 'Structural repairs needed',
    category: 'structure',
    description: 'Damage leaving ember entry points',
    guidance:
      'Place where damaged roofing, siding, soffits, or trim leave gaps embers ' +
      'can enter.',
  },
  {
    id: 'roofing-material',
    label: 'Roofing material',
    category: 'structure',
    description: 'Combustible roofing material',
    guidance:
      'Place where the roof covering is combustible (e.g. wood shake) — Class A ' +
      'roofing is the single biggest structure-hardening upgrade.',
  },
  {
    id: 'siding-material',
    label: 'Siding material(s)',
    category: 'structure',
    description: 'Combustible siding',
    guidance:
      'Place where combustible siding is exposed, especially near grade where ' +
      'flames or embers can contact it.',
  },
  {
    id: 'vents-screens',
    label: 'Vents/Screens',
    category: 'structure',
    description: 'Unscreened or damaged vents',
    guidance:
      'Place at attic, crawlspace, or dryer vents without intact 1/8-inch metal ' +
      'mesh — a primary ember entry path into the structure.',
  },
  {
    id: 'attached-fencing',
    label: 'Attached fencing',
    category: 'structure',
    description: 'Combustible fence attached to the structure',
    guidance:
      'Place where a wooden fence meets the house — it acts as a fuse. Replace the ' +
      'final 5 ft with a noncombustible section or gate.',
  },
  {
    id: 'deck-storage-under',
    label: 'Deck — storage under',
    category: 'structure',
    description: 'Combustibles stored under a deck',
    guidance:
      'Place where items are stored under a deck or porch. Attached decks count as ' +
      'part of the structure and need a clear 0–5 ft noncombustible zone.',
  },
  {
    id: 'deck-vegetation-under',
    label: 'Deck — vegetation under',
    category: 'structure',
    description: 'Vegetation growing under a deck',
    guidance:
      'Place where vegetation grows beneath a deck or porch — remove it; embers ' +
      'collect in these sheltered pockets.',
  },
  {
    id: 'solar-electrical',
    label: 'Solar/electrical risk',
    category: 'structure',
    description: 'Solar or electrical equipment concern',
    guidance:
      'Place at solar arrays, batteries, or electrical equipment responders should ' +
      'know about for shutoff or ignition risk.',
  },
  // ── Access & water supply ─────────────────────────────────────────────────
  {
    id: 'parcel-access',
    label: 'Parcel access risk',
    category: 'access',
    description: 'Difficult apparatus access to the parcel',
    guidance:
      'Place where overall access to the parcel is difficult for fire apparatus — ' +
      'gates, grade, surface, or clearance issues.',
  },
  {
    id: 'road-width',
    label: 'Road width',
    category: 'access',
    description: 'Road too narrow for apparatus',
    guidance:
      'Place where the access road is too narrow for fire apparatus and ' +
      'simultaneous evacuation traffic.',
  },
  {
    id: 'driveway',
    label: 'Driveway length/width',
    category: 'access',
    description: 'Driveway limits apparatus access',
    guidance:
      'Place where a long, narrow, or overgrown driveway limits engine access — ' +
      'note vertical clearance and turnouts.',
  },
  {
    id: 'adequate-turnaround',
    label: 'Adequate turnaround',
    category: 'access',
    description: 'Usable apparatus turnaround',
    guidance:
      'Place at a usable turnaround so responders know where apparatus can turn ' +
      'around on the parcel.',
  },
  {
    id: 'inadequate-turnaround',
    label: 'Inadequate turnaround',
    category: 'access',
    description: 'No usable apparatus turnaround',
    guidance:
      'Place where apparatus cannot turn around — a dead-end approach that forces ' +
      'backing out.',
  },
  {
    id: 'distance-hydrant',
    label: 'Distance to hydrant',
    category: 'access',
    description: 'Nearest hydrant or water supply',
    guidance:
      'Place at the nearest hydrant or drafting source to record water-supply ' +
      'distance from the structure.',
  },
  {
    id: 'poor-escape',
    label: 'Poor escape risk',
    category: 'access',
    description: 'Limited evacuation egress',
    guidance:
      'Place where evacuation egress is limited — a single way out, or routes ' +
      'through heavy fuels.',
  },
  // ── Responder hazards ─────────────────────────────────────────────────────
  {
    id: 'hazmat',
    label: 'Hazmat risk',
    category: 'hazards',
    description: 'Hazardous materials on site',
    guidance:
      'Place where hazardous materials are stored — fuels, chemicals, ' +
      'pesticides — that responders should know about.',
  },
  {
    id: 'propane-gas',
    label: 'Propane/gas risk',
    category: 'hazards',
    description: 'Propane tank or gas service',
    guidance:
      'Place at propane tanks or gas service points. Keep 10 ft around tanks ' +
      'clear of vegetation and combustibles.',
  },
  {
    id: 'overhead-power',
    label: 'Overhead power risk',
    category: 'hazards',
    description: 'Overhead power lines',
    guidance:
      'Place where overhead power lines cross access routes or hang near ' +
      'vegetation.',
  },
  {
    id: 'pets',
    label: 'Pets risk',
    category: 'hazards',
    description: 'Animals on site',
    guidance:
      'Place where pets or livestock are kept, so responders and evacuation ' +
      'planning account for them.',
  },
  // ── Home ignition zones ───────────────────────────────────────────────────
  {
    id: 'hiz',
    label: 'HIZ 0–5 ft',
    category: 'zones',
    description: 'Other hazard in the 0–5 ft ember-resistant zone',
    guidance:
      'Place for any Zone 0 hazard not covered by another icon — combustible ' +
      'mulch, plants against walls, or items stored near vents.',
  },
  {
    id: 'hiz-30',
    label: 'HIZ 5–30 ft',
    category: 'zones',
    description: 'Other hazard in the 5–30 ft intermediate zone',
    guidance:
      'Place for any Zone 1 hazard not covered by another icon — unspaced ' +
      'vegetation, tall grass, woodpiles, or other combustibles within 30 ft.',
  },
  {
    id: 'hiz-100',
    label: 'HIZ 30–100 ft',
    category: 'zones',
    description: 'Hazard in the 30–100 ft extended zone',
    guidance:
      'Place for Zone 2 hazards — heavy fuel accumulations, dense stands, or ' +
      'slash within 30–100 ft of the structure.',
  },
];

export function mitigationIconById(id?: string): MitigationIconDef | undefined {
  return id ? MITIGATION_ICONS.find((icon) => icon.id === id) : undefined;
}
