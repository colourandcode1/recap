import { defineConfig } from 'vite';
import { resolve } from 'path';

// Separate build config for the React wrapper sub-export (recap-ux/react).
// Produces dist/recap-react.esm.js and dist/recap-react.cjs.js.
// No UMD — React consumers always use a bundler.
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/react.tsx'),
      name: 'RecapReact',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'react.esm.js' : 'react.cjs.js'),
    },
    emptyOutDir: false, // Don't wipe the main build output
    rollupOptions: {
      // Mark './index.js' external so the main recap-ux code isn't bundled in.
      // The paths map rewrites it to 'recap-ux' in the output so consumers
      // resolve it correctly from the installed package.
      external: ['react', 'react-dom', './index.js'],
      output: {
        exports: 'named',
        paths: { './index.js': 'recap-ux' },
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'recap-ux': 'Recap',
        },
      },
    },
  },
});
