import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex } from 'mdsvex';

// .svx only (not .md) so mdsvex never touches the project's own docs
// (CLAUDE.md, CONTENT.md, README.md, ...) -- those must stay plain
// documentation, not get run through the Svelte compiler.
const MDSVEX_EXTENSION = '.svx';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', MDSVEX_EXTENSION],
	// vitePreprocess first so it can still handle lang="ts"/lang="scss" in any
	// <script>/<style> block mdsvex content contains; mdsvex second to turn
	// the markdown body itself into Svelte markup. Standard order for this
	// combination.
	preprocess: [vitePreprocess(), mdsvex({ extensions: [MDSVEX_EXTENSION] })],
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		// mdsvex-generated .svx components pass through this same filename-based
		// check (they aren't under node_modules) -- harmless, since placeholder
		// markdown content has no legacy reactive syntax for runes mode to
		// conflict with.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter()
	}
};

export default config;
