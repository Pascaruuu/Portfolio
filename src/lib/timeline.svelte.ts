import { SvelteMap, SvelteSet } from 'svelte/reactivity';

interface Beat {
	readonly at: number;
	readonly id: string;
	readonly fire: () => void;
	fired: boolean;
	// Present only for beats that originated from after(). Lets reset() un-resolve
	// them back to pending instead of just clearing `fired`.
	readonly relative?: { readonly markName: string; readonly offset: number };
}

interface PendingBeat {
	readonly id: string;
	readonly offset: number;
	readonly fire: () => void;
}

function createTimeline() {
	const beats = new SvelteMap<string, Beat>();
	const marks = new SvelteMap<string, number>();
	// Relative beats waiting on a mark that hasn't happened yet, keyed by markName.
	// A beat lives here XOR in `beats` — never both — so tick() (which only reads
	// `beats`) structurally cannot see or fire a pending beat early.
	const pending = new SvelteMap<string, PendingBeat[]>();
	// Id namespace shared by at() and after(), including pending ones, so a
	// duplicate id can't slip through by registering via the other function.
	const ids = new SvelteSet<string>();

	function claimId(id: string): void {
		// Edge case: duplicate id across at() and after() (or two at()/after()
		// calls) — fail loud, same as double-marking below. A collision here is
		// a wiring bug, not something to silently overwrite.
		if (ids.has(id)) {
			throw new Error(`timeline: duplicate beat id "${id}"`);
		}
		ids.add(id);
	}

	function resolveRelative(id: string, offsetMs: number, fire: () => void, markName: string, markTime: number): void {
		// Edge case: offsetMs === 0 needs no special-casing — `at` just equals
		// markTime, so the beat becomes due on the tick that reaches markTime.
		beats.set(id, { at: markTime + offsetMs, id, fire, fired: false, relative: { markName, offset: offsetMs } });
	}

	function at(ms: number, id: string, fire: () => void): () => void {
		claimId(id);
		beats.set(id, { at: ms, id, fire, fired: false });
		return () => {
			ids.delete(id);
			beats.delete(id);
		};
	}

	function after(markName: string, offsetMs: number, id: string, fire: () => void): () => void {
		claimId(id);

		const markTime = marks.get(markName);
		if (markTime !== undefined) {
			// Mark already happened — resolve to an absolute beat immediately.
			// The resulting `at` may already be <= the current tick time; that's
			// fine, it just fires on the very next tick like any other due beat.
			resolveRelative(id, offsetMs, fire, markName, markTime);
		} else {
			// Mark hasn't happened yet — park until mark(markName) resolves it.
			const list = pending.get(markName) ?? [];
			list.push({ id, offset: offsetMs, fire });
			pending.set(markName, list);
		}

		return () => {
			// Edge case: disposing a still-pending beat must not leak — remove it
			// from the pending list. Covers both cases (still pending, or already
			// resolved into `beats`) without needing to know which one it is.
			ids.delete(id);
			beats.delete(id);
			const list = pending.get(markName);
			if (!list) return;
			const idx = list.findIndex((b) => b.id === id);
			if (idx !== -1) list.splice(idx, 1);
		};
	}

	function mark(name: string, t: number): void {
		// Edge case: double mark of the same name — fail loud, mirrors the
		// duplicate-id rule. A mark is a one-time runtime fact.
		if (marks.has(name)) {
			throw new Error(`timeline: mark "${name}" already recorded`);
		}
		marks.set(name, t);

		const waiting = pending.get(name);
		// Edge case: a mark nobody registered an after() against — recorded and
		// harmless, nothing to resolve.
		if (!waiting) return;

		for (const beat of waiting) {
			resolveRelative(beat.id, beat.offset, beat.fire, name, t);
		}
		pending.delete(name);
	}

	function tick(t: number): void {
		// Snapshot + stable-sort so same-tick ties fire in registration order
		// (Map iterates insertion order; Array#sort is stable per spec).
		const due = [...beats.values()]
			.filter((beat) => !beat.fired && t >= beat.at)
			.sort((a, b) => a.at - b.at);

		for (const beat of due) {
			beat.fired = true;
			try {
				beat.fire();
			} catch (err) {
				console.error(`timeline: beat "${beat.id}" threw`, err);
			}
		}
	}

	// Full reset: clears fired latches, clears marks, and un-resolves any
	// mark-resolved relative beats back to pending so a re-run rediscovers marks
	// fresh instead of reusing stale ones. Registrations (and claimed ids) stay.
	// Nothing calls this yet — the intro runs once per page load — kept for a
	// future re-run/replay case. Assumes reset() runs between full cycles only,
	// never mid-tick.
	function reset(): void {
		marks.clear();

		for (const [id, beat] of [...beats]) {
			beat.fired = false;
			if (beat.relative) {
				beats.delete(id);
				const list = pending.get(beat.relative.markName) ?? [];
				list.push({ id: beat.id, offset: beat.relative.offset, fire: beat.fire });
				pending.set(beat.relative.markName, list);
			}
		}
	}

	return { at, after, mark, tick, reset };
}

export const timeline = createTimeline();
