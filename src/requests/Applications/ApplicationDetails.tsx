import React, {memo} from 'react';
import {Alert, Linking, Modal, Platform, ScrollView, TouchableOpacity, View} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Button,
  Icon,
  Input,
  Spinner,
} from '@ui-kitten/components';
import DateTimePicker from '@react-native-community/datetimepicker';
import {NavigationProp, useNavigation, useRoute} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Container from 'components/Container';
import CompanyLogoAvatar from 'components/CompanyLogoAvatar';

import {globalStyle} from 'styles/globalStyle';
import Flex from 'components/Flex';
import {ApplicationDetailsScreenNavigationProp, RootStackParamList} from 'navigation/types';
import {Application_Stage_Enum, FollowupDraftProps, JobApplicationProps, NetworkingContactProps} from 'constants/Types';
import * as applicationsService from 'services/applicationsService';
import * as dreamCompaniesService from 'services/dreamCompaniesService';
import * as networkingService from 'services/networkingService';
import NavigationAction from 'components/NavigationAction';
import Content from 'components/Content';
import { SkeletonList } from 'components/Skeleton';
import dayjs from 'dayjs';
import {getApplicationStageLabel} from 'utils/interviewTypeLabels';
import * as configService from 'services/configService';
import {accentColorForKey, accentTintBg} from 'utils/accentPalette';

// Same stale-after-days threshold Saveur-Backend's app/api/tracker.py's
// STALE_AFTER_DAYS uses — kept in sync manually (no shared-constants
// mechanism between the two repos) rather than round-tripping to the
// server just to know when to show the "Draft follow-up" button.
const STALE_AFTER_DAYS = 12;

const STAGE_ORDER = [
  Application_Stage_Enum.Applied,
  Application_Stage_Enum.Interviewing,
  Application_Stage_Enum.Offer,
];

const getStageStatus = (stage: Application_Stage_Enum) => {
  switch (stage) {
    case Application_Stage_Enum.Applied:
      return 'info';
    case Application_Stage_Enum.Interviewing:
      return 'warning';
    case Application_Stage_Enum.Offer:
      return 'success';
    case Application_Stage_Enum.Rejected:
      return 'danger';
    default:
      return 'basic';
  }
};

// Fetches the single application from applicationsService.listApplications()
// (there's no GET-by-id endpoint in the tracker contract, only list/create/
// patch/delete) and finds the one matching the `id` passed via navigation —
// see ApplicationItem.tsx's onPress, which now passes {id: item.id} instead
// of the old {type: item.stage} (that old param shape couldn't distinguish
// between two applications in the same stage, and looked the record up from
// static mock data rather than the real tracked list).
const ApplicationDetails = memo(() => {
  const {goBack, navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const {bottom} = useLayout();
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const {t} = useTranslation(['request', 'common']);

  const route = useRoute<ApplicationDetailsScreenNavigationProp>();
  const {id} = route.params;

  const [application, setApplication] = React.useState<JobApplicationProps | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = React.useState(false);
  const [isMovingStage, setIsMovingStage] = React.useState(false);

  // Premium Job Tracker features (product follow-up item) — see each
  // handler's own comment below.
  const [isDraftingFollowup, setIsDraftingFollowup] = React.useState(false);
  const [followupDraft, setFollowupDraft] = React.useState<FollowupDraftProps | null>(null);

  const [offerAmountText, setOfferAmountText] = React.useState('');
  const [offerCurrencyText, setOfferCurrencyText] = React.useState('');
  const [offerDeadline, setOfferDeadline] = React.useState<Date | null>(null);
  const [showDeadlinePicker, setShowDeadlinePicker] = React.useState(false);
  const [isSavingOffer, setIsSavingOffer] = React.useState(false);

  const [matchedDreamCompany, setMatchedDreamCompany] = React.useState<dreamCompaniesService.DreamCompany | null>(null);
  const [matchedContact, setMatchedContact] = React.useState<NetworkingContactProps | null>(null);

  const loadApplication = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const all = await applicationsService.listApplications();
      const found = all.find(item => String(item.id) === String(id)) ?? null;
      setApplication(found);
      if (!found) setError(t('request:application_not_found', {defaultValue: "This application couldn't be found — it may have been removed."}));
    } catch (e: any) {
      setError(e?.message ?? t('request:application_load_failed', {defaultValue: "Couldn't load this application."}));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    loadApplication();
  }, [loadApplication]);

  // Sync the offer-fields editor's local text state from the loaded
  // application whenever it (re)loads — e.g. after onMoveToNextStage moves
  // this into the Offer stage, or on the initial fetch for one already
  // there. Only resets when the underlying id changes or fresh values come
  // in, not on every keystroke (this effect doesn't depend on the text
  // state itself).
  React.useEffect(() => {
    if (!application) return;
    setOfferAmountText(application.offerAmount != null ? String(application.offerAmount) : '');
    setOfferCurrencyText(application.offerCurrency ?? '');
    setOfferDeadline(application.offerDeadline ? new Date(application.offerDeadline) : null);
  }, [application?.id, application?.offerAmount, application?.offerCurrency, application?.offerDeadline]);

  // Dream Company research + Networking Assistant contact linking (product
  // follow-up: "linking a tracked application to Dream Company research +
  // Networking Assistant contacts so moving a job to 'Interview' auto-
  // surfaces prep material instead of the user hunting for it"). Matched
  // case-insensitively by company name, same pattern
  // dream_companies.py's own _prep_progress() already uses server-side for
  // the reverse lookup (application-tracked-for-this-company). Networking
  // contacts have no backend model (AsyncStorage-only — see
  // networkingService.ts), so that half of the match happens client-side.
  React.useEffect(() => {
    if (!application || application.stage !== Application_Stage_Enum.Interviewing) {
      setMatchedDreamCompany(null);
      setMatchedContact(null);
      return;
    }
    const companyLower = (application.company || '').trim().toLowerCase();
    if (!companyLower) return;
    let cancelled = false;
    Promise.all([
      dreamCompaniesService.listDreamCompanies().catch(() => []),
      networkingService.listContacts().catch(() => []),
    ]).then(([companies, contacts]) => {
      if (cancelled) return;
      setMatchedDreamCompany(companies.find(c => (c.company || '').trim().toLowerCase() === companyLower) ?? null);
      setMatchedContact(contacts.find(c => (c.company || '').trim().toLowerCase() === companyLower) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [application?.id, application?.stage, application?.company]);

  // AI-drafted follow-up (product follow-up item — "the direct answer to
  // 'why pay for this instead of a spreadsheet'" per the earlier
  // conversation). NOT sent by Saveur — opens the user's own email client
  // pre-filled via a mailto: link so they review/edit/send it themselves
  // (see Saveur-Backend's app/api/tracker.py's draft_followup() docstring
  // for why sending on their behalf would be impersonation, not
  // assistance).
  const onDraftFollowup = async () => {
    if (!application || isDraftingFollowup) return;
    setIsDraftingFollowup(true);
    try {
      const draft = await applicationsService.draftFollowup(application.id);
      setFollowupDraft(draft);
    } catch (e: any) {
      Alert.alert(
        t('request:draft_followup_failed', {defaultValue: "Couldn't draft a follow-up"}),
        e?.response?.data?.message ?? e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
      );
    } finally {
      setIsDraftingFollowup(false);
    }
  };

  const onOpenFollowupInEmail = () => {
    if (!followupDraft) return;
    const mailto = `mailto:?subject=${encodeURIComponent(followupDraft.subject)}&body=${encodeURIComponent(followupDraft.body)}`;
    Linking.openURL(mailto).catch(() => {
      Alert.alert(
        t('request:no_email_app_title', {defaultValue: 'No email app found'}),
        t('request:no_email_app_body', {defaultValue: 'Copy the text below into your email client instead.'}),
      );
    });
  };

  const onSaveOfferDetails = async () => {
    if (!application || isSavingOffer) return;
    setIsSavingOffer(true);
    try {
      const amount = offerAmountText.trim() ? Number(offerAmountText.trim().replace(/[^0-9.]/g, '')) : undefined;
      const updated = await applicationsService.updateApplication(application.id, {
        offerAmount: amount !== undefined && !Number.isNaN(amount) ? amount : undefined,
        offerCurrency: offerCurrencyText.trim().toUpperCase() || undefined,
        offerDeadline: offerDeadline ? offerDeadline.getTime() : undefined,
      });
      if (updated) setApplication(updated);
    } catch (e: any) {
      Alert.alert(
        t('request:save_offer_failed', {defaultValue: 'Could not save offer details'}),
        e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
      );
    } finally {
      setIsSavingOffer(false);
    }
  };

  const onWithdraw = async () => {
    if (!application || isWithdrawing) return;
    setIsWithdrawing(true);
    try {
      await applicationsService.deleteApplication(application.id);
      goBack();
    } catch (e: any) {
      Alert.alert(
        t('request:withdraw_application_failed', {defaultValue: 'Could not withdraw application'}),
        e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
      );
    } finally {
      setIsWithdrawing(false);
    }
  };

  const onMoveToNextStage = async () => {
    if (!application || isMovingStage) return;
    const currentIndex = STAGE_ORDER.indexOf(application.stage);
    const nextStage =
      currentIndex >= 0 && currentIndex < STAGE_ORDER.length - 1
        ? STAGE_ORDER[currentIndex + 1]
        : null;
    if (!nextStage) return;
    setIsMovingStage(true);
    try {
      const updated = await applicationsService.updateApplicationStage(application.id, nextStage);
      if (updated) setApplication(updated);
    } catch (e: any) {
      Alert.alert(
        t('request:update_stage_failed', {defaultValue: 'Could not update stage'}),
        e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
      );
    } finally {
      setIsMovingStage(false);
    }
  };

  const onPracticeForThis = () => navigate('MockInterviewSetup', {});

  // Product request: "What's Next" post-offer guided journey — the Offer
  // stage of this tracker is the natural moment to surface it (a user just
  // reached the point this feature exists for), pre-filled with the real
  // company/role from this application rather than making them retype it
  // on WhatsNext's own form. Also carries the tracked offer amount/currency
  // (product report: "What's Next should also auto detect apart from users
  // manually entering details") — this application already has that data
  // (set from the Offer-stage editor), so there's no reason to make the
  // user retype it a second time on WhatsNext's own form. See
  // src/more/WhatsNext.tsx.
  const onWhatsNext = () => navigate('WhatsNext', {
    company: application?.company,
    role: application?.role,
    currentOffer: application?.offerAmount != null
      ? `${application?.offerCurrency ?? ''} ${application.offerAmount}`.trim()
      : undefined,
  });

  if (isLoading) {
    return (
      <Container style={styles.container}>
        {/* BUG FIX (app-wide sweep, product report: "so many buttons...
            the text are in white in light mode") — status="primary"
            resolves to text-primary-color, near-white, only correct for
            text on a SOLID colored surface. This TopNavigation title
            sits on the plain page background, not a colored bar, so it
            rendered effectively invisible in light mode. Default status
            (basic ink color) is what every other TopNavigation title in
            the app already uses. */}
        <TopNavigation
          accessoryLeft={<NavigationAction icon={'back'} onPress={goBack} />}
          title={<Text center category="h6" bold>{t('request:requestDetails')}</Text>}
        />
        {/* Product request: "skeleton loader should be in all the screen
            except the auth screens, AI Career coach screen" — was a bare
            "Loading…" text, no shape at all. */}
        <SkeletonList count={3} style={{ paddingHorizontal: 16, paddingTop: 16 }} />
      </Container>
    );
  }

  if (error || !application) {
    return (
      <Container style={styles.container}>
        <TopNavigation
          accessoryLeft={<NavigationAction icon={'back'} onPress={goBack} />}
          title={<Text center category="h6" bold>{t('request:requestDetails')}</Text>}
        />
        <Flex vertical itemsCenter justify="center" style={globalStyle.flexOne}>
          <Text category="h9-s" status="danger" center mh={24}>
            {error ?? t('request:application_not_found_short', {defaultValue: 'Application not found.'})}
          </Text>
        </Flex>
      </Container>
    );
  }

  const stage = application.stage;
  const canAdvance = STAGE_ORDER.indexOf(stage) >= 0 && STAGE_ORDER.indexOf(stage) < STAGE_ORDER.length - 1;

  // "Gone quiet" — mirrors Saveur-Backend's tracker.py analytics()/
  // job_tracker_service.py stale detection, computed client-side here so
  // the "Draft follow-up" button can show up immediately without an extra
  // round-trip. statusChangedAt falls back to appliedDate for applications
  // tracked before that field existed.
  const lastChangeMs = application.statusChangedAt ?? Number(application.appliedDate);
  const daysSinceChange = Math.floor((Date.now() - lastChangeMs) / (1000 * 60 * 60 * 24));
  const isStale =
    (stage === Application_Stage_Enum.Applied || stage === Application_Stage_Enum.Interviewing) &&
    daysSinceChange >= STALE_AFTER_DAYS;

  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={<NavigationAction icon={'back'} onPress={goBack} />}
        title={
          <Text center category="h6" bold>
            {t('request:requestDetails')}
          </Text>
        }
      />
      <Text
        center
        category="h8"
        bold
        status={getStageStatus(stage) as any}
        mb={8}>
        {getApplicationStageLabel(stage, t)}
      </Text>
      <Content padder contentContainerStyle={styles.content}>
        <Flex justify="flex-start" itemsCenter mb={32}>
          <CompanyLogoAvatar
            logoUrl={application.companyLogoUrl}
            companyName={application.company}
            size="giant"
            shape="rounded"
            fallbackIcon="briefcase-outline"
          />
          <View style={{marginLeft: 16, flexShrink: 1}}>
            <Text category="h3" bold numberOfLines={2}>
              {application.role}
            </Text>
            <Text category="h7-s" status="placeholder" mt={4}>
              {application.company}
            </Text>
          </View>
        </Flex>

        <Text category="h8" status={'placeholder'} bold mb={8}>
          {t('request:where')}
        </Text>
        <Text category="h7" bold mb={24}>
          {application.location}
        </Text>

        <Text category="h8" status={'placeholder'} bold mb={8}>
          {t('request:when')}
        </Text>
        {/* dayjs.utc(...) — see ApplicationItem.tsx's comment on the same
            fix; appliedDate is a UTC-midnight-encoded calendar date, not a
            real moment in time, so it must not be reinterpreted in the
            device's local timezone. */}
        <Text category="h7" bold mb={24}>
          {dayjs.utc(application.appliedDate).format('MMM DD, YYYY')}
        </Text>

        {/* Stage tracker */}
        <Text bold mb={16} category="h3">
          {t('request:application-stage')}
        </Text>
        <Flex justify="flex-start" mb={32}>
          {STAGE_ORDER.map((s, i) => {
            const reached =
              stage === Application_Stage_Enum.Rejected
                ? i === 0
                : STAGE_ORDER.indexOf(stage) >= i;
            return (
              <React.Fragment key={s}>
                <View
                  style={[
                    styles.stageDot,
                    {
                      backgroundColor: reached
                        ? theme['color-primary-500']
                        : theme['background-basic-color-3'],
                    },
                  ]}
                />
                {i < STAGE_ORDER.length - 1 ? (
                  <View
                    style={[
                      styles.stageLine,
                      {
                        backgroundColor: reached
                          ? theme['color-primary-500']
                          : theme['background-basic-color-3'],
                      },
                    ]}
                  />
                ) : null}
              </React.Fragment>
            );
          })}
        </Flex>
        <Flex justify="space-between" mb={32}>
          {STAGE_ORDER.map(s => (
            <Text key={s} category="h9" status="placeholder">
              {getApplicationStageLabel(s, t)}
            </Text>
          ))}
        </Flex>

        {application.nextStep ? (
          <>
            <Text bold mb={12} category="h3">
              {t('request:next-step')}
            </Text>
            <Text mb={32}>{application.nextStep}</Text>
          </>
        ) : null}

        {/* "Gone quiet" follow-up prompt (premium Job Tracker feature). */}
        {isStale ? (
          <Layout level="2" style={styles.premiumCard}>
            <Flex justify="flex-start" itemsCenter mb={8}>
              <Icon pack="eva" name="clock-outline" style={[globalStyle.icon20, {tintColor: theme['color-warning-500']}]} />
              <Text category="h9" bold ml={8}>
                {t('request:stale_prompt_title', {defaultValue: 'This one has gone quiet'})}
              </Text>
            </Flex>
            <Text category="h10" status="placeholder" mb={14}>
              {t('request:stale_prompt_body', {
                defaultValue: 'No update in {{days}} days. Want a follow-up email drafted for you to send?',
                days: daysSinceChange,
              })}
            </Text>
            <Button
              size="small"
              disabled={isDraftingFollowup}
              accessoryLeft={props => (isDraftingFollowup ? <Spinner size="small" status="basic" /> : <Icon {...props} pack="eva" name="edit-2-outline" />)}
              onPress={onDraftFollowup}>
              {isDraftingFollowup
                ? t('request:draft_followup_drafting', {defaultValue: 'Drafting…'})
                : t('request:draft_followup_cta', {defaultValue: 'Draft follow-up email'})}
            </Button>
          </Layout>
        ) : null}

        {/* Dream Company research / Networking contact linking (premium Job
            Tracker feature) — only for Interviewing, the moment prep
            material is actually useful. */}
        {stage === Application_Stage_Enum.Interviewing && (matchedDreamCompany || matchedContact) ? (
          <Layout level="2" style={styles.premiumCard}>
            <Text category="h9" bold mb={10}>
              {t('request:prep_card_title', {defaultValue: 'Get ready for this interview'})}
            </Text>
            {matchedDreamCompany ? (
              <TouchableOpacity
                style={styles.prepRow}
                onPress={() => navigate('DreamCompanies')}
                activeOpacity={0.7}>
                <View style={[styles.prepIconWrap, {backgroundColor: accentTintBg(accentColorForKey(application.company))}]}>
                  <Icon pack="eva" name="briefcase-outline" style={[globalStyle.icon16, {tintColor: accentColorForKey(application.company)}]} />
                </View>
                <Text category="h10" style={globalStyle.flexOne} ml={10}>
                  {t('request:prep_card_research', {defaultValue: 'You’ve already researched {{company}} — review it', company: application.company})}
                </Text>
                <Icon pack="assets" name="chevronRight" style={[globalStyle.icon16, {tintColor: theme['text-hint-color']}]} />
              </TouchableOpacity>
            ) : null}
            {matchedContact ? (
              <TouchableOpacity
                style={styles.prepRow}
                onPress={() => navigate('NetworkingAssistant')}
                activeOpacity={0.7}>
                <View style={[styles.prepIconWrap, {backgroundColor: accentTintBg('#6366F1')}]}>
                  <Icon pack="eva" name="people-outline" style={[globalStyle.icon16, {tintColor: '#6366F1'}]} />
                </View>
                <Text category="h10" style={globalStyle.flexOne} ml={10}>
                  {t('request:prep_card_contact', {defaultValue: 'You know {{name}} at {{company}} — reach out', name: matchedContact.name, company: application.company})}
                </Text>
                <Icon pack="assets" name="chevronRight" style={[globalStyle.icon16, {tintColor: theme['text-hint-color']}]} />
              </TouchableOpacity>
            ) : null}
          </Layout>
        ) : null}

        {/* Multi-offer comparison fields (premium Job Tracker feature) —
            only meaningful once this is an actual offer. */}
        {stage === Application_Stage_Enum.Offer ? (
          <Layout level="2" style={styles.premiumCard}>
            <Text category="h9" bold mb={12}>
              {t('request:offer_details_title', {defaultValue: 'Offer details'})}
            </Text>
            <Flex justify="flex-start" mb={12}>
              <Input
                keyboardType="numeric"
                placeholder={t('request:offer_amount_placeholder', {defaultValue: 'e.g. 95000'}).toString()}
                value={offerAmountText}
                onChangeText={setOfferAmountText}
                style={[globalStyle.inputField, {flex: 2, marginRight: 8}]}
                textStyle={globalStyle.inputText}
                label={t('request:offer_amount_label', {defaultValue: 'Base offer'}).toString()}
              />
              <Input
                autoCapitalize="characters"
                maxLength={3}
                placeholder="USD"
                value={offerCurrencyText}
                onChangeText={setOfferCurrencyText}
                style={[globalStyle.inputField, {flex: 1}]}
                textStyle={globalStyle.inputText}
                label={t('request:offer_currency_label', {defaultValue: 'Currency'}).toString()}
              />
            </Flex>
            <Text category="h10" status="placeholder" mb={6}>
              {t('request:offer_deadline_label', {defaultValue: 'Decision deadline (optional)'})}
            </Text>
            <TouchableOpacity onPress={() => setShowDeadlinePicker(true)} style={[globalStyle.inputField, styles.dateInput]}>
              <Text category="h9" status={offerDeadline ? 'basic' : 'placeholder'}>
                {offerDeadline
                  ? offerDeadline.toLocaleDateString()
                  : t('request:offer_deadline_placeholder', {defaultValue: 'Select a date'})}
              </Text>
              <Icon pack="eva" name="calendar-outline" style={[globalStyle.icon20, {tintColor: theme['text-hint-color']}]} />
            </TouchableOpacity>
            {showDeadlinePicker && Platform.OS === 'ios' ? (
              <View style={styles.iosDatePickerWrap}>
                <DateTimePicker
                  value={offerDeadline ?? new Date()}
                  mode="date"
                  display="spinner"
                  minimumDate={new Date()}
                  onChange={(_, selected) => {
                    if (selected) setOfferDeadline(selected);
                  }}
                />
                <Button size="small" style={{alignSelf: 'center', marginTop: 4}} onPress={() => setShowDeadlinePicker(false)}>
                  {t('common:done', {defaultValue: 'Done'})}
                </Button>
              </View>
            ) : null}
            {showDeadlinePicker && Platform.OS !== 'ios' ? (
              <DateTimePicker
                value={offerDeadline ?? new Date()}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={(_, selected) => {
                  setShowDeadlinePicker(false);
                  if (selected) setOfferDeadline(selected);
                }}
              />
            ) : null}
            <Button
              size="small"
              status="basic"
              appearance="outline"
              disabled={isSavingOffer}
              style={{marginTop: 12}}
              onPress={onSaveOfferDetails}>
              {isSavingOffer ? t('common:saving', {defaultValue: 'Saving…'}) : t('common:save', {defaultValue: 'Save'})}
            </Button>
          </Layout>
        ) : null}

        {/* Gated on post_offer_plan (product request: "all those new
            features I asked you to implement newly I want all of them to be
            configurable in the admin") — this button used to show
            unconditionally for every Offer-stage application regardless of
            the flag, even though the flag's own backend comment already
            claimed it hid this CTA. See MoreSrc.tsx's More-menu row for the
            same flag's other, already-correct gate. */}
        {stage === Application_Stage_Enum.Offer && configService.isFeatureEnabled('post_offer_plan') ? (
          <Button
            children={t('request:whats_next_cta', {defaultValue: "What's Next?"})}
            status="success"
            accessoryLeft={props => <Icon {...props} name="gift-outline" pack="eva" />}
            onPress={onWhatsNext}
            style={{marginBottom: 12}}
          />
        ) : null}

        {/* BUG FIX (product report: "the practice for this interview button
            should not appear there yet until it gets to the interview
            stage") — this used to render unconditionally for every
            application regardless of stage, including ones still sitting
            at Applied (no interview scheduled yet) or already Rejected.
            Interviewing and Offer are the only stages where practicing for
            an interview is actually relevant (Offer stays included since an
            applicant can still have further interview rounds — onsite,
            panel, etc. — after an initial offer conversation). */}
        {stage === Application_Stage_Enum.Interviewing || stage === Application_Stage_Enum.Offer ? (
          <Button
            children={t('request:practice-for-this-interview')}
            status="primary"
            onPress={onPracticeForThis}
            style={{marginBottom: 24}}
          />
        ) : null}
      </Content>
      <Layout style={[styles.bottom, {paddingBottom: bottom + 8}]} level="2">
        <Button
          children={isWithdrawing ? t('request:withdrawing', {defaultValue: 'Withdrawing…'}) : t('request:cancelApplication')}
          status="outline"
          disabled={isWithdrawing}
          style={[globalStyle.flexOne, {marginRight: 16}]}
          onPress={onWithdraw}
        />
        <Button
          children={isMovingStage ? t('common:updating', {defaultValue: 'Updating…'}) : t('common:update')}
          style={globalStyle.flexOne}
          status={stage === Application_Stage_Enum.Rejected ? 'danger' : 'basic'}
          disabled={isMovingStage || !canAdvance}
          onPress={onMoveToNextStage}
        />
      </Layout>

      {/* Follow-up draft result (premium Job Tracker feature) — plain text
          shown on-screen (so the user can also just read/manually copy it)
          plus an "Open in email app" shortcut via a mailto: link. Same
          bottom-sheet Modal pattern components/DayActivityModal.tsx uses. */}
      <Modal visible={!!followupDraft} animationType="slide" transparent onRequestClose={() => setFollowupDraft(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, {backgroundColor: theme['background-basic-color-1']}]}>
            <Flex justify="space-between" itemsCenter mb={16}>
              <Text category="h7" bold>
                {t('request:draft_followup_modal_title', {defaultValue: 'Follow-up draft'})}
              </Text>
              <TouchableOpacity onPress={() => setFollowupDraft(null)} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                <Icon pack="eva" name="close-outline" style={[globalStyle.icon24, {tintColor: theme['text-basic-color']}]} />
              </TouchableOpacity>
            </Flex>
            <ScrollView showsVerticalScrollIndicator={false} style={{maxHeight: 320}}>
              {followupDraft ? (
                <>
                  <Text category="h9" bold mb={8}>{followupDraft.subject}</Text>
                  <Text category="h10">{followupDraft.body}</Text>
                </>
              ) : null}
            </ScrollView>
            <Button
              style={{marginTop: 20}}
              accessoryLeft={props => <Icon {...props} pack="eva" name="email-outline" />}
              onPress={onOpenFollowupInEmail}>
              {t('request:draft_followup_open_email', {defaultValue: 'Open in email app'})}
            </Button>
          </View>
        </View>
      </Modal>
    </Container>
  );
});

export default ApplicationDetails;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingBottom: 0,
  },
  content: {
    ...globalStyle.topBorder16,
    paddingHorizontal: 24,
    backgroundColor: 'background-basic-color-2',
    paddingBottom: 80,
  },
  stageDot: {
    width: 16,
    height: 16,
    borderRadius: 99,
  },
  stageLine: {
    flex: 1,
    height: 4,
    marginHorizontal: 4,
    alignSelf: 'center',
  },
  bottom: {
    paddingHorizontal: 24,
    paddingTop: 14,
    ...globalStyle.topBorder24,
    ...globalStyle.shadowFade,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // Premium Job Tracker features (product follow-up item) — shared card
  // treatment for the stale-followup prompt, prep card, and offer-details
  // editor, all rendered inline in the detail flow above.
  premiumCard: {
    ...globalStyle.card,
    padding: 16,
    marginBottom: 24,
  },
  prepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  prepIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iosDatePickerWrap: {
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    maxHeight: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
});
