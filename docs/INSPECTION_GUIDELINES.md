# Inspection Guidelines by State

The assessment wizard localizes its inspection checklist to the property's US
state. This document records, for **every state**, which guidelines were used
to determine the inspection parameters (checklist items, distances, and
recommendation rules), their legal standing, and the official sources they
were drawn from.

All classifications reflect a 50-state survey completed **August 2026**.
State wildfire policy is moving quickly — the [Volatility](#volatility--items-to-re-verify)
section lists what to re-verify.

## How a state's guidelines are selected

1. The property's state is resolved **offline**: GPS coordinates are matched
   against bundled US state boundaries (`src/shared/utils/usState.ts`), with
   the typed address as fallback.
2. `resolveGuidelineProfile(stateCode)` returns that state's profile from
   `src/features/assessment/content/guidelines/`, or the **national
   composite** when the state has none.
3. The profile drives the checklist, scoring, and recommendations. The UI
   shows the guideline set in use, its legal standing, and links to the
   official sources ("About these guidelines" on the checklist; provenance
   lines on results and saved reports). The profile id is persisted on the
   assessment (`guidelineProfileId`).

Legal-standing categories used below:

| Basis | Meaning |
| --- | --- |
| **State law** | A statute/regulation homeowners or builders must follow |
| **Partly state law** | Binding only in part (a sub-region, hardening-only, or rules still in rulemaking) |
| **State guidance** | The state's own published guidance — voluntary |
| **National baseline** | No state-specific guidance exists; the composite is used |

---

## National composite (fallback)

**Basis:** National baseline · **Profile:** `composite`

Used for every state without its own section-listed profile. Compiled from
**NFPA Firewise USA** home-ignition-zone guidance (0–5 / 5–30 / 30–100 ft
zones, crown-spacing and limbing rules, 1/8-inch vent mesh) and **IBHS
Wildfire Prepared Home** research (Zone 0 hardscaping, fence-attachment and
deck rules, ember-resistant vents per ASTM E2886), with California standards
cited where they generalize (they are the most developed body of WUI
regulation).

Sources: [NFPA Firewise USA](https://www.nfpa.org/education-and-research/wildfire/firewise-usa) ·
[IBHS Wildfire Prepared Home](https://wildfireprepared.org/)

---

## Alabama

**Basis:** National baseline (Firewise-only state)

The Alabama Forestry Commission promotes generic Firewise USA practices
("Firewise Homeowners Guide", 30-ft defensible space) with no distinct state
numbers and no mandate. The national composite applies.

## Alaska

**Basis:** State guidance · **Profile:** `us-ak` · **Authority:** Alaska DNR Division of Forestry — Firewise Alaska

Boreal-specific parameters: **no conifers within 30 ft** of buildings
(100 ft downhill on steep slopes), plants under 18 in near the home,
deciduous edge trees at 20-ft trunk / 10-ft crown spacing, 8-ft limbing,
**black-spruce removal within 100 ft** (state grants up to $2,500), no wooden
walkways to the house, and unusually concrete access numbers (18-ft
all-weather driveway, 15-ft overhead clearance, 60-ft turnaround radius).

Sources: [Firewise Alaska](https://forestry.alaska.gov/fire/firewise)

## Arizona

**Basis:** State guidance · **Profile:** `us-az` · **Authority:** AZ DFFM · UA Extension az1290

Parameters: nothing combustible within 3–5 ft; 30-ft Zone 1 with grass at
6–8 in max; slope-adjusted fuel reduction to **75–125 ft**; 10-ft crown
spacing and 10-ft pruning; firewood/propane 30 ft out; "trunk diameter +
7 ft" stem spacing when thinning. WUI codes are local-option (Flagstaff,
Prescott).

Sources: [DFFM Firewise](https://dffm.az.gov/fire/prevention/firewise) ·
[az1290](https://extension.arizona.edu/sites/extension.arizona.edu/files/pubs/az1290.pdf)

## Arkansas

**Basis:** National baseline (Firewise-only state)

The Arkansas Department of Agriculture Forestry Division runs an active
Firewise USA chapter but channels generic NFPA content. The national
composite applies.

## California

**Basis:** State law · **Profile:** `us-ca` · **Authority:** CAL FIRE PRC 4291 · CWUIC · 14 CCR 1270

The only state with a long-standing homeowner defensible-space **statute**:
PRC 4291 requires **100 ft** of defensible space (Zone 1 "lean, clean and
green" 5–30 ft; Zone 2 fuel reduction 30–100 ft with 4-in grass and
slope-scaled canopy spacing), 10-ft chimney clearance, spark arresters, and
roof/gutter litter removal — enforced by CAL FIRE inspections (form LE-100A).
**Zone 0** (0–5 ft ember-resistant zone; AB 3074/SB 504) is phasing in via
Board of Forestry regulation (new construction first; multi-year window for
existing homes). Structure hardening cites the **California
Wildland-Urban-Interface Code** (CWUIC — absorbed CBC Chapter 7A on
Jan 1, 2026): Class A roof, SFM-listed/ASTM E2886 vents, tempered dual-pane
glazing, ignition-resistant decking. Access/water use the Fire Safe
Regulations (14 CCR 1273.01: 10-ft driveway lane, 14-ft horizontal / 13'6"
vertical clearance; 14 CCR 1274 addressing; 14 CCR 1275 water).

Sources: [CAL FIRE Defensible Space](https://www.fire.ca.gov/dspace) ·
[Ready for Wildfire — Hardening](https://www.readyforwildfire.org/prepare-for-wildfire/hardening-your-home/) ·
[Board of Forestry Zone 0](https://bof.fire.ca.gov/projects-and-programs/defensible-space-zones-0-1-2/)

## Colorado

**Basis:** State law · **Profile:** `us-co` · **Authority:** Colorado Wildfire Resiliency Code (8 CCR 1507-39) · CSFS

The **Colorado Wildfire Resiliency Code** (from SB23-166) is enforced by
local building authorities from **July 1, 2026** in mapped WUI areas (new
construction, large additions, ≥25% reroofs; ongoing owner maintenance duty).
Parameters: noncombustible **0–5 ft Zone 1** (no plantings/mulch/new trees);
noncombustible fences/retaining walls within 8 ft; Zone 2 (5–30 ft) dead
material removal with 10-ft crown clearance; Zone 3 (30–100 ft) 6–10 ft
crown spacing; Class A roof with roof-edge ember protection and
noncombustible gutters (Class 1); ≤1/8-in ember-resistant vent screening;
20-minute glazing/doors and garage-door ember seals (Class 2). Grass ≤4 in
per CSFS guidance. *(Section-level numbers cross-checked against an official
fire-district overview — re-verify against the adopted rule text.)*

Sources: [Wildfire Resiliency Code Board](https://dfpc.colorado.gov/WRCB) ·
[CSFS Home Ignition Zone Guide](https://csfs.colostate.edu/wp-content/uploads/2021/04/2021_CSFS_HIZGuide_Web.pdf)

## Connecticut

**Basis:** National baseline (no state guidance)

CT DEEP's forest-fire program covers suppression and burn permits only; no
homeowner defensible-space guidance is published. The national composite
applies.

## Delaware

**Basis:** National baseline (no state guidance)

The Delaware Forest Service Wildland Fire Program covers crews and prescribed
burns; no homeowner program exists. The national composite applies.

## Florida

**Basis:** State guidance · **Profile:** `us-fl` · **Authority:** Florida Forest Service (FDACS) — Be Wildfire Ready

Florida publishes its own **four-zone** system: Zone 1 (0–30 ft) dead
vegetation removed everywhere including roof/gutters/under decks, 10-ft
canopy spacing, 10-ft chimney clearance; Zone 2 (30–60 ft) grass ≤4 in with
shrub/tree separation; Zone 3 (60–100 ft) spacing + clearing low vegetation
under pines; Zone 4 (100+ ft) perimeter. Home items: Class A roof, dual-pane
tempered windows with shutters/screens; access: 10-ft horizontal clearance
each side of the driveway and 13.5-ft vertical. Voluntary — F.S. ch. 590
grants prevention powers but imposes no homeowner mandate.

Sources: [FFS Prepare Your Yard](https://www.fdacs.gov/Forest-Wildfire/Wildland-Fire/Fire-Prevention/Be-Wildfire-Ready/Prepare-Your-Yard) ·
[FFS Prepare Your Home](https://www.fdacs.gov/Forest-Wildfire/Wildland-Fire/Fire-Prevention/Be-Wildfire-Ready/Prepare-Your-Home)

## Georgia

**Basis:** State guidance · **Profile:** `us-ga` · **Authority:** Georgia Forestry Commission · Firewise USA

No defensible-space statute; the GFC promotes Firewise home-ignition-zone
practices with Southeast emphases encoded in the profile: **pine straw**
kept out of the 0–5 ft zone (weighted heavily; backed by USDA Forest Service
mulch-flammability research — pine straw has the fastest flame spread of
tested mulches), pine ladder fuels (6–10 ft limbing, no shrubs under
canopies), and **legal debris burning** (escaped yard-debris burns are
Georgia's top wildfire cause; GFC burn rules — 25 ft from woodlands, 50 ft
from structures, attended).

Sources: [GFC Firewise USA](https://gatrees.org/fire-prevention-suppression/firewise-usa-program/) ·
[GFC Outdoor Burning Laws](https://gatrees.org/understanding-georgias-outdoor-burning-laws/) ·
[GEMA Wildfires](https://gema.georgia.gov/wildfires)

## Hawaii

**Basis:** Partly state law (rules pending) · **Profile:** `us-hi` · **Authority:** HI State Fire Marshal (HRS §132-O) · HWMO

Post-Lahaina, **Act 302 (SLH 2025)** created HRS §132-O directing the State
Fire Marshal to set minimum defensible-space requirements with civil fines —
but rulemaking was incomplete as of August 2026, so the profile uses national
baseline numbers plus a Hawaii-specific item on non-native grass fuels
(guinea/buffel/fountain grass — the fuels that drove the 2023 Maui fires).
Update this profile when the Fire Marshal's numbers are adopted.

Sources: [Hawaii Wildfire Management Organization](https://www.hawaiiwildfire.org/) ·
[Act 302 (SLH 2025)](https://data.capitol.hawaii.gov/sessions/sessionlaws/Years/SLH2025/SLH2025_Act302.pdf)

## Idaho

**Basis:** State guidance · **Profile:** `us-id` · **Authority:** Idaho Department of Lands FMH 821

Idaho's own scored evaluation standard. Distinct parameters: **0–4 ft**
nonflammable break (4 ft, not the usual 5); within 30 ft — pruning to
**18 ft** (or 1/3 live crown), 15-ft crown spacing, shrub spacing 2.5×
height; 30–100 ft — 10-ft pruning and 10-ft crowns; 1/8-in metal mesh on
vents/eaves/deck undersides and metal window screens; driveway >12 ft with
20-ft vegetation clearance and two egress routes; **scored water sources**
(draftable pond/stream, 1,800-gal pool, 2,000-gal reservoir, 25-gpm well, or
hydrant). No statewide mandate; IWUIC is local-option (e.g. Boise).

Sources: [IDL FMH 821](https://www.idl.idaho.gov/wp-content/uploads/sites/2/2020/06/wildfire-home-protection-zone-evaluation.pdf) ·
[Idaho Firewise](https://idahofirewise.org/)

## Illinois

**Basis:** National baseline (no state guidance)

IL DNR publishes only a link directory to national resources. The national
composite applies.

## Indiana

**Basis:** National baseline (no state guidance)

IN DNR Forestry's fire program is rural fire-department support only. The
national composite applies.

## Iowa

**Basis:** State guidance · **Profile:** `us-ia` · **Authority:** Iowa DNR — Be Firewise

A small delta from the baseline, from Iowa DNR's "Be Firewise" series
(older but agency-hosted): defensible space **≥100 ft** (200+ ft on slopes);
driveway ≥12 ft wide with 14-ft overhead clearance (20 ft wide if over
150 ft or curved). Voluntary.

Sources: [Iowa DNR Fire Prevention](https://www.iowadnr.gov/programs-services/forestry-resources/fire-management-safety/fire-prevention)

## Kansas

**Basis:** National baseline (Firewise-only state)

The Kansas Forest Service channels Firewise USA. One distinct grassland rule
(fuel breaks ≥2.5× the height of adjacent grass fuels) appears only in a
staff quote, not an agency publication, and was deliberately **not** encoded.
The national composite applies.

## Kentucky

**Basis:** State guidance · **Profile:** `us-ky` · **Authority:** KY Division of Forestry — Woodland Home Wildfire Hazard Assessment

Kentucky's own scored yes/no instrument, mirrored nearly 1:1: shrubs ≥5 ft
from structures with rock instead of mulch; firewood and LP tanks **≥50 ft**
(stricter than the usual 30) with 15 ft cleared; wooden fences/trellises
10–12 ft off the home; chimney spark arrestor + cap, boxed eaves; deck
undersides latticed + 1/8-in mesh; 1/8-in attic vent mesh; defensible space
scored best at ≥100 ft; driveway 12 ft × 14.5 ft with gate rules (30 ft
back, 2 ft wider, opens inward); 4-in reflective address letters. Voluntary.

Sources: [KY Woodland Home Assessment (PDF)](https://eec.ky.gov/Natural-Resources/Forestry/Documents/Woodland%20Home%20Wildfire%20Hazard%20Assessment%20-%20(pdf%20format).pdf) ·
[Kentucky Firewise](https://eec.ky.gov/Natural-Resources/Forestry/wildland-fire-management/Pages/Kentucky-Firewise-Program.aspx)

## Louisiana

**Basis:** National baseline (Firewise-only state)

LDAF's fire pages center on burn bans and debris-burning safety; homeowner
defensible-space content is minimal and generic. The national composite
applies.

## Maine

**Basis:** State guidance · **Profile:** `us-me` · **Authority:** Maine Forest Service (DACF)

Maine-specific numbers: 30-ft green lawn; conifer thinning 30–100 ft;
branches trimmed **20 ft** from chimneys; driveway ≥12 ft wide with 14-ft
overhead clearance, gates ≥10 ft wide set back 30 ft; ≥100 ft of garden
hose; 4-in house numbers; chimney/foundation screens ≤1/2 in; 1/8-in deck
enclosure mesh; propane ≥10 ft on gravel. Voluntary.

Sources: [MFS Tips for Homeowners](https://www.maine.gov/dacf/mfs/forest_protection/firewise/homeowners.html)

## Maryland

**Basis:** National baseline (Firewise-only state)

MD DNR's "Firewise Living in Maryland" is Firewise-branded with no distinct
numbers. The national composite applies.

## Massachusetts

**Basis:** National baseline (Firewise-only state)

DCR and DFS actively promote NFPA Firewise zones (especially after the
2024–25 fire seasons) but publish no distinct state numbers. The national
composite applies.

## Michigan

**Basis:** National baseline (Firewise-only state)

Michigan's fire code explicitly deletes the WUI chapter from its adopted
code; DNR/MiReady pages defer to national Firewise. The national composite
applies.

## Minnesota

**Basis:** State guidance · **Profile:** `us-mn` · **Authority:** MN DNR — Firewise in Minnesota

Minnesota's own zone system: **Intensive Zone 30 ft** (grass 1–2 in, conifer
pruning ≥8 ft, crowns ≥10 ft, nothing planted within 3–5 ft) / **Extensive
Zone** next 70–100 ft, 200+ ft high-risk (grass ≤6–8 in, pruning to 10 ft
but ≤1/3 live crown). Distinct: firewood **≥25 ft** with 10-ft clearance;
20-ft chimney clearance; decks <5 ft off ground enclosed with 1/8-in mesh;
driveway ≥12 ft (20 ft if >150 ft) × 14-ft clearance with turnaround
geometry; non-electric pump + 100-ft hose. Voluntary.

Sources: [MN DNR Defensible Space](https://www.dnr.state.mn.us/firewise/livingwithfire/space.html) ·
[MN DNR 50 Things](https://www.dnr.state.mn.us/firewise/50things.html)

## Mississippi

**Basis:** National baseline (Firewise-only state)

The MS Forestry Commission uses standard NFPA zones and offers free home
assessments; no distinct numbers. The national composite applies.

## Missouri

**Basis:** State guidance · **Profile:** `us-mo` · **Authority:** Missouri Dept. of Conservation · MU Extension

Parameters: 30-ft mowed lawn (≤4 in) with no firewood, **hay**, or fuel
tanks in the 5–30 ft band; woodpiles **≥50 ft** (stricter than the usual
30); evergreens pruned ≥6 ft; access roads/gates **≥16 ft** wide with marked
driveway and turnaround. Voluntary.

Sources: [MDC Wildfire Prevention](https://mdc.mo.gov/your-property/fire-management/wildfire-prevention) ·
[MU Extension](https://extension.missouri.edu/news/protecting-your-home-and-buildings-from-wildfire)

## Montana

**Basis:** National baseline (Firewise-only state)

DNRC guidance is generic NFPA HIZ; the IWUIC applies only where local
jurisdictions elect to enforce it. The national composite applies.

## Nebraska

**Basis:** National baseline (Firewise-only state)

Nebraska Forest Service/Extension messaging uses the standard NFPA zones;
the older regional "Living With Fire" guides are no longer published. The
national composite applies.

## Nevada

**Basis:** State guidance · **Profile:** `us-nv` · **Authority:** Living With Fire (UNR Extension + NV Division of Forestry), SP-23-07

Nevada-tailored, ecosystem-specific parameters: Zone 0 hardscape with
**ornamental junipers removed within 30 ft**; Zone 1 vegetation islands,
10-ft branch clearance, wood mulch ≤1 in deep, cheatgrass cleared within
30 ft (sagebrush country); Zone 2 shrub separation 2× height, ~10-ft
canopies, **pinyon/juniper thinned to 1.5–2× tree height**, needle depth
<3 in, extending to 200 ft on >20% slopes; retrofit guide: Class A roof,
1/8-in vent mesh. Voluntary (NRS 472.041/472.500 allow abatement orders in
designated hazardous areas).

Sources: [LWF Defensible Space Guide SP-23-07](https://extension.unr.edu/publication.aspx?PubID=5522) ·
[Wildfire Home Retrofit Guide SP-20-11](https://extension.unr.edu/publication.aspx?PubID=3810)

## New Hampshire

**Basis:** National baseline (Firewise-only state)

The Division of Forests & Lands publishes Firewise checklists but directs
homeowners to firewise.org for specifics. The national composite applies.

## New Jersey

**Basis:** Partly state law · **Profile:** `us-nj` · **Authority:** NJ Forest Fire Service · Pinelands CMP (N.J.A.C. 7:50-6)

Statewide: voluntary NJFFS "NJ Wildfire SMART" guidance — ≥30 ft buffer
(**100 ft in the Pinelands**). Inside the ~938,000-acre **Pinelands Area**,
the Comprehensive Management Plan imposes mandatory standards on development:
fuel breaks of **30/75/100 ft** by fire-hazard class with annual understory
maintenance, **25-ft pine-to-pine spacing** in extreme hazard, fire-resistant
roofs with wood shake prohibited in high/extreme hazard, and dead-end
turnaround/dual-accessway rules. Pinelands items are phrased conditionally
("If in the Pinelands…") with Yes/N.A. answers since the app resolves
location to state level only.

Sources: [NJ Wildfire SMART](https://dep.nj.gov/parksandforests/wildfire/nj-wildfire-smart/) ·
[Pinelands CMP](https://www.nj.gov/pinelands/cmp/)

## New Mexico

**Basis:** State guidance · **Profile:** `us-nm` · **Authority:** EMNRD Forestry · Wildfire Prepared Act (SB 33, 2025)

The 2025 Wildfire Prepared Act created a voluntary, state-funded assessment/
certification program (IBHS-style, 0–5 ft noncombustible zone). EMNRD
numbers: 30-ft Zone 1 with grass 6–8 in; slope-adjusted fuel reduction to
75–125 ft; 10-ft crowns/pruning; firewood/propane ≥30 ft; roof **Class B
minimum, Class A preferred**. *(EMNRD publications conflict on Zone 1 width —
15 vs 30 ft; the profile uses the Living With Fire guide's 30 ft.)*

Sources: [EMNRD Living With Fire](https://www.emnrd.nm.gov/sfd/fire-prevention-programs/living-with-fire-guide-new-mexico/) ·
[EMNRD Defensible Zones (PDF)](https://www.emnrd.nm.gov/sfd/wp-content/uploads/sites/4/Wui_defzone.pdf)

## New York

**Basis:** State guidance · **Profile:** `us-ny` · **Authority:** NYS DEC — FIREWISE New York

DEC's own numbers (note: a 0–30 / 30–100 / 100–200 ft zoning that differs
from NFPA's): 0–30 ft "lean, clean and green"; 30–100 ft spacing (20 ft
between individual trees or 30 ft between 2–3-tree clusters; ~30 ft between
conifer crowns); pruning 6–10 ft; roof of composition shingle/metal/clay/
cement tile; **1/8-in or smaller vent screening**; double-pane or tempered
glass; propane tanks and seasonal firewood ≥30 ft. Voluntary.

Sources: [DEC FIREWISE New York](https://dec.ny.gov/nature/forests-trees/wildfires/firewise-new-york/homeowners)

## North Carolina

**Basis:** State guidance · **Profile:** `us-nc` · **Authority:** N.C. Forest Service — Resist Wildfire NC

The nation's largest WUI state publishes its own numbers: defensible space
**100 ft in all directions, up to 200 ft on slopes >20%**; a strict 0–5 ft
rule (noncombustible ground cover and ALL needles/leaves/cones removed,
including on decks and fences); combustibles (wood scraps, fuel tanks,
boats, RVs) ≥30 ft; drip lines ≥10 ft from the structure; pruning 6–10 ft
(≤1/3 tree height) with shrubs ≥10 ft below lowest branches; turf ≤4 in.
Voluntary.

Sources: [Resist Wildfire NC](https://www.ncagr.gov/divisions/nc-forest-service/resist-wildfire-north-carolina) ·
[Fire-Resistant Landscaping in NC](https://ncagr.gov/divisions/nc-forest-service/fire-resistant-landscaping-nc/download?attachment=)

## North Dakota

**Basis:** National baseline (Firewise-only state)

ND Forest Service homeowner messaging is generic and points to Firewise USA.
The national composite applies.

## Ohio

**Basis:** National baseline (Firewise-only state)

ODNR Forestry directs homeowners to Firewise.org with no distinct numbers.
The national composite applies.

## Oklahoma

**Basis:** National baseline (Firewise-only state)

Oklahoma Forestry Services' "50 Ways to Make Your Home Firewise" is the
Southern-state-foresters/NFPA template (standard Firewise numbers), with an
eastern-redcedar removal emphasis. The national composite applies.

## Oregon

**Basis:** State guidance (local adoption) · **Profile:** `us-or` · **Authority:** OSFM Model Defensible Space Code · ORSC R327

Oregon **repealed** its statewide SB 762 mandates (SB 83, July 2025); the
OSFM **Model Defensible Space Code** (finalized May 19, 2026) and the
**R327** hardening standard apply only where cities/counties adopt them
(e.g. Ashland, Grants Pass, Deschutes County). Parameters follow those
codes: 5-ft noncombustible zone (bark mulch and stored wood called out);
fuel-modification perimeter of **30/50/100 ft** by local hazard tier; 10-ft
crown separation with 6-ft limbing (>18-ft trees) or 1/3-height; R327
hardening — roof min Class B (shake prohibited), noncombustible gutters +
guards, 1/16–1/8-in vent mesh or ember-rated vents with eave/soffit vent
restrictions, tempered/20-min glazing, ASTM E2632/E2726 decking.

Sources: [OSFM Defensible Space](https://www.oregon.gov/osfm/wildfire/pages/defensiblespace.aspx) ·
[OSFM Model Code (PDF)](https://www.oregon.gov/osfm/Docs/Model%20Defensible%20Space%20Code_FINAL.pdf)

## Pennsylvania

**Basis:** National baseline (Firewise-only state)

PA DCNR defers homeowner preparation to Ready PA and Firewise links. The
national composite applies.

## Rhode Island

**Basis:** National baseline (Firewise-only state)

RI DEM promotes Firewise USA sites and fuel-reduction plans with no distinct
numbers. The national composite applies.

## South Carolina

**Basis:** National baseline (Firewise-only state)

The SC Forestry Commission runs an active WUI program and publishes a
one-page risk-reduction checklist, but it is almost entirely qualitative
(3-ft mulch rule, 100-ft vegetation note). The national composite applies.

## South Dakota

**Basis:** National baseline (Firewise-only state)

SD channels NFPA numbers via SDSU Extension and the Black Hills NF; the
state's own "Living With Fire — Black Hills" guide is a scanned PDF whose
numbers could not be extracted (worth revisiting). Free home assessments are
available from the SD Wildland Fire Division. The national composite applies.

## Tennessee

**Basis:** State guidance · **Profile:** `us-tn` · **Authority:** TN Division of Forestry — Fire Adapted Communities

Parameters: 5-ft noncombustible zone; ≥30 ft lean/clean/green with fuel
reduction to 100–200 ft; branches 10 ft from the roof and **15 ft from the
chimney**; lowest limbs ≥6 ft; firewood ≥30 ft; **1/8-in metal vent
screening and metal (not nylon) window screens**; driveway ≥12 ft × 15 ft.
Voluntary.

Sources: [TN Protect Your Home](https://www.tn.gov/tnwildlandfire/prevention/tennessee-fire-adapted-communities/protect-your-home-from-wildfire.html)

## Texas

**Basis:** National baseline (Firewise-only state)

Texas A&M Forest Service publishes extensive home-ignition-zone guidance,
but its numbers are exactly NFPA Firewise (cited to NFPA 1144). A statewide
WUI code bill (SB 1636) died in 2023; 2025 reforms imposed nothing on
homeowners. Counties >250k may adopt local fire codes (Austin adopted the
2024 IWUIC) — check local ordinances. The national composite applies.

## Utah

**Basis:** State law · **Profile:** `us-ut` · **Authority:** Utah WUI Code (IWUIC + Utah amendments) · FFSL · HB 48 (2025)

The Utah WUI Code is enforced through local adoption required by **HB 48**
(effective Jan 1, 2026); homes in the state high-risk WUI pay a
**wildfire-mitigation fee** on property taxes, reduced by completed
mitigation. Parameters: defensible space **30/50/100 ft** by hazard class
(§603) with no combustible plants or wood mulch within 5 ft and no tree
within 10 ft; §604 maintenance (10-ft crown clearance, 6-ft limbing, litter-
free roofs); §607 firewood (≥20 ft from structures, ≥15 ft from crowns,
never under decks); §605 spark arresters (≤1/2-in mesh); §504 ignition-
resistant construction (Class A roof, vents ≤144 sq in with ≤1/4-in mesh —
1/8 in common locally, tempered/20-min glazing, 1-3/4-in solid-core doors);
Ch. 4 access/water (20-ft width, 13'6" vertical, turnarounds >150 ft,
hydrants within 1,000 ft). FFSL adds 4-in grass and 12-ft/6-ft canopy
spacing bands.

Sources: [FFSL WUI Risk & HB 48](https://ffsl.utah.gov/wuirisk) ·
[Utah Wildfire Risk Map](https://wildfirerisk.utah.gov/)

## Vermont

**Basis:** National baseline (no state guidance)

FPR's wildland fire program is suppression and town fire wardens; no
homeowner numeric guidance. The national composite applies.

## Virginia

**Basis:** State guidance · **Profile:** `us-va` · **Authority:** Virginia Department of Forestry — Firewise Virginia

The richest access/water detail in the South: 30-ft green lawn cut to
**3 in** (tighter than the common 4); thinning 30–100 ft with a downhill
emphasis; branches **20 ft** from chimneys; propane ≥10 ft with a 10-ft
gravel perimeter; driveway 12 ft × 14 ft with gates ≥10 ft set back 30 ft, a
gravel turnaround, and bridges/culverts rated **10,000 lb**; 4-in house
numbers at the home **and** the driveway entrance; ≥100-ft hose; a rural
**Dry Hydrant Program** for drafting from ponds. Voluntary.

Sources: [VDOF Protect Your Property](https://dof.virginia.gov/wildland-prescribed-fire/wildfire-preparation/protect-your-property/) ·
[VDOF Take Action](https://dof.virginia.gov/wildland-prescribed-fire/wildfire-preparation/take-action-to-be-firewise/)

## Washington

**Basis:** Partly state law · **Profile:** `us-wa` · **Authority:** RCW 19.27.560 · DNR Wildfire Ready Neighbors

**RCW 19.27.560** (SB 6120, 2024) mandates hardening for building permits in
high/very-high hazard areas on the DNR statewide map — but the map finalizes
Dec 2026 with enforcement ~mid-2027, and the statute covers **structures and
access only** (defensible space is explicitly not mandated statewide; the
broader WA-WUIC was repealed in 2026). Statutory parameters: Class A roof
with firestopped roof-edge gaps; ignition-resistant/1-hr/noncombustible
walls; protected decks with wire-mesh-screened undersides; driveway triggers
(>150 ft needs a driveway, >300 ft a turnaround, >500 ft and <20 ft wide
needs turnouts). Defensible-space items follow DNR's voluntary Wildfire
Ready Neighbors (NFPA-baseline) guidance.

Sources: [RCW 19.27.560](https://app.leg.wa.gov/rcw/default.aspx?cite=19.27.560) ·
[DNR Wildfire Ready Neighbors](https://wildfireready.dnr.wa.gov/)

## West Virginia

**Basis:** National baseline (Firewise-only state)

"Firewise WV" focuses education on ten higher-risk counties; state fire law
is seasonal burn-time restrictions. The national composite applies.

## Wisconsin

**Basis:** State guidance · **Profile:** `us-wi` · **Authority:** WI DNR — Preparing Your Property (PUB FR-474)

Wisconsin's own home-ignition-zone standards: Structure Ignition Zone
**100–200 ft** (wider than NFPA's 100); no plants or wood mulch in 0–5 ft
with evergreens minimized within 30 ft; **buildings within 30 ft of each
other treated as one unit**; eaves boxed with 5/8-in plywood or better;
vent mesh ≤1/8 in (the DNR webpage says 1/4 in — the profile targets 1/8);
driveway ≥12 ft × 13.5 ft. Voluntary. A waterfront-home module (FR-419) is
WI-unique and not yet encoded.

Sources: [WI DNR Preparing Your Property](https://dnr.wisconsin.gov/topic/forestfire/preparing) ·
[WI DNR Driveway Access](https://dnr.wisconsin.gov/topic/forestfire/drivewayaccess)

## Wyoming

**Basis:** National baseline (Firewise-only state)

Wyoming has no statewide building code of any kind; the State Forestry
Division channels Firewise USA ("at least 100 feet"). Teton County has a
local IWUIC. The national composite applies.

---

## District of Columbia

No wildland-fire or Firewise program exists. The national composite applies.
(Puerto Rico is also resolvable by the app's state detection and uses the
composite.)

---

## Volatility — items to re-verify

State wildfire policy was moving quickly at the time of the survey
(August 2026). Before relying on these profiles for compliance purposes,
re-verify:

| State | What to check |
| --- | --- |
| **California** | Zone 0 final rule text and effective dates (Board of Forestry rulemaking was in its phased, education-first draft as of April 2026) |
| **Colorado** | Section-level numbers against the adopted 8 CCR 1507-39 text (profile cross-checked against an official fire-district overview) |
| **Washington** | DNR hazard map finalization (Dec 2026) and enforcement start (~June 2027) |
| **Hawaii** | State Fire Marshal defensible-space rulemaking under HRS §132-O — replace baseline numbers when adopted |
| **Oregon** | Rolling local adoptions of the OSFM model code and R327 |
| **New Jersey** | Post-2025 legislative activity on a statewide mandate |
| **Georgia** | Pine-straw guidance is sourced to USDA research + Firewise; confirm with GFC before attributing to them |
| **South Dakota** | The state's own Black Hills "Living With Fire" guide (scanned PDF) may contain SD-specific numbers |

The app is not a compliance instrument: profiles inform an advisory
inspection score, and users see each profile's legal standing and sources
in the UI.
