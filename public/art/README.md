# Pictures the game shows

Finished, web-ready pictures go here. What to make, at what size and under what name, is in `graphics/` at the top of the repository: start with `graphics/AGENT_GUIDE.md`.

```
public/art/
  characters/<id>/<stage>.webp   normal, early, mid, late, statue, permanent
  monsters/<id>.webp
  people/<id>.webp
  places/...
  icons/<id>.webp
```

`.png` is accepted in place of `.webp`. Nothing else belongs here. Sizes in the list are targets: a larger picture of the right shape is scaled down when the game is built, and the original here is left as it is.

There is no list to edit. When the game is built, it scans this folder and shows whatever it finds: a character's pictures appear once she has at least `normal` and `statue`.

To check what is delivered and whether it follows the rules:

```bash
npm run art:check
```
