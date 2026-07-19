# Saveur — Backend API Specification

This document consolidates every `BACKEND TODO` / mock-service contract scattered across
`services/*.ts`, `AuthContext.tsx`, and various screens in `src/` into one handoff-ready API
spec. It is written for a backend developer picking up this project cold.

## 1. Current State (read this first)

**Saveur today runs entirely on a mock service layer.** There is no real backend, no real
database, and no real auth provider wired in. Every module under `services/*.ts` exports
functions with the exact same signatures a real backend-backed implementation would need, but
internally each one:

- Persists data to **`AsyncStorage`** (on-device key/value storage) instead of a server.
- Simulates network latency with an artificial `delay()` (300ms–1200ms depending on the call) so
  the UI's loading states get exercised in development.
- Seeds itself from static mock data in `constants/Data.ts` on first read, so screens aren't
  empty on a fresh install.

The intent (visible throughout the codebase) is that this is a **drop-in-replaceable boundary**:
screens only ever call into `services/*.ts`, never `AsyncStorage` directly, so swapping a mock
function's body for a real `fetch`/`axios` call should require zero changes to any screen.

Two features are **real, on-device, and not mocked** — worth calling out so they aren't
mistaken for backend work:
- **Video-mode interview analysis** (`services/videoAnalysisService.ts`) — real on-device camera
  frame face-detection (Google ML Kit via `react-native-vision-camera-face-detector`) and real
  on-device speech-to-text (`@dev-amirzubair/react-native-voice`). No cloud API is involved in
  producing the raw signal today; see §5 for what a backend *could* take over.
- **Resume/document file picking** (`ResumeBuilder.tsx`) — uses the native document picker
  (`@react-native-documents/picker`) to get a real on-device file URI. The file itself is never
  uploaded anywhere yet; see §6.

Voice/Text-mode interview "recording" (`services/recordingService.ts`) is the one fully
simulated exception worth flagging separately — it does not touch the camera/mic at all, it just
fakes a start/stop timer. That's a client-side native-module gap (a real
camera/mic library needs to be wired in), not strictly a backend concern, but the backend should
expect a real media file (audio or video) to eventually arrive with session-completion requests
once that's addressed.

## 2. Auth Strategy — Decision Needed

**`AuthContext.tsx` currently has no real auth provider wired in at all.** Firebase is listed as
a `package.json` dependency but is never initialized (no `google-services.json` /
`GoogleService-Info.plist`, no `firebase.initializeApp()` call) — an earlier attempt to import
the Firebase JS SDK unconditionally caused a module-evaluation crash on device, so all auth
state today is backed purely by the local mock `authService` (AsyncStorage). `signIn`/`signUp`
in the mock **always succeed** — there is no real credential validation.

Before implementing anything in §3, **pick one real auth provider**:

| Option | Notes |
|---|---|
| **Firebase Auth** | Path of least resistance given `firebase` is already a listed dependency and the codebase's own comments assume it (`AuthContext.tsx` explicitly says "once a real backend/Firebase project exists, wire it up here"). Requires adding real `google-services.json`/`GoogleService-Info.plist` and calling `firebase.initializeApp()` before `AuthContext` mounts. Google/Apple Sign-In are first-class; LinkedIn is not — would need a custom OIDC/OAuth2 flow layered on top. |
| **Auth0** | Good if LinkedIn OAuth is a hard requirement (Auth0 has a LinkedIn social connection out of the box) and/or if a vendor-agnostic identity layer is preferred. |
| **Custom JWT backend** | Full control (email/password hashing, refresh tokens, session revocation), but means building and securing the credential store yourself, plus rolling your own Google/Apple/LinkedIn OAuth2 code-exchange flows. |

Whichever is chosen, the mobile app expects the same contract: a call to `POST /auth/signup` or
`POST /auth/login` that returns a **bearer token** (`token`) plus a `UserProfileProps` object
(§4). All authenticated endpoints below assume `Authorization: Bearer <token>` unless noted.

**Social sign-in (Google, Apple, LinkedIn) is not wired up on either the client or backend
today.** The buttons exist on both `src/auth/Login/Login.tsx` and
`src/auth/Signup/SignupThirdStep.tsx`, but tapping any of them just shows a
`"<Provider> sign-in isn't connected yet — use email for now."` alert
(`onSocialComingSoon` in both files) — no native SDK, no OAuth redirect, nothing. Whoever
implements real auth needs to: (1) add the native Google/Apple sign-in SDKs (and a LinkedIn
OAuth2 flow, which has no equivalent "native button" SDK) to the client, (2) replace
`onSocialComingSoon`/`onGoogle`/`onApple`/`onLinkedIn` in both files with real SDK calls that
retrieve a provider ID token, and (3) implement the backend verification endpoint in §3.4 to
exchange that token for a Saveur session.

## 3. Domain: Auth & Session

Backs `AuthContext.tsx` + `services/authService.ts`, consumed by `src/auth/Login/Login.tsx` and
the 3-step signup wizard (`src/auth/Signup/SignupFirstStep|SecondStep|ThirdStep.tsx`).

### 3.1 `POST /api/v1/auth/signup`
**Auth:** none

**Request:**
```ts
{
  email: string;
  password: string;
  name?: string;
  goals?: string[];
  industries?: string[];
  preferredCountries?: string[];
}
```
(This is the `SignUpPayload` type — fields are collected incrementally across
`SignupFirstStep`/`SignupSecondStep`/`SignupThirdStep` and submitted together at the end.)

**Response — 201:**
```ts
{
  uid: string;
  token: string;
  profile: UserProfileProps; // see §4 for shape
}
```

**Response — 409:** `{ error: { code: 'EMAIL_TAKEN', message: string } }`

**Business logic:** Create the auth credential (email/password) with whichever provider was
chosen in §2, then immediately create a `users/{uid}` profile record seeded with
`name` (default to the email's local-part if omitted), and empty/passed-through
`goals`/`industries`/`preferredCountries`, `subscriptionTier: 'free'`. The mock's
`defaultProfile()` helper in `services/authService.ts` is the authoritative shape for what a
freshly-created profile should default to.

### 3.2 `POST /api/v1/auth/login`
**Auth:** none

**Request:** `{ email: string; password: string }`

**Response — 200:** `{ uid: string; token: string; profile: UserProfileProps }`

**Response — 401:** `{ error: { code: 'INVALID_CREDENTIALS', message: string } }`

**Business logic:** Validate the credential against the chosen auth provider, then fetch and
return the matching profile record. Note: the current mock **always succeeds** (it fabricates a
fresh profile if none is cached locally) — the real backend must actually 401 on bad
credentials, which is new behavior the client needs to handle (see the `BACKEND TODO` in
`src/auth/Login/Login.tsx` — the `catch` block around `signIn()` is currently empty with a
comment that a real error needs to be surfaced to the user once real auth exists).

### 3.3 `POST /api/v1/auth/logout`
**Auth:** required

**Request:** none (or `{ refreshToken? }` if a custom JWT backend with revocable refresh tokens
is chosen)

**Response — 204**

**Business logic:** Revoke the session/refresh token server-side, if the chosen auth provider
supports it. The client also clears its own signed-in state but **intentionally does not clear
its local profile cache** on sign-out (see `services/authService.ts::signOut` comment) so the
next sign-in on the same device is instant — this is a client caching decision, not something
the backend needs to account for.

### 3.4 `POST /api/v1/auth/oauth/{provider}`
**Auth:** none · `provider` ∈ `google | apple | linkedin`

**Request:** `{ idToken: string }` (or an authorization `code` for LinkedIn, which doesn't issue
ID tokens the same way) — the client obtains this from the provider's native SDK / OAuth2 flow
after §2's client-side work is done.

**Response — 200 (existing user) / 201 (new user):**
```ts
{ uid: string; token: string; profile: UserProfileProps; isNewAccount: boolean }
```

**Business logic:** Verify the token/code with the provider, find-or-create a `users/{uid}`
record keyed by the provider's account id, and return a Saveur session the same shape as
signup/login. **This entire endpoint is net-new** — nothing in the current codebase implements
it, it's inferred purely from the three "coming soon" social buttons existing on the client with
no backend counterpart. Flag `isNewAccount` so the client knows whether to route into the
onboarding wizard (goals/industries/preferredCountries are never collected via OAuth) or straight
into the app.

## 4. Domain: User Profile

Backs `services/authService.ts`'s profile read/write functions and the multi-step signup wizard,
consumed by Profile/EditProfile screens and `AuthContext.tsx`.

**Shared type — `UserProfileProps`:**
```ts
interface UserProfileProps {
  email: string;
  name: string;
  goals: string[];
  industries: string[];
  preferredCountries: string[];
  subscriptionTier: 'free' | 'premium' | 'premium_plus';
}
```

### 4.1 `GET /api/v1/users/me`
**Auth:** required

**Response — 200:** `UserProfileProps`

**Business logic:** Replaces `services/authService.ts::getCurrentProfile()`, which today just
reads a locally-cached profile from AsyncStorage. The mock comment explicitly suggests keeping
an AsyncStorage cache as an **offline fallback** even after this is wired to a real endpoint, so
the app keeps working (read-only) without network.

### 4.2 `PATCH /api/v1/users/me`
**Auth:** required

**Request:** `Partial<UserProfileProps>`

**Response — 200:** `UserProfileProps` (full, updated)

**Business logic:** Replaces `services/authService.ts::updateProfile()`. Used both by an
"Edit Profile" screen and by the tail end of the signup wizard (to persist
goals/industries/preferredCountries once collected) and by the Subscription screen (to persist
`subscriptionTier` after a plan change — see §14, though a real implementation should likely
derive `subscriptionTier` server-side from actual payment-provider state rather than accept it
as a raw client-writable field once payments are real).

## 5. Domain: Interviews / Practice Sessions

Backs `services/interviewService.ts`, consumed by `MockInterviewSetup` →
`LiveInterviewSession`/`CodingInterview` → `InterviewFeedback`, and the Practice History tab.

**Shared types:**
```ts
enum Interview_Type_Enum {
  Behavioral, Technical, Coding, SystemDesign, ProductManagement,
  Sales, Marketing, Finance, Healthcare, CustomerService,
  Government, Consulting, Executive, Graduate, Internship,
}
enum Practice_Mode_Enum { Voice, Text, Video }
enum Difficulty_Enum { Beginner, Intermediate, Advanced }

interface SkillScoreProps { label: string; score: number }
interface StarBreakdownItemProps {
  letter: 'S' | 'T' | 'A' | 'R';
  label: string;
  score: number;
  note: string;
}
interface MockInterviewSessionProps {
  id: number | string;
  interviewType: Interview_Type_Enum;
  mode: Practice_Mode_Enum;
  difficulty: Difficulty_Enum;
  date: number | Date;
  durationMin: number;
  overallScore?: number;
  status: 'Completed' | 'Scheduled';
  videoAnalysis?: VideoAnalysisMetrics; // §5 note below — Video mode only
  company?: string;
  askedQuestions?: string[];
}
```

### 5.1 `POST /api/v1/interviews/sessions`
**Auth:** required

**Request:**
```ts
{
  interviewType: Interview_Type_Enum;
  mode: Practice_Mode_Enum;
  difficulty: Difficulty_Enum;
  timed: boolean;
  company?: string; // optional company the session is "targeted" at, for question-copy flavor
}
```

**Response — 201:** `{ sessionId: string; firstQuestion?: string }`

**Business logic:** This is where **adaptive question generation** belongs — the backend should
pick or LLM-generate the first question based on `interviewType`/`difficulty` (and `company`, if
present, for company-flavored prompts) and return it so the interview screen can render a real
prompt instead of today's static placeholder. The mock (`services/interviewService.ts::
startSession`) just mints a random `sessionId` and holds the config in an in-memory map — a real
backend should track in-progress sessions server-side (or in a document store) instead.

### 5.2 `POST /api/v1/interviews/sessions/{sessionId}/complete`
**Auth:** required

**Request:**
```ts
{
  transcript?: string;       // speech-to-text transcript, for Voice/Video modes
  recordingUri?: string;     // uploaded audio/video file reference, once recordingService is real
  codeSubmissions?: string;  // for Coding-type sessions
  videoAnalysis?: VideoAnalysisMetrics; // Video-mode only — see §5 note below
  askedQuestions?: string[]; // adaptive follow-up questions actually surfaced during the session
}
```

**Response — 200:**
```ts
{
  overallScore: number;
  skillScores: SkillScoreProps[]; // 7 fixed labels: Confidence, Communication, Technical Skill,
                                  // Leadership, Problem Solving, Creativity, Critical Thinking
  starBreakdown: StarBreakdownItemProps[]; // S/T/A/R, each with score + a coaching note
  videoAnalysis?: VideoAnalysisMetrics;
}
```

**Business logic:** This is the real scoring pipeline: transcript analysis (speech-to-text
already done client-side for Voice/Video — see §5.3), STAR-method detection, and an LLM- or
rubric-based scorer belong behind this endpoint. Persist the completed session
(`MockInterviewSessionProps`) so it shows up in Practice History (§5.3). Calling this endpoint
again for an already-completed `sessionId` should **update the existing record in place** rather
than create a duplicate (e.g. `InterviewFeedback` re-calls this on mount) — and should fall back
to whatever `videoAnalysis`/`askedQuestions` was already persisted if the caller omits them on a
re-call. For **Video mode** specifically: the frame-level face-detection and speech-to-text
signal collection is already real and on-device (§5 sidebar below) — a backend's job here is
mainly to take over the *aggregation/confidence-scoring* of that signal with a properly
calibrated model, not to re-collect the raw signal.

### 5.3 `GET /api/v1/interviews/sessions`
**Auth:** required

**Query params:** `status?: 'Completed' | 'Scheduled'`, `page?`, `pageSize?` (standard
pagination — not specified by the mock, which returns everything at once)

**Response — 200:**
```ts
{
  sessions: MockInterviewSessionProps[]; // most recent first
  page: number;
  pageSize: number;
  total: number;
}
```

**Business logic:** Replaces `services/interviewService.ts::getPracticeHistory()`. Backs both
the "Upcoming" and "Completed" tabs of Practice History (client filters by `status`).

### Sidebar — Video Analysis Signal (real, on-device, not mocked)

`services/videoAnalysisService.ts` is a **real** implementation, not a mock — it drives
`react-native-vision-camera` (v4.x, pinned deliberately — v5 rewrote frame processors around
Nitro Modules and the face-detector plugin is only confirmed compatible with v4's JSI-based
frame processor API) + `react-native-vision-camera-face-detector` (on-device Google ML Kit face
detection — bounding box, head yaw/pitch, smiling probability) + `@dev-amirzubair/
react-native-voice` (on-device speech-to-text, a New-Architecture-compatible fork of the
abandoned `@react-native-voice/voice`). None of it calls a cloud API today.

```ts
interface VideoAnalysisMetrics {
  eyeContactPct: number;   // % of sampled frames within a ~15° yaw/pitch "looking at camera" threshold
  smilePct: number;        // % of sampled frames with smilingProbability > 0.5
  avgHeadYaw: number;
  avgHeadPitch: number;
  fillerWordCount: number;
  fillerWordBreakdown: Record<string, number>; // { um: 3, like: 5, "you know": 2, ... }
  speakingRateWpm: number;
  silenceGapCount: number; // gaps > 4s between speech segments ("awkward pauses")
  confidenceScore: number; // 0-100, weighted blend — see formula below
}
```

The client-side `confidenceScore` heuristic (documented in full in
`services/videoAnalysisService.ts` as `CONFIDENCE_SCORE_FORMULA`):
```
confidenceScore =
    eyeContactPct                          * 0.40
  + smilePct                               * 0.15
  + max(0, 100 - fillerWordCount * 4)      * 0.25
  + speakingPaceScore(speakingRateWpm)     * 0.10   (110-160 wpm ideal, tapers outside)
  + max(0, 100 - silenceGapCount * 15)     * 0.10
  ... clamped [0,100], rounded
```

**Optional future endpoint — `POST /api/v1/interviews/sessions/{sessionId}/video-analysis`:**
a backend could accept the raw per-frame samples + transcript and return a properly
trained/calibrated `confidenceScore` + richer coaching notes, without changing the
`VideoAnalysisMetrics` contract `InterviewFeedback` already renders against. This is explicitly
called out as a nice-to-have in the source comment, not a requirement — the on-device heuristic
is functional today.

## 6. Domain: Resume

Backs `services/resumeService.ts`, consumed by `src/more/ResumeBuilder.tsx`.

### 6.1 `POST /api/v1/resume/import`
**Auth:** required · `Content-Type: multipart/form-data`

**Request:** `{ sourceKey: 'resume'|'linkedin'|'portfolio'|'certificates'|'transcript'; file: File }`

The file is a **real, on-device, user-picked file** — `ResumeBuilder.tsx` already uses the native
document picker (`@react-native-documents/picker`) to let the user pick a real PDF/DOC/DOCX/
image/text file. Today, `resumeService.ts::importSource` only persists the file's
name/size/mimeType locally; it never uploads the actual bytes anywhere. That upload is the real
gap this endpoint fills.

**Response — 200:** `{ sourceKey: string; status: 'imported'; parsedPreviewUrl?: string }`

**Business logic:** Upload and store the file, associate it with the user + `sourceKey`.
`parsedPreviewUrl` is optional — a rendered/parsed preview link, if the backend does any
server-side text extraction at import time rather than only at analyze time (§6.3).

### 6.2 `GET /api/v1/resume/imports`
**Auth:** required

**Response — 200:** `Record<ResumeImportSourceKey, ImportedFileInfo>` where
```ts
interface ImportedFileInfo { uri: string; name: string; sizeBytes?: number; mimeType?: string }
```

**Business logic:** Replaces `services/resumeService.ts::getImportedSources()`. Lets the screen
restore its "Uploaded" badges per source on mount instead of resetting every visit.

### 6.3 `POST /api/v1/resume/analyze`
**Auth:** required

**Request:** `{}` (server looks up the user's most recently imported resume — no body needed per
the mock's own comment)

**Response — 200:** `{ atsScore: number; tips: string[] }` (`atsScore` 0–100)

**Business logic:** Run a real resume-parsing + ATS-scoring pass server-side — extract text,
check for contact info/section completeness/keyword density/formatting issues that would trip up
an ATS parser (e.g. tables/graphics). The mock's `tips` pool (for reference on tone/scope):
quantifiable achievements, keyword mirroring against target JDs, avoiding tables/graphics,
adding a skills section, leading with action verbs, trimming to 1–2 pages.

### 6.4 `POST /api/v1/resume/rewrite-bullet`
**Auth:** required

**Request:** `{ text: string }`

**Response — 200:** `{ rewritten: string; explanation: string }`

**Business logic:** Swap for a real LLM call. Pass the user's actual role/seniority as context
(so any injected metric isn't a generic placeholder) and, per the mock's own convention, if a
plausible-but-fabricated number is injected because the original bullet had none, **flag it in
the response/UI as a placeholder the user must replace with a real number** — same as the
current rule-based mock does (it appends a metric like "improving efficiency by 27%" and calls
that out explicitly in `explanation`).

## 7. Domain: Job Description Analyzer

Backs `services/jdService.ts`, consumed by `src/more/JDAnalyzer.tsx`. Stateless — no persistence
needed on either side.

### 7.1 `POST /api/v1/jd/analyze`
**Auth:** required

**Request:** `{ jobDescriptionText: string }`

**Response — 200:** `{ score: number; missingSkills: string[]; keywordSuggestions: string[] }`
(`score` 0–100)

**Business logic:** Run a real resume-vs-JD comparison server-side — embedding similarity plus
keyword/skill extraction, compared against the user's most recently imported/analyzed resume
(§6). This should read from the same resume data §6.1–6.3 manage, not take the resume as part of
this request.

## 8. Domain: Applications Tracker

Backs `services/applicationsService.ts`, consumed by the Interviews tab's Applications view
(`RequestsSrc`/`ApplicationsTab`/`ApplicationItem`).

**Shared types:**
```ts
enum Application_Stage_Enum { Applied, Interviewing, Offer, Rejected }
interface JobApplicationProps {
  id: number | string;
  company: string;
  role: string;
  location: string;
  logo: ImageRequireSource; // client asset reference today — backend should likely return a URL
  appliedDate: number | Date;
  stage: Application_Stage_Enum;
  nextStep?: string;
}
```

### 8.1 `GET /api/v1/applications`
**Auth:** required

**Response — 200:** `JobApplicationProps[]`, newest `appliedDate` first (pagination optional —
mock returns the full list; add `page`/`pageSize` if the list is expected to grow large).

### 8.2 `POST /api/v1/applications`
**Auth:** required

**Request:** `Omit<JobApplicationProps, 'id'>`

**Response — 201:** `JobApplicationProps` (with server-assigned `id`)

### 8.3 `PATCH /api/v1/applications/{id}`
**Auth:** required

**Request:** `{ stage: Application_Stage_Enum }`

**Response — 200:** `JobApplicationProps` (updated)

**Business logic:** Moves an application through the pipeline (Applied → Interviewing →
Offer/Rejected). The mock only ever patches `stage` today, but a full "edit application" form
would reasonably widen this to `Partial<JobApplicationProps>`.

### 8.4 `DELETE /api/v1/applications/{id}`
**Auth:** required

**Response — 204**

## 9. Domain: Coach Chat

Backs `services/coachService.ts`, consumed by the Coach tab (`src/messages/Chat.tsx`). **There
is no real LLM behind this today** — replies are chosen by simple keyword-matching against the
user's message text (rules for salary/nerves/resume/coding/networking/thanks keywords, falling
back to a generic-encouragement pool).

**Shared type:**
```ts
interface CoachChatMessageProps {
  id: string;
  role: 'user' | 'coach';
  text: string;
  createdAt: number;
}
```

### 9.1 `GET /api/v1/coach/messages`
**Auth:** required

**Response — 200:** `CoachChatMessageProps[]` (seeded with a greeting message on a brand-new
account — see the mock's `GREETING_MESSAGE` for the current copy/tone if useful as a reference)

### 9.2 `POST /api/v1/coach/messages`
**Auth:** required

**Request:** `{ text: string }`

**Response — 200:** `{ userMessage: CoachChatMessageProps; coachMessage: CoachChatMessageProps }`

**Business logic:** Replace the keyword-matching with a real LLM chat-completion call. The mock
comment specifically suggests passing the user's **recent practice history and resume context**
(§5, §6) as system context so replies are actually personalized rather than keyword-bucketed.
Persist both the user's message and the coach's reply to history.

### 9.3 `DELETE /api/v1/coach/messages`
**Auth:** required

**Response — 204**

**Business logic:** "Reset conversation" — clears history back to just the greeting message.

## 10. Domain: Salary Negotiation

Backs `services/salaryNegotiationService.ts`, consumed by `src/practice/SalaryNegotiation.tsx` —
a scenario-based negotiation simulator (mock offer → user picks an approach each round → mocked
"recruiter response" + updated offer, for a fixed 3 rounds).

**Shared types:**
```ts
interface SalaryOffer {
  company: string; title: string;
  baseSalary: number; bonus: number; signingBonus: number; equity: string;
}
type NegotiationApproachId =
  | 'counter_number' | 'full_package' | 'enthusiasm_buy_time' | 'competing_offer';
interface NegotiationApproach { id: NegotiationApproachId; title: string; description: string }
```

### 10.1 `GET /api/v1/negotiation/scenario`
**Auth:** required

**Response — 200:** `{ offer: SalaryOffer; approaches: NegotiationApproach[]; totalRounds: number }`

**Business logic:** Generate a fresh scenario to negotiate against. The mock picks randomly from
a static pool of 4 fictional offers; a real implementation could instead generate this from the
user's actual tracked applications/offers (§8) so the practice scenario reflects a real
opportunity the user is pursuing.

### 10.2 `POST /api/v1/negotiation/rounds`
**Auth:** required

**Request:** `{ round: number; approachId: NegotiationApproachId; currentOffer: SalaryOffer }`

**Response — 200:** `{ recruiterResponse: string; updatedOffer: SalaryOffer; isFinalRound: boolean }`

**Business logic:** `isFinalRound` should be `true` once `round >= totalRounds` (3 in the mock).
A real version of this could be LLM-driven — generating a recruiter-persona response grounded in
the chosen approach and the negotiation history so far, rather than the mock's templated
percentage bumps (which do vary by approach: e.g. `competing_offer` yields the largest single
base-salary bump but is framed as the "riskiest" tactic, `full_package` bumps bonus/signing
instead of base, etc. — useful as a rough calibration reference for tone/scale).

### 10.3 `POST /api/v1/negotiation/sessions/complete`
**Auth:** required

**Request:** `{ initialOffer: SalaryOffer; finalOffer: SalaryOffer }`

**Response — 200:** `{ summary: string; totalIncreasePct: number }`

**Business logic:** `totalIncreasePct` is computed off `baseSalary` movement
(`(final - initial) / initial * 100`, rounded). Persist a summary entry (id, date, company,
title, initialBase, finalBase, increasePct) for negotiation history (§10.4).

### 10.4 `GET /api/v1/negotiation/sessions`
**Auth:** required

**Response — 200:** `NegotiationHistoryEntry[]` (most recent first), where
```ts
interface NegotiationHistoryEntry {
  id: string; date: number; company: string; title: string;
  initialBase: number; finalBase: number; increasePct: number;
}
```

## 11. Domain: Coding Practice / Code Review

Backs `services/codeReviewService.ts`, consumed by `src/practice/CodingInterview.tsx`'s "Test
Cases" panel and "Get AI Code Review" button. **Neither is real today** — no code is actually
executed anywhere; test pass/fail is derived from the submitted code's length/hash, and review
feedback is picked from small canned pools based on cheap heuristics (loop count as a complexity
proxy, short variable names).

### 11.1 `POST /api/v1/coding/run-tests`
**Auth:** required

**Request:** `{ code: string; language: string; testCases?: TestCase[] }` where
`interface TestCase { input: string; expectedOutput: string }`

**Response — 200:** `{ results: TestRunResult[]; passedCount: number }` where
`interface TestRunResult extends TestCase { passed: boolean }`

**Business logic:** This is where a **real sandboxed code-execution service** belongs (e.g. a
Judge0-style isolated container runner) — actually run the submitted code against each test
case and diff the real output. The mock's hardcoded `TEST_CASES` are for a static "Two Sum"
prompt; a real implementation should key test cases off the actual problem assigned for the
session (tie back to §5.1's `startSession`/adaptive question selection, once that's real).

### 11.2 `POST /api/v1/coding/review`
**Auth:** required

**Request:** `{ code: string; language: string }`

**Response — 200:** `{ complexityNote: string; feedback: string[] }`

**Business logic:** Swap for a real LLM call with the code (and ideally the problem statement)
as context, so feedback is grounded in what was actually written rather than pattern-matched
heuristics (current mock: counts `for`/`while` occurrences as an O(n)/O(n²) proxy, flags short
1-letter variable names, picks from small edge-case/style-note pools).

## 12. Domain: Networking Assistant

Backs `services/networkingService.ts`, consumed by `src/more/NetworkingAssistant.tsx` — a simple
contacts tracker (name, company, role, last-contacted date, note). Structurally mirrors §8
(Applications) closely.

**Shared type:**
```ts
interface NetworkingContactProps {
  id: number | string;
  name: string;
  company: string;
  role: string;
  lastContactedDate: number | Date | null;
  note?: string;
}
```

### 12.1 `GET /api/v1/networking/contacts`
**Auth:** required

**Response — 200:** `NetworkingContactProps[]`, most recently contacted first.

### 12.2 `POST /api/v1/networking/contacts`
**Auth:** required

**Request:** `Omit<NetworkingContactProps, 'id'>`

**Response — 201:** `NetworkingContactProps` (with server-assigned `id`)

### 12.3 `PATCH /api/v1/networking/contacts/{id}`
**Auth:** required

**Request:** `Partial<Omit<NetworkingContactProps, 'id'>>`

**Response — 200:** `NetworkingContactProps` (updated) — e.g. after logging a follow-up, update
`lastContactedDate`/`note`.

### 12.4 `DELETE /api/v1/networking/contacts/{id}`
**Auth:** required

**Response — 204**

## 13. Domain: Learning Courses

Backs `src/more/LearningCourses.tsx`. **Fully mocked today** — the course catalog and progress
bars are static data from `constants/Data.ts` (`DATA_COURSES`), and tapping "Start" on any course
just shows a `"Course content coming soon."` alert. No `services/*.ts` file backs this yet; the
`BACKEND TODO` comment lives directly on the screen file.

**Shared type (from `constants/Data.ts`, promote to `constants/Types.tsx` when implementing):**
```ts
interface CourseProps {
  id: string;
  title: string;
  description: string;
  durationMin: number;
  category: 'Behavioral' | 'Technical' | 'Salary Negotiation' | 'Resume' | 'System Design' | 'Networking';
  totalModules: number;
  completedModules: number;
}
```

### 13.1 `GET /api/v1/learning/courses`
**Auth:** required

**Response — 200:** `CourseProps[]`, with `completedModules` reflecting the current user's real
progress (today it's static/identical for every user).

### 13.2 `GET /api/v1/learning/courses/{id}`
**Auth:** required

**Response — 200:** course detail + lesson content (shape not specified anywhere in the current
code — there is no lesson-viewer UI yet, "Start" is a placeholder alert). Treat this as the
biggest open design question in this domain: decide on a lesson-content format (video refs,
markdown, structured steps) before building the viewer screen.

### 13.3 `POST /api/v1/learning/courses/{id}/progress`
**Auth:** required

**Request:** `{ completedModules: number }` or `{ moduleId: string }` depending on how granular
lesson tracking ends up being.

**Response — 200:** `CourseProps` (updated)

**Business logic:** Net-new — replaces the local-only static progress bars with real
server-tracked completion.

## 14. Domain: Subscriptions / Payments

Backs `src/more/Subscription.tsx`. **No real payment processing exists** — "Subscribe" just
calls `AuthContext.updateProfile({ subscriptionTier })` (§4.2), i.e. it flips a field on the
user's profile record directly with no payment ever collected. The screen's own comment states
this plainly: *"no real payment processing (that needs a real backend + Stripe/RevenueCat, out
of scope for this pass)."*

**Plans** (`PlanId = UserProfileProps['subscriptionTier']`, i.e. `'free' | 'premium' |
'premium_plus'`), as currently defined client-side in `Subscription.tsx`:

| Plan | Price | Key features (client-side copy only — not enforced anywhere server-side) |
|---|---|---|
| `free` | $0/mo | 3 mock interviews/month, basic ATS scan, limited coach chat |
| `premium` | $14.99/mo | Unlimited mock interviews, Video mode analysis, AI bullet rewriting, salary negotiation simulator |
| `premium_plus` | $29.99/mo | Everything in Premium + AI code review, unlimited coach chat, system design whiteboard export |

None of the per-plan feature gates (interview count limits, chat limits, etc.) are actually
enforced anywhere in the app today — every feature is available regardless of `subscriptionTier`.
Implementing real enforcement is a separate, larger task beyond wiring up payment collection.

### 14.1 `GET /api/v1/subscriptions/plans`
**Auth:** none (or required — plans are static, but keeping it public simplifies pre-signup
paywall screens)

**Response — 200:** the plan table above, structured, plus real payment-provider price IDs
(e.g. Stripe `price_...` IDs) once a provider is chosen.

### 14.2 `POST /api/v1/subscriptions/subscribe`
**Auth:** required

**Request:** `{ planId: 'premium' | 'premium_plus'; paymentMethodToken: string }` (shape depends
entirely on the payment provider chosen — e.g. a Stripe `PaymentMethod` ID from Stripe's mobile
SDK, or a RevenueCat purchase receipt)

**Response — 200:** `{ profile: UserProfileProps }` (updated, with new `subscriptionTier`)

**Business logic:** **Net-new — this is the actual payment-collection gap.** Charge the payment
method via whichever provider is chosen (Stripe and RevenueCat are the two explicitly named in
the source comment; RevenueCat is worth strong consideration given this is a cross-platform
mobile app needing App Store/Play Store subscription compliance), then update
`subscriptionTier` on the user's profile only after payment succeeds — do not let the client set
`subscriptionTier` directly the way the current mock does.

### 14.3 `POST /api/v1/subscriptions/cancel`
**Auth:** required

**Response — 200:** `{ profile: UserProfileProps }` (with `subscriptionTier: 'free'`, effective
either immediately or at period end — pick one and reflect it in the response)

### 14.4 `GET /api/v1/subscriptions/me`
**Auth:** required

**Response — 200:** `{ tier: UserProfileProps['subscriptionTier']; renewsAt?: number; cancelAtPeriodEnd?: boolean }`

### 14.5 `POST /api/v1/webhooks/payments`
**Auth:** provider signature verification (not a user bearer token)

**Business logic:** Standard payment-provider webhook receiver (Stripe/RevenueCat/App Store
Server Notifications/Play Billing) to keep `subscriptionTier` in sync with renewals, failed
charges, refunds, and cancellations that originate outside the app (e.g. cancelled from the App
Store directly). This is standard practice, not implied by any existing comment — flagged here
because a subscription system without one will drift out of sync with the real payment state.

## 15. Domain: Gamification / Badges

Backs the badge-unlock UI on `src/home/HomeSrc.tsx`. **Computed entirely client-side today** —
badge unlock state is derived on-device from practice-session count, streak, resume-import
count, and networking-contact count (each already fetched from the real services above). The
badge *definitions* are static data (`constants/Data.ts` → `DATA_BADGES`).

```ts
interface BadgeDefinitionProps {
  id: string; title: string; description: string; icon: string; iconPack?: 'assets' | 'eva';
}
```

10 badges currently defined: `first_interview`, `five_sessions`, `ten_sessions`,
`three_day_streak`, `five_day_streak`, `perfect_score`, `resume_uploaded`, `ats_optimized`,
`coding_complete`, `networker`.

### 15.1 `GET /api/v1/badges`
**Auth:** required (or none — definitions are static/global)

**Response — 200:** `BadgeDefinitionProps[]`

### 15.2 `GET /api/v1/badges/me`
**Auth:** required

**Response — 200:** `{ unlockedBadgeIds: string[]; unlockedAt: Record<string, number> }`

**Business logic:** The explicit ask in the source comment: *"once a real backend exists, badge
unlocks should be computed/awarded server-side so they can't be spoofed by tampering with local
AsyncStorage."* Move the unlock-condition evaluation (session counts, streak calculation, ATS
score threshold, contact count) server-side, ideally computed as a side effect of the events that
feed it (session completion in §5.2, resume analysis in §6.3, contact creation in §12.2) rather
than recalculated from scratch on every profile load.

## 16. Not Yet Speced — Flagged for Follow-Up

These surfaced during the audit but don't have enough contract detail in the source comments to
spec responsibly — listed here so they aren't silently dropped:

- **Push / in-app notifications** — `navigation/MainBottomTab.tsx` has a `TODO: wire up to real
  push/in-app notifications once backend exists` around the "Your AI Coach" notification modal
  that currently fires on every Interviews-tab open with static content. No request/response
  shape is implied anywhere; likely needs its own device-token-registration endpoint (APNs/FCM)
  plus a notification-events table, standard for either provider.
- **System Design Whiteboard export/save** (`src/practice/SystemDesignWhiteboard.tsx`) — a
  freehand SVG sketch surface (react-native-svg + PanResponder, deliberately avoiding a new
  native drawing dependency). Currently fully local/ephemeral with no save or export path. The
  Premium+ plan copy in Subscription.tsx promises "system design whiteboard **+ export**" —
  that's the only hint an export/save endpoint is expected eventually; no shape is implied.
- **Voice/Text-mode real recording** (`services/recordingService.ts`) — flagged in §1. Once a
  real camera/mic library replaces the simulated timer, session-completion requests (§5.2) should
  expect a real `recordingUri` to accompany Voice/Text-mode sessions the same way Video mode
  already produces real analysis data.

## 17. Conventions Used Throughout This Spec

- **Base path:** `/api/v1` — versioned from day one since this is a pre-launch app; bump to `v2`
  for breaking changes later rather than breaking existing mobile clients in the field.
- **Auth header:** `Authorization: Bearer <token>` on every endpoint marked "Auth: required".
- **Error shape** (not specified by any mock — standard convention applied uniformly):
  ```ts
  { error: { code: string; message: string; details?: unknown } }
  ```
- **Pagination** (where noted): `?page=1&pageSize=20` query params, response wraps the array as
  `{ items: T[], page, pageSize, total }`. Most list endpoints here (`GET /applications`,
  `GET /networking/contacts`, etc.) return the full array in the current mock since local data
  volumes are small — add real pagination once user data volume justifies it.
- **IDs:** the mock generates client-visible IDs like `app_${Date.now()}` / `contact_${Date.now()}`
  — replace with real server-assigned IDs (UUID/ULID/DB auto-increment) on every `POST` that
  creates a resource; do not let the client dictate IDs.
- **Timestamps:** the codebase mixes `number` (epoch ms) and `Date` in several types
  (`appliedDate`, `lastContactedDate`, `date`) — standardize on epoch-ms numbers over the wire
  (matches what most of the mock already persists via `Date.now()`) and let the client format
  for display.
