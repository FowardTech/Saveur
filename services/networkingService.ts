import AsyncStorage from '@react-native-async-storage/async-storage';
import {EKeyAsyncStorage, NetworkingContactProps} from 'constants/Types';
import {DATA_NETWORKING_CONTACTS} from 'constants/Data';
import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// networkingService — partial real backend implementation.
//
// Backs src/more/NetworkingAssistant.tsx: a simple contacts tracker (name,
// company, role, last-contacted date, note) plus AI-generated outreach
// messages. Per this task's endpoint contract, only message *generation* is
// a real backend call — POST /api/v1/networking/message (see
// generateOutreachMessage below). The contacts tracker itself (list/add/
// update/delete) has no corresponding endpoint in this pass, so it stays
// local/mocked exactly as before — seeded from static mock data on first
// read, then persisted to AsyncStorage so adds/edits/deletes stick.
// ---------------------------------------------------------------------------

const FAKE_LATENCY_MS = 450;
const delay = (ms: number = FAKE_LATENCY_MS) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

const readAll = async (): Promise<NetworkingContactProps[]> => {
  const raw = await AsyncStorage.getItem(EKeyAsyncStorage.networkingContacts);
  if (raw) {
    try {
      return JSON.parse(raw) as NetworkingContactProps[];
    } catch {
      // Corrupted/partial write — fall through and re-seed below rather
      // than crash the Networking Assistant screen.
    }
  }
  const seeded = [...DATA_NETWORKING_CONTACTS];
  await AsyncStorage.setItem(EKeyAsyncStorage.networkingContacts, JSON.stringify(seeded));
  return seeded;
};

const writeAll = async (contacts: NetworkingContactProps[]): Promise<void> => {
  await AsyncStorage.setItem(EKeyAsyncStorage.networkingContacts, JSON.stringify(contacts));
};

/**
 * List all tracked networking contacts, most recently contacted first.
 *
 * BACKEND TODO: GET /networking/contacts — returns NetworkingContactProps[]
 *   for the current user.
 */
export async function listContacts(): Promise<NetworkingContactProps[]> {
  await delay();
  const all = await readAll();
  return [...all].sort((a, b) => Number(b.lastContactedDate ?? 0) - Number(a.lastContactedDate ?? 0));
}

/**
 * Add a new tracked contact.
 *
 * BACKEND TODO: POST /networking/contacts
 *   request:  Omit<NetworkingContactProps, 'id'>
 *   response: NetworkingContactProps (with server-assigned id)
 */
export async function addContact(
  contact: Omit<NetworkingContactProps, 'id'>,
): Promise<NetworkingContactProps> {
  await delay();
  const all = await readAll();
  const newContact: NetworkingContactProps = {...contact, id: `contact_${Date.now()}`};
  await writeAll([newContact, ...all]);
  return newContact;
}

/**
 * Update an existing contact (e.g. after a follow-up — update
 * lastContactedDate/note).
 *
 * BACKEND TODO: PATCH /networking/contacts/{id}
 *   request:  Partial<NetworkingContactProps>
 *   response: NetworkingContactProps (updated)
 */
export async function updateContact(
  id: NetworkingContactProps['id'],
  partial: Partial<Omit<NetworkingContactProps, 'id'>>,
): Promise<NetworkingContactProps | null> {
  await delay();
  const all = await readAll();
  let updated: NetworkingContactProps | null = null;
  const next = all.map(item => {
    if (item.id === id) {
      updated = {...item, ...partial};
      return updated;
    }
    return item;
  });
  await writeAll(next);
  return updated;
}

/**
 * Remove a tracked contact.
 *
 * BACKEND TODO: DELETE /networking/contacts/{id}
 */
export async function deleteContact(id: NetworkingContactProps['id']): Promise<void> {
  await delay(300);
  const all = await readAll();
  await writeAll(all.filter(item => item.id !== id));
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
  });
  return data.message ?? data.text ?? data.draft ?? '';
}
