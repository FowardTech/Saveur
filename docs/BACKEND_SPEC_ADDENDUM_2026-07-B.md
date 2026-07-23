# Saveur — Backend Spec Addendum (July 2026, second batch — the 15-item list)

This covers the 15-item batch requested separately from `BACKEND_SPEC_ADDENDUM_2026-07.md` (the
first July batch). Same conventions apply: snake_case on the wire, camelCase in-app,
`Authorization: Bearer <token>`. Only new/changed backend surface area is documented — pure
client-only changes are noted as such and skipped in detail.

This doc is being filled in as each item is completed, not all at once at the end — sections for
items not yet built are marked **not started** and will be added when that item is implemented.

## Quick index

| # | Item | Backend action needed? |
|---|---|---|
| 1 | App Store/Play Store rating prompt | No — client-only (`Linking.openURL` to store listing) |
| 2 | AI coach live voice conversation | **Yes — done** (§7) |
| 3 | Referral program ($5/$5 discount) | **Yes — done** (§6) |
| 4 | Learning courses → Pro-only | Done — `@require_pro` added to `/learning/module`, `/learning/visual` |
| 5 | Location-based language auto-detect on first open | No — client-only (device geolocation + free BigDataCloud reverse-geocode) |
| 6 | Privacy Policy/Terms rewrite + admin-editable | **Yes — done** (§1) |
| 7 | Weekly Practice chart not updating | No — client-only (`useFocusEffect` bug) |
| 8 | Admin-configurable subscription pricing | **Yes — done** (§2) |
| 9 | Today's Goal not dynamic per user | Done — `/goals/tips-today` now takes roles/countries into account |
| 10 | Learning course curriculum overhaul + certificates | **Yes — done** (§4) |
| 11 | Career Diary (new feature) | **Yes — done** (§5) |
| 12 | Resume/CV standard sections + real file rendering | **Yes — done** (§3) |
| 13 | Coding Practice screen error | Done — `/coding/review` shape fix, `/coding/run` 503 consistency, `run_case` `actual_output` alias |
| 14 | Sports interview type | Done — added to `VALID_TYPES` in `interviews.py` |
| 15 | *(blank in original request)* | n/a |

---

## §1. Admin-editable legal content (item 6)

New model `LegalContent` (`app/models/content.py`): `slug` (unique), `title`, `body_md`,
`updated_at`.

New public endpoint, no auth: `GET /api/v1/content/legal/<slug>` (`app/api/content.py`) —
`slug` is `"privacy_policy"` or `"terms_of_service"`. Returns the admin-saved row if one exists,
otherwise a real, Saveur-specific default (not placeholder boilerplate) baked into the endpoint.

New admin-only endpoints (`app/api/admin.py`, `@require_admin`):
- `GET /api/v1/admin/legal-content` — list both slugs' current state.
- `GET /api/v1/admin/legal-content/<slug>` — single slug (nulls if never edited).
- `PUT /api/v1/admin/legal-content/<slug>` — body `{title, body_md}`, upserts.

**Action needed:** run `python setup_db.py` (or whatever triggers `db.create_all()` in your
deploy) once to create the `legal_content` table — this project uses `db.create_all()`, not
hand-written Alembic migrations, so no migration file is needed, just a fresh schema sync.

Admin dashboard: new "Legal" tab on the Content page (`career-spark-suite/src/routes/
admin.content.tsx`) with a title input + markdown textarea per slug, pre-filled from the public
default the first time a slug has never been saved.

## §2. Admin-configurable subscription pricing (item 8)

New model `SubscriptionPlan` (`app/models/subscription_plan.py`): `code` (unique, e.g.
`pro_monthly`), `name`, `description`, `plan_tier`, `amount` (cents), `currency`, `interval`,
`recommended`, `is_active`, `price_id`/`product_id` (cached Stripe ids), `lookup_key`/
`lookup_version`.

**This replaces the old hardcoded `PLAN_CATALOG` list in `stripe_service.py`** (kept only as
`DEFAULT_PLAN_CATALOG`, used once to seed this table on a fresh database — first call to
`ensure_catalog()` after deploy will auto-populate it from the old 3 plans, so no manual seeding
step is required). `GET /api/v1/billing/plans` (existing, unauthenticated-optional endpoint the
mobile app's paywall already reads) is unchanged in shape — it just now sources its data from
this table instead of the hardcoded list, so **no mobile client change was needed for pricing to
become admin-editable**.

New admin-only endpoints:
- `GET /api/v1/admin/subscription-plans` — list all plans (also seeds + syncs `price_id` if empty).
- `PUT /api/v1/admin/subscription-plans/<code>` — body `{name?, description?, amount?, currency?,
  interval?, is_active?, recommended?}`. Changing `amount`/`currency`/`interval` **mints a brand
  new Stripe Price** (Stripe Prices are immutable — cannot be edited in place) and archives the old
  one via `stripe_service.reprice_plan()`. Existing subscribers already on the old price are
  unaffected until they resubscribe; only new checkouts see the new price. This is standard Stripe
  practice, not a limitation specific to this implementation.

**Action needed:** run `python setup_db.py` again for the new `subscription_plans` table, same as
§1. No Stripe-side action needed — the first admin dashboard load (or first `/billing/plans` call)
auto-provisions Products/Prices in Stripe exactly as the old hardcoded catalog did.

Admin dashboard: new "Pricing" nav item / page (`career-spark-suite/src/routes/admin.pricing.tsx`)
listing each plan with an edit dialog (name/description/price/currency/interval/recommended) and
an active/inactive toggle.

## §3. Resume/CV standard sections + real file rendering (item 12)

**Section schema changed.** The old ad-hoc shape (`{summary, skills, highlights,
suggested_skills}`) is replaced by a standard resume/CV section set, with no more generic
"highlights" bucket:

```
{
  "contact": {"name", "email", "phone", "location", "links": [str]},
  "summary": str,
  "core_skills": [str],
  "certifications": [str],
  "experience": [{"title", "company", "location", "start", "end", "bullets": [str]}],
  "education": [{"school", "degree", "field", "start", "end"}],
  "projects": [{"name", "description", "link"}],
  "volunteer": [{"org", "role", "description"}],
  "awards": [str],
  "languages": [str],
  "references": [{"name", "relationship", "contact"}],
  "suggested_keywords": [str]
}
```

This is stored as-is in `Resume.parsed_json` (already a schemaless JSON column — no DB migration
needed) via the existing `PATCH /api/v1/resume`.

**`POST /api/v1/resume/generate`** (`app/api/resume_gen.py`, already existed, still `@require_pro`)
now prompts the LLM for exactly this shape instead of the old generic
`sections: [{heading, bullets}]`. Certifications/volunteer/awards/languages/references are
instructed to come back empty rather than filled with invented filler when there's no real basis
for them in the existing resume or target role.

**`POST /api/v1/resume/export`** (`app/api/resume.py`) is now a *real* renderer, not a passthrough
to the originally-uploaded file. New service `app/services/resume_render_service.py` renders the
structured sections into an actual `.docx` (via `python-docx`) or `.pdf` (via `reportlab`) in
memory, uploads it to storage, and returns a real `https://` download URL — this was a known gap
flagged in the first addendum doc (export previously just echoed the raw upload's URL or nothing).
Falls back to the raw uploaded file's URL only if there's no structured section data at all yet.

New request field: `doc_type: "resume" | "cv"` (default `"resume"`). Both use the identical
section schema and renderer — `"cv"` only changes the document title to "Curriculum Vitae". This
backs the new standalone "Create My CV" entry point in the mobile Resume Builder screen.

**Action needed:**
1. `pip install -r requirements.txt` (adds `python-docx==1.1.2` and `reportlab==4.2.5`) and restart
   Flask.
2. No DB migration needed (`parsed_json` is already schemaless).
3. If you're on the Lovable AI Gateway rather than direct OpenAI, verify `response_format:
   {"type": "json_object"}` is supported for `/resume/generate` the same way it already is for the
   other JSON-mode endpoints in this codebase (coding review, ATS score, etc.) — no new
   requirement, just flagging it uses the same mechanism.

## §4. Learning course curriculum overhaul + certificates (item 10)

Three real gaps this closes: (a) courses never went past one flat difficulty level, (b)
`CourseSession.tsx` never actually read or wrote `/learning/progress` at all despite that endpoint
already existing, so "resume where I left off" silently did nothing, and (c) "Learn Anything"
would generate a syllabus for literally any typed string with no check that it's a real,
certifiable professional topic.

**New model `Certificate`** (`app/models/certificate.py`): `user_id`, `topic`, unique `code`
(`SVR-XXXXXXXX`), `levels_completed` (JSON list), `issued_at`. Unique on `(user_id, topic)` — one
certificate per user per topic, re-issuing is a no-op.

**New endpoint `POST /api/v1/learning/topic-check`** (`@require_auth`, `@require_pro`) — body
`{topic}`. A real LLM judgment call (not a keyword blocklist) on whether the typed topic is a
coherent professional/career skill area, returning `{valid, canonical_topic, reason?,
core_subtopics}`. `core_subtopics` (5-8 real professional subtopics) is fed into syllabus
generation so a topic like "Microservices" is taught its actual recognized subject matter instead
of the AI free-associating under that name. Fails open (valid, no subtopics) on any provider error
— a transient hiccup shouldn't block a legitimate topic.

**New endpoint `POST /api/v1/learning/certificates/issue`** (`@require_auth`, `@require_pro`) —
body `{topic, tiers: [{level, course_id, total_modules}, ...]}` for all three of
basic/intermediate/advanced. Re-verifies each tier's completion against real `CourseProgress` rows
(`COUNT(... WHERE course_id=X AND completed=true) >= total_modules`) — a client can't shortcut this
by just calling the endpoint, since those completion counts were only ever written by genuine
`POST /learning/progress` calls made while actually stepping through each module. Issues (or
returns the existing) `Certificate` once all three tiers check out.

**New endpoint `GET /api/v1/learning/certificates`** (`@require_auth`, no Pro gate — reading your
own earned certificates isn't itself a paid action, same reasoning as `/progress`).

**Client-side convention, no further backend change needed:** each tier of a topic is tracked as
its own `course_id` against the *existing* `GET/POST /api/v1/learning/progress` endpoints, using
the pattern `"<topic-slug>::<level>"` (e.g. `"microservices::advanced"`). Basic is 4 modules,
Intermediate 5, Advanced 6 (`MODULES_PER_LEVEL` in `services/learningService.ts`) — purely a
client-side constant, not sent from or validated against anything else server-side beyond the
certificate-issue check above.

**Action needed:** run `python setup_db.py` again for the new `certificates` table (schemaless
`db.create_all()`, same as §1/§2 — no hand-written migration needed).

## §5. Career Diary (item 11)

Entirely new feature — a plain journal, no AI involved. New model `CareerDiaryEntry`
(`app/models/career_diary.py`): `user_id`, `entry_date`, `category` (`"did"|"learned"|"achieved"`,
optional), `role` (optional free-text tag for which role/career/job this relates to), `text`.

New blueprint `app/api/career_diary.py`, all `@require_auth`, no Pro gate (a personal journal
isn't a premium feature by product decision):
- `GET /api/v1/career-diary` — `?days=N` (default 90, `0` = no limit) and `?role=...` filters,
  most-recent-first, capped at 500 rows.
- `POST /api/v1/career-diary` — body `{text, category?, role?, entry_date?}` (`entry_date`
  defaults to today if omitted).
- `PATCH /api/v1/career-diary/<id>` — partial update, any of the same fields.
- `DELETE /api/v1/career-diary/<id>` — ownership-checked (404s if the entry belongs to another user).

Mobile: `services/careerDiaryService.ts` (CRUD wrapper) + new screen `src/more/CareerDiary.tsx`
(composer with a text box, Did/Learned/Achieved tag, optional role tag, and a date-grouped entry
list with delete), reachable from the More menu.

**Action needed:** run `python setup_db.py` again for the new `career_diary_entries` table (same
`db.create_all()` pattern as the other new tables above — no hand-written migration needed).

## §6. Referral program — $5/$5 (item 3)

**New column** `User.referral_code` (unique, nullable — generated lazily on first `/referrals/me`
or `/users/me` sync call, not backfilled).

**New model `Referral`** (`app/models/referral.py`): `referrer_user_id`, `referee_user_id`
(unique — one referral per person, ever), `code`, `status` (`"pending"` → `"rewarded"`),
`reward_amount_cents` (500 = $5), `rewarded_at`.

**New blueprint `app/api/referrals.py`** (all `@require_auth`):
- `GET /api/v1/referrals/me` — `{code, share_url, deep_link, reward_amount_cents,
  referred_count, pending_count, rewarded_count, credit_earned_cents}`.
- `POST /api/v1/referrals/redeem` — body `{code}`, manual fallback for attaching a code (see
  below on why this exists).

**Changed** `POST /api/v1/users/me` (sync) — now accepts optional `{referred_by_code}` in the
body. Only has an effect on a genuinely new user's very first sync; records a pending `Referral`
via `referral_service.record_referral()`.

**Changed** the Stripe webhook (`app/api/billing.py`) — `checkout.session.completed` and
`customer.subscription.updated`/`created` now call `referral_service.reward_if_eligible(user)`
whenever the resulting plan is non-free and status is `active`/`trialing`. That function checks
for a `status="pending"` `Referral` row for this user as referee, and if found, grants **both**
the referrer and referee a **$5 Stripe account-balance credit** (`stripe_service
.grant_account_credit` — a negative Stripe balance transaction, which Stripe automatically applies
to that customer's next invoice; not a coupon code or a field some other part of the system needs
to remember to honor) and flips the row to `"rewarded"`. This matches the exact requirement:
signup alone earns nothing, subscribing to a **paid** plan is what triggers the reward, and it's
double-sided.

**New plain (non-JSON) route** `GET /r/<code>` (`app/web.py`, registered separately from the
`/api/v1/*` blueprints) — the actual link people share. It's a small HTML page that immediately
tries to open `saveur://referral?code=<code>` (works if the app is already installed) and falls
back to the iOS App Store / Google Play listing after ~1.5s if that didn't navigate away (app not
installed).

**Two things you need to configure / be aware of:**
1. `WEB_APP_URL` env var — the domain this redirect page is actually hosted at (defaults to the
   same `https://app.saveur.io` placeholder already used for `APP_SUCCESS_URL`/`APP_CANCEL_URL` in
   `billing.py`). Set it to your real production domain once you have one.
2. `IOS_APP_STORE_URL` env var — set this once Saveur has a real App Store listing (same
   not-yet-published gap already flagged for `utils/appRating.ts`'s `IOS_APP_STORE_ID`
   placeholder). Falls back to a generic `apps.apple.com` URL until then.
3. **Honest limitation, not a bug:** this does not implement deferred deep linking. If someone
   taps the link, doesn't have the app, and installs it from the store, the referral code is not
   automatically recovered after install — that requires a dedicated attribution SDK
   (Branch/AppsFlyer/etc.), which isn't wired up here (no such account/keys exist to configure).
   For that specific case, the mobile Referral screen has a manual "Enter a referral code" field
   (`POST /referrals/redeem`) so the new user can paste the code in themselves after signing up.
   The automatic path (deep link while already installed, or install → open → the code was
   already captured pre-signup) works end-to-end without this.

**Action needed:** run `python setup_db.py` again for the new `referral_code` column and
`referrals` table.

## §7. AI coach live voice conversation (item 2)

No new endpoint was needed — this reuses the existing `POST /api/v1/coach/advice` (already the
real Coach chat backend), extended with an optional `mode: "voice"` field in the request body.
Sending `mode: "voice"`:

1. Pulls in a new, much richer context block (`app/api/coach.py`'s `_activity_snippet()`) —
   recent mock-interview types/roles/scores, current practice streak, Learning Course tiers
   completed, certificates earned, the last 3 Career Diary entries, the next upcoming scheduled
   interview, and subscription tier — on top of the existing static profile fields
   (goals/industries/roles/countries) `_user_profile_snippet()` already sent. This is what makes
   the coach genuinely "aware of all the information and activities the user has in the app," per
   the product requirement, not just their signup-time profile.
2. Swaps the system prompt for a "real coach checking in with a student" conversational tone, and
   caps replies at 1-3 short, plain-spoken sentences with no markdown/bullets/headers — this text
   is fed straight to text-to-speech, not displayed.

When `mode` is omitted (the existing text-chat call sites), behavior is byte-for-byte unchanged
from before this change — the extra activity-context queries only run for voice requests, so this
doesn't add load to the existing chat.

**Mobile architecture — "Live continuous conversation" (the option you explicitly picked over
push-to-talk):**

- Reuses the app's *existing* real STT (`@dev-amirzubair/react-native-voice`, via
  `speechService.useSpeechToText()`) and TTS (ElevenLabs through `POST /api/v1/tts/speak`, with
  on-device fallback, via `speechService.speak()`) — both already used by Voice-mode mock
  interviews. No new native dependency was added for this feature.
- New component `src/messages/VoiceCoachView.tsx` layers *silence-based turn detection* on top of
  that already-continuous listening stream: the recognizer restarts itself automatically on every
  pause (pre-existing behavior), and this adds a ~1.3s debounce timer that, when it fires with no
  new speech, treats the accumulated transcript as one finished turn and sends it to
  `/coach/advice` with `mode: "voice"`.
- The Coach tab (`src/messages/Chat.tsx`) now opens in Voice mode by default, with a "Text" toggle
  in the top-right that switches to the original GiftedChat UI — both modes read/write the exact
  same persisted conversation history, so switching mid-conversation doesn't lose context.
- **Interruption/barge-in — an explicit, documented trade-off.** True automatic barge-in (the AI
  stops mid-sentence the instant you start talking over it) needs verified on-device acoustic echo
  cancellation, so the mic doesn't pick up the AI's own voice out of the phone speaker as if it
  were you talking. That can't be verified from this environment (no audio hardware, no real
  device to test on). So: the mic is intentionally paused while the AI's reply is playing, and
  interruption is instead a **visible tap** — tapping the orb while the coach is speaking
  immediately stops playback and hands the mic back. This is a deliberate, low-risk substitute for
  acoustic barge-in, not an oversight. **Recommended next step:** test on a real iOS/Android device
  with the phone's speaker (not headphones) and see whether keeping the mic live during playback
  causes an echo/self-interruption loop; if it doesn't, `VoiceCoachView.tsx`'s `sendTurn()` can be
  changed to skip the `stt.stop()` call before `speak()` for genuine automatic barge-in.
- No new permissions needed — `NSMicrophoneUsageDescription`/`RECORD_AUDIO` already exist for
  Video-mode interviews.
