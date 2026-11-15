# Places

## Labyrinth textures

The first-person view builds its corridors from three repeating textures per stratum: wall, floor, ceiling. They must tile without visible seams and have flat, even lighting, because the game lights them itself with the party's lantern and fog.

- Stratum 1, the Pale Galleries: old dressed stone, pale and dry, with chalky mineral growth creeping over it. It should feel like a gallery whose pictures have all turned to blank stone.
- 512 × 512 px each, no perspective, no baked shadows.

## Battle map pieces

Defense battles are drawn from above. The game lays out lanes and building sites itself, so it needs pieces, not finished maps:

- A tileable ground texture for each map (frontier outpost, sanctuary approach).
- One piece per structure type, intact and ruined: watchtower, bunker, support station.
- The gate, and the sanctuary's automated weapon.

Pieces are seen from above at a three-quarter angle, on a transparent background, and must read at 64 px. The three structure types must be tellable apart by silhouette alone: tall and thin, low and square, small and roofed.

## Screen backgrounds

- **Title** (1920 × 1080): the sanctuary alone in a field of stone figures, at dusk. Leave calm empty sky on the left third for the title text.
- **Guild hall** (1920 × 1080): backdrop for the guild view. It sits behind interface panels, so keep it dark and low in contrast.
- **Prologue** (1600 × 900): the silent city. One picture is enough for now.

## Must be true

- No people in any of these. Stone figures in the title and prologue pictures are scenery: distant, small, never the subject, never in distress.
- No text.
- The sanctuary is the only place with living colour.

## Later, not now

Textures for deeper strata, a painted sanctuary battle map, weather and time-of-day variants.
