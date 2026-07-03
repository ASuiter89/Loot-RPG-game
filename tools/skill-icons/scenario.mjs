// Thin client for the Scenario (scenario.gg) API used to generate skill-icon art.
// Credentials come from the environment — never hardcode them:
//   SCENARIO_SDK_API_KEY, SCENARIO_SDK_API_SECRET
import { writeFileSync } from 'node:fs';

const BASE = 'https://api.cloud.scenario.com/v1';
const MODEL = 'model_google-gemini-3-1-flash';

function auth() {
  const k = process.env.SCENARIO_SDK_API_KEY, s = process.env.SCENARIO_SDK_API_SECRET;
  if (!k || !s) throw new Error('Set SCENARIO_SDK_API_KEY and SCENARIO_SDK_API_SECRET in the environment');
  return 'Basic ' + Buffer.from(`${k}:${s}`).toString('base64');
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, { method = 'GET', body } = {}, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(BASE + path, {
        method,
        headers: { Authorization: auth(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
      return json;
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await sleep(1500 * 2 ** i);
    }
  }
  throw lastErr;
}

// Kick off a text->image generation. Returns the jobId.
export async function generate(prompt, opts = {}) {
  const body = {
    prompt,
    aspectRatio: '1:1',
    resolution: '512',
    useGoogleSearch: true,
    thinkingLevel: 'MINIMAL',
    ...opts,
  };
  const j = await api(`/generate/custom/${MODEL}`, { method: 'POST', body });
  const id = j.job?.jobId;
  if (!id) throw new Error('generate: no jobId in response');
  return id;
}

// Poll a job until it succeeds; returns its assetIds.
export async function waitJob(jobId, { timeoutMs = 180000, everyMs = 3000 } = {}) {
  const t0 = Date.now();
  for (;;) {
    const { job } = await api(`/jobs/${jobId}`);
    if (job.status === 'success') return job.metadata?.assetIds || [];
    if (job.status === 'failure') throw new Error(`job ${jobId} failed`);
    if (Date.now() - t0 > timeoutMs) throw new Error(`job ${jobId} timed out (${job.status})`);
    await sleep(everyMs);
  }
}

// Remove the background of an asset. The endpoint responds synchronously with the
// new (transparent) asset, including a temporary CDN url.
export async function removeBackground(assetId) {
  const j = await api('/generate/remove-background', { method: 'POST', body: { image: assetId } });
  const a = j.asset;
  if (!a?.url) throw new Error('remove-background: no asset url');
  return { assetId: a.id, url: a.url };
}

// Fetch an asset's current (temporary) CDN url.
export async function assetUrl(assetId) {
  const { asset } = await api(`/assets/${assetId}`);
  if (!asset?.url) throw new Error(`asset ${assetId}: no url`);
  return asset.url;
}

// Download binary content (follows the CDN redirect) to a file.
export async function download(url, filePath, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`download HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 100) throw new Error('download too small');
      writeFileSync(filePath, buf);
      return buf.length;
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await sleep(1500 * 2 ** i);
    }
  }
  throw lastErr;
}

// Full art step for one icon: generate -> wait -> remove background -> download
// the transparent PNG to `outPath`. Returns { assetId, bgId }.
export async function makeTransparentIcon(prompt, outPath) {
  const jobId = await generate(prompt);
  const assetIds = await waitJob(jobId);
  if (!assetIds.length) throw new Error('no asset produced');
  const { assetId: bgId, url } = await removeBackground(assetIds[0]);
  await download(url, outPath);
  return { assetId: assetIds[0], bgId };
}
