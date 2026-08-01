import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// sharesService — in-app, user-to-user sharing by username (product request
// item: "I want to add a feature to this app where other users can share
// the AI feedback, recorded video interview alongside the flagged moments,
// and Jobs to other users of these app... using their usernames"). Backed
// by Saveur-Backend's app/api/shares.py + app/services/shares_service.py.
//
// This is ADDITIVE to, not a replacement for, the existing "regular
// sharing" paths (services/jobShareService.ts's OS share sheet for jobs,
// and any future equivalent for feedback/video) — both stay available side
// by side, matching the product request's "...and regular sharing."
// ---------------------------------------------------------------------------

export type SharedContentType = 'feedback' | 'video' | 'job';

export interface SharedContentPreview {
  role?: string;
  company?: string;
  interviewType?: string;
  overallScore?: number;
  title?: string;
  location?: string;
}

export interface ReceivedShareProps {
  id: string;
  senderUsername: string;
  contentType: SharedContentType;
  contentId: string;
  message?: string;
  createdAt: number;
  read: boolean;
  preview: SharedContentPreview;
}

interface WireShare {
  id: string;
  sender_username: string;
  content_type: SharedContentType;
  content_id: string;
  message?: string | null;
  created_at: string;
  read: boolean;
  preview?: {
    role?: string; company?: string; interview_type?: string;
    overall_score?: number; title?: string; location?: string;
  };
}

function fromWire(w: WireShare): ReceivedShareProps {
  return {
    id: w.id,
    senderUsername: w.sender_username,
    contentType: w.content_type,
    contentId: w.content_id,
    message: w.message ?? undefined,
    createdAt: w.created_at ? new Date(w.created_at).getTime() : Date.now(),
    read: !!w.read,
    preview: {
      role: w.preview?.role,
      company: w.preview?.company,
      interviewType: w.preview?.interview_type,
      overallScore: w.preview?.overall_score,
      title: w.preview?.title,
      location: w.preview?.location,
    },
  };
}

/** POST /api/v1/shares — shares one piece of content (an interview
 * session's feedback or video replay, or a job alert) to another Saveur
 * user by username. Throws on failure (invalid content, recipient not
 * found, etc.) so the composer can show the real reason — see
 * ShareToUserModal's catch block for the code -> message mapping. */
export async function shareContent(params: {
  recipientUsername: string;
  contentType: SharedContentType;
  contentId: string | number;
  message?: string;
}): Promise<void> {
  await apiClient.post('/api/v1/shares', {
    recipient_username: params.recipientUsername,
    content_type: params.contentType,
    content_id: String(params.contentId),
    message: params.message,
  });
}

export interface RecipientLookupResult {
  exists: boolean;
  connected: boolean;
}

/** GET /api/v1/shares/recipient-lookup?username=X — live as-you-type check
 * for the share composer, mirroring authService.checkUsernameAvailability's
 * pattern. Now also reports `connected` (product request item: sharing is
 * gated on an accepted connection — see send/respondConnectionRequest below)
 * so the composer knows whether to show "Send" or "Send connection
 * request." Swallows errors into `{exists: false, connected: false}`
 * (advisory only — the real validation happens server-side on submit). */
export async function checkRecipientExists(username: string): Promise<RecipientLookupResult> {
  try {
    const {data} = await apiClient.get<{exists: boolean; connected: boolean}>(
      '/api/v1/shares/recipient-lookup',
      {params: {username}},
    );
    return {exists: !!data.exists, connected: !!data.connected};
  } catch {
    return {exists: false, connected: false};
  }
}

// ---------------------------------------------------------------------------
// Connections (product request item: "Before a user can share something
// with another Saveur user they must send a request first and until the
// other person accept it then they can now be able to send or share with
// that user... If the other user did not accept it should go to pending
// requests until the user accept or declines").
// ---------------------------------------------------------------------------

export interface PendingConnectionRequest {
  id: string;
  requesterUsername: string;
  createdAt: number;
}

interface WirePendingConnection {
  id: string;
  requester_username: string;
  created_at: string | null;
}

/** POST /api/v1/shares/connections — send a connection request to a
 * recipient by username. If the recipient already has an unanswered
 * request out to the sender, the backend auto-accepts instead of leaving
 * two pending rows (`auto_accepted: true` in the response). Throws on
 * failure (recipient not found, already connected, request already sent,
 * etc.) so the composer can show the real reason. */
export async function sendConnectionRequest(recipientUsername: string): Promise<{
  id: string;
  status: 'pending' | 'accepted' | 'declined';
  autoAccepted: boolean;
}> {
  const {data} = await apiClient.post<{id: string; status: string; auto_accepted: boolean}>(
    '/api/v1/shares/connections',
    {recipient_username: recipientUsername},
  );
  return {
    id: data.id,
    status: data.status as 'pending' | 'accepted' | 'declined',
    autoAccepted: !!data.auto_accepted,
  };
}

/** GET /api/v1/shares/connections/pending — incoming connection requests
 * awaiting this user's accept/decline. Used by the Pending Requests
 * screen. */
export async function listPendingConnectionRequests(): Promise<PendingConnectionRequest[]> {
  const {data} = await apiClient.get<WirePendingConnection[]>('/api/v1/shares/connections/pending');
  return (data ?? []).map(w => ({
    id: w.id,
    requesterUsername: w.requester_username,
    createdAt: w.created_at ? new Date(w.created_at).getTime() : Date.now(),
  }));
}

/** POST /api/v1/shares/connections/{id}/accept or /decline — respond to an
 * incoming connection request. Throws on failure (not found, already
 * responded). */
export async function respondToConnectionRequest(
  requestId: string,
  accept: boolean,
): Promise<{id: string; status: 'accepted' | 'declined'}> {
  const {data} = await apiClient.post<{id: string; status: string}>(
    `/api/v1/shares/connections/${requestId}/${accept ? 'accept' : 'decline'}`,
  );
  return {id: data.id, status: data.status as 'accepted' | 'declined'};
}

/** GET /api/v1/shares — everything shared TO the current user, newest
 * first. Used by src/more/SharedWithMe.tsx. */
export async function listReceivedShares(): Promise<ReceivedShareProps[]> {
  const {data} = await apiClient.get<WireShare[]>('/api/v1/shares');
  return (data ?? []).map(fromWire);
}

// The full, viewable payload for one share — shape of `content` depends on
// contentType: feedback/video get feedback.py's existing score/STAR/voice/
// camera (+ transcript/annotations/video_url for video) fields plus
// role/company/interviewType/mode/difficulty context; job gets the same
// JobAlert fields JobAlertDetails.tsx already renders.
export interface SharedContentDetailProps {
  id: string;
  senderUsername: string;
  contentType: SharedContentType;
  message?: string;
  createdAt: number;
  content: Record<string, any>;
}

/** GET /api/v1/shares/{id} — the full content for one share (marks it read
 * server-side the first time the recipient opens it). Throws on failure
 * (not found, or the original content was since deleted) so
 * SharedContentDetail.tsx can show a real error instead of a blank screen. */
export async function getShareDetail(shareId: string): Promise<SharedContentDetailProps> {
  const {data} = await apiClient.get<{
    id: string; sender_username: string; content_type: SharedContentType;
    message?: string | null; created_at: string; content: Record<string, any>;
  }>(`/api/v1/shares/${shareId}`);
  return {
    id: data.id,
    senderUsername: data.sender_username,
    contentType: data.content_type,
    message: data.message ?? undefined,
    createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
    content: data.content,
  };
}
