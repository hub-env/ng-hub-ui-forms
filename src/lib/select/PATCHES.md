# hub-select — select engine (fork of ng-select)

The `engine/` directory holds a copy of the `src/ng-select` library from
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

- The engine's classes, files and element tags carry hub names (see "Renames" and "CSS classes"
  below). The CSS classes it puts on the DOM carry both the upstream `.ng-*` name and the
  `hub-select__*` name until 23.0.0; the library styles only the new names.
- Hub theming lives outside `engine/` (in the wrapper's `select.component.scss`), targeting the
  `hub-select__*` classes via `--hub-select-*` tokens.
- A change to `engine/` is ordinary work now: it goes in `CHANGELOG.md` and, when it departs from
  what upstream does, in a spec that says so. The table below is closed.

## Applied patches (closed at the fork)

| #   | File                                                  | Change                                                                                                                                                                                                                                                                                   | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Date       |
| --- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| 1   | `engine/**/*.ts`                                      | Prepend `// @ts-nocheck` as line 1 (removed from the sources when the engine was typed; only specs and `engine/testing` keep it)                                                                                                                                                         | ng-hub-ui compiles under a stricter `tsconfig` than ng-select (strictNullChecks, strictPropertyInitialization, noImplicitAny, noPropertyAccessFromIndexSignature, isolatedModules) → ~100 type errors. The code is already type-checked upstream; `@ts-nocheck` keeps the source byte-identical except line 1 and avoids invasive edits that would conflict on every sync.                                                                                   | 2026-06-13 |
| 2   | `engine/lib/select-engine/select-engine.component.ts` | `ng-select-opened` is reflected imperatively (`_reflectOpenState` via `Renderer2`, called synchronously from `open()`/`close()` + an `effect` for `[isOpen]`-driven writes) instead of the upstream `'[class.ng-select-opened]': 'isOpen()'` host binding, which is removed from `host`. | `open()` ends in a LOCAL `_cd.detectChanges()`: the own template updates (panel, `aria-expanded`) but host bindings — which execute during the PARENT view's refresh — do not, so in apps without a global tick after the interaction (zoneless / OnPush islands) the class never appeared and the theme's caret flip never engaged. Regression spec: `select-opened-class.spec.ts` (fails against the upstream host binding in a plain zone-based TestBed). | 2026-07-30 |

| 3 | `engine/lib/services/console.service.ts` | `warn()` returns early unless `isDevMode()`, and prefixes the message with `[ng-hub-ui-forms]`. | The two call sites (`_isValidWriteValue`) report a model the engine is about to drop — worth keeping, but addressed to whoever wrote the form. Unguarded they printed in production builds, i.e. into the console of the consuming application's users, who did not write the binding and cannot silence it. Gating the single writer covers both messages and leaves the call sites byte-identical to upstream. Regression spec: `select-console-silence.spec.ts`. | 2026-09-08 |

| 4 | `engine/lib/select-engine/select-engine.component.ts` | `selectTag()` guards the promise branch with the same `if (item)` the synchronous branch has, closes the panel up front when `closeOnSelect` is on, and reads `isOpen()` once into `wasOpen` before doing so. | An `addTag` that resolves with nothing — a creation dialog dismissed, a request refused — was selected anyway, so the field held an option built out of `null`. And an `addTag` that opens a modal left the panel hanging over it: appended to `<body>`, above the modal, covering the form the user had just been sent to fill in, until the promise resolved or forever if it resolved empty. `wasOpen` keeps the created item joining the list rather than standing alone, which closing first would otherwise have changed. Regression specs: `select-search-and-tagging.spec.ts`. | 2026-09-23 |

| 5 | `engine/lib/select-engine/select-engine.component.ts` | New optional `dropdownAnchor` input: a function that returns the element to line up with, asked each time the list opens (hub-select answers from `--hub-select-dropdown-anchor`). `_dropdownOrigin()` returns that element when there is one, otherwise the control as upstream. Since v24 the list is an overlay (CDK then, the `ng-hub-ui-utils` one now) whose position and width come from the origin element, so the old panel-side `anchor` input and its `_updateXPosition`/`_updateYPosition`/`_alignInlineToAnchor` edits are gone. | A chip draws the filter's name in front of the value; the control is only the value part, so the list started under the value and was as narrow as it. Unset or returning `null`, every path behaves as upstream. Regression spec: `select-chip-anchor.spec.ts`. | 2026-11-04 |

| 6 | `engine/lib/select-engine/select-engine.component.html`, `select-engine/select-engine.component.ts`, `items-list.ts`, `select-panel/select-panel.component.ts` | `fixedPlaceholder() ?? config.fixedPlaceholder` becomes `fixedPlaceholder()`, `itemsList?.markedItem` becomes `itemsList.markedItem` and the `markedItem` getter and the panel's `markedItem` input are typed `SelectEngineOption \| undefined` (it is undefined while nothing is marked, which the `?.` after it guards), the search input's `searchTerm ?? ''` becomes `searchTerm \|\| ''`, and the `placeholder` input is typed `string \| undefined`. | Angular's extended diagnostics (NG8102, NG8107) warned on every library build that these operators could never fire for the declared types. Each change keeps the runtime result: the fixed-placeholder input has a non-null default, the items list exists from the constructor, `\|\|` and `??` agree on a string or null, and widening the placeholder type is what makes its fallback legitimate. | 2026-11-04 |

| 7 | `engine/lib/select-panel/panel-overlay-manager.ts`, `select-panel/panel-position.ts` | The overlay is sized with `updateSize({ minWidth })` instead of `{ width }`, and `auto` positions gain end-aligned variants (below-start, below-end, above-start, above-end). The width contract itself (`width: max-content`, `min-width: 100%`, `max-width` from `--hub-select-dropdown-max-width`) lives in `select.component.scss` on `.ng-dropdown-panel.hub-select__panel`, not in `vendor/`. | Upstream pins the overlay to the control's width, which cut the options of a narrow select ("Paid by ban…"). The list must be at least as wide as the control (or the chip group) and grow to its options, and open from the control's end instead of running off the screen. Regression specs: `select-dropdown-horizontal-position.spec.ts`, `select-chip-anchor.spec.ts`. | 2026-11-19 |

## Renames

The engine used to live in `vendor/` under upstream's names. Old name to current name:

| Before                                                                                                             | Now                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `vendor/`                                                                                                          | `engine/`                                                                                                        |
| `lib/ng-select/ng-select.component.*`, `NgSelectComponent`, `<ng-select>`                                          | `lib/select-engine/select-engine.component.*`, `HubSelectEngineComponent`, `<hub-select-engine>`                 |
| `lib/ng-select/ng-select-model-value.ts` and `ng-select.*.spec.ts`                                                 | `lib/select-engine/select-engine-model-value.ts` and `select-engine.*.spec.ts`                                   |
| `lib/dropdown-panel/ng-dropdown-panel.component.ts`, `NgDropdownPanelComponent`, `<ng-dropdown-panel>`             | `lib/select-panel/select-panel.component.ts`, `HubSelectPanelComponent`, `<hub-select-panel>`                    |
| `lib/dropdown-panel/ng-dropdown-panel.service.ts`, `NgDropdownPanelService`                                        | `lib/select-panel/select-panel.service.ts`, `SelectPanelService`                                                 |
| `dropdown-overlay-manager.ts`, `dropdown-panel-classes.ts`, `dropdown-panel-dom-events.ts`, `dropdown-position.ts` | `select-panel/panel-overlay-manager.ts`, `panel-classes.ts`, `panel-dom-events.ts`, `panel-position.ts`          |
| `DropdownOverlayManager`, `DropdownPanelDomEvents`                                                                 | `SelectPanelOverlayManager`, `SelectPanelDomEvents`                                                              |
| `lib/ng-option.component.ts`, `NgOptionComponent`, `<ng-option>`                                                   | `lib/option.component.ts`, `HubOptionComponent`, `<hub-option>` (`<ng-option>` still matches)                    |
| `lib/services/config.service.ts`, `NgSelectConfig`                                                                 | `lib/services/select-config.service.ts`, `HubSelectConfig` (`NgSelectConfig` exported as a deprecated alias)     |
| `lib/types/ng-select.types.ts`, `NgOption`                                                                         | `lib/types/select-engine.types.ts`, `SelectEngineOption`                                                         |
| `lib/directives/ng-templates.directive.ts`                                                                         | `lib/directives/engine-templates.directive.ts` (the `ng-*-tmp` directives keep their names; they are deprecated) |
| `lib/ng-select.module.ts`, `NgSelectModule`, `provideNgSelect()`                                                   | `lib/select-engine.providers.ts`, `provideSelectEngine()` (the module is gone)                                   |
| `testing/ng-select-test-fixtures.ts`                                                                               | `testing/select-engine-test-fixtures.ts`                                                                         |
| `vendor/public-api.ts`                                                                                             | removed; `src/public-api.ts` exports straight from the files                                                     |

## Patch files (history)

Patches #2–#7 are also kept as unified diffs in `patches/NN-*.patch`, frozen with the paths they had under `vendor/` (see Renames), made against pristine upstream
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

## CSS classes

Every element emits the old `.ng-*` class next to the new one. The `.ng-*` names are unstyled
hooks kept until 23.0.0 so consumer stylesheets keep matching; `select-legacy-classes.spec.ts`
guards that they do not disappear early.

| Element                | Before (`.ng-*`)                                                                                                                                                               | Now (`hub-select__*`)                                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Host                   | `ng-select`                                                                                                                                                                    | `hub-select__control`                                                                                                                                                                                  |
| Host modifiers         | `ng-select-single`, `-multiple`, `-opened`, `-focused`, `-disabled`, `-searchable`, `-clearable`, `-taggable`, `-typeahead`, `-filtered`, `-top`, `-bottom`, `-left`, `-right` | `hub-select__control--single`, `--multiple`, `--opened`, `--focused`, `--disabled`, `--searchable`, `--clearable`, `--taggable`, `--typeahead`, `--filtered`, `--top`, `--bottom`, `--left`, `--right` |
| Box with a value       | `ng-has-value` (on the box)                                                                                                                                                    | `hub-select__box--has-value` (on the box)                                                                                                                                                              |
| Box                    | `ng-select-container`                                                                                                                                                          | `hub-select__box`                                                                                                                                                                                      |
| Values                 | `ng-value-container`, `ng-value`, `ng-value-disabled`, `ng-value-label`, `ng-value-icon`                                                                                       | `hub-select__values`, `hub-select__value`, `hub-select__value--disabled`, `hub-select__value-label`, `hub-select__value-remove`                                                                        |
| Placeholder and search | `ng-placeholder`, `ng-input`                                                                                                                                                   | `hub-select__placeholder`, `hub-select__search`                                                                                                                                                        |
| Clear, arrow, spinner  | `ng-clear-wrapper`, `ng-clear`, `ng-arrow-wrapper`, `ng-arrow`, `ng-spinner-loader`                                                                                            | `hub-select__clear`, `hub-select__clear-icon`, `hub-select__arrow-wrapper`, `hub-select__arrow`, `hub-select__spinner`                                                                                 |
| Live region            | `ng-visually-hidden`                                                                                                                                                           | `hub-select__visually-hidden`                                                                                                                                                                          |
| Panel                  | `ng-dropdown-panel`, `ng-select-top` / `-bottom` / `-left` / `-right`                                                                                                          | `hub-select__panel`, `hub-select__panel--top` / `--bottom` / `--left` / `--right`                                                                                                                      |
| Panel parts            | `ng-dropdown-panel-items`, `ng-dropdown-header`, `ng-dropdown-footer`                                                                                                          | `hub-select__panel-items`, `hub-select__panel-header`, `hub-select__panel-footer`                                                                                                                      |
| Options                | `ng-option`, `-marked`, `-selected`, `-disabled`, `-child`, `ng-option-label`, `ng-optgroup`, `ng-tag-label`                                                                   | `hub-select__panel-option`, `--marked`, `--selected`, `--disabled`, `--child`, `hub-select__panel-option-label`, `hub-select__panel-optgroup`, `hub-select__panel-tag-label`                           |
