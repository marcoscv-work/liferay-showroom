import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';

export default defineConfig({
	base: './',
	build: {
		outDir: 'dist',
		rollupOptions: {
			/* The React component runtime is its own entry, loaded by the preview frame at a fixed name */
			input: {
				'component-runtime': fileURLToPath(new URL('src/components/runtime.tsx', import.meta.url)),
				index: fileURLToPath(new URL('index.html', import.meta.url)),
			},
			output: {
				chunkFileNames: (chunk) => `assets/${chunk.facadeModuleId?.match(/\/components\/([^/]+)\/index\.[jt]sx?$/)?.[1] ?? '[name]'}-[hash].js`,
				entryFileNames: (chunk) => (chunk.name === 'component-runtime' ? 'assets/component-runtime.js' : 'assets/[name]-[hash].js'),
			},
		},
	},
	plugins: [react()],
	test: {environment: 'node'},
});
