# Step 3.10 — Assets & Evidence Audit (pre-merge)

**Status: audit complete. 0 production file assets on the branch; the 97 Step
3.9 report/evidence files are committed (`5a606d3`); the Step 3.8 / 3.8.1
evidence is already tracked. Nothing was deleted, moved or modified. The Step
3.10 integration follows this audit as a fast-forward merge into `main` — see
§9.**

| Item | Value |
|---|---|
| Branch | `feat/first-section-remaining-polish` @ `ad835f620cbbd2e6bda649135b472d5c6cc7c383` |
| Merge base | `origin/main` @ `b9e045731245fc006c52dab732e2d347d839d93e` |
| Branch delta | 93 tracked files changed vs `origin/main` (+14 821 / −110 lines), plus 97 Step 3.9 files |
| Working tree | Clean except the 97 staged additions; no modified or deleted tracked files |
| Date | 2026-11-23 (Europe/Minsk) |

## 1. Method

Read-only inventory unless stated otherwise:

```bash
git diff --name-status origin/main...HEAD        # branch delta
git status --porcelain --untracked-files=all     # untracked (Step 3.9)
git status --porcelain --ignored=matching        # ignored artifacts
git check-ignore -v <path>                       # why a path is excluded
git ls-files -z | xargs -0 stat                  # sizes / heavy files
git grep -l "/Users/"                            # local-path hygiene
```

Classification used: **production** (the game/build needs it), **evidence**
(browser/documentation proof), **tooling** (DEV-only helper), **local artifact**
(regenerable, correctly ignored).

The engine is procedural: `src/` is **122 TypeScript files + 1 CSS**, there is
no `public/` or `assets/` directory, Vite defines no `publicDir`, and no source
file references an image/audio/model file. The only "asset" in the shipped
shell is the favicon, embedded as an inline `data:image/svg+xml` URI in
`index.html`. **There are therefore no production binary assets to track.**

## 2. Summary

| Measure | Value |
|---|---|
| Production file assets (textures/sprites/audio/fonts/models) | **0** |
| Branch tracked additions | 10.49 MB (evidence 10.37 MB + docs/tests/src 0.11 MB) |
| Step 3.9 staged additions | **97 files, 15.79 MB** (81 JPEG + 1 MP4 + 4 JSON + 4 TXT + 6 MD/MJS) |
| Tracked evidence in the repo (pre-existing) | 751 files, 363.7 MB |
| Tracked videos (pre-existing) | 13 files, 0.98–29.6 MB each |
| Ignored local data (not in Git) | `captures/` 504 MB, `ref/` 412 MB, `.npm-cache/` 2.9 GB, `node_modules/` 292 MB, `.omni-workstation/` 51 MB, `dist/` 14 MB, release zip 4.4 MB |
| Case collisions | 0 across 1 178 working files |
| Broken relative links in merge-relevant docs | 0 of 92 |

## 3. Inventory and classification

### 3.1 Merge-critical: Step 3.9 (staged)

| Файл / set | Category | Size | Tracked | Decision |
|---|---|---:|---|---|
| `docs/FIRST_SECTION_UX_ACCEPTANCE_REPORT.md` | report (UX acceptance) | 32 KB | **staged (was untracked)** | **include** — the only Step 3.9 verdict |
| `docs/evidence/first-section/step-3.9/README.md` | evidence index | 4 KB | **staged** | **include** |
| `…/step-3.9/harness/` (README + 4 `.mjs`) | DEV evidence tooling | 0.17 MB | **staged** | **include** — reproduces the pass; DEV-only, not imported by the game |
| `…/step-3.9/session-1/` (32 JPG, report, summary, MP4) | evidence + video | 9.26 MB | **staged** | **include** — boot/Move/CP1/gap A/returning profile + the only continuous video (5.6 MB, 65.4 s) |
| `…/step-3.9/session-5/` (14 JPG, report, summary) | evidence | 1.69 MB | **staged** | **include** — pointer-lock / pause / resume (P1 evidence) |
| `…/step-3.9/session-6/` (12 JPG, report, summary) | evidence | 1.56 MB | **staged** | **include** — gap edges / look-down / CP2 |
| `…/step-3.9/session-7/` (23 JPG, report, summary) | evidence | 3.12 MB | **staged** | **include** — full route to Results |
| **Step 3.9 total** | | **15.79 MB** | **97 staged** | **include** |

Frame resolutions: 79 × 1600 × 900 screenshots + 2 × 1280 × 720 frames extracted
from the video (`toast-hide-01/02`), both documented in the Step 3.9 report.

### 3.2 Already tracked on the branch (must stay)

| Set | Category | Size | Tracked | Decision |
|---|---|---:|---|---|
| `docs/evidence/first-section/step-3.8/` (59 files) | evidence | 6.67 MB | yes (commit `057c364`) | keep / in merge |
| `docs/evidence/first-section/step-3.8-golden/` (4 files) | evidence | 2.70 MB | yes | keep / in merge |
| `docs/evidence/first-section/step-3.8.1/` (8 files) | evidence | 1.04 MB | yes (commit `ad835f6`) | keep / in merge |
| `docs/evidence/first-section/step-3.8-prologue/report.json` | evidence | 4 KB | yes | keep / in merge |
| `src/**` (122 TS + 1 CSS; new `src/ui/ToastQueue.ts`) | production code | — | yes (branch commits) | in merge |
| `tests/**` (3 new files + 7 modified) | tests | 0.03 MB new | yes | in merge |
| `tools/capture/playtest.mjs` | DEV tooling | — | yes | in merge |
| `docs/FIRST_SECTION_MANUAL_PLAYTEST.md`, `docs/FIRST_SECTION_REMAINING_POLISH_REPORT.md`, `docs/IMPLEMENTATION_STATUS.md`, `docs/reports/FIRST_GAMEPLAY_SECTION_SPEC.md` | docs | 0.36 MB | yes | in merge |
| `index.html` (inline SVG favicon only) | production shell | 8.6 KB | yes | already tracked; nothing to add |

### 3.3 Excluded local artifacts (correctly ignored)

| Path | Category | Size | Tracked | Decision |
|---|---|---:|---|---|
| `captures/` | regenerable capture output | 504 MB | ignored (`.gitignore`) | exclude |
| `ref/` | reference video / frames (not distributable) | 412 MB | ignored | exclude |
| `.npm-cache/` | tooling cache | 2.9 GB | ignored | exclude |
| `node_modules/` | dependencies | 292 MB | ignored | exclude |
| `.omni-workstation/` | image-tool scratch | 51 MB | ignored | exclude |
| `dist/` | build output | 14 MB | ignored | exclude |
| `glassline-final-build.zip` | local release bundle | 4.4 MB | ignored | exclude |
| `.DS_Store`, `docs/**/.DS_Store`, `docs/evidence/cross-browser/firefox/geckodriver.log`, `tools/capture/__pycache__/` | OS/tool artifacts | < 1 MB | ignored (`*.log`, `__pycache__/`, `.DS_Store`) | exclude |

`git check-ignore` confirms `docs/evidence/` itself is **not** ignored; only the
OS/tool artifacts inside it are.

## 4. Verification checklist (task §3)

| Check | Result | Detail |
|---|---|---|
| All required production assets tracked | **N/A — PASS** | There are none: no `public/`, no `assets/`, no file-based texture/audio/font/model, and no source reference to one (`grep` for loaders/asset extensions: 0 hits). The favicon is inline in `index.html`. |
| Paths and file-name case correct | **PASS** | 0 case collisions among 1 178 files (1 081 previously tracked + 97 newly staged). 92 relative links in the merge-relevant docs resolve exactly, including 37 links inside the Step 3.9 docs. |
| Resources available after checkout | **PASS with action** | Step 3.8 / 3.8.1 evidence is in Git. Step 3.9 was **absent** from the index (all 97 links would break on a fresh clone); now staged (§5). |
| No accidentally missed files | **PASS** | Step 3.8.1 = 8/8 files; Step 3.9 = 96 files + report; 0 zero-byte files; no stray temp/probe files in `step-3.9/`. |
| No unneeded heavy binaries | **PASS** | Largest new file is the 5.6 MB playthrough video — the only continuous recording of the pass and smaller than the 10–30 MB videos already tracked. Nothing else in the delta exceeds 0.3 MB. Cumulative evidence weight is flagged in §7. |
| Evidence Step 3.8.1 and 3.9 not lost | **PASS with action** | 3.8.1 is committed in `ad835f6`. 3.9 existed only on disk; it is now staged and would otherwise have been lost by the merge. |
| Ignored files are the right ones | **PASS** | Only caches, build output, reference data, the local zip and OS logs are ignored. No evidence or source file is ignored. |

## 5. Inclusion for the merge

Production assets to include: **none** (nothing exists to add).

Evidence to include (staged, no content changed):

```bash
git add docs/FIRST_SECTION_UX_ACCEPTANCE_REPORT.md \
        docs/evidence/first-section/step-3.9
# staged: 97 files, 15.79 MB, 24 371 insertions
# committed: 5a606d3  docs(section): record the Step 3.9 UX acceptance evidence
```

Explicitly **not** included: `captures/`, `ref/`, `dist/`, `node_modules/`,
`.npm-cache/`, `.omni-workstation/`, `glassline-final-build.zip`, `.DS_Store`,
`geckodriver.log`, `__pycache__/`.

Nothing was deleted, moved, renamed or edited during this audit.

## 6. Evidence integrity spot checks

- Step 3.9 report links: 37 relative links, all resolving to files that are now
  staged.
- Step 3.8.1: README references `55`, `56`–`59`, `61`; all six JPEGs and
  `report.json` are tracked.
- Step 3.8: 58 JPEGs + `report.json`, all tracked; no zero-byte or missing
  frame in the directory.
- Step 3.9: all four `session-*-report.json` parse as valid JSON; 22 toast
  segments, 0 overlaps, 0 console/page errors (already reported in Step 3.9).
- Golden runs: `step-3.7-golden` and `step-3.8-golden` keep only a documented
  subset of frames (1 / 2 of 12), so their `report.json` lists frames that are
  intentionally not committed. Pre-existing and documented in the Step 3.8
  report; not a loss introduced here.

## 7. Observations and residual risks

1. **Cumulative evidence weight.** The repository already tracks 363.7 MB of
   evidence; this merge adds 15.79 MB (≈ 380 MB total). There is no Git LFS and
   no `.gitattributes`. Not a merge blocker, but worth a separate capacity
   decision (LFS or pruning old rounds) after the merge — do not delete existing
   evidence without approval.
2. **Local absolute paths.** Three staged run reports
   (`session-1/5/6-report.json`) contain `/Users/igorhodorchenko/...` inside the
   stack traces of failed exploratory phases. There are 0 secrets. The pattern
   already existed in 12 files tracked before this staging (including `step-3.4`, `step-3.7-golden`,
   `step-3.8-golden` reports), so it is not introduced by this merge; sanitize
   only if the repository is to be published.
3. **Naming style.** Step 3.9 uses uppercase scenario prefixes (`A-01`, `S5-E-03`)
   while older evidence uses numeric prefixes. Names are exact-case consistent,
   collision-free and match all report links; no change is proposed.
4. **Two of the 81 frames are 1280 × 720 video extracts** (the toast-hide pair),
   not 1600 × 900 screenshots; this is documented in the report and README.
5. **Step 3.9 harness scripts** are DEV evidence tooling placed under
   `docs/evidence/…/harness/`, not under `tools/capture/`. Moving them would be
   a change; the audit keeps them where the report references them.

## 8. Audit conclusion

- **Production:** complete; no missing or untracked production resources.
- **Evidence:** Step 3.8 and 3.8.1 are in Git; Step 3.9 was the only gap and is
  now staged (97 files, 15.79 MB).
- **Hygiene:** no case/path issues, no broken links, no stray or zero-byte
  files, no oversized additions beyond the documented video, and all ignored
  data is regenerable or non-distributable.
- **Ready for the merge commit** from the assets/evidence standpoint.

## 9. Integration status

- **Commit:** `5a606d3` `docs(section): record the Step 3.9 UX acceptance
  evidence` — 97 files, 24 371 insertions. This audit is committed separately,
  after it.
- **Merge:** the feature branch is fast-forwarded into `main` as the Step 3.10
  integration; `main` was at `origin/main` (`b9e0457`) before the merge, so the
  merge is a fast-forward with no merge-commit conflict surface.
- **Push:** not performed in this step; both `main` and the feature branch stay
  local until an explicit push.
- The original Step 3.10 task was not available in this session, so the merge was
  executed from the direct instruction in the conversation. Any remaining
  Step 3.10 gates (if the original task defines more) are still open.
- No file was deleted, moved or modified; the resource changes are exactly the
  two documentation commits and the merge.
