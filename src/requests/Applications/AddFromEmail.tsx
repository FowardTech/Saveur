import React, {memo} from 'react';
import {Alert, View} from 'react-native';
import {TopNavigation, StyleService, useStyleSheet, Input, Button, Spinner} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import NavigationAction from 'components/NavigationAction';
import CtaButton from 'components/CtaButton';
import Flex from 'components/Flex';
import CompanyLogoAvatar from 'components/CompanyLogoAvatar';
import {globalStyle} from 'styles/globalStyle';
import {RootStackParamList} from 'navigation/types';
import {EmailConnectionProps, CalendarConnectionProps} from 'constants/Types';
import * as applicationsService from 'services/applicationsService';
import * as emailConnectionService from 'services/emailConnectionService';
import {EmailProvider} from 'services/emailConnectionService';
import * as calendarConnectionService from 'services/calendarConnectionService';
import {CalendarProvider} from 'services/calendarConnectionService';
import * as configService from 'services/configService';

// SYMPHONY REDESIGN follow-up (product request, with reference screenshot:
// "The connect to google gmail, calendar, outlook mail and calendar should
// be like cards... Make sure to add the real google logo and outlook logos
// just like the way it is in the screenshot") — real brand marks via the
// same geticon.dev lookup CompanyLogoAvatar already uses for employer
// logos elsewhere in this app (see that component's own comment / Saveur-
// Backend's company_logo_service.py for why geticon.dev specifically).
// Built client-side here rather than through a backend call since these 4
// providers are fixed constants, not per-user data — no round trip
// needed. Google serves distinct per-product favicons off its own
// subdomains (mail.google.com vs calendar.google.com), which is what
// actually gets Gmail's red icon and Calendar's own icon instead of one
// generic Google "G" for both; Outlook doesn't split as cleanly, so both
// rows resolve to the same Outlook mark, which is still correct branding.
const PROVIDER_LOGO_DOMAIN: Record<'gmail' | 'outlook_mail' | 'google_calendar' | 'outlook_calendar', string> = {
  gmail: 'mail.google.com',
  outlook_mail: 'outlook.com',
  google_calendar: 'calendar.google.com',
  outlook_calendar: 'outlook.com',
};
const providerLogoUrl = (key: keyof typeof PROVIDER_LOGO_DOMAIN) =>
  `https://geticon.dev/?url=${PROVIDER_LOGO_DOMAIN[key]}`;

// Premium Job Tracker feature (product follow-up: "auto-detect status
// changes by scanning the user's inbox... the direct answer to 'why pay for
// this instead of a spreadsheet'"). Two families of real auto-detect, on
// top of the permanent paste/forward fallback below:
//   - Inbox connect (Gmail/Outlook, services/emailConnectionService.ts) —
//     catches all four stages (applied/interviewing/offer/rejected), but
//     Gmail's side can't go live for real users until Google's
//     gmail.readonly CASA security assessment clears (a real, paid,
//     multi-week review — see app/services/gmail_service.py's own comment).
//   - Calendar connect (Google/Outlook Calendar, product follow-up: "build
//     the calendar-connect one for both", services/calendarConnectionService.ts)
//     — inbox-free, only ever detects the Interviewing stage (an interview
//     invite almost always comes with a calendar event), but
//     calendar.readonly is only a SENSITIVE Google scope (not restricted),
//     so it doesn't share Gmail's CASA blocker and can launch independently.
// Each of these four providers is independently controlled from the admin
// Feature Flags tab (product follow-up: "we can activate and deactivate
// any from the admin dashboard") — configService.isFeatureEnabled below is
// what actually hides a row whose flag is off, on top of the /start route
// itself also refusing to work if disabled (defense in depth, same
// reasoning as job_alerts' own two-switch design on the backend).
const AddFromEmail = memo(() => {
  const {goBack, navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['request', 'common']);

  const [emailText, setEmailText] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [emailConnections, setEmailConnections] = React.useState<EmailConnectionProps[] | null>(null);
  const [connectingEmailProvider, setConnectingEmailProvider] = React.useState<EmailProvider | null>(null);
  const [disconnectingEmailProvider, setDisconnectingEmailProvider] = React.useState<EmailProvider | null>(null);

  const [calendarConnections, setCalendarConnections] = React.useState<CalendarConnectionProps[] | null>(null);
  const [connectingCalendarProvider, setConnectingCalendarProvider] = React.useState<CalendarProvider | null>(null);
  const [disconnectingCalendarProvider, setDisconnectingCalendarProvider] = React.useState<CalendarProvider | null>(null);

  const loadConnections = React.useCallback(() => {
    emailConnectionService.listConnections().then(setEmailConnections).catch(() => setEmailConnections([]));
    calendarConnectionService.listConnections().then(setCalendarConnections).catch(() => setCalendarConnections([]));
  }, []);
  React.useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const onConnectEmail = async (provider: EmailProvider) => {
    if (connectingEmailProvider) return;
    setConnectingEmailProvider(provider);
    try {
      const result = await emailConnectionService.connect(provider);
      if (result.error) throw new Error(result.error);
      loadConnections();
    } catch (e: any) {
      Alert.alert(
        t('request:connect_inbox_failed_title', {defaultValue: "Couldn't connect that inbox"}),
        e?.response?.data?.error === 'gmail_not_configured' ||
        e?.response?.data?.error === 'outlook_not_configured' ||
        e?.response?.data?.error === 'feature_disabled'
          ? t('request:connect_inbox_not_configured', {defaultValue: 'This isn’t available yet — check back soon.'})
          : e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
      );
    } finally {
      setConnectingEmailProvider(null);
    }
  };

  const onDisconnectEmail = async (provider: EmailProvider) => {
    if (disconnectingEmailProvider) return;
    setDisconnectingEmailProvider(provider);
    try {
      await emailConnectionService.disconnect(provider);
      loadConnections();
    } catch (e: any) {
      Alert.alert(
        t('request:disconnect_inbox_failed_title', {defaultValue: "Couldn't disconnect"}),
        e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
      );
    } finally {
      setDisconnectingEmailProvider(null);
    }
  };

  const onConnectCalendar = async (provider: CalendarProvider) => {
    if (connectingCalendarProvider) return;
    setConnectingCalendarProvider(provider);
    try {
      const result = await calendarConnectionService.connect(provider);
      if (result.error) throw new Error(result.error);
      loadConnections();
    } catch (e: any) {
      Alert.alert(
        t('request:connect_calendar_failed_title', {defaultValue: "Couldn't connect that calendar"}),
        e?.response?.data?.error === 'google_calendar_not_configured' ||
        e?.response?.data?.error === 'outlook_calendar_not_configured' ||
        e?.response?.data?.error === 'feature_disabled'
          ? t('request:connect_inbox_not_configured', {defaultValue: 'This isn’t available yet — check back soon.'})
          : e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
      );
    } finally {
      setConnectingCalendarProvider(null);
    }
  };

  const onDisconnectCalendar = async (provider: CalendarProvider) => {
    if (disconnectingCalendarProvider) return;
    setDisconnectingCalendarProvider(provider);
    try {
      await calendarConnectionService.disconnect(provider);
      loadConnections();
    } catch (e: any) {
      Alert.alert(
        t('request:disconnect_inbox_failed_title', {defaultValue: "Couldn't disconnect"}),
        e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
      );
    } finally {
      setDisconnectingCalendarProvider(null);
    }
  };

  const onSubmit = async () => {
    const text = emailText.trim();
    if (!text || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await applicationsService.parseEmailAndTrack(text);
      goBack();
      // Land the user straight on the (new-or-updated) application so they
      // can immediately see what got tracked/changed, rather than leaving
      // them to hunt for it back in the list.
      navigate('RequestStack', {screen: 'ApplicationDetails', params: {id: result.application.id}});
    } catch (e: any) {
      Alert.alert(
        t('request:add_from_email_failed_title', {defaultValue: "Couldn't read that email"}),
        e?.response?.data?.message ??
          e?.message ??
          t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // SYMPHONY REDESIGN follow-up -- see the module-level comment above
  // PROVIDER_LOGO_DOMAIN for the full "why cards + real logos" story. Was
  // a single shared card with plain divided rows (one email-outline glyph
  // reused for all 4 providers) -- now each provider is its OWN card with
  // its real brand mark, a one-line description, and a real bordered
  // Button (matching the reference screenshot) instead of a text link.
  const renderConnectorCard = (opts: {
    logoKey: keyof typeof PROVIDER_LOGO_DOMAIN;
    label: string;
    subtitle: string;
    conn: EmailConnectionProps | CalendarConnectionProps | null;
    isConnecting: boolean;
    isDisconnecting: boolean;
    onConnect: () => void;
    onDisconnect: () => void;
  }) => (
    <View style={[globalStyle.card, styles.providerCard]}>
      <CompanyLogoAvatar
        logoUrl={providerLogoUrl(opts.logoKey)}
        companyName={opts.label}
        size="medium"
        shape="rounded"
        fallbackIcon="building-outline"
        style={styles.providerLogo}
      />
      <View style={globalStyle.flexOne}>
        <Text category="h9" bold numberOfLines={1}>
          {opts.label}
        </Text>
        <Text category="h10" status="placeholder" mt={2} numberOfLines={2}>
          {opts.conn?.isActive
            ? t('request:connect_inbox_connected_as', {defaultValue: 'Connected — {{email}}', email: opts.conn.emailAddress ?? opts.label})
            : opts.subtitle}
        </Text>
      </View>
      {opts.conn?.isActive ? (
        opts.isDisconnecting ? (
          <Spinner size="small" />
        ) : (
          <Button
            size="small"
            appearance="outline"
            status="danger"
            onPress={opts.onDisconnect}>
            {t('request:disconnect', {defaultValue: 'Disconnect'})}
          </Button>
        )
      ) : opts.isConnecting ? (
        <Spinner size="small" />
      ) : (
        <Button
          size="small"
          appearance="outline"
          status="basic"
          onPress={opts.onConnect}>
          {t('request:connect', {defaultValue: 'Connect'})}
        </Button>
      )}
    </View>
  );

  const showOutlookMail = configService.isFeatureEnabled('outlook_inbox_scan');
  const showGmail = configService.isFeatureEnabled('gmail_inbox_scan');
  const showGoogleCalendar = configService.isFeatureEnabled('google_calendar_scan');
  const showOutlookCalendar = configService.isFeatureEnabled('outlook_calendar_scan');
  const anyConnectRowVisible = showOutlookMail || showGmail || showGoogleCalendar || showOutlookCalendar;
  const rows: React.ReactNode[] = [];
  if (showOutlookMail) {
    rows.push(renderConnectorCard({
      logoKey: 'outlook_mail',
      label: t('request:connect_outlook', {defaultValue: 'Outlook'}),
      subtitle: t('request:connect_outlook_subtitle', {defaultValue: 'Automatically detect application updates in your Outlook inbox.'}),
      conn: emailConnections?.find(c => c.provider === 'outlook') ?? null,
      isConnecting: connectingEmailProvider === 'outlook',
      isDisconnecting: disconnectingEmailProvider === 'outlook',
      onConnect: () => onConnectEmail('outlook'),
      onDisconnect: () => onDisconnectEmail('outlook'),
    }));
  }
  if (showGmail) {
    rows.push(renderConnectorCard({
      logoKey: 'gmail',
      label: t('request:connect_gmail', {defaultValue: 'Gmail'}),
      subtitle: t('request:connect_gmail_subtitle', {defaultValue: 'Automatically detect application updates in your Gmail inbox.'}),
      conn: emailConnections?.find(c => c.provider === 'gmail') ?? null,
      isConnecting: connectingEmailProvider === 'gmail',
      isDisconnecting: disconnectingEmailProvider === 'gmail',
      onConnect: () => onConnectEmail('gmail'),
      onDisconnect: () => onDisconnectEmail('gmail'),
    }));
  }
  if (showGoogleCalendar) {
    rows.push(renderConnectorCard({
      logoKey: 'google_calendar',
      label: t('request:connect_google_calendar', {defaultValue: 'Google Calendar'}),
      subtitle: t('request:connect_google_calendar_subtitle', {defaultValue: 'See interview invites and manage your schedule.'}),
      conn: calendarConnections?.find(c => c.provider === 'google') ?? null,
      isConnecting: connectingCalendarProvider === 'google',
      isDisconnecting: disconnectingCalendarProvider === 'google',
      onConnect: () => onConnectCalendar('google'),
      onDisconnect: () => onDisconnectCalendar('google'),
    }));
  }
  if (showOutlookCalendar) {
    rows.push(renderConnectorCard({
      logoKey: 'outlook_calendar',
      label: t('request:connect_outlook_calendar', {defaultValue: 'Outlook Calendar'}),
      subtitle: t('request:connect_outlook_calendar_subtitle', {defaultValue: 'See interview invites and manage your schedule.'}),
      conn: calendarConnections?.find(c => c.provider === 'outlook') ?? null,
      isConnecting: connectingCalendarProvider === 'outlook',
      isDisconnecting: disconnectingCalendarProvider === 'outlook',
      onConnect: () => onConnectCalendar('outlook'),
      onDisconnect: () => onDisconnectCalendar('outlook'),
    }));
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={<NavigationAction icon={'back'} onPress={goBack} />}
        title={<Text center category="h6" bold>{t('request:add_from_email_title', {defaultValue: 'Add from email'})}</Text>}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        {/* Connect-an-inbox-or-calendar option (product follow-up: "why not
            reading emails too?" / "build the calendar-connect one for
            both" — this is the real automatic version, see this file's own
            module comment). Shown above the manual paste box since, once
            connected, most people won't need the paste box again. Whole
            section self-hides if every provider's admin flag is currently
            off, so a fresh/not-yet-launched install just shows the paste
            box with nothing above it. */}
        {anyConnectRowVisible ? (
          <>
            <Text category="h9" bold mb={4}>
              {t('request:connect_inbox_title', {defaultValue: 'Connect your inbox or calendar'})}
            </Text>
            <Text category="h10" status="placeholder" mb={12}>
              {t('request:connect_inbox_body', {
                defaultValue: 'Automatically track application emails and interview invites as they arrive — no copy-pasting. We only read job-related messages/events; everything else is left alone.',
              })}
            </Text>
            {/* Each provider is now its own card (see renderConnectorCard's
                own comment) instead of one shared card with divided rows,
                matching the reference screenshot. */}
            {rows.map((row, i) => (
              <React.Fragment key={i}>{row}</React.Fragment>
            ))}

            <Flex justify="flex-start" itemsCenter mt={24} mb={12}>
              <View style={styles.orLine} />
              <Text category="h10" status="placeholder" ml={8} mr={8}>
                {t('request:connect_inbox_or', {defaultValue: 'OR PASTE AN EMAIL'})}
              </Text>
              <View style={styles.orLine} />
            </Flex>
          </>
        ) : null}

        <Text category="h9-s" status="placeholder" mb={16}>
          {t('request:add_from_email_body', {
            defaultValue:
              'Forward or paste an application confirmation, interview invite, rejection, or offer email below — we’ll figure out which application it belongs to and update it for you.',
          })}
        </Text>
        <Input
          multiline
          scrollEnabled
          textStyle={styles.emailText}
          style={styles.emailInput}
          placeholder={t('request:add_from_email_placeholder', {
            defaultValue: 'Paste the email text here…',
          }).toString()}
          value={emailText}
          onChangeText={setEmailText}
          autoFocus
        />
        <CtaButton
          disabled={!emailText.trim() || isSubmitting}
          onPress={onSubmit}
          style={{marginTop: 20}}>
          {isSubmitting
            ? t('request:add_from_email_submitting', {defaultValue: 'Reading email…'})
            : t('request:add_from_email_submit', {defaultValue: 'Track this application'})}
        </CtaButton>
      </Content>
    </Container>
  );
});

export default AddFromEmail;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 60,
  },
  // SYMPHONY REDESIGN follow-up (see renderConnectorCard's own comment) --
  // was a single shared card (`connectCard`) with divided rows
  // (`providerRow`/`providerDivider`); each provider is its own card now.
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
  },
  providerLogo: {
    marginRight: 12,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(128,128,128,0.15)',
  },
  // Same "Input's own style prop doesn't reach the bordered TextInput box"
  // constraint JDAnalyzer.tsx's jdInput hit (see its own comment) —
  // minHeight lives on textStyle (reaches the real native TextInput),
  // border/background/radius stay on style (reaches the wrapper).
  emailInput: {
    ...globalStyle.inputField,
    minHeight: 220,
    alignItems: 'flex-start',
  },
  emailText: {
    minHeight: 200,
    textAlignVertical: 'top',
  },
});
