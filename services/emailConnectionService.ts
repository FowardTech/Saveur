import {Linking} from 'react-native';
import apiClient from './apiClient';
import {EmailConnectionProps} from 'constants/Types';

// ---------------------------------------------------------------------------
// Job Tracker inbox auto-scan — "Connect Gmail" / "Connect Outlook", the
// real "auto-detect status changes by scanning the user's inbox" feature
// (see src/requests/Applications/AddFromEmail.tsx's own comment for why the
// paste/forward flow shipped first, and Saveur-Backend's
// app/api/gmail_auth.py / outlook_auth.py for the OAuth flow this drives —
// structurally the same pattern as linkedinAuthService.ts's "Sign in with
// LinkedIn", except this LINKS an inbox to the already-signed-in user
// instead of authenticating a new session:
//   1. GET /api/v1/auth/{provider}/start -> an authorize URL, opened in the
//      system browser (same Linking.openURL pattern as LinkedIn/Stripe).
//   2. The user approves on Google/Microsoft's own consent page. The
//      provider redirects to the BACKEND's callback (has to be https, not
//      a custom scheme — same constraint LinkedIn's flow has), which
//      exchanges the code, stores the (encrypted) refresh token, and 302s
//      the browser to saveur://gmail-connected?ok=1&email=... or
//      saveur://outlook-connected?... — this app's own custom scheme.
//   3. App.tsx's Linking listener forwards every incoming URL to
//      handleIncomingUrl below, which resolves whatever connect() call is
//      currently waiting.
// No token or credential ever reaches this app directly — connect() only
// ever resolves with ok/error + the connected inbox's display address.
// ---------------------------------------------------------------------------

export type EmailProvider = 'gmail' | 'outlook';

export interface EmailConnectResult {
  ok: boolean;
  email?: string;
  error?: string;
}

async function getAuthorizeUrl(provider: EmailProvider): Promise<string> {
  const {data} = await apiClient.get<{url: string}>(`/api/v1/auth/${provider}/start`);
  return data.url;
}

// Plain regex rather than URL()/URLSearchParams — same reasoning as
// linkedinAuthService.ts's parseRedirect (custom scheme URLs don't always
// parse cleanly across RN's JS engines).
function parseRedirect(provider: EmailProvider, url: string): EmailConnectResult | null {
  const marker = `${provider}-connected`;
  if (!url.includes(marker)) return null;
  const okMatch = url.match(/[?&]ok=([^&]+)/);
  const emailMatch = url.match(/[?&]email=([^&]+)/);
  const errorMatch = url.match(/[?&]error=([^&]+)/);
  return {
    ok: okMatch ? okMatch[1] === '1' : false,
    email: emailMatch ? decodeURIComponent(emailMatch[1]) : undefined,
    error: errorMatch ? decodeURIComponent(errorMatch[1]) : undefined,
  };
}

let pendingResolve: {gmail?: (r: EmailConnectResult) => void; outlook?: (r: EmailConnectResult) => void} = {};

/** Called from App.tsx's Linking handler for every incoming URL — a no-op
 * for anything that isn't one of these two specific redirects. */
export function handleIncomingUrl(url: string | null | undefined): void {
  if (!url) return;
  (['gmail', 'outlook'] as EmailProvider[]).forEach(provider => {
    const result = parseRedirect(provider, url);
    if (!result) return;
    const resolve = pendingResolve[provider];
    if (resolve) {
      resolve(result);
      pendingResolve[provider] = undefined;
    }
  });
}

// Same "no reliable browser-cancel signal" limitation as LinkedIn/Stripe's
// own system-browser hand-offs — time out rather than hang forever if the
// user just closes the browser tab without finishing.
const REDIRECT_TIMEOUT_MS = 5 * 60 * 1000;

/** Opens the provider's consent page in the system browser and resolves
 * once the app receives the callback redirect (or rejects on timeout/no
 * browser). */
export async function connect(provider: EmailProvider): Promise<EmailConnectResult> {
  const url = await getAuthorizeUrl(provider);
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    throw new Error('This device cannot open the sign-in page.');
  }

  const resultPromise = new Promise<EmailConnectResult>((resolve, reject) => {
    pendingResolve[provider] = resolve;
    setTimeout(() => {
      if (pendingResolve[provider]) {
        pendingResolve[provider] = undefined;
        reject(new Error('Connecting timed out.'));
      }
    }, REDIRECT_TIMEOUT_MS);
  });

  await Linking.openURL(url);
  return resultPromise;
}

interface EmailConnectionWire {
  provider: EmailProvider;
  email_address: string | null;
  is_active: boolean;
  connected_at: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
}

function fromWire(wire: EmailConnectionWire): EmailConnectionProps {
  return {
    provider: wire.provider,
    emailAddress: wire.email_address,
    isActive: wire.is_active,
    connectedAt: wire.connected_at ? new Date(wire.connected_at).getTime() : null,
    lastSyncedAt: wire.last_synced_at ? new Date(wire.last_synced_at).getTime() : null,
    lastSyncError: wire.last_sync_error,
  };
}

/** GET /api/v1/email-connections — every active inbox connection for the
 * signed-in user (0, 1, or 2 rows — Gmail and/or Outlook). */
export async function listConnections(): Promise<EmailConnectionProps[]> {
  const {data} = await apiClient.get<{data: EmailConnectionWire[]}>('/api/v1/email-connections');
  return (data.data ?? []).map(fromWire);
}

/** DELETE /api/v1/email-connections/{provider} — stops auto-scanning that
 * inbox immediately (the poll job only ever reads active connections) and
 * best-effort revokes the token on Google's side for Gmail. */
export async function disconnect(provider: EmailProvider): Promise<void> {
  await apiClient.delete(`/api/v1/email-connections/${provider}`);
}
