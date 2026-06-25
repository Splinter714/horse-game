// Resolve the URL of a running horse-game dev server.
//
// Vite auto-increments the port when 5173 is busy (common when several worktrees
// run `npm run dev` at once), so the helper scripts can't assume a fixed port.
// This probes the usual Vite range and returns the first port actually serving
// this game. Override entirely with SMOKE_URL.

// Dev serves at root (base '/'); a built/previewed app serves under /horse-game/.
// Try both so the scripts work either way.
const PATHS = ['/?canvas', '/horse-game/?canvas'];

// Vite starts at 5173 and counts up from there when ports are taken.
const PORTS = Array.from({ length: 20 }, (_, i) => 5173 + i);

// Confirm a URL is serving *this* game (not some other Vite app on the same port).
async function servesGame(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(800) });
    if (!res.ok) return false;
    const html = await res.text();
    return html.includes('horse-game') || html.includes('main.js');
  } catch {
    return false;
  }
}

export async function resolveDevServerUrl() {
  if (process.env.SMOKE_URL) return process.env.SMOKE_URL;

  for (const port of PORTS) {
    for (const path of PATHS) {
      const url = `http://localhost:${port}${path}`;
      if (await servesGame(url)) return url;
    }
  }

  throw new Error(
    `No horse-game dev server found on ports ${PORTS[0]}-${PORTS.at(-1)}. ` +
      'Start one with `npm run dev`, or set SMOKE_URL.'
  );
}
