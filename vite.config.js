import { defineConfig } from 'vite';

export default defineConfig({
  base: '/horse-game/',
  server: {
    port: 5173,
    open: true,
    watch: {
      // OneDrive constantly touches files during sync, which triggers endless
      // reloads. Ignore its temp/lock files and limit what Vite watches.
      ignored: ['**/.~lock*', '**/*.tmp', '**/~$*', '**/desktop.ini'],
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }
    }
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0
  }
});
