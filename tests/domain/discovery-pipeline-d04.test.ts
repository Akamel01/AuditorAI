/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from 'vitest';
import { runDiscoveryPipeline } from '@/discovery/pipeline';
import type { DiscoveryProvider, FetchResult, DiscoverQuery } from '@/discovery/providers/provider-types';
import type { DiscoveryHit } from '@/discovery/types';

let providerFetchCalled = false;

class SeedPortalProvider implements DiscoveryProvider {
  id = 'seed-portals';
  source_type = 'institutional-repo' as const;
  async discover(_query: DiscoverQuery) {
    const hit: DiscoveryHit = {
      hit_id: 'hit-seed',
      url: 'http://seed/road-safety-audit-stage-1-report.pdf',
      source_type: 'institutional-repo',
      provider_id: this.id,
      portal_id: null,
      discovered_at: new Date().toISOString(),
      licence_hint: 'unknown',
      http_status: null,
      sha256_hint: null,
      title_hint: 'Seed road safety audit stage 1 preliminary design report',
      jurisdiction_guess: 'UK' as any,
    } as any;
    (hit as any).scheme_hint = 'stage 1 preliminary design';
    return [hit];
  }
  async fetch(_url: string, _fetchImpl?: typeof fetch): Promise<FetchResult> {
    providerFetchCalled = true;
    throw new Error('offline');
  }
}

describe('discovery pipeline d04 (live fallback per-hit provider.fetch)', () => {
  beforeEach(() => {
    providerFetchCalled = false;
    // Mock global fetch used by legacy fallback path
    (globalThis as any).fetch = async (_url: string, _init?: any) => {
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new TextEncoder().encode('%PDF-1.4 fake').buffer,
        headers: {
          get: (_k: string) => 'application/pdf',
        },
      } as any;
    };
  });

  it('calls provider.fetch for the seed portal hit and falls back to legacy fetch yielding docs', async () => {
    const ctx = {
      ranAtIso: new Date().toISOString(),
      query: { jurisdictions: ['UK'], themes: ['"road safety audit"'] } as any,
      providers: [new SeedPortalProvider()],
      acquireDocs: undefined,
    } as any;

    const result = await runDiscoveryPipeline(ctx);
    // provider.fetch attempted first (offline) then legacy fallback acquired docs
    expect(providerFetchCalled).toBe(true);
    expect(result.state.acquired && result.state.acquired.length).toBeGreaterThan(0);
    expect(result).toBeDefined();
  });
});
