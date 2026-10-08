# Affiliate program — implementation progress

## Phase 1 — links and dated statistics (2026-10-07)
Completed locally; TypeScript, production build, seven isolated backend tests, migration consistency and HTTP health passed:
- Own affiliate dashboard at /affiliate; administrator profile view at /studio/affiliates/:userId.
- Editable unique short links /gogi; reserved application routes; old aliases retained and cannot be claimed by others.
- Campaign labels; daily deduplicated arrivals, distinct browser sessions, registrations, existing confirmed purchase rewards and tokens.
- 7/30/90-day charts with accessible data tables. Server-generated dates and purchase data.
- Existing UUID links retained; first eligible referral wins within existing attribution window. Logged-in visits ignored.
- Link changes recorded with administrator/user actor and timestamp.
- No user media, captions, keystrokes or query contents collected.

## Business rules — confirmed 2026-10-07
- User explicitly rejected a rewards program: results are tracked; agreements with affiliates are handled directly outside the application.
- No automatic token bonuses for purchases or caption generation; existing historical token ledger/balances retained.
- Legacy AffiliateReward table remains as the idempotent record of confirmed referred purchases, with zero tokens for new rows. No cash payout workflow.
- Active affiliate plus paid subscription eligibility is unchanged from the previous system.
- Analytics counts browser sessions, not verified people. Original historical aggregate visits are not backfilled as dated events.

## Phase 2 — product analytics (implemented locally, 2026-10-07)
- Opt-in choice, editable in Options. No events before consent; administrators excluded in client and server.
- Memory-only queue, batches of 40, 5-second delay, bounded retry queue; hidden-page flush. No per-frame or pointer tracking.
- Server validates event names, page/section enums and style-key format, rejects extra fields, deduplicates UUIDs and limits traffic.
- Admin /studio/analytics: 7/30/90-day activity charts, campaign filter, styles table, exposure-normalized selection among exposed browsers, page/section usage and operation/error counts.
- Shared style shelf: 50% visibility for 600ms, selections/replacements, card palette choices. No search strings or preset names collected.
- Subtitle editor: file selection, recognition start/success/error/cancel; both editors export prepared/error; project saving signals.
- Server-only upload/save/transcription completion events cannot be submitted via public event collector. Backend opt-in uses request header; analytics errors never fail media/save operations.
- Export completion remains browser-reported (local renderer); it means prepared/download offered, not verified file on disk. Styles are inferred from configured caption segments, not raster inspection.
- Visitor identifier is random session UUID. Authenticated user reference permits future review; no raw IP, filenames, URLs, media or caption text stored.
- Affiliate/campaign attribution is obtained server-side. Analytics never award tokens or money.
- 90-day dashboard window; bounded deletion of up to 5,000 older events hourly during ingestion. No invented historical data.
- Tests: 14 isolated analytics/affiliate tests passed; frontend TypeScript, production build, migration consistency and local HTTP health passed.

### Analytics follow-ups (not claimed complete)
- Additional video editor recognition/upload controls and every palette/settings surface, as needed after initial data.
- Cohort retention, unique project funnels and explicit setting-change taxonomy (current operation cards are counts, not conversion funnels).
- Dedicated scheduled cleanup if idle deployments must purge on a fixed deadline; currently cleanup is ingestion-triggered.
- Consent/privacy copy review before public rollout; opt-in currently controls product analytics, not existing affiliate attribution or operational diagnostics.

## Phase 3 — admin review and corrections (implemented locally)
- Pending corrections per affiliate, date, campaign and metric (visits/registrations/purchases), with mandatory reason.
- Staff-only approve/reject/reverse; row locks, expected-status conflict checking and idempotent request IDs.
- Approved changes apply consistently to totals, daily charts, campaign totals and the 30-day admin summary. Distinct browser counts are not manually adjusted.
- Original events retained; reject changes that would produce negative adjusted daily/campaign totals.
- Private audit records actor, timestamp, reason, transition and before/after values. Affiliate API omits audit/raw counts and prior link aliases, not merely hides them in UI.
- Affiliates see current link and adjusted results. Existing aliases continue to work.
- No rewards, commissions or payouts implemented; former bonus issuance disabled without reversing old balances.
- Added production SPA routes for affiliate/admin dashboards and validated short-link landing routes.
- Validation: 27 targeted affiliate/review/social compatibility tests passed; TypeScript, production build and restarted local backend health passed.

## Phase 4 — pilot launch
- Onboarding invitations and promotional materials for initial partners.
- Explicit production publication request, rollout monitoring and reconciliation.
- Validate with pilot group before expanding to ~50 partners.


## Phase 4a — local pilot account, feedback and user history (2026-10-07)
- Local test_affiliate, non-admin, separate workspace, approved access, Partner quota for 30 days, /test-affiliate link. Creation command refuses existing accounts/links and non-DEBUG/non-SQLite databases. No synthetic traffic or purchase records.
- /krediti: tabs for operations, recorded transfers and feedback, paginated in sets of 25. Operation states distinguish reserved/completed/refunded. Existing token ledger retained.
- Feedback is authenticated, length/category validated, capped at ten submissions/hour and retry-safe by UUID. Own API excludes other users and reviewer identities.
- /studio: feedback inbox with new/reviewing/resolved status, staff-only endpoints. This explicitly submitted feedback is independent of optional product analytics consent.
- Four isolated tests cover ownership, retries, staff permission, pagination, input/rate checks and session CSRF. TypeScript and production build passed; migration 0016 applied locally. No live publication.

## Next requested implementation slices — not completed
1. Provider operation ledger: actual measured ElevenLabs quantities per operation/user, timestamps, success/failure/retries; distinguish provider-confirmed units from estimates and Edita tokens. Cloudflare object operations/bytes and provider account totals need separate instrumentation/reconciliation. Current resources endpoint is account subscription usage and storage size, not today's bill.
2. Admin day/hour charts, peak drilldown by user/function, operational diagnosis and user-facing own daily consumption charts. Test traffic must be marked/excluded before public pilot.
3. Consent-aware presence heartbeat with expiry, visible/active/idle distinctions, dedup across tabs, current page/section and affiliate/campaign attribution; distinguish reading/editor-open from actual editing. No claim of complete tracking or inferred exact reading.
4. Visitor sources/campaigns and aggregate funnel charts, additional settings/function event coverage. Do not collect raw user media/caption text or sensitive URL parameters.
5. Pilot release, privacy copy review, retention/scheduled cleanup and monitoring, then expand to ~50 partners.


## Phase 4b — observed provider usage and peak drilldown (2026-10-07, local)
- ProviderUsage records attempts, including failures/retries, authenticated account or guest, staff/local-test flags, input chars/decoded audio seconds/bytes, received audio bytes, HTTP status, elapsed time and operation UUID. No captions, filenames, signed URLs, API keys or provider response content.
- Instrumented: proxy transcription (actual WAV duration), narration, voice change, cleanup, admin direct-transcription token issuance, multipart start/parts/completion/object checks and ordinary asset upload. A failed call can still incur upstream charges; no billing inference made from HTTP status.
- Fail-open recording uses savepoints; logging errors do not cancel operations. Process termination can leave pending records, explicitly labeled as unfinished/unknown.
- /studio: expandable provider section with date/provider filters, 24 hourly buckets, metric switch (calls/audio seconds/chars/bytes), click-hour and click-user drilldown, grouped actions, top 100 users, and 25-row attempt pagination. Defaults exclude staff/local test; opt-in internal display available.
- /krediti: own report, enforced server-side even if another user ID is supplied. Admin report denies ordinary users. Guests/deleted accounts are combined, not individually identifiable.
- Uses Europe/Sarajevo calendar dates; hour filters retain full-day chart context. Existing resource endpoint remains account snapshot, not a financial invoice. Nothing backfilled.
- Boundaries: not provider-confirmed spend, input bytes reflect attempted payload not verified wire bytes; not all R2 operations. Excludes direct object downloads, SDK internal retries, background deletion/repair/storage listing and other external callers. Direct admin browser transcription only records token issuance, not duration/outcome of downstream browser call. Test flag currently dedicated local DEBUG account only.
- 25 isolated provider/billing tests passed including retry/errors, HTTP status, ownership, staff permission, test exclusion, pagination, local date boundary, fail-open logging, streamed byte counts and transcription input duration. TypeScript and production build passed. Local migration 0017 applied; no external provider calls or user projects used for tests.
- Next: optional provider billing reconciliation and missing operation coverage; consent-aware real-time presence with expiry and origin/page/activity breakdown remains unimplemented. Keep financial totals distinct from measured workloads.


## Phase 4c — current presence and acquisition source (2026-10-07, local)
- Opt-in only, extends existing analytics preference text. Client sends coarse page/section/source, visibility and recent interaction boolean every 30 seconds; early updates on visibility, section or return from idle are bounded. No pointer trails, pressed keys, scroll positions, text, media or referrer URLs sent.
- Visible sessions expire after 90 seconds without heartbeat. Hidden/unloaded/opted-out tabs send a higher-sequence tombstone; stale reordered packets cannot reopen the same tab. Offline/unload delivery remains best effort; expiry handles it.
- Recent interaction = click/key/scroll within 60 seconds at the last heartbeat, not proof of edits or reading. Editor-open and editor-active are separate, clearly labeled. Multiple visible tabs deduplicate by random server session visitor ID, favor active/latest tab. Multiple browser profiles/devices remain separate sessions.
- Entry-source buckets (direct/unknown, Google, Bing, Instagram, Facebook, TikTok, YouTube, LinkedIn, other) are browser-reported and first-source stable per session. No raw host, IP, geolocation or URL storage. Referrers can be absent or inaccurate.
- Attribution derived from registered referral or unexpired session affiliate attribution, never from posted affiliate/user IDs. Snapshot uses current visible sessions only, not historical unique-visitor counts.
- /studio/affiliates and /studio/analytics: current counts, source/page/campaign bars, sections, admin-only recent session details (up to100), affiliate totals. Staff excluded; dedicated local test optionally included. /affiliate: own-attributed aggregate only, no usernames/session IDs. Admin affiliate detail can filter to one affiliate.
- Polling every15 seconds only while dashboard visible, failed refresh labeled stale. Heartbeat rate limit60/min/session and128 retained tabs/session; narrow payload validation/CSRF. Bounded cleanup of records older24h during ingestion, at most5000 per5minutes; idle databases retain expired rows until subsequent ingestion. Expired rows never count as present.
- Seven isolated presence tests and seven product analytics tests passed: validation, consent, CSRF, permissions, attribution expiry/registered referral, tab dedup/order/visibility, source stability, rate/tab limits, internal exclusion and cleanup. TypeScript, production build and migration consistency passed; 0018 applied locally and backend restarted. No real projects or fabricated live metrics used.
- Next unimplemented items: historical acquisition/funnel reporting, trusted provider billing reconciliation/remaining provider operations, scheduled retention tasks, pilot rollout/privacy review and cross-device identity policy. No claim of comprehensive surveillance or exact people counts.


## Free affiliate pilot — 2026-10-07
Approved active affiliates have free feature access independent of paid subscription. All signed-in users can apply at /affiliate with a motivation message. Admins review /studio/affiliates; notes are private. Affiliates request tokens with a purpose and admins approve a chosen amount, or reject. No automatic monthly allotment, commission or purchase is created. Each approved token request has a unique ledger reference and is applied atomically once. Grants follow an existing active credit period; expired balances are discarded before a new non-expiring free period (blocked during reserved work). Suspending the affiliate role removes complimentary feature access but preserves history.

Applications now require first name, last name, phone, email and message. Contact details are exposed only to admin review. Menu access appears only after approval. Public catalogue: Free, Affiliate application, Basic USD20/100, Advanced USD30/200. Stripe remains sandbox-only; Advanced price is local environment configuration.

## Account controls and operations, 2026-10-07
Admin tabs separate users, errors, provider usage, product/style analytics, affiliates, feedback, email delivery and sandbox invoices. Additive grants and per-user upload/download limits follow the current token period, with private audit and unique request references; limits apply to new transfers. Browser-rendered exports are enforced through the normal application download path, not DRM against modified clients.
Affiliates choose coupon names; admins own 0/5/10 percent discounts. Current pilot discount is once on the first subscription charge, automatically from referral or explicit code; it cannot be self-used or stacked. Coupon-only purchases without prior referral currently receive the discount but do not retroactively create a signup referral. Live Stripe remains disabled.
Email verification uses a signed link expiring after 24 hours, bound to the current account email. Verification is tracked but does not retroactively block existing accounts. Login/affiliate decision/payment notices go only to verified recipients. SMTP delivery can be pending/failed/sent (SMTP acceptance is not proof of inbox delivery); admin can retry pending/failed messages. Local SMTP is unconfigured pending sender selection and setup.
Demo day metrics are stored separately and visibly labelled; real event history is unchanged.
