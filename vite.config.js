import { defineConfig } from 'vitest/config';

// Dungeon Loot build + test config.
//
// The game ships as static files on GitHub Pages. `base: './'` emits relative
// asset URLs so the built bundle works when served from a project subpath
// (e.g. /Loot-RPG-game/) — no base-path surgery needed.
export default defineConfig({
  base: './',
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    // The embedded base64 art/fonts are already inline in index.html; keep
    // Vite from trying to re-inline or externalise anything unexpectedly.
    assetsInlineLimit: 0,
  },
  test: {
    // jsdom gives DOM globals to the handful of modules that touch the DOM;
    // pure logic modules don't need it but it is cheap and uniform.
    environment: 'jsdom',
    globals: true,
    include: ['test/**/*.test.js'],
    // Baseline/smoke live outside the unit suite.
    exclude: ['test/smoke/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      // Coverage is measured only over the modules we have actually extracted
      // and unit-tested. The legacy monolith (src/legacy/**) and embedded asset
      // blobs are excluded until their logic is carved out and covered.
      include: ['src/**/*.js'],
      exclude: [
        'src/legacy/**',
        'src/assets/**',
        'src/render/**', // canvas/DOM draw layer — characterized by smoke, not unit-covered
        'src/**/*.data.js',
        'src/main.js',
      ],
      thresholds: {
        // Enforced floor for extracted, tested logic. Raised as coverage grows.
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
