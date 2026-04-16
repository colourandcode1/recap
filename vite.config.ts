import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    // Dev server: serves examples/basic.html with the source loaded directly
    return {
      root: 'examples',
      // appType defaults to 'spa', which serves index.html as the fallback for
      // all unknown routes. This means Vite's full-page reload after a file
      // change won't 404 when the browser is on a pushState URL like /reports.
      server: { open: '/' },
      resolve: {
        alias: {
          // Map the CDN script reference to local source so changes hot-reload
          'recap-ux': resolve(__dirname, 'src/index.ts'),
        },
      },
    };
  }

  // Production library build
  return {
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'Recap',
        formats: ['umd', 'es', 'cjs'],
        fileName: (format) => {
          if (format === 'umd') return 'recap.min.js';
          if (format === 'es') return 'recap.esm.js';
          return 'recap.cjs.js';
        },
      },
      rollupOptions: {
        external: ['react', 'react-dom'],
        output: {
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM',
          },
          exports: 'named',
        },
      },
      minify: 'terser',
      target: 'es2020',
      reportCompressedSize: true,
    },
  };
});
