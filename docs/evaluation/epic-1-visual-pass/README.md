# EPIC 1 · visual pass — Proof-required evidence

Eight screens at 390 × 844, 2× scale, captured from the real production build
(`01-home`) and the e2e harness (the rest), on the branch that introduced the
pass. Nothing here is a mock-up: each is the app as it ships.

| File | Screen | What it evidences |
| --- | --- | --- |
| `01-home.png` | Home | Eyebrow, absence card in the one neutral treatment, bottom-anchored primary. |
| `02-search.png` | Search | Eyebrow, short heading, the status region as a bordered card. |
| `03-candidates.png` | Candidates | Identical markup and weight on every row; the unresolved-address card is the same card as every other; no ranking, no emphasis on the first entry. |
| `04-confirm.png` | Confirm | Returned address in a bordered card, primary with the secondary ghosted beneath it. |
| `05-area-check.png` | AreaCheck | A standing designation rendered with no alert colour and no warning icon. |
| `06-conflict.png` | Conflict | Two equal ghosted choices, neither selected and neither presented as the expected one. |
| `07-size.png` | Size | The size stated before any write; exactly one action. |
| `08-pack-detail.png` | PackDetail | Publisher and saved date on every item; one card treatment throughout. |

Colours in all eight come from `src/ui/theme.css` tokens via `data-mode="prepare"`.
No component carries a literal colour.
