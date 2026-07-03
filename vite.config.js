import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

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
    assetsInlineLimit: 0,
    // Tree-shaking disabled: Rollup's tree-shake/link phase hangs indefinitely on this
    // project's module graph (the ~125-module paddock/species/data web the game grew into).
    // It's a safe disable — tree-shaking only *removes* unused exports, so keeping them all
    // can't change behavior, and a Phaser game whose code is all reachable (Phaser itself is
    // a bundled monolith) gets negligible size benefit from it. Root cause tracked separately.
    rollupOptions: { treeshake: false }
  },
  plugins: [
    // Installable PWA (#37): manifest for the icon/name/splash + standalone launch,
    // and a generated service worker for offline play. Only active in the production
    // build (devOptions.enabled defaults to false), so it doesn't interfere with the
    // dev server / Claude Code preview. Icons are pre-rendered PNGs under
    // public/icons/ (scripts/gen-pwa-icons.mjs) since the game's actual art is
    // generated at runtime — a manifest needs static files to point at.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Villa Cura',
        short_name: 'Villa Cura',
        description: 'A cozy pixel-art horse care game',
        theme_color: '#1c2330',
        background_color: '#1c2330',
        display: 'standalone',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-1024.png', sizes: '1024x1024', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // No runtime asset caching needed — sprites/audio are procedurally generated
        // at runtime, not fetched files. Precaching the built JS/HTML/icon shell is
        // enough for the whole game to boot and run with no connection.
        globPatterns: ['**/*.{js,css,html,png,ico,svg}'],
      },
    }),
  ],
}));
