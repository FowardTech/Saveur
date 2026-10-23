import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import {EKeyAsyncStorage, NetworkingContactProps} from 'constants/Types';
import apiClient from './apiClient';

// `language` per the backend's contract — constants/languages.ts,
// docs/BACKEND_SPEC_ADDENDUM_2026-07.md §16.
function currentLanguage(): string {
  return i18n.language || 'en';
}

// ---------------------------------------------------------------------------
// networkingService — real backend implementation.
//
// Backs src/more/NetworkingAssistant.tsx: a contacts tracker (name, company,
// role, last-contacted date, note) plus AI-generated outreach messages.
// Contacts are stored in the database (Saveur-Backend app/api/networking.py:
// GET/POST /networking/contacts, PATCH/DELETE /networking/contacts/{id},
// POST /networking/contacts/import) so they survive reinstalls/new devices
// and sync with the web app. They used to live only in AsyncStorage; any
// contacts still there are uploaded once (see migrateLocalContacts).
// ---------------------------------------------------------------------------

type ContactsBody = {data?: NetworkingContactProps[]} | NetworkingContactProps[];

const unwrapList = (body: ContactsBody | undefined): NetworkingContactProps[] =>
  Array.isArray(body) ? body : body?.data ?? [];

// Epoch ms (what the server stores/returns) for a number | Date | null.
const toWireDate = (value: NetworkingContactProps['lastContactedDate'] | undefined): number | null => {
  if (value == null) return null;
  const ms = value instanceof Date ? value.getTime() : Number(value);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
};

const toWire = (c: Partial<Omit<NetworkingContactProps, 'id'>>) => {
  const wire: Record<string, unknown> = {};
  if (c.name !== undefined) wire.name = c.name;
  if (c.company !== undefined) wire.company = c.company;
  if (c.role !== undefined) wire.role = c.role;
  if (c.note !== undefined) wire.note = c.note;
  if (c.lastContactedDate !== undefined) wire.lastContactedDate = toWireDate(c.lastContactedDate);
  return wire;
};

// One-time upload of contacts saved on this device before contacts moved to
// the server. The server skips duplicates, so a failed/retried attempt is
// safe; the local copy is only removed once the upload succeeds.
const migrateLocalContacts = async (): Promise<NetworkingContactProps[] | null> => {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(EKeyAsyncStorage.networkingContacts);
  } catch {
    return null;
  }
  if (!raw) return null;
  let local: NetworkingContactProps[] = [];
  try {
    const parsed = JSON.parse(raw);
    local = Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupted legacy data — nothing recoverable; drop it.
    await AsyncStorage.removeItem(EKeyAsyncStorage.networkingContacts).catch(() => {});
    return null;
  }
  if (!local.length) {
    await AsyncStorage.removeItem(EKeyAsyncStorage.networkingContacts).catch(() => {});
    return null;
  }
  const {data} = await apiClient.post<ContactsBody>('/api/v1/networking/contacts/import', {
    contacts: local.map(c => ({...toWire(c)})),
  });
  await AsyncStorage.removeItem(EKeyAsyncStorage.networkingContacts).catch(() => {});
  return unwrapList(data);
};

/**
 * List all tracked networking contacts, most recently contacted first
 * (the server already sorts them). Uploads any legacy on-device contacts
 * first. Throws if the server can't be reached — callers show an error
 * instead of an empty list that would look like data loss.
 */
export async function listContacts(): Promise<NetworkingContactProps[]> {
  try {
    const migrated = await migrateLocalContacts();
    if (migrated) return migrated;
  } catch {
    // Upload failed (offline etc.) — keep the local copy and retry next
    // time; fall through to a normal fetch below.
  }
  const {data} = await apiClient.get<ContactsBody>('/api/v1/networking/contacts');
  return unwrapList(data);
}

/** Add a new tracked contact (POST /api/v1/networking/contacts). */
export async function addContact(
  contact: Omit<NetworkingContactProps, 'id'>,
): Promise<NetworkingContactProps> {
  const {data} = await apiClient.post<NetworkingContactProps>('/api/v1/networking/contacts', toWire(contact));
  return data;
}

/**
 * Update an existing contact, e.g. after a follow-up — lastContactedDate/note
 * (PATCH /api/v1/networking/contacts/{id}).
 */
export async function updateContact(
  id: NetworkingContactProps['id'],
  partial: Partial<Omit<NetworkingContactProps, 'id'>>,
): Promise<NetworkingContactProps | null> {
  const {data} = await apiClient.patch<NetworkingContactProps>(`/api/v1/networking/contacts/${id}`, toWire(partial));
  return data ?? null;
}

/** Remove a tracked contact (DELETE /api/v1/networking/contacts/{id}). */
export async function deleteContact(id: NetworkingContactProps['id']): Promise<void> {
  await apiClient.delete(`/api/v1/networking/contacts/${id}`);
}

// ---- POST /api/v1/networking/message ---------------------------------------

export type MessageTone = 'friendly' | 'formal' | 'enthusiastic' | 'warm';

export const MESSAGE_TONES: {id: MessageTone; label: string}[] = [
  {id: 'friendly', label: 'Friendly'},
  {id: 'formal', label: 'Formal'},
  {id: 'enthusiastic', label: 'Enthusiastic'},
  {id: 'warm', label: 'Warm'},
];

interface GenerateMessageWire {
  message?: string;
  text?: string;
  draft?: string;
}

/**
 * POST /api/v1/networking/message — real LLM-generated LinkedIn outreach
 * message. `recipientRole` is the contact's job title/role, `context` is a
 * short free-text description of who they are / why you're reaching out
 * (e.g. "Met at a PM meetup, interested in referral for the PM role at
 * Nimbus Analytics"), `tone` picks the voice.
 *
 * Wired to a "Generate Message" action per contact in
 * src/more/NetworkingAssistant.tsx.
 */
export async function generateOutreachMessage(
  recipientRole: string,
  context: string,
  tone: MessageTone,
): Promise<string> {
  const {data} = await apiClient.post<GenerateMessageWire>('/api/v1/networking/message', {
    recipient_role: recipientRole,
    context,
    tone,
    language: currentLanguage(),
  });
  return data.message ?? data.text ?? data.draft ?? '';
}
