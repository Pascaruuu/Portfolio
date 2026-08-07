import type { ArtCategory } from './types.js';

const CATEGORIES: ArtCategory[] = ['hand-drawn', 'digital'];

export interface ValidatedMeta {
	title: { en: string | null; ja: string | null };
	description: { en: string | null; ja: string | null };
	category: ArtCategory | null;
	date: string | null;
	images: string[];
}

export type ValidationResult =
	| { skip: true; warnings: string[] }
	| { skip: false; warnings: string[]; meta: ValidatedMeta };

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
 * Pure validation rules shared by the Vite loader (loader.ts) and the standalone
 * check (scripts/validate-art-content.mjs). Each caller supplies the raw parsed
 * meta.json (or null if missing/unreadable) and the filenames present in the
 * piece's directory; this function contains no filesystem or Vite-specific I/O.
 */
export function validatePieceMeta(
	slug: string,
	rawMeta: unknown,
	filesInDir: string[]
): ValidationResult {
	const warnings: string[] = [];

	if (rawMeta === null || typeof rawMeta !== 'object') {
		warnings.push(`art/${slug}: missing or unreadable meta.json — skipped`);
		return { skip: true, warnings };
	}

	const raw = rawMeta as Record<string, unknown>;

	const images = Array.isArray(raw.images) ? (raw.images as unknown[]).filter((f) => typeof f === 'string') as string[] : [];
	const [firstImage] = images;
	if (firstImage === undefined) {
		warnings.push(`art/${slug}: images missing or empty — skipped`);
		return { skip: true, warnings };
	}

	if (!filesInDir.includes(firstImage)) {
		warnings.push(`art/${slug}: first image "${firstImage}" not found on disk — skipped`);
		return { skip: true, warnings };
	}

	for (const filename of images.slice(1)) {
		if (!filesInDir.includes(filename)) {
			warnings.push(`art/${slug}: image "${filename}" not found on disk — dropped`);
		}
	}

	const rawTitle = (raw.title ?? {}) as Record<string, unknown>;
	const titleEn = typeof rawTitle.en === 'string' ? rawTitle.en : null;
	const titleJa = typeof rawTitle.ja === 'string' ? rawTitle.ja : null;
	if (titleEn === null) warnings.push(`art/${slug}: missing title.en — using null`);
	if (titleJa === null) warnings.push(`art/${slug}: missing title.ja — using null`);

	const rawDescription = (raw.description ?? {}) as Record<string, unknown>;
	const descriptionEn = typeof rawDescription.en === 'string' ? rawDescription.en : null;
	const descriptionJa = typeof rawDescription.ja === 'string' ? rawDescription.ja : null;
	if (descriptionEn === null) warnings.push(`art/${slug}: missing description.en — using null`);
	if (descriptionJa === null) warnings.push(`art/${slug}: missing description.ja — using null`);

	const date = isValidDate(raw.date) ? raw.date : null;
	if (date === null) warnings.push(`art/${slug}: missing or unparseable date — using null`);

	const category = CATEGORIES.includes(raw.category as ArtCategory) ? (raw.category as ArtCategory) : null;
	if (category === null) warnings.push(`art/${slug}: invalid category — using null`);

	return {
		skip: false,
		warnings,
		meta: {
			title: { en: titleEn, ja: titleJa },
			description: { en: descriptionEn, ja: descriptionJa },
			category,
			date,
			images
		}
	};
}
