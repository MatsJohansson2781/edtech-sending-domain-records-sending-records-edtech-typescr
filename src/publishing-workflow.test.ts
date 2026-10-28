import test from "node:test";
import assert from "node:assert/strict";
import { recordsForSendingDomain, type SendingDomainInput } from "./publishing-workflow.ts";

test("course-mail domain plan keeps SPF and DMARC as TXT and DKIM as CNAME", () => {
  const input: SendingDomainInput = {
    domain: "classes.example.edu",
    spfContent: "v=spf1 include:sender.example.net ~all",
    dmarcContent: "v=DMARC1; p=quarantine",
    dkimName: "selector1._domainkey.classes.example.edu",
    dkimTarget: "selector1.mail.example.net"
  };
  assert.deepEqual(recordsForSendingDomain(input), [
    { record_type: "TXT", name: "classes.example.edu", content: input.spfContent },
    { record_type: "TXT", name: "_dmarc.classes.example.edu", content: input.dmarcContent },
    { record_type: "CNAME", name: input.dkimName, content: input.dkimTarget }
  ]);
});
