import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // Production (GitHub Pages) is served under /horse-game/, but in dev serve at
  // root so the Claude Code preview — which health-checks `/` — gets a 200
  // instead of a 302 redirect and actually attaches.
  base: command === 'serve' ? '/' : '/horse-game/',
  server: {
    host: true,
    // Preferred port, but don't fail if it's taken — Vite increments to the next
    // free port. Handy when several worktrees run `npm run dev` at once. The
    // helper scripts (smoke, sprites) auto-detect the actual port.
    port: 5173,
    strictPort: false,
    // Don't auto-open an external browser — the Claude Code preview attaches to
    // the server itself, and `open` just spawns an annoying extra Safari tab.
    open: false,
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
}));
