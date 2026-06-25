import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // Production (GitHub Pages) is served under /horse-game/, but in dev serve at
  // root so the Claude Code preview — which health-checks `/` — gets a 200
  // instead of a 302 redirect and actually attaches.
  base: command === 'serve' ? '/' : '/horse-game/',
  server: {
    host: true,
    // Honour the PORT env var the Claude Code preview assigns (its autoPort) so Vite
    // binds to the SAME port the preview then navigates to. By default Vite IGNORES
    // PORT and stays on 5173, so the preview opens a port nothing is serving (it was
    // navigating to an ephemeral port like 63863) → blank pane. When PORT is set we
    // bind exactly there (strictPort) so preview target and Vite agree; otherwise
    // fall back to 5173 and let Vite increment — handy for plain `npm run dev` across
    // worktrees (the smoke/sprites helpers auto-detect the actual port).
    port: Number(process.env.PORT) || 5173,
    strictPort: !!process.env.PORT,
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
