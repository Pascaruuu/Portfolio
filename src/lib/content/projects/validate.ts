// Copied verbatim from src/lib/content/art/validate.ts's isValidDate rather
// than imported — the two content types are separate modules by design (see
// CONTENT.md) and this is the only rule they'd need to share. Worth
// extracting into a common helper if a third content type ever needs the
// same YYYY-MM-DD rule; not done here since this pass only touches projects.
function isValidDate(value: unknown): value is string {
	if (typeof value !== 'string') return false;

	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (match === null) return false;

	const yearStr = match[1];
	const monthStr = match[2];
	const dayStr = match[3];
	if (yearStr === undefined || monthStr === undefined || dayStr === undefined) return false;

	const year = Number(yearStr);
	const month = Number(monthStr);
	const day = Number(dayStr);

	// Date.UTC silently rolls invalid components over into the next month/year
	// (e.g. Feb 30 becomes Mar 2) instead of failing, so round-trip the parsed
	// value and reject anything that didn't land back on the same y/m/d.
	const parsed = new Date(Date.UTC(year, month - 1, day));
	return (
		parsed.getUTCFullYear() === year &&
		parsed.getUTCMonth() === month - 1 &&
		parsed.getUTCDate() === day
	);
}

/**
 * Detail-file naming convention: `detail.<lang>.svx`, one per language, sitting
 * next to meta.json in the project directory. Not a meta.json field — the file
 * either exists at this fixed name or it doesn't, same "directory is the
 * contract" spirit as slug-from-dirname. See CONTENT.md.
 */
export function detailFilename(lang: 'en' | 'ja'): string {
	return `detail.${lang}.svx`;
}

/**
 * A missing detail file warns, never skips — same third tier as art's
 * "fewer images than listed" (src/lib/content/art/validate.ts): the project
 * still has everything a card needs (image, title, description, tags, url)
 * without it, so losing the expanded write-up degrades the detail view
 * rather than removing the project. See CONTENT.md.
 */
export function checkDetailFiles(slug: string, filesInDir: string[]): string[] {
	const warnings: string[] = [];
	for (const lang of ['en', 'ja'] as const) {
		if (!filesInDir.includes(detailFilename(lang))) {
			warnings.push(`projects/${slug}: missing ${detailFilename(lang)} — detail view falls back to card fields only`);
		}
	}
	return warnings;
}

/**
 * Pure validation rules shared by the Vite loader (loader.ts) and the standalone
 * check (scripts/validate-projects-content.mjs). Each caller supplies the raw
 * parsed meta.json (or null if missing/unreadable) and the filenames present in
 * the project's directory; this function contains no filesystem or Vite-specific
 * I/O. Mirrors src/lib/content/art/validate.ts: every field except `image`
 * degrades to null/empty rather than skipping the project — only a missing or
 * unresolvable image removes it, since a project card has nothing to show
 * without one.
 */
export function validateProjectMeta(
	slug: string,
	rawMeta: unknown,
	filesInDir: string[]
):
	| { skip: true; warnings: string[] }
	| {
			skip: false;
			warnings: string[];
			meta: {
				title: string | null;
				description: { en: string | null; ja: string | null };
				tags: { en: string[]; ja: string[] };
				url: string | null;
				date: string | null;
				image: string;
				focalPoint: { x: number; y: number } | null;
			};
	  } {
	const warnings: string[] = [];

	if (rawMeta === null || typeof rawMeta !== 'object') {
		warnings.push(`projects/${slug}: missing or unreadable meta.json — skipped`);
		return { skip: true, warnings };
	}

	const raw = rawMeta as Record<string, unknown>;

	const image = typeof raw.image === 'string' ? raw.image : undefined;
	if (image === undefined) {
		warnings.push(`projects/${slug}: image missing — skipped`);
		return { skip: true, warnings };
	}

	if (!filesInDir.includes(image)) {
		warnings.push(`projects/${slug}: image "${image}" not found on disk — skipped`);
		return { skip: true, warnings };
	}

	const title = typeof raw.title === 'string' ? raw.title : null;
	if (title === null) warnings.push(`projects/${slug}: missing title — using null`);

	const rawDescription = (raw.description ?? {}) as Record<string, unknown>;
	const descriptionEn = typeof rawDescription.en === 'string' ? rawDescription.en : null;
	const descriptionJa = typeof rawDescription.ja === 'string' ? rawDescription.ja : null;
	if (descriptionEn === null) warnings.push(`projects/${slug}: missing description.en — using null`);
	if (descriptionJa === null) warnings.push(`projects/${slug}: missing description.ja — using null`);

	const rawTags = (raw.tags ?? {}) as Record<string, unknown>;
	const tagsEn = Array.isArray(rawTags.en)
		? (rawTags.en as unknown[]).filter((t) => typeof t === 'string') as string[]
		: [];
	const tagsJa = Array.isArray(rawTags.ja)
		? (rawTags.ja as unknown[]).filter((t) => typeof t === 'string') as string[]
		: [];
	if (!Array.isArray(rawTags.en)) warnings.push(`projects/${slug}: missing tags.en — using empty list`);
	if (!Array.isArray(rawTags.ja)) warnings.push(`projects/${slug}: missing tags.ja — using empty list`);

	const url = typeof raw.url === 'string' ? raw.url : null;
	if (url === null) warnings.push(`projects/${slug}: missing url — using null`);

	const date = isValidDate(raw.date) ? raw.date : null;
	if (date === null) warnings.push(`projects/${slug}: missing or unparseable date — using null`);

	// PHASE 6 (header-strip crop): unlike every field above, this one is
	// truly optional -- meta.json's table doesn't mark it "should be
	// filled," and most projects will never need it (see CONTENT.md's
	// "Focal point" section). So it warns only when PRESENT but malformed
	// (wrong shape, or a coordinate outside 0-100), never when simply
	// absent -- an absent focalPoint isn't a gap to flag, it's the expected
	// default (centred crop). Same type-check-and-degrade shape as every
	// other field, just without the "should be filled" warning tier.
	const rawFocalPoint = raw.focalPoint;
	let focalPoint: { x: number; y: number } | null = null;
	if (rawFocalPoint !== undefined) {
		const f = rawFocalPoint as Record<string, unknown>;
		const x = typeof f?.x === 'number' && f.x >= 0 && f.x <= 100 ? f.x : null;
		const y = typeof f?.y === 'number' && f.y >= 0 && f.y <= 100 ? f.y : null;
		if (x !== null && y !== null) {
			focalPoint = { x, y };
		} else {
			warnings.push(`projects/${slug}: invalid focalPoint — using centered crop`);
		}
	}

	return {
		skip: false,
		warnings,
		meta: {
			title,
			description: { en: descriptionEn, ja: descriptionJa },
			tags: { en: tagsEn, ja: tagsJa },
			url,
			date,
			image,
			focalPoint
		}
	};
}
