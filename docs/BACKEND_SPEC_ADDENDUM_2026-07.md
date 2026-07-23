# Saveur — Backend Spec Addendum (July 2026 batch)

This addends `docs/BACKEND_API_SPEC.md`, which already covers the full endpoint contract for a
backend that predates this batch. It does **not** repeat anything that batch already specifies
correctly — it only calls out what's **new**, **changed**, or **newly load-bearing** as a result
of the 19 fixes/features implemented in this pass, plus two items still blocked on backend-side
investigation.

Everything below assumes the auth/session model, wire-format convention (snake_case on the wire,
camelCase in-app), and `Authorization: Bearer <token>` pattern already established in the base
spec.

## Quick index

| # | Item | Backend action needed? |
|---|---|---|
| 1–2 | Voice-interview turn-taking glitch, timer/text overlap | No — client-only fix |
| 3 | Enforce selected interview duration | Recommended: server-side soft cutoff (§1) |
| 4 | AI voice in video interviews | No — reuses existing TTS endpoint |
| 5 | Coach chat dynamic per user | **Yes — required** (§2) |
| 6 | Suggested Topics dynamic | Optional — new endpoint, has client fallback (§3) |
| 7 | Salary Negotiator dynamic | Optional — new endpoint, has client fallback (§4) |
| 8 | Weekly Practice chart real | No — derived from existing session history |
| 9–11 | Icon consistency, quick actions, Career Goal screen | No — client-only |
| 12 | Remove paywall from signup | No — client-only |
| 13 | Email verification gate | Recommended: server-side enforcement too (§5) |
| 14 | Subscription-plan feature gating | **Yes — new fields + recommended enforcement** (§6) |
| 15 | Subscription screen redesign | Optional — `recommended` flag on plans (§7) |
| 16 | Custom Stripe checkout styling | No — client-only (Payment Sheet `appearance`) |
| 17 | Friendly auth error messages | No — client-only |
| 18 | Job Alerts crash | **Blocked — needs your server logs** (§8) |
| 19 | Push notifications not arriving | Checklist to verify server-side (§9) |

---

## §1. Interview session duration (item 3)

The client now hard-stops a session locally once `duration_min` (already sent on
`POST /api/v1/interviews/sessions`, see base spec) elapses — it plays a closing line, stops
calling `POST .../next-question`, and calls the existing completion flow. No new endpoint is
required for this to work end-to-end.

**Recommended, not required:** treat `duration_min` as a soft budget server-side too — reject (or
just stop returning fresh questions for) a `next-question` call once the session's elapsed time
materially exceeds `duration_min`. This is defense-in-depth only (a modified client could ignore
its own timer); nothing in the app depends on it.

## §2. Coach chat must be personalized server-side (item 5)

`POST /api/v1/coach/advice` is called with `{question, history}` only — the client does **not**
send the user's goals/industries/desired roles on every request, because the request is already
authenticated (`Authorization: Bearer <token>`).

**This is the one required change in this batch with no client-side equivalent.** For chat
responses to actually be "dynamic per user" rather than generic, the `/coach/advice` handler must
look up the authenticated user's own profile (`goals`, `industries`, `desiredRoles`,
`preferredCountries` — same fields as `GET /api/users/me`) server-side and fold them into the
prompt/context sent to whatever LLM backs this endpoint. If the current implementation ignores
the authenticated user and just runs `question` through a shared prompt, every user gets the same
answer regardless of the token — that's the exact symptom reported.

## §3. `GET /api/v1/coach/suggested-topics` (item 6, optional)

```
GET /api/v1/coach/suggested-topics
Response: { topics: [{ id: string, title: string }, ...] }   // or a bare array
```

If implemented, personalize using the same profile fields as §2 (e.g. a topic referencing the
user's `desiredRoles[0]`). If this endpoint 404s or errors, the client already falls back to 3
locally-generated topics (one personalized off `desiredRoles`/`goals` if present, two generic) —
so this is enhancement, not a blocker.

## §4. `GET /api/v1/coach/negotiation/scenario` (item 7, optional)

```
GET /api/v1/coach/negotiation/scenario
Response: { company, role, offer: {base, bonus, equity, currency}, ... }  (see ScenarioWire
           in services/salaryNegotiationService.ts for the exact optional fields read)
```

If this errors, the client falls back to the user's own applications at the `Offer` stage (real
company/title from `GET /api/v1/applications`) with estimated numbers, then finally a static
scenario pool as a last resort. Implementing this endpoint (ideally sourced from real market data
or the user's actual offer if one's on file) upgrades all three fallback tiers to something more
realistic.

## §5. Email verification — client gate now blocks the app; consider a server gate too (item 13)

`MainBottomTab.tsx` now renders a blocking "verify your email" screen in place of Home/Practice/
Coach/Interviews for any signed-in-but-unverified user (Profile/Settings, resend, and logout stay
reachable). This is enforced entirely client-side today.

**Recommended:** any endpoint that lets an unverified user create real data or spend a paid
action (starting an interview session, sending a coach message, subscribing) should independently
check `email_verified` server-side and reject with a clear `403` if a client bypasses the UI gate
(modified client, direct API call, etc.). Not currently enforced server-side anywhere in this
contract as far as the client can tell.

## §6. Subscription-plan feature gating — session cap (item 14)

**Model:** Free tier is capped at a fixed number of practice sessions per calendar month (any
mode/type — voice, video, text, coding all count against the same cap); Pro (`premium` or
`premium_plus`, while `active`/`trialing`) is unlimited. See `services/entitlementsService.ts` for
the client-side implementation (`FREE_SESSIONS_PER_MONTH = 5` today — change this constant, or
better, make it backend-driven per below, if the real number differs).

`GET /api/v1/billing/subscription` (already documented in the base spec) can now optionally
return two new fields:

```jsonc
{
  "tier": "free",
  "status": "active",
  // ...existing fields...
  "sessions_used": 3,      // sessions started this billing period, free tier only
  "sessions_limit": 5      // null (or field omitted) = unlimited / not enforced server-side yet
}
```

If these fields are absent, the client falls back to counting the current **calendar month's**
sessions from the user's own practice history against the hardcoded local constant — so gating
works today without any backend change. Once the backend sends real values, it should ideally key
off the actual Stripe billing-period boundary (which won't always equal calendar-month), and the
client will pick that up automatically.

**Recommended, stronger enforcement:** the client blocks the "Start Interview" button once the
cap is hit (`MockInterviewSetup.tsx`), but this is bypassable by a modified client calling
`POST /api/v1/interviews/sessions` directly. If session limits need to be a hard guarantee (not
just a UX nudge), `POST /api/v1/interviews/sessions` should itself reject with `402 Payment
Required` (or similar) once a free-tier user is at `sessions_limit`, using the same counting logic
that populates `sessions_used` above.

## §7. `recommended` flag on billing plans (item 15, optional)

`GET /api/v1/billing/plans` (already documented) can optionally set `recommended: true` (or
`popular`/`is_recommended` — the client checks all three) on exactly one plan to drive the "Most
Popular" badge on the redesigned Subscription screen. If no plan sets it, the client falls back to
a heuristic (first paid plan in the list), so this is cosmetic-only.

## §8. Job Alerts screen crash — still blocked (item 18)

Client-side investigation is exhausted: the crash string isn't hardcoded anywhere in this repo,
`services/jobAlertsService.ts` now defensively parses every response shape it might plausibly
receive (bare array, `{data: [...]}`, `{alerts: [...]}`), and the error still reproduces. This
strongly points to the error being generated **server-side** and passed through verbatim by the
client's generic error-normalization (`apiClient` surfaces `error.response.data.message` as-is).

**What's needed to unblock this:** server logs (or just the raw JSON error body) from a request to
`GET /api/v1/job-alerts` around the time the crash reproduces. Once that's available, this can be
finished in one pass.

## §9. Push notifications not arriving — checklist (item 19)

Client-side, `services/pushNotificationService.ts` now logs (rather than silently swallowing)
every point registration can fail: permission denied, empty FCM token, or a failed
`POST /api/v1/notifications/device-token` call. Foreground pushes for job alerts now also show an
in-app alert (Firebase never auto-displays a system banner while the app is foregrounded — that's
expected behavior, not a bug, and a full native banner would require adding a new native
dependency like `@notifee/react-native`, which hasn't been added). If notifications still aren't
arriving after confirming the client-side registration logs are clean, check server-side:

- Is `POST /api/v1/notifications/device-token` actually persisting the token against the
  authenticated user (not silently no-op'ing)?
- Is whatever triggers a push (job-match detection, a manual notification) actually calling FCM's
  send API with that stored token, and is it using the right credential (server key / service
  account) for this Firebase project (`saveur-ac8ec`)?
- Are pushes being sent with a `notification` payload (auto-displays) vs. a `data`-only payload
  (app must handle it — which it now does, but only in foreground/background, not fully killed
  state edge cases)?

---

## Summary of concrete backend deliverables from this batch

1. **Required:** make `POST /api/v1/coach/advice` use the authenticated user's own profile to
   personalize replies (§2).
2. **Recommended:** add `sessions_used`/`sessions_limit` to `GET /api/v1/billing/subscription`,
   and enforce the free-tier cap server-side on `POST /api/v1/interviews/sessions` (§6).
3. **Recommended:** enforce `email_verified` server-side on write/paid endpoints, not just via the
   client's UI gate (§5).
4. **Optional/nice-to-have:** `GET /api/v1/coach/suggested-topics` (§3),
   `GET /api/v1/coach/negotiation/scenario` (§4), `recommended` flag on
   `GET /api/v1/billing/plans` (§7) — all three already have working client-side fallbacks.
5. **Blocked on you:** server logs for the Job Alerts `GET /api/v1/job-alerts` crash (§8).
6. **Needs verification on your end:** the push-notification checklist in §9.

Everything else in the 19-item batch (turn-taking glitch, timer overlap, video-mode TTS, icon
consistency, quick actions, My Progress screen, Career Goal screen, removing the signup paywall,
Subscription screen redesign, custom Stripe checkout styling, friendly auth error messages) was
implemented entirely client-side against endpoints the base spec already documents — no backend
work needed for those.

---

## Addendum 2 — second batch (same session, follow-up round)

Covers the next 9 items raised after the first batch shipped. Same rule as above: only what's new
or changed.

### §10. Subscription activation lag (item 2)

Root cause: Stripe confirms a payment synchronously (the Payment Sheet resolving), but this app's
backend only learns the plan changed once it separately receives Stripe's webhook
(`invoice.payment_succeeded` / `customer.subscription.updated`) — an async round trip that can lag
the client by a few seconds. The client (`src/more/Subscription.tsx`) now polls
`GET /api/v1/billing/subscription` for up to ~9 seconds after a successful payment instead of
reading once, which papers over normal webhook latency and tells the user honestly if it's still
pending after that. **This is a mitigation, not a fix** — if subscriptions are still not
activating after ~10+ seconds consistently, the actual problem is almost certainly one of:

- The Stripe webhook endpoint isn't registered/reachable (check Stripe Dashboard → Developers →
  Webhooks for delivery failures on this project).
- The webhook handler isn't listening for the right event types, or is failing to match the
  incoming event to the right user/subscription record.
- `GET /billing/subscription` itself isn't reading from wherever the webhook handler writes.

### §11. Feature gating expansion (item 4)

Job Alerts, Networking Assistant, Resume Builder, JD Analyzer, and the whole Coach tab (chat,
Suggested Topics, Salary Negotiator) are now Pro-only client-side — a free user sees a lock screen
with an Upgrade CTA instead of the real screen (`components/ProLockGate.tsx`). This reads the same
`isPro` derived from `GET /api/v1/billing/subscription` as the session-cap gating in Addendum 1
§6 — no new endpoint needed.

**Recommended, same rationale as §6 in Addendum 1:** the client-side lock is bypassable by a
modified client calling these endpoints directly (`/api/v1/interviews/scheduled` aside, the
existing `/api/v1/coach/*`, `/api/v1/resume/*`, `/api/v1/jd/*`, `/api/v1/job-alerts`,
`/api/v1/networking/*` endpoints). If Pro-gating these needs to be a hard guarantee rather than a
UX nudge, each should independently check the authenticated user's plan server-side and reject
with `403` for a free-tier user.

### §12. Coach chat personalization — client now sends profile context (item 5)

`POST /api/v1/coach/advice` now also receives an optional `profile_context` object on every
request:

```jsonc
{
  "question": "...",
  "history": [...],
  "profile_context": {
    "goals": ["..."],
    "industries": ["..."],
    "desired_roles": ["..."],
    "preferred_countries": ["..."]
  }
}
```

This is the same data `GET /api/users/me` already returns for this user — sent directly so the
backend doesn't need its own profile-lookup step to personalize a reply. **The backend prompt
needs to actually read and use this field** (or independently look up the authenticated user's
profile) for chat responses to stop feeling generic/templated — sending the field alone doesn't
personalize anything if the handler ignores it. For deeper personalization (referencing the
user's actual resume content or practice history, which doesn't fit in a lightweight per-request
payload), the backend should pull that from its own stores keyed off the authenticated user.

### §13. New: Scheduled interviews (item 6)

Backs the real "Upcoming Session" feature on Home and the new `src/practice/ScheduleInterview.tsx`
screen (see `services/scheduledInterviewService.ts` for the exact client contract this targets).
Three new endpoints:

```
GET    /api/v1/interviews/scheduled       — list this user's upcoming (future) scheduled interviews
POST   /api/v1/interviews/scheduled       — create one
DELETE /api/v1/interviews/scheduled/{id}  — cancel one
```

`POST` body / list item shape:

```jsonc
{
  "interview_type": "behavioral",   // same enum values as POST /interviews/sessions
  "mode": "voice",                  // voice | text | video | coding
  "difficulty": "intermediate",
  "role": "Software Engineer",
  "company": "Google",              // optional
  "duration_min": 30,
  "scheduled_at": 1753024800        // unix seconds, future
}
```

Response (all three) should include a generated `"id"`. Until this exists server-side, the client
falls back to creating/listing/canceling entirely from local `AsyncStorage` (so the feature works
today, it just won't sync across devices) — same defensive pattern used everywhere else in this
app's service layer.

**Optional nice-to-have:** since device-push registration already exists
(`POST /api/v1/notifications/device-token`, wired since the last batch), the backend could send a
push notification some number of minutes before `scheduled_at` as a real reminder — right now the
"reminder" is purely passive (the user has to open the app and look at Home).

### §14. JD Analyzer → generate a matching resume (item 7)

Not yet implemented — flagging the shape of what's coming so the backend contract can be planned
alongside it. The plan: after `POST /api/v1/jd/analyze` returns its match/gap analysis, the client
will offer to generate a resume addressing those gaps, in a user-chosen visual style, downloadable
as `.docx` or PDF. The document generation itself will happen client-side (this app already has
docx/PDF-building tooling available). What would help most from the backend is a dedicated
generation endpoint rather than reusing the analysis endpoint's output as-is — something like:

```
POST /api/v1/resume/generate
Body: {jd_analysis_id or raw jd text, target_role, existing resume content if any}
Response: {summary, sections: [{heading, bullets: [...]}, ...]}
```

...returning structured, ready-to-lay-out content (a professional summary + per-section rewritten
bullet points) rather than free-text, so the client can drop it into a template reliably. Not a
hard blocker — the client can also just reuse the existing bullet-rewrite logic already wired in
Resume Builder — but a purpose-built endpoint would produce meaningfully better output.

### §15. Learning Courses — AI teacher, now built (item 8)

**Implemented and working today** — `src/more/CourseSession.tsx` / `services/learningService.ts`.
Rather than waiting on a bespoke module-content endpoint, module generation reuses the existing,
already-working `POST /api/v1/coach/advice` (via a new `coachService.askOneOff` — same endpoint,
just skipped from the Coach tab's persisted chat history) with an instructor-style prompt per
module. This means it works live today for any topic — including technical/coding topics — not
just a fixed catalog, and needs **no new backend work** for text content, the syllabus outline, or
the check-for-understanding question's answer feedback (all three are separate `askOneOff` calls
with different prompts). Voice narration reuses the existing `POST /api/v1/tts/speak` pipeline
already wired for interviews.

**Still needed — real AI-generated images (the one genuinely new piece):**

```
POST /api/v1/learning/visual
Body: {prompt}          // e.g. "React Native basics: State and Props"
Response: {image_url}   // or {url}
```

This can't be done from the client — it needs a real image-generation API key/provider
relationship (DALL-E, Stable Diffusion, etc.) the backend holds. `learningService.generateVisual`
already calls this endpoint per module and simply renders nothing if it 404s/errors, so the
lesson is fully usable today without it — implementing it is additive, not a prerequisite for the
feature to work.

**Optional, out of scope for this pass:** persisted per-user course progress across sessions
(so "2/5 modules complete" on the catalog list reflects reality instead of the static
`constants/Data.ts` numbers) would need its own endpoints
(`GET/POST /api/v1/learning/progress` or similar) — not built here since the ask was specifically
about the teaching experience itself.

### §16. Preferred language (UI text + AI voice) — new feature

Client-side implementation is done: `constants/languages.ts` is the single source of truth for
which languages are offered (currently English + Spanish — every language listed there has full
i18next translation coverage, see `i18n/config.ts`). Users pick it during signup
(`SignupFirstStep.tsx`, before anything else) and can change it anytime from Settings → Language
(`src/home/MyFavorites/SelectLanguage.tsx`, now reachable from `MoreSrc.tsx`). The choice is
persisted to the existing `UserProfileProps.locale` field — `PATCH /api/users/me` already accepts
and returns this field (it was wired but unused before this pass), so **no schema change is needed
for storing the preference itself**. On every sign-in/sign-up, the client re-applies
`profile.locale` to the local UI language (`AuthContext.tsx`'s `syncLanguageFromProfile`), so a
user's language follows their account across devices/reinstalls, not just local device storage.

Static UI text (buttons, labels, screen copy) is 100% client-side via i18next — no backend
involvement needed there. Two things do need backend work, since "the AI speaks/writes in the
chosen language" is not something the client can fake:

**1. `POST /api/v1/tts/speak` — add a `language` field.**

```
POST /api/v1/tts/speak
Body: {text, language}   // language: "en" | "es" (ISO 639-1, matches profile.locale)
Response: {audio_url}    // unchanged
```

The client now sends this on every TTS call (`services/speechService.ts`'s `speak()`, used by
Live Interview voice mode and Learning Courses narration) — today it's harmless to ignore, but for
this feature to actually work, ElevenLabs needs to synthesize in that language. Two ways to do it,
roughly in order of recommended effort:
  - Simplest: maintain a small per-language `voice_id` map server-side (one ElevenLabs voice
    picked/cloned per supported language) and select by `language`.
  - Alternative: use one of ElevenLabs' multilingual models (`eleven_multilingual_v2` or
    `eleven_turbo_v2_5`/`eleven_flash_v2_5`, which also support an explicit `language_code` field
    for language enforcement) with a single voice — simpler to maintain, but voice suitability
    (accent, naturalness) per language may be worse than a curated voice map.

If `language` isn't sent (older client / bug) or isn't recognized, default to English — exactly
today's behavior.

**2. Every AI-content-generation endpoint needs to respond in the requested language.**

This is the one most likely to be missed: TTS in Spanish reading *English* text the LLM generated
would sound broken, not multilingual. Every endpoint whose response gets shown as text or spoken
aloud — `POST /api/v1/coach/advice` (Coach chat + Learning Courses' `askOneOff`-based module/
syllabus/feedback generation), resume bullet-rewrite/`update-sections` (Resume Builder + the
JD-Analyzer-driven resume generator), JD Analyzer's match/gap output, Salary Negotiation's
counter-offer copy, Networking Assistant's message drafts — should accept the same `language` field
and have its prompt to the underlying LLM instructed to respond only in that language (e.g. append
"Respond only in Spanish." to the system/user prompt when `language: "es"`). Recommend standardizing
on one field name (`language`, ISO 639-1) across all of these rather than each endpoint inventing
its own, so the client can pass `profile.locale` (or `i18n.language`) the same way everywhere.

Not a hard blocker for the app to run — everything works in English today regardless of the
`locale` a user picks, since none of these endpoints are being sent `language` yet from most call
sites (only the new signup/settings pickers exist so far) — but it is the part that actually
fulfills "the AI speaks/writes in whatever language I picked," so it's the highest-value follow-up
here.

### §16b. `language` now wired into every AI-generation call (client-side follow-up)

Per the backend-confirmed contract above (field `language`, ISO 639-1, body for POST / `?language=`
query for GET, falling back to `profile.locale` then English), the client now sends it on every
endpoint that generates natural-language content shown or spoken to the user:

- `POST /api/v1/coach/advice` (Coach chat + Learning Courses' `askOneOff`), `POST /api/v1/coach/star`,
  `GET /api/v1/coach/suggested-topics`
- `GET /api/v1/goals/tips/today`
- `POST /api/v1/resume/ats-score`, `POST /api/v1/resume/rewrite-bullet`, `POST /api/v1/resume/export`
- `POST /api/v1/jd/analyze`, `POST /api/v1/jd/match`
- `GET /api/v1/coach/negotiation/scenario`, `POST /api/v1/coach/negotiation`
- `POST /api/v1/networking/message`
- `POST /api/v1/coding/review`, `POST /api/v1/coding/system-design`
- `POST /api/v1/ai-twin/ask`
- `GET /api/v1/feedback/session/{id}`, `POST /api/v1/feedback/session/{id}/regenerate`
- `POST /api/v1/interviews/sessions` (session creation — question generation), `POST
  /api/v1/interviews/sessions/{id}/next-question`, `GET /api/v1/interviews/sessions/{id}`
- `POST /api/v1/tts/speak` (already covered in §16 above)

**One field-name exception to flag:** `POST /api/v1/coding/review` already has a pre-existing
`language` field meaning the *programming* language (e.g. "python") — it can't double up as the
UI-language field. The client sends the UI language on that one endpoint only as
`responseLanguage` instead. Every other endpoint above uses the literal field name `language`.

Not sent on: `run`/`run-tests` (raw stdout, nothing to localize), `camera-frame`/`camera-summary`
(pure numeric telemetry), contacts/documents/billing/notifications CRUD (no generated text).

### §16c. Language list expanded to Top 12 (client-side, backend follow-up needed)

Per the user's request ("all the major languages in the world," not just English/Spanish), the
client now offers 12 languages end to end (signup picker, Settings → Language, full i18next
translation coverage across all 13 text namespaces): `en`, `es`, `fr`, `de`, `pt`, `it`, `zh`
(Simplified), `ja`, `ko`, `ar`, `hi`, `ru`. These are exactly the ISO 639-1 codes the client now
sends as `language`/`profile.locale` everywhere described in §16/§16b.

Two backend-side follow-ups this implies, per your own contract notes:

1. **Extend `LANGUAGE_NAMES` in `language_service.py`** to cover all 12 codes above (currently
   only `en`/`es` per your note) — otherwise the "respond only in {language_name}" prompt
   instruction has nothing to map the new codes to for the other 10 languages.
2. **Extend `ELEVENLABS_VOICE_MAP`** to include a voice ID for each of the 10 new codes, e.g.:

```
ELEVENLABS_VOICE_MAP={"es":"<spanish_voice_id>","fr":"<french_voice_id>","de":"<german_voice_id>","pt":"<portuguese_voice_id>","it":"<italian_voice_id>","zh":"<mandarin_voice_id>","ja":"<japanese_voice_id>","ko":"<korean_voice_id>","ar":"<arabic_voice_id>","hi":"<hindi_voice_id>","ru":"<russian_voice_id>"}
```

Until a given code has a mapped voice, falling back to English (or to ElevenLabs' multilingual
model without language enforcement) is safe per the existing fallback rule — no client-side
change needed if voices roll out gradually.

### §17. `POST /api/v1/resume/export` returning a local server path, not a fetchable URL (bug)

Reported via a screenshot: downloading a generated resume fails with `Unable to open URL:
file:///files/users/<uid>/resume/portfolio/<id>.pdf`. That `url` field is a path on the
**backend's own disk** — `Linking.openURL` on a device can never reach it, since it isn't
reachable over the network at all (not even a 404 — the scheme itself isn't openable without an
iOS `LSApplicationQueriesSchemes` entry, which wouldn't help anyway since the file physically
isn't on the device). `POST /resume/export` needs to return a real `https://` link (a signed
S3/CDN URL, or a `GET /api/v1/resume/export/{id}/download` endpoint proxied through your own API)
instead of the raw filesystem path.

Client-side follow-up already shipped: `resumeGenerationService.generateResumeDocument` now
validates the returned `url` starts with `http(s)://` before trying to open it, and falls back to
a plain-text share sheet otherwise — so this no longer surfaces the native "Unable to open URL"
error to the user, but the download itself still won't work correctly until the backend returns a
real link.

### §18. `GET /api/v1/feedback/session/{id}` — clarify sync vs. async scoring contract

Reported via screenshot: Interview Feedback shows Overall Score and all 7 skill-breakdown
categories at a flat 0% after a completed session. Two different backend states would both produce
exactly this symptom, and the client can't tell which one it's looking at without your input:

1. **Scoring is asynchronous** (an LLM pass over the transcript that takes longer than the request)
   and the client's `GET` lands before that job finishes. `fromFeedbackWire` in
   `services/feedbackService.ts` was already written anticipating a `status` field for this case,
   but nothing ever branched on it. **Now fixed client-side**: `InterviewFeedback.tsx` polls
   `GET /feedback/session/{id}` every 3s (up to ~60s) while `status` is one of
   `pending`/`processing`/`queued`/`in_progress`/`scoring`/`running` (case-insensitive), showing a
   "still scoring" message instead of a permanent 0%. **This only works if the backend actually
   returns one of those status strings** on the in-progress response — please confirm the exact
   spelling used (or tell us the real one so `PENDING_STATUSES` in `feedbackService.ts` can be
   tightened to match).
2. **Scoring is synchronous but the endpoint isn't fully implemented yet** (returns a stub/empty
   scores object with no status field at all). If this is the case, the 0% the user is seeing is
   accurate to what the backend is currently returning — there's no client-side fix possible until
   real scores are being computed and returned. Please confirm which of these two is actually
   happening today so we know whether this is resolved or still blocked on backend work.

### §19. "Choose from My Documents" reuses `/resume/upload` with a remote URL — consider a dedicated attach endpoint

`src/more/ResumeBuilder.tsx`'s import buttons (Resume/LinkedIn/Portfolio/Certificates/Transcript)
now offer "Choose from Device" (unchanged) or "Choose from My Documents" (new — lists whatever's
already in the generic document store, `GET /api/v1/documents`). Picking an existing document
re-runs it through the same `POST /api/v1/resume/upload` multipart flow as a device pick, but using
the document's already-hosted `url` as the file source instead of a local device path. This relies
on React Native's networking layer fetching `http(s)` URIs when building a multipart body (the same
mechanism apps commonly use to re-post a remote image URL without downloading it locally first) —
it should work, but hasn't been verified against a real device build in this pass. If uploads from
"My Documents" fail/produce empty files server-side, the more robust fix is a dedicated endpoint
like `POST /api/v1/resume/attach-document {document_id, source_key}` that lets the backend copy/
reference the file it already has instead of asking the client to re-stream it — worth adding
regardless, since it'd be strictly cheaper than a re-upload for anything already on your servers.

**Known limitation, not backend's to fix:** Arabic is right-to-left, and this pass only covers
translated *text* — the app's layout itself still renders left-to-right (icons, alignment, nav
direction). A true RTL mirror is a separate native change (`I18nManager.forceRTL` + restart, plus
auditing every screen's layout assumptions) that hasn't been done. Flagging this so it isn't
mistaken for a translation bug when Arabic is selected.
