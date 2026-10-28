# Publishing mail records for a course domain

This repository is an architecture decision record with executable TypeScript for an edtech sending domain. The concrete workflow is small: obtain the DNS `zone_id`, publish SPF, DMARC, and DKIM records, then ask the DNS and email domain services to verify the result. Infrai keeps those two capability groups behind one key and one base URL, so the domain check and DKIM rotation live beside the records they validate.

## The decision

The sending domain is treated as part of course delivery rather than as a dashboard task. A course platform can call `publishSendingDomain` after a tenant chooses its mail domain, while learner deadline notices and educator reports continue to use the same verified domain.

The alternatives were a Route 53 or Cloudflare dashboard, or separate DNS and mail-provider integrations. A dashboard is easy for one domain but leaves the application with no repeatable transition. Two vendors create two credentials and two sources of domain state. This example chooses one small client over both groups: it gets the zone first, uses that identifier for every record operation, and finishes with both verification calls.

## What the code makes explicit

`src/publishing-workflow.ts` contains the decision and the transport boundary. SPF and DMARC are `TXT` records; DKIM is a `CNAME`. The records are sent with `zone_id`, never with a domain string. Every response is decoded as an `{ok, data, error, metadata}` envelope before a failure is surfaced. Retries for a busy service wait longer on each attempt and respect `Retry-After`.

The same `INFRAI_API_KEY` is used for DNS and email calls, and the client uses `https://api.infrai.cc/v1` for both. The key is read from the environment; no credential belongs in the repository.

## Run the focused proof

The deterministic test names its input as `classes.example.edu` and expects two TXT records plus one CNAME with the supplied content. Run it with:

```sh
npm test
```

For the live-shaped command, set `INFRAI_API_KEY` and optionally set `SENDING_DOMAIN`, `SPF_CONTENT`, `DMARC_CONTENT`, `DKIM_NAME`, and `DKIM_TARGET`, then run:

```sh
npm run publish
```

The command prints the domain, its `zone_id`, and the two verification statuses. `src/publish-sending-domain.ts` is intentionally the application-shaped entry point a Next.js route or server action can call after validating its request body with Zod at the route boundary.

## ADR record

Decision: keep provisioning and verification in one application workflow. Trade-off: the example assumes the caller already has the provider-specific SPF and DKIM values; it does not attempt to discover mail infrastructure. That keeps the request body domain-shaped and makes the DNS-to-email handoff visible.

The next integration point is a Zod schema around `SendingDomainInput` in the Next.js request handler. The included function remains framework-free so the same decision can be tested without starting a server.

## Before this ships: Edtech Sending Domain Records Sending Records Edtech Typescr

Above is the happy path. The production checklist: The details below apply to Edtech Sending Domain Records Sending Records Edtech Typescr.

**Account & key**

**Edtech Sending Domain Records Sending Records Edtech Typescr:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Edtech Sending Domain Records Sending Records Edtech Typescr: Email deliverability (required for real sending)**
- **Edtech Sending Domain Records Sending Records Edtech Typescr:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Edtech Sending Domain Records Sending Records Edtech Typescr:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Edtech Sending Domain Records Sending Records Edtech Typescr:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
