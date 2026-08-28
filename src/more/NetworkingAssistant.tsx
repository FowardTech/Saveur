import React, { memo } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, TouchableOpacity, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Button,
  Input,
  Icon,
  Spinner,
  ViewPager,
} from '@ui-kitten/components';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import { SkeletonListRow } from 'components/Skeleton';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import BasicTabBar from 'components/BasicTabBar';
import CompanyLogoAvatar from 'components/CompanyLogoAvatar';
import { globalStyle } from 'styles/globalStyle';
import { NetworkingContactProps, CareerEventProps } from 'constants/Types';
import { RootStackParamList } from 'navigation/types';
import * as networkingService from 'services/networkingService';
import { MESSAGE_TONES, MessageTone } from 'services/networkingService';
import * as careerEventsService from 'services/careerEventsService';
import { AuthContext } from '../../AuthContext';
import ProLockGate from 'components/ProLockGate';
import CtaButton from 'components/CtaButton';

const emptyForm = {name: '', company: '', role: '', note: ''};

// Networking Assistant — Career Events (product request: "add the fetching
// of career events using eventbrite api... determined by the target roles
// and countries") plus a contacts tracker (list/add/edit/delete — still
// local/mocked, see services/networkingService.ts) with a real AI-drafted
// outreach message generator per contact, backed by POST
// /api/v1/networking/message. "Mark as contacted today" bumps
// lastContactedDate so the Home dashboard's "Networker" badge (unlocked at
// 3+ contacts) and a future follow-up reminder feature have a real signal
// to work off of.
//
// TABS (product request: "we need to separate the career Events and the
// Your contacts into separate tabs. And the Career event should have a
// count badge to indicate new event that just came in") — these used to be
// two sections stacked on one scrolling page. Same ViewPager + BasicTabBar
// pattern src/requests/RequestsSrc.tsx already uses for Applications/
// Practice History. Career Events' load/refresh/save state is lifted up to
// THIS component (rather than owned inside CareerEventsTab itself) purely
// so the unread count can feed BasicTabBar's badgeCounts — the badge lives
// in the tab bar, one level above either tab's own content, so whichever
// component owns the events list has to be at least that high. Contacts
// state has no such need and stays fully inside ContactsTab.
const NetworkingAssistant = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common']);
  const { isPro } = React.useContext(AuthContext);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const [activeIndex, setActiveIndex] = React.useState(0);
  const shouldLoadComponent = React.useCallback(
    (index: number) => index === activeIndex,
    [activeIndex],
  );

  // Career Events — own loading/refreshing state, separate from the
  // contacts list below — a slow events fetch (server-side auto-refresh
  // trigger on GET, see careerEventsService.listCareerEvents) shouldn't
  // block the contacts list from rendering, and vice versa.
  const [events, setEvents] = React.useState<CareerEventProps[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = React.useState(true);
  const [isRefreshingEvents, setIsRefreshingEvents] = React.useState(false);
  const [savingEventId, setSavingEventId] = React.useState<string | null>(null);

  const loadEvents = React.useCallback(async () => {
    setIsLoadingEvents(true);
    try {
      const list = await careerEventsService.listCareerEvents();
      setEvents(list);
    } catch {
      // Best-effort — an empty-state message covers both "genuinely
      // nothing found yet" and "couldn't reach the server" the same way
      // the contacts list already tolerates a failed load silently.
    } finally {
      setIsLoadingEvents(false);
    }
  }, []);

  React.useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Manual refresh triggers a background discovery pass server-side (see
  // careerEventsService.refreshCareerEvents's own doc comment — it does NOT
  // return new results immediately). Re-focusing this screen later (e.g.
  // coming back from the WebView after viewing an event) re-fetches, same
  // "refresh on focus" convention src/home/DailyTipsBanner.tsx uses, so a
  // pass that finished in the background (or the new scheduled sweep — see
  // Saveur-Backend's app/scheduler.py's career_events_refresh tick) while
  // the user was elsewhere gets picked up without a manual pull.
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadEvents);
    return unsubscribe;
  }, [navigation, loadEvents]);

  const onRefreshEvents = async () => {
    if (isRefreshingEvents) return;
    setIsRefreshingEvents(true);
    try {
      const result = await careerEventsService.refreshCareerEvents();
      // "paused"/"cooldown" are normal 200 responses, not errors (see
      // careerEventsService.refreshCareerEvents' own doc comment) — worth
      // a real message rather than the button silently doing nothing,
      // especially "cooldown" (product follow-up: "I dont want too much
      // load on perplexity"), which a user could otherwise read as broken
      // if they tap it twice in a row.
      if (result.status === 'cooldown') {
        const minutes = Math.max(1, Math.ceil((result.retryAfterSeconds ?? 0) / 60));
        Alert.alert(
          t('more:career_events_refresh_cooldown_title', { defaultValue: 'Just refreshed' }) as string,
          (result.message ??
            t('more:career_events_refresh_cooldown_body', {
              defaultValue: 'Please wait about {{minutes}} minute(s) before refreshing again.',
              minutes,
            })) as string,
        );
      } else if (result.status === 'paused') {
        Alert.alert(
          t('more:career_events_refresh_paused_title', { defaultValue: 'Paused' }) as string,
          (result.message ??
            t('more:career_events_refresh_paused_body', { defaultValue: 'Career events discovery is temporarily paused.' })) as string,
        );
      }
    } catch {
      // Real errors (network, etc.) stay silent — same "the button itself
      // is the only feedback needed" treatment as JobAlerts.tsx's own
      // manual refresh.
    } finally {
      setIsRefreshingEvents(false);
    }
  };

  const onOpenEvent = (event: CareerEventProps) => {
    if (!event.read) {
      careerEventsService.markCareerEventsRead([event.id]).catch(() => undefined);
      setEvents(prev => prev.map(e => (e.id === event.id ? { ...e, read: true } : e)));
    }
    navigation.navigate('WebViewScreen', { url: event.url, title: event.title });
  };

  const onToggleEventSaved = async (event: CareerEventProps) => {
    if (savingEventId) return;
    setSavingEventId(event.id);
    // Optimistic — same "flip it locally, reconcile on failure" treatment
    // PaymentMethod.tsx's onSetDefault uses, so the star/heart responds the
    // instant it's tapped rather than waiting on a round trip.
    setEvents(prev => prev.map(e => (e.id === event.id ? { ...e, saved: !e.saved } : e)));
    try {
      const updated = await careerEventsService.toggleCareerEventSaved(event.id);
      setEvents(prev => prev.map(e => (e.id === event.id ? updated : e)));
    } catch {
      setEvents(prev => prev.map(e => (e.id === event.id ? { ...e, saved: event.saved } : e)));
    } finally {
      setSavingEventId(null);
    }
  };

  // Product request: "the Career event should have a count badge to
  // indicate new event that just came in" — CareerEvent.read (see
  // Saveur-Backend's app/models/career_event.py) already exists per-event
  // for exactly this, same as JobAlert.read_at; no separate "unread count"
  // endpoint needed here since the full list (with each item's `read`
  // flag) is already loaded for the tab's own content.
  const unreadEventsCount = events.filter(e => !e.read).length;

  const [contacts, setContacts] = React.useState<NetworkingContactProps[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = React.useState(true);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<NetworkingContactProps['id'] | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [isSaving, setIsSaving] = React.useState(false);

  // "Generate Message" panel — AI-drafted LinkedIn outreach message for a
  // single contact, backed by networkingService.generateOutreachMessage()
  // (POST /api/v1/networking/message). Only one contact's panel is open at
  // a time, tracked by id.
  const [messageContactId, setMessageContactId] = React.useState<NetworkingContactProps['id'] | null>(null);
  const [messageContext, setMessageContext] = React.useState('');
  const [messageTone, setMessageTone] = React.useState<MessageTone>('friendly');
  const [generatedMessage, setGeneratedMessage] = React.useState<string | null>(null);
  const [isGeneratingMessage, setIsGeneratingMessage] = React.useState(false);
  const [generateMessageError, setGenerateMessageError] = React.useState<string | null>(null);

  const loadContacts = React.useCallback(async () => {
    setIsLoadingContacts(true);
    try {
      const list = await networkingService.listContacts();
      setContacts(list);
    } finally {
      setIsLoadingContacts(false);
    }
  }, []);

  React.useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const onOpenAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsFormOpen(true);
  };
  const onOpenEdit = (contact: NetworkingContactProps) => {
    setEditingId(contact.id);
    setForm({name: contact.name, company: contact.company, role: contact.role, note: contact.note ?? ''});
    setIsFormOpen(true);
  };
  const onCancelForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const onSave = async () => {
    if (!form.name.trim() || isSaving) return;
    setIsSaving(true);
    try {
      if (editingId != null) {
        await networkingService.updateContact(editingId, form);
      } else {
        // BUG FIX (product report: "Mark contacted is not working") — a
        // brand-new contact used to be stamped lastContactedDate: Date.now()
        // at creation time, i.e. already "contacted" the moment it's added,
        // even though nothing has actually happened yet. Combined with the
        // day-only date display below, tapping "Mark contacted" later the
        // same day as adding a contact updated the real timestamp (the
        // underlying AsyncStorage write always worked) but showed no visible
        // change at all — same date, same position in the list, no
        // confirmation — which read exactly like a broken button. A new
        // contact now genuinely starts as "Not yet contacted" so the first
        // real tap has something to show.
        await networkingService.addContact({...form, lastContactedDate: null});
      }
      await loadContacts();
      onCancelForm();
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = async (id: NetworkingContactProps['id']) => {
    await networkingService.deleteContact(id);
    await loadContacts();
  };

  const onMarkContactedToday = async (contact: NetworkingContactProps) => {
    await networkingService.updateContact(contact.id, {lastContactedDate: Date.now()});
    await loadContacts();
  };

  const onOpenGenerateMessage = (contact: NetworkingContactProps) => {
    setMessageContactId(contact.id);
    setMessageContext(
      contact.note?.trim()
        ? contact.note
        : t('more:default_outreach_context', {
            defaultValue: 'Reaching out to {{name}} at {{company}} about the {{role}} team.',
            name: contact.name,
            company: contact.company,
            role: contact.role,
          }).toString(),
    );
    setMessageTone('friendly');
    setGeneratedMessage(null);
    setGenerateMessageError(null);
  };
  const onCloseGenerateMessage = () => {
    setMessageContactId(null);
    setGeneratedMessage(null);
    setGenerateMessageError(null);
  };
  const onGenerateMessage = async (contact: NetworkingContactProps) => {
    if (isGeneratingMessage) return;
    setIsGeneratingMessage(true);
    setGenerateMessageError(null);
    try {
      const message = await networkingService.generateOutreachMessage(
        contact.role,
        messageContext.trim(),
        messageTone,
      );
      setGeneratedMessage(message);
    } catch (e: any) {
      setGenerateMessageError(
        e?.message ?? t('more:generate_message_failed', { defaultValue: "Couldn't generate a message. Please try again." }),
      );
    } finally {
      setIsGeneratingMessage(false);
    }
  };

  if (!isPro) {
    return (
      <ProLockGate
        title={t('more:networking_assistant_title', { defaultValue: 'Networking Assistant' }).toString()}
        description={t('more:networking_assistant_pro_gate_description', {
          defaultValue: 'Track contacts, log outreach, and get AI-drafted messages tailored to each one — Networking Assistant is a Basic feature.',
        }).toString()}
      />
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:networking_assistant', { defaultValue: 'Networking Assistant' }).toString()}
        accessoryLeft={<NavigationAction />}
        // The "+" (add contact) only makes sense on the Contacts tab —
        // Career Events has its own refresh affordance inside that tab
        // instead (see CareerEventsTab below).
        accessoryRight={
          activeIndex === 1
            ? <NavigationAction icon="plusImg" size="small" onPress={onOpenAdd} />
            : undefined
        }
      />

      <Layout style={styles.tabBarWrap}>
        <BasicTabBar
          style={styles.tabBar}
          activeIndex={activeIndex}
          onChange={setActiveIndex}
          tabs={[
            t('more:career_events_title', { defaultValue: 'Career Events' }),
            t('more:networking_contacts_title', { defaultValue: 'Your Contacts' }),
          ]}
          badgeCounts={[unreadEventsCount, undefined]}
        />
      </Layout>

      <ViewPager
        selectedIndex={activeIndex}
        onSelect={setActiveIndex}
        style={globalStyle.flexOne}
        swipeEnabled={false}
        shouldLoadComponent={shouldLoadComponent}>
        <CareerEventsTab
          events={events}
          isLoading={isLoadingEvents}
          isRefreshing={isRefreshingEvents}
          savingEventId={savingEventId}
          onRefresh={onRefreshEvents}
          onOpenEvent={onOpenEvent}
          onToggleSaved={onToggleEventSaved}
        />
        <ContactsTab
          contacts={contacts}
          isLoading={isLoadingContacts}
          onOpenEdit={onOpenEdit}
          onDelete={onDelete}
          onMarkContactedToday={onMarkContactedToday}
          messageContactId={messageContactId}
          messageContext={messageContext}
          setMessageContext={setMessageContext}
          messageTone={messageTone}
          setMessageTone={setMessageTone}
          generatedMessage={generatedMessage}
          isGeneratingMessage={isGeneratingMessage}
          generateMessageError={generateMessageError}
          onOpenGenerateMessage={onOpenGenerateMessage}
          onCloseGenerateMessage={onCloseGenerateMessage}
          onGenerateMessage={onGenerateMessage}
        />
      </ViewPager>

      {/* Product request item: "I want forms like this in the app to
          appear as bottom sheets just like it is in the Resume
          Evolution" — was an inline card that pushed the contact list
          down the screen while open; now a slide-up Modal sheet, same
          Modal + KeyboardAvoidingView + rounded Layout pattern as
          src/more/ResumeVariants.tsx's "+ New Variant" sheet (see also
          DreamCompanies.tsx / JobAlerts.tsx, converted the same way).
          `isFormOpen` still drives the same two triggers (the header "+"
          icon via onOpenAdd, and each contact card's "Edit" link via
          onOpenEdit) — only what showing it actually looks like changed.
          Kept at this top level (not inside ContactsTab) since it's
          triggered from the TopNavigation header above, outside the
          ViewPager entirely. */}
      <Modal visible={isFormOpen} transparent animationType="slide" onRequestClose={onCancelForm}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Layout level="1" style={styles.modalSheet}>
            {/* Product request: "all bottom sheets should have a close
                button" -- this sheet's only dismiss affordance used to be
                the "Cancel" button at the very bottom, past two-plus
                screens' worth of fields on a long contact form. A close
                X next to the title, same header pattern every other
                bottom sheet in the app uses, gives an immediate way out
                without scrolling down first. */}
            <Flex justify="space-between" itemsCenter mb={12}>
              <Text category="h7" bold>
                {editingId != null
                  ? t('more:edit_contact', { defaultValue: 'Edit Contact' })
                  : t('more:add_contact', { defaultValue: 'Add Contact' })}
              </Text>
              <ModalCloseButton onPress={onCancelForm} />
            </Flex>
            <Input
              placeholder={t('more:contact_name', { defaultValue: 'Name' }).toString()}
              value={form.name}
              onChangeText={name => setForm(prev => ({ ...prev, name }))}
              style={styles.formInput}
              textStyle={globalStyle.inputText}
            />
            <Input
              placeholder={t('more:contact_company', { defaultValue: 'Company' }).toString()}
              value={form.company}
              onChangeText={company => setForm(prev => ({ ...prev, company }))}
              style={styles.formInput}
              textStyle={globalStyle.inputText}
            />
            <Input
              placeholder={t('more:contact_role', { defaultValue: 'Role' }).toString()}
              value={form.role}
              onChangeText={role => setForm(prev => ({ ...prev, role }))}
              style={styles.formInput}
              textStyle={globalStyle.inputText}
            />
            <Input
              placeholder={t('more:contact_note', { defaultValue: 'Note (how you met, follow-up plan…)' }).toString()}
              value={form.note}
              onChangeText={note => setForm(prev => ({ ...prev, note }))}
              multiline
              textStyle={[globalStyle.inputText, { minHeight: 56, textAlignVertical: 'top' }]}
              style={styles.formInput}
            />
            <Flex justify="flex-start" mt={4}>
              <CtaButton
                children={isSaving ? t('more:saving', { defaultValue: 'Saving…' }) : t('common:save', { defaultValue: 'Save' })}
                disabled={isSaving || !form.name.trim()}
                onPress={onSave}
                style={{ marginRight: 12 }}
              />
              <Button
                children={t('common:cancel', { defaultValue: 'Cancel' })}
                status="basic"
                appearance="ghost"
                onPress={onCancelForm}
              />
            </Flex>
          </Layout>
        </KeyboardAvoidingView>
      </Modal>
    </Container>
  );
});

export default NetworkingAssistant;

// Small standalone piece so it can grab `theme` without the parent needing
// to pass it down just for this one icon.
const ModalCloseButton = memo(({ onPress }: { onPress: () => void }) => {
  const theme = useTheme();
  return (
    <TouchableOpacity onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Icon pack="eva" name="close-outline" style={[globalStyle.icon24, { tintColor: theme['text-basic-color'] }]} />
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Career Events tab (product request: "add the fetching of career events
// using eventbrite api... The career event fetched must be determined by
// the target roles and countries... (Target Role & Countries and Job
// alert)"). Purely presentational — all loading/refresh/save state lives in
// the parent (see that component's own comment for why: the unread count
// feeds the tab bar's badge, one level above this component). Each card
// opens the real event page in-app (WebViewScreen), same "stay in the app"
// treatment Job Alerts gives its own apply links.
// ---------------------------------------------------------------------------
interface CareerEventsTabProps {
  events: CareerEventProps[];
  isLoading: boolean;
  isRefreshing: boolean;
  savingEventId: string | null;
  onRefresh: () => void;
  onOpenEvent: (event: CareerEventProps) => void;
  onToggleSaved: (event: CareerEventProps) => void;
}

const CareerEventsTab = memo(
  ({ events, isLoading, isRefreshing, savingEventId, onRefresh, onOpenEvent, onToggleSaved }: CareerEventsTabProps) => {
    const theme = useTheme();
    const styles = useStyleSheet(themedStyles);
    const { t, i18n } = useTranslation(['more', 'common']);

    return (
      <Content padder contentContainerStyle={styles.content}>
        <Flex justify="flex-end" itemsCenter mb={12}>
          <TouchableOpacity onPress={onRefresh} disabled={isRefreshing} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {isRefreshing ? (
              <Spinner size="tiny" />
            ) : (
              <Icon pack="eva" name="refresh-outline" style={[globalStyle.icon16, { tintColor: theme['text-hint-color'] }]} />
            )}
          </TouchableOpacity>
        </Flex>
        {isLoading ? (
          // Product request: "I want skeleton loader in app" — was a bare
          // centered Spinner; two placeholder rows shaped like the real
          // event cards below read as "content is coming" more clearly
          // than a spinner, and cost nothing extra to build (shared
          // Skeleton component).
          <View>
            <SkeletonListRow style={styles.contactCard} />
            <SkeletonListRow style={[styles.contactCard, { marginBottom: 0 }]} />
          </View>
        ) : events.length === 0 ? (
          <Layout level="2" style={styles.contactCard}>
            <Text category="h9-s" status="placeholder">
              {t('more:no_career_events', {
                defaultValue: "No career events found yet for your target roles and countries — check back soon, or tap refresh above.",
              })}
            </Text>
          </Layout>
        ) : (
          events.map(event => (
            <TouchableOpacity key={event.id} activeOpacity={0.8} onPress={() => onOpenEvent(event)}>
              <Layout level="2" style={styles.contactCard}>
                <Flex justify="flex-start" itemsCenter mb={event.eventDate ? 8 : 0}>
                  {/* BUG FIX (product report: "why are the logo of the
                      event source not displaying on the left here in the
                      networking assistant but the logos are displaying on
                      the ones shown in the homescreen?") — this card used
                      to render title/organizer/date only, with no logo at
                      all, unlike src/home/CareerFairEventCard.tsx (Home's
                      compact preview of this exact same list), which
                      already used CompanyLogoAvatar against
                      CareerEvent.to_dict()'s logo_url (resolved
                      server-side from `source`, the discovering
                      platform's real domain — see that model's own
                      comment). Same component, same prop, now used here
                      too, so both surfaces show the same logo. */}
                  <CompanyLogoAvatar
                    logoUrl={event.logoUrl}
                    companyName={event.organizer || event.title}
                    size="small"
                    fallbackIcon="building-outline"
                    style={{ marginRight: 10 }}
                  />
                  <View style={globalStyle.flexOne}>
                    <Text category="h8" bold numberOfLines={2}>
                      {event.title}
                    </Text>
                    {event.organizer || event.location ? (
                      <Text category="h9-s" status="placeholder" mt={2} numberOfLines={1}>
                        {[event.organizer, event.location].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => onToggleSaved(event)}
                    disabled={savingEventId === event.id}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ marginLeft: 8 }}>
                    <Icon
                      pack="eva"
                      name={event.saved ? 'star' : 'star-outline'}
                      style={[globalStyle.icon20, { tintColor: event.saved ? '#f59e0b' : theme['text-hint-color'] }]}
                    />
                  </TouchableOpacity>
                </Flex>
                {event.eventDate ? (
                  <Flex justify="flex-start" itemsCenter>
                    <Icon pack="eva" name="calendar-outline" style={[globalStyle.icon16, { tintColor: theme['text-hint-color'], marginRight: 4, width: 12, height: 12 }]} />
                    <Text category="h10" status="placeholder">
                      {new Date(event.eventDate).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </Flex>
                ) : null}
              </Layout>
            </TouchableOpacity>
          ))
        )}
      </Content>
    );
  },
);

// ---------------------------------------------------------------------------
// Your Contacts tab — list/add/edit/delete + AI-drafted outreach message
// generator. Fully self-contained aside from the shared add/edit Modal,
// which lives in the parent (triggered from the TopNavigation header, see
// that component's own comment).
// ---------------------------------------------------------------------------
interface ContactsTabProps {
  contacts: NetworkingContactProps[];
  isLoading: boolean;
  onOpenEdit: (contact: NetworkingContactProps) => void;
  onDelete: (id: NetworkingContactProps['id']) => void;
  onMarkContactedToday: (contact: NetworkingContactProps) => void;
  messageContactId: NetworkingContactProps['id'] | null;
  messageContext: string;
  setMessageContext: (value: string) => void;
  messageTone: MessageTone;
  setMessageTone: (value: MessageTone) => void;
  generatedMessage: string | null;
  isGeneratingMessage: boolean;
  generateMessageError: string | null;
  onOpenGenerateMessage: (contact: NetworkingContactProps) => void;
  onCloseGenerateMessage: () => void;
  onGenerateMessage: (contact: NetworkingContactProps) => void;
}

const ContactsTab = memo(
  ({
    contacts, isLoading, onOpenEdit, onDelete, onMarkContactedToday,
    messageContactId, messageContext, setMessageContext, messageTone, setMessageTone,
    generatedMessage, isGeneratingMessage, generateMessageError,
    onOpenGenerateMessage, onCloseGenerateMessage, onGenerateMessage,
  }: ContactsTabProps) => {
    const theme = useTheme();
    const styles = useStyleSheet(themedStyles);
    const { t, i18n } = useTranslation(['more', 'common']);

    return (
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        {isLoading ? (
          // Product request: "I want skeleton loader in app" — this list
          // used to render nothing at all (not even a spinner) for the
          // entire fetch, indistinguishable from "you have zero contacts"
          // until it resolved.
          <>
            <SkeletonListRow style={styles.contactCard} />
            <SkeletonListRow style={styles.contactCard} />
          </>
        ) : contacts.length === 0 ? (
          <Flex vertical itemsCenter justify="center" style={{ paddingVertical: 40 }}>
            <Text category="h9-s" status="placeholder" center>
              {t('more:no_contacts', { defaultValue: 'No contacts yet — add someone you met networking.' })}
            </Text>
          </Flex>
        ) : null}

        {contacts.map(contact => (
          <Layout key={contact.id} level="2" style={styles.contactCard}>
            <Flex justify="space-between" itemsCenter mb={4}>
              <Text category="h7" bold>{contact.name}</Text>
              <TouchableOpacity onPress={() => onDelete(contact.id)}>
                <Icon pack="assets" name="trash" style={[globalStyle.icon16, { tintColor: theme['text-basic-color'] }]} />
              </TouchableOpacity>
            </Flex>
            <Text category="h9-s" status="placeholder" mb={8}>
              {contact.role} · {contact.company}
            </Text>
            {contact.note ? (
              <Text category="h9-s" mb={8}>{contact.note}</Text>
            ) : null}
            <Text category="h10" status="placeholder">
              {contact.lastContactedDate
                ? // BUG FIX (product report: "Mark contacted is not
                  // working") — was toLocaleDateString() (day-only). Tapping
                  // "Mark contacted" a second time the same day genuinely
                  // updated the stored timestamp every time, but the
                  // displayed text was byte-for-byte identical before and
                  // after, with nothing else in the UI confirming the tap
                  // did anything — indistinguishable from a broken button.
                  // toLocaleString() includes the time, so a same-day re-tap
                  // is now visibly reflected.
                  `${t('more:last_contacted', { defaultValue: 'Last contacted' })}: ${new Date(contact.lastContactedDate).toLocaleString(i18n.language)}`
                : t('more:never_contacted', { defaultValue: 'Not yet contacted' })}
            </Text>
            <Flex justify="space-between" itemsCenter mt={4}>
              <Flex justify="flex-start">
                <TouchableOpacity onPress={() => onMarkContactedToday(contact)} style={{ marginRight: 16 }}>
                  <Text category="h10" status="link" bold>
                    {t('more:mark_contacted', { defaultValue: 'Mark contacted' })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    messageContactId === contact.id ? onCloseGenerateMessage() : onOpenGenerateMessage(contact)
                  }
                  style={{ marginRight: 16 }}>
                  <Text category="h10" status="link" bold>
                    {t('more:generate_message', { defaultValue: 'Message' })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onOpenEdit(contact)}>
                  <Text category="h10" status="link" bold>
                    {t('common:edit', { defaultValue: 'Edit' })}
                  </Text>
                </TouchableOpacity>
              </Flex>
            </Flex>

            {messageContactId === contact.id ? (
              <View style={styles.messagePanel}>
                <Text category="h10" status="placeholder" mb={8}>
                  {t('more:generate_message_hint', {
                    defaultValue: 'AI-drafted LinkedIn outreach message for this contact.',
                  })}
                </Text>
                <Input
                  placeholder={t('more:message_context', { defaultValue: "Context (why you're reaching out)" }).toString()}
                  value={messageContext}
                  onChangeText={setMessageContext}
                  multiline
                  textStyle={[globalStyle.inputText, { minHeight: 56, textAlignVertical: 'top' }]}
                  style={styles.formInput}
                />
                <Flex justify="flex-start" mb={12} style={{ flexWrap: 'wrap' }}>
                  {MESSAGE_TONES.map(toneOption => (
                    <TouchableOpacity
                      key={toneOption.id}
                      onPress={() => setMessageTone(toneOption.id)}
                      style={[
                        styles.toneChip,
                        {
                          backgroundColor:
                            messageTone === toneOption.id
                              ? theme['color-primary-500']
                              : theme['background-basic-color-3'],
                        },
                      ]}>
                      <Text
                        category="h10"
                        bold
                        status={messageTone === toneOption.id ? 'control' : 'basic'}>
                        {toneOption.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </Flex>
                <CtaButton
                  children={isGeneratingMessage ? t('more:generating', { defaultValue: 'Generating…' }) : t('more:generate', { defaultValue: 'Generate' })}
                  size="small"
                  disabled={isGeneratingMessage || !messageContext.trim()}
                  onPress={() => onGenerateMessage(contact)}
                  style={{ marginBottom: 12 }}
                />
                {generateMessageError ? (
                  <Text category="h10" status="danger" mb={8}>
                    {generateMessageError}
                  </Text>
                ) : null}
                {generatedMessage ? (
                  <Layout level="1" style={styles.generatedMessageBox}>
                    <Text category="h9-s" selectable>
                      {generatedMessage}
                    </Text>
                  </Layout>
                ) : null}
              </View>
            ) : null}
          </Layout>
        ))}
      </Content>
    );
  },
);

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  // Same "raised strip" treatment RequestsSrc.tsx's own tabBarWrap uses —
  // white fill + a soft shadow on the bottom edge only.
  tabBarWrap: {
    backgroundColor: 'background-basic-color-2',
    shadowColor: 'rgba(31, 41, 84, 0.35)',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  tabBar: {
    marginTop: 12,
    paddingHorizontal: 12,
  },
  // Redesign v2 (full reskin): `card` carries a real shadow again, which
  // needs an opaque fill on Android — dropped the 'transparent' overrides
  // below so each Layout's own `level="2"` background shows through
  // instead.
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  formInput: {
    ...globalStyle.inputField,
    marginBottom: 12,
  },
  contactCard: {
    ...globalStyle.card,
    padding: 16,
    marginBottom: 12,
  },
  messagePanel: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: 'background-basic-color-3',
  },
  toneChip: {
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  generatedMessageBox: {
    ...globalStyle.card,
    padding: 12,
  },
});
