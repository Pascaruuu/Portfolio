import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { validatePieceMeta } from '../src/lib/content/art/validate.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const artDir = resolve(__dirname, '../src/lib/content/art');

function readMeta(pieceDir, slug) {
	const metaPath = join(pieceDir, 'meta.json');

	let raw;
	try {
		raw = readFileSync(metaPath, 'utf-8');
	} catch {
		return null;
	}

	try {
		return JSON.parse(raw);
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		console.warn(`art/${slug}: meta.json is not valid JSON — ${reason}`);
		return null;
	}
}

function main() {
	const slugs = readdirSync(artDir).filter((entry) => statSync(join(artDir, entry)).isDirectory());

	let skippedCount = 0;
	let warningCount = 0;

	for (const slug of slugs) {
		const pieceDir = join(artDir, slug);
		const filesInDir = readdirSync(pieceDir).filter((f) => f !== 'meta.json');
		const rawMeta = readMeta(pieceDir, slug);

		const result = validatePieceMeta(slug, rawMeta, filesInDir);

		for (const warning of result.warnings) {
			console.warn(warning);
			warningCount++;
		}

		if (result.skip) skippedCount++;
	}

	console.log(`\nchecked ${slugs.length} piece director${slugs.length === 1 ? 'y' : 'ies'}: ${warningCount} warning(s), ${skippedCount} skipped.`);

	if (skippedCount > 0) {
		console.error(`FAIL: ${skippedCount} piece(s) would be skipped by the loader.`);
		process.exit(1);
	}

	process.exit(0);
}

main();
