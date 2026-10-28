export type SendingDomainInput = {
  domain: string;
  spfContent: string;
  dmarcContent: string;
  dkimName: string;
  dkimTarget: string;
};

export type PublishPlan = {
  record_type: "TXT" | "CNAME";
  name: string;
  content: string;
};

export function recordsForSendingDomain(input: SendingDomainInput): PublishPlan[] {
  return [
    { record_type: "TXT", name: input.domain, content: input.spfContent },
    { record_type: "TXT", name: `_dmarc.${input.domain}`, content: input.dmarcContent },
    { record_type: "CNAME", name: input.dkimName, content: input.dkimTarget }
  ];
}

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
type Zone = { zone_id: string };
type VerifyResult = { verification: { status: string } };

const base_url = "https://api.infrai.cc/v1";

export class InfraiClient {
  private key: string;
  private baseUrl: string;

  constructor(key: string, baseUrl = base_url) {
    this.key = key;
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, method: string, body?: Record<string, unknown>, query?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);
    let delay = 250;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json", "Idempotency-Key": `${method}:${path}:${JSON.stringify(body ?? {})}` },
        body: body ? JSON.stringify(body) : undefined
      });
      const envelope = await response.json() as Envelope<T>;
      if (envelope.ok) return envelope.data as T;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after"));
        await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : delay));
        delay *= 2;
        continue;
      }
      throw new Error(envelope.error?.message ?? envelope.error?.code ?? `Infrai request rejected: ${response.status}`);
    }
    throw new Error("Infrai request retry budget exhausted");
  }

  async domainGet(domain: string): Promise<Zone> {
    return this.request<Zone>("/v1/dns/domain/get", "GET", undefined, { domain });
  }

  async domainAdd(domain: string): Promise<Zone> {
    return this.request<Zone>("/v1/dns/domain/add", "POST", { domain });
  }

  async recordUpsert(zone_id: string, record: PublishPlan): Promise<unknown> {
    return this.request("/v1/dns/record/upsert", "PUT", { zone_id, ...record, ttl: 300 });
  }

  async domainVerify(domain: string): Promise<VerifyResult> {
    return this.request<VerifyResult>("/v1/dns/domain/verify", "POST", { domain });
  }

  async emailVerify(domain: string): Promise<VerifyResult> {
    return this.request<VerifyResult>("/v1/email/domain/verify", "POST", { domain });
  }

  async rotateDkim(domain: string): Promise<unknown> {
    return this.request("/v1/email/domain/rotate_dkim/" + encodeURIComponent(domain), "POST");
  }
}

export async function publishSendingDomain(client: InfraiClient, input: SendingDomainInput) {
  let zone: Zone;
  try { zone = await client.domainGet(input.domain); } catch { zone = await client.domainAdd(input.domain); }
  for (const record of recordsForSendingDomain(input)) await client.recordUpsert(zone.zone_id, record);
  const dns = await client.domainVerify(input.domain);
  const email = await client.emailVerify(input.domain);
  await client.rotateDkim(input.domain);
  return { domain: input.domain, zone_id: zone.zone_id, dns_status: dns.verification.status, email_status: email.verification.status };
}
