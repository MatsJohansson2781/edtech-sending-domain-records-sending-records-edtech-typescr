import { InfraiClient, publishSendingDomain, type SendingDomainInput } from "./publishing-workflow.ts";
import { z } from "zod";

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("Set INFRAI_API_KEY before publishing a domain");

const sendingDomainBody = z.object({
  domain: z.string().min(1),
  spfContent: z.string().min(1),
  dmarcContent: z.string().min(1),
  dkimName: z.string().min(1),
  dkimTarget: z.string().min(1)
});

const input = sendingDomainBody.parse({
  domain: process.env.SENDING_DOMAIN ?? "mail.example.edu",
  spfContent: process.env.SPF_CONTENT ?? "v=spf1 include:sender.example.net ~all",
  dmarcContent: process.env.DMARC_CONTENT ?? "v=DMARC1; p=none; rua=mailto:dmarc@example.edu",
  dkimName: process.env.DKIM_NAME ?? "selector1._domainkey.mail.example.edu",
  dkimTarget: process.env.DKIM_TARGET ?? "selector1.mail.example.net"
}) as SendingDomainInput;

const result = await publishSendingDomain(new InfraiClient(key), input);
console.log(JSON.stringify(result, null, 2));
