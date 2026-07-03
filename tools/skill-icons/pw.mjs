// Resolve a launchable Chromium. The pinned Playwright (1.61.1) expects a browser
// revision that may differ from the one pre-installed in this environment, so we
// point launch() at the on-disk Chromium under PLAYWRIGHT_BROWSERS_PATH when the
// default resolution would miss. Falls back to Playwright's own resolution.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function chromeExecutable() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  let best = null;
  for (const d of readdirSync(root)) {
    const m = /^chromium-(\d+)$/.exec(d);
    if (!m) continue;
    const exe = join(root, d, 'chrome-linux', 'chrome');
    if (existsSync(exe)) { const rev = +m[1]; if (!best || rev > best.rev) best = { rev, exe }; }
  }
  return best ? best.exe : undefined;
}

export async function launchChromium(chromium, opts = {}) {
  const executablePath = chromeExecutable();
  return chromium.launch(executablePath ? { executablePath, ...opts } : opts);
}
