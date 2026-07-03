import { describe, it, expect, vi } from 'vitest';
import {
  restHeaders,
  buildSubmitRequest,
  buildFetchUrl,
  buildRangeHeaders,
  createLeaderboardRepo,
} from '../../src/persistence/leaderboardRepo.js';

const CONFIG = { url: 'https://proj.supabase.co', key: 'anon-key' };

describe('restHeaders', () => {
  it('sets apikey, bearer auth and content-type', () => {
    expect(restHeaders('k')).toEqual({
      apikey: 'k',
      Authorization: 'Bearer k',
      'Content-Type': 'application/json',
    });
  });
  it('merges extras', () => {
    expect(restHeaders('k', { Prefer: 'x' }).Prefer).toBe('x');
  });
});

describe('buildSubmitRequest', () => {
  it('is a keepalive POST upsert with the entry as JSON body', () => {
    const entry = { name: 'Hero', max_floor: 12, hardcore: false };
    const req = buildSubmitRequest(CONFIG, entry);
    expect(req.url).toBe('https://proj.supabase.co/rest/v1/leaderboard?on_conflict=name,hardcore');
    expect(req.method).toBe('POST');
    expect(req.keepalive).toBe(true);
    expect(req.headers.Prefer).toBe('resolution=merge-duplicates,return=minimal');
    expect(req.headers.apikey).toBe('anon-key');
    expect(JSON.parse(req.body)).toEqual(entry);
  });
});

describe('buildFetchUrl', () => {
  it('encodes the sort column and the Standard/Hardcore ladder', () => {
    expect(buildFetchUrl(CONFIG, 'max_floor', false)).toBe(
      'https://proj.supabase.co/rest/v1/leaderboard?select=name,player_class,max_floor,level,gold,power,hardcore&hardcore=eq.false&order=max_floor.desc',
    );
    expect(buildFetchUrl(CONFIG, 'power', true)).toContain('hardcore=eq.true');
    expect(buildFetchUrl(CONFIG, 'power', true)).toContain('order=power.desc');
  });
});

describe('buildRangeHeaders', () => {
  it('produces a PostgREST items Range window', () => {
    const h = buildRangeHeaders(CONFIG, 0, 1000);
    expect(h['Range-Unit']).toBe('items');
    expect(h.Range).toBe('0-999');
    expect(buildRangeHeaders(CONFIG, 1000, 1000).Range).toBe('1000-1999');
  });
});

describe('createLeaderboardRepo (mocked fetch — never hits the backend)', () => {
  it('submit() upserts via the injected fetch', () => {
    const fetchImpl = vi.fn(() => Promise.resolve({ ok: true }));
    const repo = createLeaderboardRepo({ fetchImpl, ...CONFIG });
    const entry = { name: 'Hero', hardcore: true };
    repo.submit(entry);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toContain('/rest/v1/leaderboard?on_conflict=name,hardcore');
    expect(opts.method).toBe('POST');
    expect(opts.keepalive).toBe(true);
    expect(JSON.parse(opts.body)).toEqual(entry);
  });

  it('submit() never throws even if fetch rejects or throws', async () => {
    const rejecting = createLeaderboardRepo({ fetchImpl: () => Promise.reject(new Error('net')), ...CONFIG });
    await expect(Promise.resolve(rejecting.submit({}))).resolves.not.toThrow;
    const throwing = createLeaderboardRepo({ fetchImpl: () => { throw new Error('boom'); }, ...CONFIG });
    expect(() => throwing.submit({})).not.toThrow();
  });

  it('fetchBoard() returns a single short page in one request', async () => {
    const page = [{ name: 'A' }, { name: 'B' }];
    const fetchImpl = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(page) }));
    const repo = createLeaderboardRepo({ fetchImpl, ...CONFIG });
    const rows = await repo.fetchBoard('level', false, { pageSize: 1000 });
    expect(rows).toEqual(page);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1].headers.Range).toBe('0-999');
  });

  it('fetchBoard() pages until a short window and concatenates', async () => {
    const full = [{ n: 1 }, { n: 2 }];
    const tail = [{ n: 3 }];
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(full) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(tail) });
    const repo = createLeaderboardRepo({ fetchImpl, ...CONFIG });
    const rows = await repo.fetchBoard('gold', true, { pageSize: 2 });
    expect(rows).toEqual([...full, ...tail]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][1].headers.Range).toBe('2-3'); // second window
  });

  it('fetchBoard() throws on a non-OK response', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve({ ok: false, status: 503 }));
    const repo = createLeaderboardRepo({ fetchImpl, ...CONFIG });
    await expect(repo.fetchBoard('level', false)).rejects.toThrow('HTTP 503');
  });

  it('fetchBoard() arms and clears an abort timeout', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
    const setTimeoutImpl = vi.fn(() => 'timer-id');
    const clearTimeoutImpl = vi.fn();
    const repo = createLeaderboardRepo({
      fetchImpl, ...CONFIG, setTimeoutImpl, clearTimeoutImpl,
      AbortControllerImpl: class { abort() {} get signal() { return {}; } },
    });
    await repo.fetchBoard('level', false, { timeoutMs: 5000 });
    expect(setTimeoutImpl).toHaveBeenCalledWith(expect.any(Function), 5000);
    expect(clearTimeoutImpl).toHaveBeenCalledWith('timer-id');
  });
});
