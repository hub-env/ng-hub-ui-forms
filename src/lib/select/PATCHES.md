# hub-select — vendored ng-select patches

This directory holds a copy of the `src/ng-select` library from
[ng-select/ng-select](https://github.com/ng-select/ng-select), taken at the version recorded in
`UPSTREAM`. It is the foundation for `hub-select` and the upcoming ng-hub-ui selection-component
family.

**Since 2026-11-24 the copy is a fork maintained here.** The weekly sync that re-vendored each new
upstream tag and re-applied the patch files has been switched off. Upstream fixes now come in by
hand, after reading their changelog, when one is worth having. The table below is the history of
the deviations made while the copy still followed upstream; new changes are recorded in the
library's `CHANGELOG.md` like any other code.

The specs upstream ships with this version live next to the code they test, so a change to the
fork is checked against the behaviour ng-select itself guarantees.

## Conventions

- **Do not rename** upstream classes, selectors (`.ng-select*`) or files. Theming and behavior are
  layered on top from the `hub-select` wrapper + the hub theme, not by editing `vendor/`.
- Hub theming lives **outside** `vendor/` (in `select/theme/`), targeting the stable `.ng-select`
  classes via `--hub-select-*` tokens — so upstream SCSS changes don't conflict.
- A change to `vendor/` is ordinary work now: it goes in `CHANGELOG.md` and, when it departs from
  what upstream does, in a spec that says so. The table below is closed.

## Applied patches (closed at the fork)

| #   | File                                          | Change                                                                                                                                                                                                                                                                                   | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Date       |
| --- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| 1   | `vendor/**/*.ts`                              | Prepend `// @ts-nocheck` as line 1                                                                                                                                                                                                                                                       | ng-hub-ui compiles under a stricter `tsconfig` than ng-select (strictNullChecks, strictPropertyInitialization, noImplicitAny, noPropertyAccessFromIndexSignature, isolatedModules) → ~100 type errors. The code is already type-checked upstream; `@ts-nocheck` keeps the source byte-identical except line 1 and avoids invasive edits that would conflict on every sync.                                                                                   | 2026-06-13 |
| 2   | `vendor/lib/ng-select/ng-select.component.ts` | `ng-select-opened` is reflected imperatively (`_reflectOpenState` via `Renderer2`, called synchronously from `open()`/`close()` + an `effect` for `[isOpen]`-driven writes) instead of the upstream `'[class.ng-select-opened]': 'isOpen()'` host binding, which is removed from `host`. | `open()` ends in a LOCAL `_cd.detectChanges()`: the own template updates (panel, `aria-expanded`) but host bindings — which execute during the PARENT view's refresh — do not, so in apps without a global tick after the interaction (zoneless / OnPush islands) the class never appeared and the theme's caret flip never engaged. Regression spec: `select-opened-class.spec.ts` (fails against the upstream host binding in a plain zone-based TestBed). | 2026-07-30 |

| 3 | `vendor/lib/services/console.service.ts` | `warn()` returns early unless `isDevMode()`, and prefixes the message with `[ng-hub-ui-forms]`. | The two call sites (`_isValidWriteValue`) report a model the engine is about to drop — worth keeping, but addressed to whoever wrote the form. Unguarded they printed in production builds, i.e. into the console of the consuming application's users, who did not write the binding and cannot silence it. Gating the single writer covers both messages and leaves the call sites byte-identical to upstream. Regression spec: `select-console-silence.spec.ts`. | 2026-09-08 |

| 4 | `vendor/lib/ng-select/ng-select.component.ts` | `selectTag()` guards the promise branch with the same `if (item)` the synchronous branch has, closes the panel up front when `closeOnSelect` is on, and reads `isOpen()` once into `wasOpen` before doing so. | An `addTag` that resolves with nothing — a creation dialog dismissed, a request refused — was selected anyway, so the field held an option built out of `null`. And an `addTag` that opens a modal left the panel hanging over it: appended to `<body>`, above the modal, covering the form the user had just been sent to fill in, until the promise resolved or forever if it resolved empty. `wasOpen` keeps the created item joining the list rather than standing alone, which closing first would otherwise have changed. Regression specs: `select-search-and-tagging.spec.ts`. | 2026-09-23 |

| 5 | `vendor/lib/ng-select/ng-select.component.ts` | New optional `dropdownAnchor` input: a function that returns the element to line up with, asked each time the list opens (hub-select answers from `--hub-select-dropdown-anchor`). `_dropdownOrigin()` returns that element when there is one, otherwise the control as upstream. Since v24 the list is an overlay (CDK then, the `ng-hub-ui-utils` one now) whose position and width come from the origin element, so the old panel-side `anchor` input and its `_updateXPosition`/`_updateYPosition`/`_alignInlineToAnchor` edits are gone. | A chip draws the filter's name in front of the value; the control is only the value part, so the list started under the value and was as narrow as it. Unset or returning `null`, every path behaves as upstream. Regression spec: `select-chip-anchor.spec.ts`. | 2026-11-04 |

| 6 | `vendor/lib/ng-select/ng-select.component.html`, `ng-select/ng-select.component.ts`, `items-list.ts`, `dropdown-panel/ng-dropdown-panel.component.ts` | `fixedPlaceholder() ?? config.fixedPlaceholder` becomes `fixedPlaceholder()`, `itemsList?.markedItem` becomes `itemsList.markedItem` and the `markedItem` getter and the panel's `markedItem` input are typed `NgOption \| undefined` (it is undefined while nothing is marked, which the `?.` after it guards), the search input's `searchTerm ?? ''` becomes `searchTerm \|\| ''`, and the `placeholder` input is typed `string \| undefined`. | Angular's extended diagnostics (NG8102, NG8107) warned on every library build that these operators could never fire for the declared types. Each change keeps the runtime result: the fixed-placeholder input has a non-null default, the items list exists from the constructor, `\|\|` and `??` agree on a string or null, and widening the placeholder type is what makes its fallback legitimate. | 2026-11-04 |

| 7 | `vendor/lib/dropdown-panel/dropdown-overlay-manager.ts`, `dropdown-panel/dropdown-position.ts` | The overlay is sized with `updateSize({ minWidth })` instead of `{ width }`, and `auto` positions gain end-aligned variants (below-start, below-end, above-start, above-end). The width contract itself (`width: max-content`, `min-width: 100%`, `max-width` from `--hub-select-dropdown-max-width`) lives in `select.component.scss` on `.ng-dropdown-panel.hub-select__panel`, not in `vendor/`. | Upstream pins the overlay to the control's width, which cut the options of a narrow select ("Paid by ban…"). The list must be at least as wide as the control (or the chip group) and grow to its options, and open from the control's end instead of running off the screen. Regression specs: `select-dropdown-horizontal-position.spec.ts`, `select-chip-anchor.spec.ts`. | 2026-11-19 |

## Patch files (history)

Patches #2–#7 are also kept as unified diffs in `patches/NN-*.patch`, made against pristine upstream
`v24.2.1` with patch #1 already applied, and with paths relative to the forms repo root. Apply them
in order from the repo root after re-vendoring and applying #1:

```bash
for p in src/lib/select/patches/*.patch; do git apply "$p"; done
```

Each one is cumulative on the previous (#2, #4, #5 and #6 all touch `ng-select.component.ts`), so the
order matters. When a patch no longer applies, redo it by hand from this table and regenerate its file.

Dropped since v23.0.1: none. Patch #5 changed shape (see its row) because upstream moved the list
into a CDK overlay in v24.

> The sync used to apply patch #1 itself (it prepends `@ts-nocheck` to every vendored `.ts`) and then the
> files in `patches/` in name order. A patch that no longer fits is applied with `--reject`, and the
> pull request opens as a draft naming it.
