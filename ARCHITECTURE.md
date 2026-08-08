# temp-sv — Architecture

A visually-rich SvelteKit + Svelte 5 (runes) portfolio site: a Three.js ASCII-rendered particle sphere with clickable hotspots, draggable/resizable popup panels, a cinematic lightspeed intro, and an ASCII-glitch reveal system. Bilingual EN/JA, desktop + mobile.

**Stack:** SvelteKit · Svelte 5 (runes, forced on) · Three.js · Vite · TypeScript · GLSL · pnpm. CSS pipeline: postcss-custom-media fed by a build-time codegen plugin. Adapter: `adapter-auto`.

This document describes module boundaries and how subsystems connect. It is not a line-level reference — read the source for internals. Where the architecture has known rough edges, they're called out as **⚠ Flags** rather than smoothed over.

---

## 1. Big picture

There is effectively one page. `src/routes/+page.svelte` is the entire app shell — it mounts the intro, initializes the sphere, owns nearly all app state, renders the hotspot overlay and popup panel, and registers the timeline beats. Everything else is a library module it drives.

The runtime has three coordinated clocks/loops:

- **The sphere's own rAF loop** (`sphere/index.ts`) — renders the particle sphere continuously via its postprocessing composer.
- **The intro's rAF loop** (`LightspeedIntro.svelte`) — runs the lightspeed animation and, each frame, feeds elapsed time into the timeline.
- **The timeline** (`timeline.svelte.ts`) — a headless sequencer, no clock of its own; it's driven by the intro's `tick` and fires registered beats.

Control flows in two directions and they cross: **progress** flows sphere → page → intro (load state driving the intro), while **control** flows intro → page-owned timeline → sphere/glitch (choreography commands driving animations). Keeping these straight is the main thing to understand about the app.

---

## 2. Directory map

```
src/
  routes/
    +layout.svelte              root layout
    +page.svelte                THE app shell — state, sphere init, hotspot overlay, popup, timeline beats
  lib/
    timeline.svelte.ts          headless beat sequencer (the choreography seam)
    viewport.svelte.ts          reactive viewport size + breakpoint constants
    createDraggablePanel.svelte.ts   drag/resize primitive for the popup
    portfolio-data.ts           untranslated structured data (nav order, images, urls)
    language-strings.ts         translated copy
    content.ts                  getLabel / getUi / lookup getters
    panelGeometry.ts            PANEL_GUTTER / PANEL_MAX_W constants
    types.ts                    SphereControls, GlitchControls, shared interfaces
    index.ts                    ⚠ dead $lib barrel (see Flags)
    sphere/
      index.ts                  initSphere → builds renderer/scene/camera, returns SphereControls
      ascii.ts                  createAsciiRenderer → postprocessing composer + setters
      interaction.ts            worldToScreen projection, raycast hotspot clicks
      constants.ts              HOTSPOT_DEFS ({ id, lat, lon }[])
    lightspeed/
      streaks.ts                lightspeed streak effect
      glitch.ts                 ⚠ GlitchEffect — used by the SPHERE pipeline, not just intro (see Flags)
    glitch/
      constants.ts              shared glitch constants (chars, timings, salts)  ⚠ see Flag #8
      asciiGlitchRender.ts      standalone Three-free glitch renderer  ⚠ see Flag #8
    actions/
      panelScrollFade.ts        use:panelScrollFade — top/bottom scroll-fade mask for .panel-body
  components/
    LightspeedIntro.svelte      intro animation; feeds timeline.tick + mark('exit')
  generated/
    breakpoints.css             CODEGEN — do not edit by hand
scripts/
  generate-breakpoints.mjs      extracts BP constants from TS → writes generated/breakpoints.css
```

---

## 3. The timeline (choreography seam)

`src/lib/timeline.svelte.ts` — a singleton, headless sequencer. This is the central connective tissue: all intro-driven animation is registered against it, and it's how any future animated component connects to the intro without touching the intro.

**Model — two anchors:**
- `t=0` = **page load**. Absolute beats (`at(ms, …)`) fire at fixed offsets from load.
- `exit` = a **runtime marker**. The exit moment is asset-load-gated (`progress>=1 && elapsed>=MIN_PEAK_MS`), so it's discovered at runtime, not known at mount. Beats that fire after exit anchor to this marker via `after('exit', offset, …)`.

**API:**
- `at(ms, id, fire) → dispose` — absolute beat.
- `after(markName, offsetMs, id, fire) → dispose` — relative beat. Held *pending* (invisible to `tick`) until `mark(markName)` fires, then resolved to an absolute beat. If the mark already fired, schedules from the recorded mark time.
- `mark(name, t)` — record a runtime marker at time `t`; resolves waiting `after` beats. Throws on double-mark.
- `tick(t)` — fires all due, unfired, resolved beats where `t >= at`, in ascending-`at` then registration order, each `fire()` wrapped in try/catch. One-shot latch per beat.
- `reset()` — clears marks + fired flags, returns resolved-relative beats to pending. Defensive; the intro runs once per load so it has no live caller today.

Duplicate `id` across `at`/`after`/pending throws (shared id set). Uses `SvelteMap`/`SvelteSet` per the `svelte/prefer-svelte-reactivity` lint rule — which also makes the registry reactive (useful for a future dev visualizer).

**How it's driven:** `LightspeedIntro`'s rAF loop calls `timeline.tick(elapsed)` every frame (`elapsed = now - startedAt`, the page-load clock). When the exit condition hits, the intro calls `timeline.mark('exit', elapsed)`. `mark` runs before `tick` in the same frame, so exit-anchored beats are visible the frame they resolve.

**Registered beats** (in `+page.svelte` `onMount`):
- `mark('exit', elapsed)` — fired inside the intro.
- `after('exit', 500, …)` — sphere glitch-reveal + welcome-block appear.
- `after('exit', 1400, …)` — flips `loadingVisible=false` (after a 400ms inner delay).

**Adding a new timeline-anchored component** is one line:
```
onMount(() => timeline.after('exit', 800, 'cockpit-in', () => cockpitCtl.appear()));
```
Build the component, give it a controller, pick an offset, register. No intro edit, no dispatcher, no latch.

---

## 4. The intro (`LightspeedIntro.svelte`)

Runs the cinematic lightspeed sequence and is the timeline's clock source. Phases: `wake` (0–800ms) → `accelerate` (→2500ms) → `peak` (holds ≥4000ms, gated on asset load) → `exiting` → `done`.

Props in: `progress`, `visible`, `sphereCtl`. It drives the sphere's warp via `sphereCtl.setWarpProgress(p)` and manages its own streaks + composer.

**It no longer dispatches events.** The old `createEventDispatcher` (`exit`/`glitchReveal`/`done`) was removed in favor of the timeline. The intro now knows nothing about who listens — it feeds `tick` and fires one `mark('exit')`, and that's its entire outbound surface. This is what made the intro stop being the god-object every beat routed through.

---

## 5. Sphere subsystem

`sphere/index.ts` `initSphere()` builds the renderer/scene/camera, bakes terrain, spawns particles and hotspots, wires interaction, **starts its own rAF loop**, and returns a `SphereControls` object.

`sphere/ascii.ts` `createAsciiRenderer()` builds the postprocessing composer — RenderPass → ASCII EffectPass → optional GlitchEffect pass — and returns setter functions the sphere uses to drive it.

**Control surface:** `SphereControls` (in `types.ts`) exposes 6 methods, each called from exactly one site — mostly `+page.svelte`, with `setWarpProgress` called from the intro. The pattern throughout the app is **caller-owns-object / callee-mutates-methods**: a plain object with placeholder methods is created by the caller and overwritten with real implementations at init, living outside Svelte reactivity. `GlitchControls` follows the same pattern.

**⚠ Flag — split control type.** `+page.svelte` binds `sphereCtl` with a reactive type declaring only 4 of the 6 methods (omits `dispose`/`resize`); those two are reached through a separately-typed `controls` local. Same runtime object, two differently-shaped bindings — a consolidation opportunity.

**⚠ Flag — misplaced dependency.** `lib/lightspeed/glitch.ts` (`GlitchEffect`) lives under the nominally intro-only `lightspeed/` directory but is a shared dependency of the *main sphere render pipeline* (imported by `sphere/ascii.ts`). Its location misleads about ownership.

---

## 6. Hotspots

`HOTSPOT_DEFS` (`sphere/constants.ts`) is `{ id, lat, lon }[]`. Projection (`sphere/interaction.ts` `worldToScreen`): a world `Vector3` → `.project(camera)` → CSS pixels via `viewport.vw/vh`.

Clicks reach `openPanel` by **two parallel paths** that converge on the same function: a 3D raycast on the canvas (`interaction.ts` → `onHotspotClick`) and a 2D DOM-button overlay (`+page.svelte`, direct `onclick={() => openPanel(hs.id)}`). Both call `openPanel(id)`.

Sphere shifting for layout uses `camera.setViewOffset`, **not** CSS transforms — a CSS `translateX` breaks `worldToScreen` and causes hotspot drift. This is a load-bearing constraint.

---

## 7. Popup panel + draggable primitive

The popup card mounts via `{#if panelOpen}` in `+page.svelte`. Drag/resize is handled by `createDraggablePanel.svelte.ts`, a runed factory returning reactive `x/y/w/h` getters, an `initialized` flag, a bindable `el`, and `init()` / `onViewportResize()` / `onDragStart()` / `onResizeStart()`. All drag/resize bookkeeping stays internal. `+page.svelte` wires it to the card root, the drag handle, and 8 resize handles.

**⚠ Flag — flat z-index order.** `.main-content` sets no `position`/`transform`/`filter`, so once it's `.loaded` (`opacity:1`) it establishes **no stacking context**. All `position:fixed` children therefore stack globally against the document root — the ~17-selector z-index table (0–9999, intro overlay at 9999) is effectively one flat order, not scoped bands. Anything relying on band-scoping is relying on an illusion; treat z-index as global.

---

## 8. Glitch / reveal system

The ASCII-glitch system corrupts DOM content into ASCII noise for appear/disappear/switch reveals, driven by the timeline.

- `glitch/asciiGlitchRender.ts` — standalone, Three-free renderer producing the corruption.  ⚠ see Flag #8
- `glitch/constants.ts` — shared chars, timings, salts.  ⚠ see Flag #8
- `actions/asciiGlitch.ts` — the `use:asciiGlitch` Svelte action this section describes. Removed deliberately, along with its dev harness route (`src/routes/dev/ascii-glitch/`).

The welcome block (`.welcome-block`) is the first production target: hidden through the intro (`deferMount`), glitches in at the `exit+500` beat in sync with the sphere glitch, holds 1.5s (or dismisses on global click), glitches out. **This description predates the action's removal — see Flag #8 for what's actually still wired up.**

---

## 9. Viewport / breakpoint pipeline

`viewport.svelte.ts` is the reactive source of viewport size and holds breakpoint constants: `BP_DESKTOP=760`, `COMPACT_H=680` (camera-only, deliberately **not** CSS-synced), `WELCOME_COMPACT_H=640`.

`scripts/generate-breakpoints.mjs` regex-extracts `BP_DESKTOP`/`WELCOME_COMPACT_H` from the TS source and writes `generated/breakpoints.css` (`@custom-media` rules). A custom Vite plugin triggers it on `buildStart`/`configureServer`; `postcss-custom-media` resolves the rules at build time. **`generated/breakpoints.css` must never be hand-edited** — it's regenerated.

**⚠ Flag — second, unautomated mirror.** `PANEL_GUTTER`/`PANEL_MAX_W` (`panelGeometry.ts`) are mirrored into `app.css` by hand, kept in sync only by a comment — not by the codegen pipeline. A silent drift risk; a candidate to fold into the generator.

---

## 10. Data + i18n

`portfolio-data.ts` holds untranslated structured data (nav order, images, urls). `language-strings.ts` + `content.ts` getters (`getLabel`, `getUi`, …) hold translated copy. Lookups are **pure and synchronous, taking `lang` as an argument** — you can fetch a target-language string without mutating global `lang` first.

Language is a plain component-local `$state` rune in `+page.svelte`; `toggleLang()` flips it. Projects join translated copy to structured data **positionally by array index** (no id-based join) — order-fragile.

`{#key lang}` wraps **only** `.welcome-block`, so a language toggle remounts just that block (replaying its glitch appear); nothing else remounts.

---

## 11. State topology

Two `.svelte.ts` rune modules are clean single sources of truth: `viewport.svelte.ts` and `createDraggablePanel.svelte.ts`. Everything else is raw `$state` in `+page.svelte`.

`sphereCtl`, `loadProgress`, `loadingVisible` are prop-drilled into `LightspeedIntro`. The imperative controls (`SphereControls`, `GlitchControls`) live *outside* reactivity by design — they're mutated-in-place bridge objects, not reactive state.

---

## 12. Build / tooling

`vite.config.ts`: `sveltekit()` + the custom `generatedBreakpoints()` plugin + `postcssCustomMedia()`. `svelte.config.js`: `adapter-auto`, runes forced on. `package.json` scripts: `dev`, `build`, `preview`, `prepare`, `check` (svelte-kit sync + svelte-check), `check:watch`, `lint`.

**⚠ Flag — no `tsc` script.** CLAUDE.md mandates `pnpm tsc --noEmit`, which works only via pnpm's binary-fallback resolution, not an explicit script contract. Add a script to make the verification gate real.

---

## 13. Conventions & load-bearing constraints

- **Sphere shifting uses `camera.setViewOffset`, never CSS transforms** — CSS `translateX` breaks `worldToScreen`, drifting hotspots.
- **Imperative bridges are caller-owned, callee-mutated** — new controllers mirror `sphereCtl`/`welcomeCtl` (a plain object with placeholder methods overwritten at init, outside reactivity).
- **`generated/breakpoints.css` is codegen** — edit the TS constants, not the CSS.
- **Treat z-index as global** — `.main-content` establishes no stacking context (see §7).

---

## 14. Known flags (consolidated)

Housekeeping / correctness items surfaced during architecture review, none blocking:

1. `src/lib/index.ts` — dead `$lib` barrel; nothing imports bare from `$lib`.
2. `src/theme.css` header comment references "Invoice Recording System" — leftover from an unrelated template.
3. `sphereCtl` split/narrower type vs. the full `controls` local (§5).
4. Two TS→CSS mirrors — breakpoints (automated) vs. panel geometry (manual, comment-enforced) (§9).
5. `.main-content` flat global z-index order (§7).
6. `lightspeed/glitch.ts` is a sphere-pipeline dependency despite its intro-only directory (§5) — **but see #8: this file may not exist either.**
7. No `tsc` package.json script backing the mandated verification (§12).
8. **Glitch subsystem doc/code drift, broader than the removed action.** `actions/asciiGlitch.ts` and its dev route (`routes/dev/ascii-glitch/`) were confirmed removed deliberately, but this doc's description of the *rest* of the glitch subsystem was checked against the working tree during that same cleanup and doesn't hold up either: `types.ts` has no `GlitchControls` interface (only `SphereControls` — §2, §5, §11 all reference `GlitchControls`); `sphere/ascii.ts`'s composer is `RenderPass → ASCII EffectPass` only, no `GlitchEffect` pass (§1, §5, §8); and `lightspeed/glitch.ts`, `glitch/constants.ts`, `glitch/asciiGlitchRender.ts` are all absent from the working tree, same as `actions/asciiGlitch.ts` was. A repo-wide case-sensitive grep for `glitch`/`Glitch` under `src/` returns zero matches. Unclear whether this is all part of the same deliberate removal (undocumented) or a separate, older doc/code drift — needs the same author confirmation the original `asciiGlitch.ts` question got. Until resolved, treat §1, §3, §4, §5, §8, §10, §11's glitch-related claims as unverified, not fact.

---

*This document reflects the architecture as of the timeline refactor (2026-07-12). The timeline/intro/glitch/state layers are verified from direct work; the sphere/hotspot/panel/viewport subsystems are documented at the module-boundary level from investigation, not exhaustive internal review.*
