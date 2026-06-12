# Annotation guidance — wildfire hazard instance segmentation

Draw a tight polygon around each instance of these classes. One polygon per
distinct object/area. The "Suggested classes" hint per image is a weak label
(what the image was collected for) — still scan the whole scene and label any
other hazard classes you see.

0. **dry-dead-vegetation** — Brown/cured grasses, dead shrubs, dried-out plants. Mask the vegetation mass, not bare soil.
1. **ground-fuels** — Leaf litter, pine needles, bark, slash/brush piles on the ground. Outline accumulations.
2. **overhanging-vegetation** — Tree limbs/branches above or touching a roof, eave, or chimney. Mask the overhanging foliage.
3. **vegetation-near-structure** — Shrubs/plants directly against or within a few feet of a wall. Mask the plant, note proximity.
4. **woodpile-lumber** — Stacked firewood, cut logs, stored lumber/timber. Mask the pile.
5. **propane-tank** — Cylindrical LPG/propane tanks or bottles, residential. Mask the tank.
6. **wood-shake-roof** — Wood shake / cedar shingle roofing (not asphalt/tile/metal). Mask the roof plane.
7. **roof-debris** — Leaves, needles, branches accumulated on a roof surface. Outline the debris.
8. **gutter-debris** — Leaves/needles/moss filling a rain gutter. Outline the debris in the channel.
9. **combustible-fence** — Wood or vinyl fencing, especially where it meets/attaches to the house. Mask the fence run nearest the structure.
10. **combustible-mulch** — Bark/wood-chip/rubber mulch beds, especially within ~5 ft of a wall. Outline the mulch bed.
