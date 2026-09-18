import { assertOwnershipForInfraMutation, type OwnershipProbe } from './infra-mutation-guard';

export interface CloudflareDnsRecord {
  id: string;
  name: string;
  type: string;
  content: string;
  proxied: boolean;
}

export interface CloudflareDnsServiceOptions {
  apiToken?: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  /** Injectable for tests. Defaults to a real TaskOwnershipService probe. */
  probeOwnership?: OwnershipProbe;
}

/**
 * Minimal Cloudflare DNS client for this project's zone(s).
 *
 * No prior checked-in code called the Cloudflare API (confirmed by grepping
 * the repo for CLOUDFLARE_DNS_API_TOKEN / api.cloudflare.com / dns_records
 * during the #1453/#1455 investigation, 2026-09-18) -- the original DNS
 * cutover to Render was made ad hoc, outside any reusable, gated path. This
 * is that reusable path going forward.
 *
 * Every mutating call requires a taskRef and is refused
 * (InfraMutationBlockedError, thrown before any network request) when task
 * ownership resolves to `unknown_stop` -- see infra-mutation-guard.ts and
 * .agents/memory/task-ownership-guard-scope.md for why this exists.
 * Read-only calls are not gated; they carry no external-state risk.
 */
export class CloudflareDnsService {
  private readonly apiToken: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly probeOwnership: OwnershipProbe | undefined;

  constructor(options: CloudflareDnsServiceOptions = {}) {
    const token = options.apiToken ?? process.env.CLOUDFLARE_DNS_API_TOKEN;
    if (!token) throw new Error('CLOUDFLARE_DNS_API_TOKEN is not set.');
    this.apiToken = token;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? 'https://api.cloudflare.com/client/v4';
    this.probeOwnership = options.probeOwnership;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.apiToken}`,
        'content-type': 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
    const body = (await res.json()) as { success: boolean; result: T; errors?: unknown[] };
    if (!res.ok || !body?.success) {
      throw new Error(`Cloudflare API error (${res.status}): ${JSON.stringify(body?.errors ?? body)}`);
    }
    return body.result;
  }

  /** Read-only. Not gated by task ownership -- listing records mutates nothing. */
  async listDnsRecords(zoneId: string): Promise<CloudflareDnsRecord[]> {
    return this.request<CloudflareDnsRecord[]>(`/zones/${zoneId}/dns_records?per_page=100`);
  }

  /**
   * Mutates a DNS record's target (e.g. a production cutover). Requires
   * taskRef so the ownership guard can run first; throws
   * InfraMutationBlockedError instead of calling Cloudflare when ownership
   * cannot be proven for that task.
   */
  async updateDnsRecordContent(
    taskRef: string,
    zoneId: string,
    recordId: string,
    content: string,
  ): Promise<CloudflareDnsRecord> {
    await assertOwnershipForInfraMutation(
      taskRef,
      `cloudflare:update_dns_record:${recordId}`,
      this.probeOwnership,
    );
    return this.request<CloudflareDnsRecord>(`/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    });
  }
}
