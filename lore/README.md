# Lore

A working draft of the world of The Last Sanctuary. It exists so that story text, character writing and art can all pull in the same direction, and so that a writing tool (or a person) can be handed this folder and asked for more.

## How sure each statement is

Every section is marked with one of three labels.

| Label | Meaning |
|---|---|
| **Fixed** | Comes from the design specification or from a rule the game already enforces. Changing it means changing the game. |
| **Proposed** | Written here to fill a gap. Sensible, consistent with the fixed parts, and free to change. |
| **Open** | A question nobody has answered yet. Collected in `04_open_questions.md`. |

## Files

| File | Contents |
|---|---|
| `01_world.md` | The catastrophe, the sanctuary, the goddess, the seal, the labyrinth, monsters |
| `02_people.md` | The player's role, the goddess, residents, the four callings, the 24 champions |
| `03_pale_galleries.md` | The first stratum: its floors, creatures, the Warden, the Colossus, what is found there |
| `04_open_questions.md` | What has been decided, what the decisions raised, and what is still open |
| `06_strata_outline.md` | A proposed shape for the whole labyrinth: five wings, their curators and media |
| `07_the_longer_road.md` | A proposed quest line that follows the first champion's steps down |

## Where the words in the game live

| What | File |
|---|---|
| Sakuya's and Iwanaga's words at turning points | `content/stories.json` |
| Each champion's epithet, trait and background | `config/balance.json`, `roster.champions` |
| What masters of strata say in a fight | `config/balance.json`, `dungeon.enemies.<id>.speech` |
| Prologue, first-defense hints, game over | `src/app/PrologueScreen.tsx`, `src/app/BattleScreen.tsx`, `src/app/App.tsx` |

The first three can be edited as text without touching code. Keep the ids.
| `05_glossary.md` | Terms as the game uses them, with the in-world word for each |

## For anyone writing more

**Tone.** Quiet, mournful, resolved. The horror is stillness, not violence. People are kind to each other because there are so few left. No gore; no cruelty for its own sake; no jokes that puncture the mood, though dry humour between tired people is welcome.

**Voice.** Plain, concrete sentences. Name the thing in the room. Avoid prophecy-speak and invented words where an ordinary one will do.

**Hard limits.** Everyone affected is an adult woman. Solidification is never desirable, never a resource, never deserved: it is loss. A statue is a person, and is never damaged or destroyed. Nothing here copies the names, places or characters of any existing work.

**What is most needed next**, in order:

1. Decisions on the open questions in `04_open_questions.md`, especially the longer road and the second medium.
2. A voice sample for each champion, and a line from each when another is brought home as a statue.
3. Sakuya's words for the five first summons, and for a lost champion carried home to the Still Grove.
4. What the Keeper says, and what Iwanaga says when the sanctuary falls.
5. The Gilded Exchange in more detail.

When you write, keep the labels: mark new material **Proposed**, and move a question out of `04_open_questions.md` only when it has been decided.
