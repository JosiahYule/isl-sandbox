# Website enquiry measurement

The website separates employer enquiries from candidate activity. A form preview is never a lead. A completed application is not inferred from an outbound application click.

## Events

| Event | Trigger | Audience |
| --- | --- | --- |
| `employer_cta_click` | Open the internal hiring form; placement identifies header, homepage or mobile menu | Employer |
| `form_start` | First interaction with the talent request | Employer |
| `form_submit` | A valid request is sent to the configured delivery endpoint | Employer |
| `generate_lead` | The delivery endpoint acknowledges the request after the email provider accepts it | Employer |
| `form_error` | Validation or delivery failure, without field contents | Employer |
| `form_preview` | A valid request in the sandbox with no delivery endpoint | Employer |
| `job_view` | View an individual vacancy | Candidate |
| `job_search` | Search/filter results, without the free-text query | Candidate |
| `apply_click` | Open a specific application or general resume submission | Candidate |
| `phone_click`, `email_click` | Contact action, without the phone number or address | Page context |

The delivery endpoint preserves `lead_id`, service, province, first campaign and latest non-direct campaign in the recruiter's email. Contact fields remain in that private notification. Campaign context is bounded and allowlisted; arbitrary URL queries and form answers are excluded from analytics. Google receives a cleaned page URL, without the form's `details` parameter or the job search query.

Source information can persist for the current browser tab. A later direct/internal visit does not replace the campaign that brought the visitor in. An explicit analytics refusal clears campaign storage; internal links carry campaign tags instead. No Google script or measurement requests start before acceptance. The Privacy page has a control for changing the choice when analytics is configured.

## Activate production collection

Set these repository **Actions variables**, then rebuild. Empty values retain the sandbox's existing off/demo behaviour. Per-brand settings keep the three sites independent.

| Brand | GA4 variable | Form endpoint variable |
| --- | --- | --- |
| Integrated Staffing | `ISL_GA4_ID` | `ISL_REQUEST_ENDPOINT` |
| Accountant Staffing | `AS_GA4_ID` | `AS_REQUEST_ENDPOINT` |
| Administrative Staffing | `ADS_GA4_ID` | `ADS_REQUEST_ENDPOINT` |

The GA4 value is the actual `G-...` Web stream measurement ID. Use a separate test property if measuring the sandbox. Do not send preview traffic to the production property. The corresponding local build variables are `PUBLIC_ISL_GA4_ID`, `PUBLIC_ISL_REQUEST_ENDPOINT`, and equivalent AS/ADS names. Existing values in the brand configuration still work as a fallback.

Deploy the updated `assistant/supabase/functions/isl-request/index.ts` before enabling its ISL endpoint. Its Resend credentials and sender remain server-side secrets, configured as described in `assistant/README.md`. This change does not provision or deploy an external service. AS and ADS need their own correctly routed delivery endpoint; do not point them at the ISL-only recruiter handler.

In GA4:

1. Validate events in a test stream's DebugView/Realtime and check the production stream after activation.
2. Mark `generate_lead`, `qualify_lead` and `close_convert_lead` as the appropriate employer key events. Keep candidate `apply_click` separate from these totals.
3. Register event-scoped dimensions for `brand`, `audience`, `service`, `province`, `cta_placement` and `application_kind` where useful.
4. Keep the high-cardinality `lead_id` as a record/export join key, rather than a general reporting dimension.
5. Review Enhanced Measurement's form events so automatic events are not mistaken for this confirmed employer funnel. Configure cross-domain application measurement with the ATS before reporting completed applications.

## Connect recruiter outcomes

Use the enquiry's opaque lead reference in the CRM or recruiter log. Record actual stages, rather than inferring qualification from a website action:

| Recruiter stage | Event |
| --- | --- |
| Confirmed suitable requirement | `qualify_lead` |
| Recruiter contacted prospect | `working_lead` |
| Proposal sent | `proposal_sent` |
| Placement/client conversion confirmed | `close_convert_lead` |
| Opportunity lost | `close_unconvert_lead` |
| Not a suitable employer requirement | `disqualify_lead` |

For visitors who accepted analytics, the enquiry can include the original GA4 client ID and consent marker. If Google is blocked or the visitor declines, these fields are absent; keep the enquiry in the CRM and do not manufacture an analytics identity.

`scripts/lead-outcomes.mjs` provides a trusted-side bridge for recruiter-confirmed stages. Export a JSON array using this shape (the identifiers below are examples):

```json
[{
  "lead_id": "lead_12345678-1234-4234-8234-123456789abc",
  "stage": "qualified",
  "brand": "isl",
  "service": "direct",
  "measurement": { "consent": "granted", "client_id": "123.456" }
}]
```

Run `npm run lead-outcomes -- outcomes.json` to inspect the contact-free payload without transmitting it. With real records, set `GA4_MEASUREMENT_ID` and `GA4_API_SECRET` in a trusted environment, then use `--validate` against Google's validation endpoint before `--send`. The API secret must never be a public build variable or enter browser code. No outcome import has been sent as part of this website change.

Run the import when a stage changes; events are recorded at import time. Import each lead/stage once and keep your CRM export/import log to prevent repeat submissions. Duplicate stages in one input file are rejected. A 2xx collection response confirms HTTP receipt, so verify processing in GA4. Automatic CRM export/synchronisation still requires the CRM connection and a defined source for recruiter-confirmed outcomes.

Official references: [GA4 lead events](https://developers.google.com/analytics/devguides/collection/ga4/reference/events), [Measurement Protocol](https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events), [Resend retry protection](https://resend.com/changelog/idempotency-keys).
