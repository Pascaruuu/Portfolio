import { sveltekit } from '@sveltejs/kit/vite';
import { enhancedImages } from '@sveltejs/enhanced-img';
import { defineConfig, type Plugin } from 'vite';
import postcssCustomMedia from 'postcss-custom-media';
import { generateBreakpointsCss } from './scripts/generate-breakpoints.mjs';

function generatedBreakpoints(): Plugin {
	return {
		name: 'generate-breakpoints-css',
		buildStart() {
			generateBreakpointsCss();
		},
		configureServer() {
			generateBreakpointsCss();
		}
	};
}

export default defineConfig({
	plugins: [enhancedImages(), sveltekit(), generatedBreakpoints()],
	css: {
		postcss: {
			plugins: [postcssCustomMedia()]
		}
	}
});
