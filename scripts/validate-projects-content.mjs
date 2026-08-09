import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { checkDetailFiles, validateProjectMeta } from '../src/lib/content/projects/validate.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectsDir = resolve(__dirname, '../src/lib/content/projects');

function readMeta(projectDir, slug) {
	const metaPath = join(projectDir, 'meta.json');

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
		console.warn(`projects/${slug}: meta.json is not valid JSON — ${reason}`);
		return null;
	}
}

function main() {
	const slugs = readdirSync(projectsDir).filter((entry) => statSync(join(projectsDir, entry)).isDirectory());

	let skippedCount = 0;
	let warningCount = 0;

	for (const slug of slugs) {
		const projectDir = join(projectsDir, slug);
		const filesInDir = readdirSync(projectDir).filter((f) => f !== 'meta.json');
		const rawMeta = readMeta(projectDir, slug);

		const result = validateProjectMeta(slug, rawMeta, filesInDir);

		for (const warning of result.warnings) {
			console.warn(warning);
			warningCount++;
		}

		if (result.skip) {
			skippedCount++;
			continue;
		}

		for (const warning of checkDetailFiles(slug, filesInDir)) {
			console.warn(warning);
			warningCount++;
		}
	}

	console.log(`\nchecked ${slugs.length} project director${slugs.length === 1 ? 'y' : 'ies'}: ${warningCount} warning(s), ${skippedCount} skipped.`);

	if (skippedCount > 0) {
		console.error(`FAIL: ${skippedCount} project(s) would be skipped by the loader.`);
		process.exit(1);
	}

	process.exit(0);
}

main();
