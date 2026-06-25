// Resolve the URL of a running horse-game dev server.
//
// Vite auto-increments the port when 5173 is busy, which is normal when several
// worktrees each run their own dev server / Claude Code preview at once. Since
// EVERY worktree serves "the horse game", a naive port scan can't tell them apart
// and would attach to whichever worktree happens to sit on the lowest port — so
// verifying from worktree B could silently test worktree A's code.
//
// To stay correct under that workflow we first look for the Vite process whose
// working directory IS this worktree (process.cwd()) and use ITS port. Only if
// that fails (e.g. server started elsewhere) do we fall back to the port scan.
// Override everything with SMOKE_URL.

import { execSync } from 'node:child_process';

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

// The listening port of the Vite dev server whose process cwd is THIS worktree, or
// null. Uses lsof (present on macOS/Linux); any failure just returns null so the
// caller falls back to the port scan. Best-effort and side-effect free.
function ownWorktreePort() {
  try {
    const cwd = process.cwd();
    const pids = execSync('pgrep -f "node_modules/.bin/vite"', { encoding: 'utf8' })
      .split('\n').map((s) => s.trim()).filter(Boolean);
    for (const pid of pids) {
      // Process working directory (the worktree it was launched from).
      let pcwd = '';
      try {
        pcwd = execSync(`lsof -a -d cwd -p ${pid} -Fn`, { encoding: 'utf8' })
          .split('\n').find((l) => l.startsWith('n'))?.slice(1) ?? '';
      } catch { /* ignore */ }
      if (pcwd !== cwd) continue;
      // The TCP port this PID is listening on.
      const out = execSync(`lsof -a -p ${pid} -iTCP -sTCP:LISTEN -P -n -Fn`, { encoding: 'utf8' });
      const m = out.match(/n.*:(\d+)\s*$/m);
      if (m) return Number(m[1]);
    }
  } catch { /* lsof/pgrep unavailable — fall back */ }
  return null;
}

export async function resolveDevServerUrl() {
  if (process.env.SMOKE_URL) return process.env.SMOKE_URL;

  // Prefer the server that belongs to THIS worktree, so multi-worktree setups each
  // verify their own running code regardless of which port they landed on.
  const ownPort = ownWorktreePort();
  if (ownPort) {
    for (const path of PATHS) {
      const url = `http://localhost:${ownPort}${path}`;
      if (await servesGame(url)) return url;
    }
  }

  // Fallback: probe the usual Vite range and return the first server serving the game.
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
