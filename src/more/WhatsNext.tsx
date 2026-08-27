import React, { memo } from 'react';
import { KeyboardAvoidingView, Modal, Platform, TouchableOpacity, View } from 'react-native';
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
} from '@ui-kitten/components';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NavigationProp, RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import CtaButton from 'components/CtaButton';
import PeriodicCheckInSheet from 'components/PeriodicCheckInSheet';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import { AuthContext } from '../../AuthContext';
import ProLockGate from 'components/ProLockGate';
import { SkeletonList } from 'components/Skeleton';
import { ArtWorkplaceCompass } from 'src/home/HomeHeroArt';
import * as whatsNextService from 'services/whatsNextService';
import { PostOfferPlan, PlanStep, PostOfferCheckIn } from 'services/whatsNextService';
import * as applicationsService from 'services/applicationsService';
import { Application_Stage_Enum } from 'constants/Types';

// "What's Next" — Pro Premium post-offer guided journey (product request:
// once a user gets an offer, one feature should cover negotiation help, a
// pre-start checklist, and a 90-day success plan together, not three
// separate screens — explicit product-owner scope decision: "both, as a
// single guided journey"). One AI call plans all three sections for this
// specific offer (see services/whatsNextService.ts / app/api/post_offer.py).
//
// Reached two ways: from the Offer stage of the Application Tracker
// (src/requests/Applications/ApplicationDetails.tsx passes company/role
// pre-filled from that application) and from the More menu (both blank,
// typed in on this screen's own form instead) — both land here identically,
// this screen doesn't need to know which.
const WhatsNext = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t, i18n } = useTranslation(['more', 'common']);
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'WhatsNext'>>();
  const { isPremium } = React.useContext(AuthContext);

  const [plan, setPlan] = React.useState<PostOfferPlan | null>(null);
  const [planLoaded, setPlanLoaded] = React.useState(false);

  // Product request: "convert this form to a bottom sheet" — same
  // Modal + KeyboardAvoidingView + Layout sheet pattern as
  // DreamCompanies.tsx/NetworkingAssistant.tsx/CareerDiary.tsx, replacing
  // the old always-open inline form card.
  const [showFormSheet, setShowFormSheet] = React.useState(false);

  const [company, setCompany] = React.useState(route.params?.company ?? '');
  const [role, setRole] = React.useState(route.params?.role ?? '');
  const [currentOffer, setCurrentOffer] = React.useState(route.params?.currentOffer ?? '');
  const [targetAsk, setTargetAsk] = React.useState('');
  // Product report: "I thought the What's Next also auto detect apart from
  // users manually entering details" -- true when the form below was
  // silently pre-filled from a tracked application rather than typed in,
  // so the intro/form copy can tell the user what happened instead of
  // presenting pre-filled fields with no explanation.
  const [autoDetectedFrom, setAutoDetectedFrom] = React.useState(false);
  const [startDate, setStartDate] = React.useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Which checklist item / plan phase currently has a request in flight —
  // disables just that row/button, same pattern CareerRoadmap.tsx's
  // completingOrder uses for its own "mark complete" calls.
  const [togglingItemId, setTogglingItemId] = React.useState<number | null>(null);
  const [completingOrder, setCompletingOrder] = React.useState<number | null>(null);

  React.useEffect(() => {
    whatsNextService.getSavedPlan()
      .then(setPlan)
      .finally(() => setPlanLoaded(true));
  }, []);

  // Product report: "I thought the What's Next also auto detect apart from
  // users manually entering details" -- this screen only ever pre-filled
  // company/role when reached from a specific Offer-stage application's own
  // "What's Next?" button (ApplicationDetails.tsx passing them via route
  // params, see onWhatsNext there). Opened from the More menu instead,
  // every field was blank even though the app's own Application Tracker
  // very possibly already has an Offer-stage entry with this exact
  // information. Auto-detect that case: once the saved plan has loaded (so
  // this doesn't race it) and no plan/route params/typed-in values already
  // cover it, check the tracker for a single Offer-stage application and
  // silently pre-fill the form sheet from it. Deliberately does nothing
  // when there are zero or multiple Offer-stage applications -- guessing
  // wrong would be worse than leaving the form blank, and picking "most
  // recent" among several offers isn't obviously correct either.
  React.useEffect(() => {
    if (!planLoaded || plan) return;
    if (route.params?.company || route.params?.role) return;
    applicationsService.listApplications().then(apps => {
      const offers = apps.filter(a => a.stage === Application_Stage_Enum.Offer);
      if (offers.length !== 1) return;
      const offer = offers[0];
      setCompany(offer.company ?? '');
      setRole(offer.role ?? '');
      if (offer.offerAmount != null) {
        setCurrentOffer(`${offer.offerCurrency ?? ''} ${offer.offerAmount}`.trim());
      }
      setAutoDetectedFrom(true);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planLoaded, plan]);

  // Weekly "how's it going?" check-in (product request: "always check up
  // on the user regularly to know how they are doing at the new role until
  // the first 90 days are over. Usually via push notification and pop up
  // questions") — the push (data.type: "post_offer_checkin", see
  // pushNotificationService.ts) just navigates here; there's nothing to
  // parse out of its payload, so a plain re-fetch on every focus (not just
  // mount) is what actually surfaces it, whether the user tapped the push
  // or was already sitting on this screen. Only meaningful once a plan
  // exists — before that there's nothing to check in on.
  const [pendingCheckIn, setPendingCheckIn] = React.useState<PostOfferCheckIn | null>(null);
  // Dismissing without answering shouldn't immediately re-pop the same
  // check-in the moment this screen regains focus again (e.g. backgrounding
  // and reopening the app) — same "asked, dismissed, don't re-ask this
  // session" idea as dailyCheckinService.wasGoalPromptDismissedToday, just
  // in-memory only rather than persisted, since these are far less frequent
  // (weekly, not daily) and refetching next session is fine.
  const dismissedCheckInIdsRef = React.useRef<Set<number>>(new Set());
  useFocusEffect(
    React.useCallback(() => {
      if (!plan) return;
      whatsNextService.getPendingCheckIn().then(found => {
        if (found && dismissedCheckInIdsRef.current.has(found.id)) return;
        setPendingCheckIn(found);
      });
    }, [plan]),
  );
  const onSubmitCheckIn = React.useCallback(async (text: string) => {
    if (!pendingCheckIn) return;
    await whatsNextService.submitCheckIn(pendingCheckIn.id, text);
    setPendingCheckIn(null);
  }, [pendingCheckIn]);
  const onDismissCheckIn = React.useCallback(() => {
    if (pendingCheckIn) dismissedCheckInIdsRef.current.add(pendingCheckIn.id);
    setPendingCheckIn(null);
  }, [pendingCheckIn]);

  const onGenerate = async () => {
    const co = company.trim();
    const r = role.trim();
    if (!co || !r || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const built = await whatsNextService.generatePlan({
        company: co,
        role: r,
        currentOffer: currentOffer.trim(),
        targetAsk: targetAsk.trim(),
        startDate: startDate ? startDate.toISOString().slice(0, 10) : undefined,
      });
      setPlan(built);
      setShowFormSheet(false);
    } catch {
      setError(t('more:whats_next_generate_failed', {
        defaultValue: "Couldn't build your plan right now. Please try again.",
      }));
    } finally {
      setIsGenerating(false);
    }
  };

  const onReset = async () => {
    await whatsNextService.resetPlan();
    setPlan(null);
    setCompany('');
    setRole('');
    setCurrentOffer('');
    setTargetAsk('');
    setStartDate(null);
    setError(null);
  };

  const onToggleChecklistItem = async (id: number) => {
    if (togglingItemId != null) return;
    setTogglingItemId(id);
    setError(null);
    try {
      const updated = await whatsNextService.toggleChecklistItem(id);
      setPlan(updated);
    } catch {
      setError(t('more:whats_next_update_failed', {
        defaultValue: "Couldn't update your plan right now. Please try again.",
      }));
    } finally {
      setTogglingItemId(null);
    }
  };

  const onCompletePlanStep = async (order: number) => {
    if (completingOrder != null) return;
    setCompletingOrder(order);
    setError(null);
    try {
      const updated = await whatsNextService.completePlanStep(order);
      setPlan(updated);
    } catch {
      setError(t('more:whats_next_update_failed', {
        defaultValue: "Couldn't update your plan right now. Please try again.",
      }));
    } finally {
      setCompletingOrder(null);
    }
  };

  const stepColor = (status: PlanStep['status']) => {
    if (status === 'completed') return theme['color-success-500'];
    if (status === 'current') return theme['color-primary-500'];
    return theme['text-hint-color'];
  };

  if (!planLoaded) {
    return (
      <Container style={styles.container}>
        <TopNavigation
          title={t('more:whats_next_title', { defaultValue: "What's Next" })}
          accessoryLeft={<NavigationAction />}
        />
        <SkeletonList count={3} style={{ paddingHorizontal: 16 }} />
      </Container>
    );
  }

  if (!plan && !isPremium) {
    return (
      <ProLockGate
        variant="premium"
        title={t('more:whats_next_title', { defaultValue: "What's Next" })}
        description={t('more:whats_next_pro_gate_description', {
          defaultValue: 'Negotiation talking points, a pre-start checklist, and a plan for settling in and succeeding with your new team — a Premium feature.',
        })}
      />
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:whats_next_title', { defaultValue: "What's Next" })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        {!plan ? (
          <Flex vertical itemsCenter justify="center" style={styles.introBody}>
            {/* Product request: "add illustrations like the gift box
                wherever needed", then a follow-up: "use a better
                illustration". Also shown inside the form sheet's own
                header below. Only rendered before a plan exists — once
                generated, the timeline/checklist are the visual content.
                See src/home/HomeHeroArt.tsx's own comment for the full
                context on why this replaced the earlier signpost. */}
            <ArtWorkplaceCompass size={104} />
            <Text category="h9-s" status="placeholder" center mt={20} mb={28} maxWidth={320}>
              {t('more:whats_next_description', {
                defaultValue: "Tell the AI about your offer, and it builds your negotiation talking points, a pre-start checklist, and a plan for navigating your first 90 days — fitting in with your new team, working well with colleagues, and making a real impact, not just closing tasks.",
              })}
            </Text>

            {error ? <Text category="h9-s" status="danger" mb={16} center>{error}</Text> : null}

            <CtaButton
              style={[globalStyle.shadowBtn, { width: '100%' }]}
              onPress={() => setShowFormSheet(true)}
            >
              {t('more:whats_next_get_started_cta', { defaultValue: 'Get started' })}
            </CtaButton>
          </Flex>
        ) : (
          <View>
            {error ? <Text category="h9-s" status="danger" mb={16} center>{error}</Text> : null}

            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text category="h10" status="placeholder">
                  {t('more:whats_next_offer_label', { defaultValue: 'Offer' })}
                </Text>
                <Text category="h7" bold mt={2}>{plan.role}</Text>
                <Text category="h9-s" status="placeholder" mt={2}>{plan.company}</Text>
              </View>
              <Text category="h10" status="link" onPress={onReset}>
                {t('more:curriculum_start_over', { defaultValue: 'Start over' })}
              </Text>
            </View>

            {/* Section 1: negotiation */}
            <Text category="h6" bold mb={4} mt={12}>
              {t('more:whats_next_negotiate_title', { defaultValue: 'Negotiate your offer' })}
            </Text>
            <Text category="h9-s" status="placeholder" mb={16}>
              {t('more:whats_next_negotiate_description', {
                defaultValue: 'Concrete talking points for this offer — say them in your own words.',
              })}
            </Text>
            {plan.negotiationPoints.map((point, i) => (
              <Layout level="2" key={i} style={styles.pointCard}>
                <Text category="h9" bold mb={4}>{point.title}</Text>
                <Text category="h9-s" status="placeholder">{point.script}</Text>
              </Layout>
            ))}
            <Button
              size="small"
              appearance="outline"
              style={{ marginTop: 4, marginBottom: 28, alignSelf: 'flex-start' }}
              accessoryLeft={props => <Icon {...props} name="mic-outline" />}
              onPress={() => navigate('SalaryNegotiation')}
            >
              {t('more:whats_next_practice_live_cta', { defaultValue: 'Practice this live' })}
            </Button>

            {/* Section 2: pre-start checklist */}
            <Text category="h6" bold mb={4}>
              {t('more:whats_next_checklist_title', { defaultValue: 'Before you start' })}
            </Text>
            <Text category="h9-s" status="placeholder" mb={16}>
              {t('more:whats_next_checklist_progress', {
                defaultValue: '{{done}} of {{total}} done',
                done: plan.checklistDoneCount,
                total: plan.checklistTotalCount,
              })}
            </Text>
            {plan.checklist.map(item => {
              const isDone = item.status === 'done';
              const isBusy = togglingItemId === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.7}
                  disabled={isBusy}
                  onPress={() => onToggleChecklistItem(item.id)}
                  style={styles.checklistRow}
                >
                  <View style={[
                    styles.checkbox,
                    { borderColor: isDone ? theme['color-success-500'] : theme['border-basic-color-3'] },
                    isDone ? { backgroundColor: theme['color-success-500'] } : null,
                  ]}>
                    {isBusy ? (
                      <Spinner size="tiny" status="basic" />
                    ) : isDone ? (
                      <Icon pack="eva" name="checkmark-outline" style={[globalStyle.icon16, { tintColor: '#fff' }]} />
                    ) : null}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text category="h9" bold status={isDone ? 'placeholder' : 'basic'} style={isDone ? styles.strikethrough : undefined}>
                      {item.title}
                    </Text>
                    {item.description ? (
                      <Text category="h10" status="placeholder" mt={2}>{item.description}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Section 3: 90-day plan */}
            <Text category="h6" bold mb={4} mt={28}>
              {t('more:whats_next_90day_title', { defaultValue: 'Your first 90 days' })}
            </Text>
            <Text category="h9-s" status="placeholder" mb={16}>
              {t('more:whats_next_90day_description', {
                defaultValue: 'A phase-by-phase plan for settling in, working well with your new team, and succeeding in this role, tracked as you go.',
              })}
            </Text>

            {plan.planIsComplete ? (
              <View style={[styles.completeBanner, styles.completeBannerInner]}>
                <Icon pack="eva" name="award-outline" style={[globalStyle.icon20, { tintColor: 'color-success-500' }]} />
                <Text category="h9" bold status="success" style={{ marginLeft: 10, flex: 1 }}>
                  {t('more:whats_next_90day_complete', {
                    defaultValue: "You've worked through your first 90 days at {{company}}!",
                    company: plan.company,
                  })}
                </Text>
              </View>
            ) : null}

            <View style={styles.timeline}>
              {plan.ninetyDayPlan.map((step, i) => {
                const isLast = i === plan.ninetyDayPlan.length - 1;
                const color = stepColor(step.status);
                const isCompletingThis = completingOrder === step.order;
                return (
                  <View key={step.order} style={styles.timelineRow}>
                    <View style={styles.timelineIndicatorCol}>
                      <View style={[
                        styles.timelineDot,
                        { borderColor: color },
                        step.status !== 'locked' ? { backgroundColor: color } : null,
                      ]}>
                        <Icon
                          pack="eva"
                          name={step.status === 'locked' ? 'lock-outline' : (step.status === 'completed' ? 'checkmark-outline' : 'flag-outline')}
                          style={[globalStyle.icon16, { tintColor: step.status !== 'locked' ? theme['color-basic-100'] : theme['text-hint-color'] }]}
                        />
                      </View>
                      {!isLast ? (
                        <View style={[styles.timelineLine, { backgroundColor: step.status === 'completed' ? theme['color-success-500'] : theme['border-basic-color-3'] }]} />
                      ) : null}
                    </View>
                    <View style={[styles.timelineContent, { paddingBottom: isLast ? 0 : 24 }]}>
                      <Text category="h10" status="placeholder">{step.phase}</Text>
                      <Text category="h9" bold status={step.status === 'locked' ? 'placeholder' : 'basic'} mt={2}>
                        {step.title}
                      </Text>
                      <Text category="h10" status="placeholder" mt={2} mb={step.status === 'current' ? 10 : 0}>
                        {step.description}
                      </Text>
                      {step.status === 'current' ? (
                        <Button
                          size="small"
                          status="primary"
                          disabled={completingOrder != null}
                          onPress={() => onCompletePlanStep(step.order)}
                        >
                          {isCompletingThis
                            ? () => <Spinner size="small" status="control" />
                            : t('more:roadmap_mark_complete', { defaultValue: 'Mark complete' })}
                        </Button>
                      ) : step.status === 'completed' ? (
                        <Text category="h10" status="success" bold mt={4}>
                          {t('more:completed', { defaultValue: 'Completed' })}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </Content>

      <Modal visible={showFormSheet} transparent animationType="slide" onRequestClose={() => setShowFormSheet(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Layout level="1" style={styles.modalSheet}>
            {/* flexShrink:1 on the ScrollView (Content), paired with
                modalSheet's maxHeight below, is what actually lets this
                sheet scroll internally instead of growing past the screen
                — a ScrollView with no explicit flex sizes itself to its
                full content height regardless of an ancestor's maxHeight,
                so without this the last field/button could render off the
                bottom of the screen unreachable. */}
            <Content style={{ flexGrow: 0, flexShrink: 1 }} showsVerticalScrollIndicator={false}>
              {/* Product request: "all bottom sheets should have a close
                  button" -- this sheet's heading is centered under the
                  illustration rather than in a left-aligned title row like
                  most other sheets, so there's no natural spot for an
                  inline X next to a title. A standalone top-right close
                  button above the illustration instead. */}
              <Flex justify="flex-end" mb={4}>
                <TouchableOpacity onPress={() => setShowFormSheet(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon pack="eva" name="close-outline" style={[globalStyle.icon24, { tintColor: theme['text-basic-color'] }]} />
                </TouchableOpacity>
              </Flex>
              <Flex center mb={12}>
                <ArtWorkplaceCompass size={72} />
              </Flex>
              <Text category="h7" bold center mb={autoDetectedFrom ? 4 : 20}>
                {t('more:whats_next_form_sheet_title', { defaultValue: 'Tell us about your offer' })}
              </Text>
              {autoDetectedFrom ? (
                <Text category="h10" status="primary" center mb={20}>
                  {t('more:whats_next_autodetected_notice', {
                    defaultValue: 'Filled in from your Offer-stage application — edit anything below before building your plan.',
                  })}
                </Text>
              ) : null}
              <Text category="h10" status="placeholder" mb={6}>
                {t('more:whats_next_company_label', { defaultValue: 'Company' })}
              </Text>
              <Input
                placeholder={t('more:whats_next_company_placeholder', { defaultValue: 'e.g. Acme Inc.' })}
                value={company}
                onChangeText={setCompany}
                style={[styles.input, { marginBottom: 16 }]}
                textStyle={globalStyle.inputText}
              />
              <Text category="h10" status="placeholder" mb={6}>
                {t('more:whats_next_role_label', { defaultValue: 'Role' })}
              </Text>
              <Input
                placeholder={t('more:whats_next_role_placeholder', { defaultValue: 'e.g. Senior Product Manager' })}
                value={role}
                onChangeText={setRole}
                style={[styles.input, { marginBottom: 16 }]}
                textStyle={globalStyle.inputText}
              />
              <Text category="h10" status="placeholder" mb={6}>
                {t('more:whats_next_current_offer_label', { defaultValue: 'Your current offer (optional)' })}
              </Text>
              <Input
                multiline
                placeholder={t('more:whats_next_current_offer_placeholder', { defaultValue: 'e.g. $115k base + $10k signing bonus' })}
                value={currentOffer}
                onChangeText={setCurrentOffer}
                style={[styles.input, styles.multilineInput, { marginBottom: 16 }]}
                textStyle={globalStyle.inputText}
              />
              <Text category="h10" status="placeholder" mb={6}>
                {t('more:whats_next_target_ask_label', { defaultValue: "What you'd like to negotiate for (optional)" })}
              </Text>
              <Input
                multiline
                placeholder={t('more:whats_next_target_ask_placeholder', { defaultValue: 'e.g. $130k base, or more PTO' })}
                value={targetAsk}
                onChangeText={setTargetAsk}
                style={[styles.input, styles.multilineInput, { marginBottom: 16 }]}
                textStyle={globalStyle.inputText}
              />
              <Text category="h10" status="placeholder" mb={6}>
                {t('more:whats_next_start_date_label', { defaultValue: 'Start date (optional)' })}
              </Text>
              <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[styles.input, styles.dateInput, styles.multilineInput,]}>
                <Text category="h9" status={startDate ? 'basic' : 'placeholder'}>
                  {startDate
                    ? startDate.toLocaleDateString(i18n.language)
                    : t('more:whats_next_start_date_placeholder', { defaultValue: 'Select a date' })}
                </Text>
                <Icon pack="eva" name="calendar-outline" style={[globalStyle.icon20, { tintColor: theme['text-hint-color'] }]} />
              </TouchableOpacity>
              {/* BUG FIX (product report: "the date selector is not looking
                  good") — this used to render the native DateTimePicker
                  inline with `display="default"`, which on iOS resolves to
                  a small floating "compact" chip that sat awkwardly beneath
                  the trigger row, and closed itself (setShowDatePicker(false)
                  in onChange) on the very first tap — before the compact
                  chip's own popover calendar even had a chance to open, so
                  it was nearly impossible to actually pick a date. `spinner`
                  is a real inline wheel that reads as an intentional part of
                  this card, and only closes when the user taps Done.
                  Android's `default` was never the problem (it's a proper
                  native dialog that dismisses correctly on its own), so it's
                  left exactly as it was. */}
              {showDatePicker && Platform.OS === 'ios' ? (
                <View style={styles.iosDatePickerWrap}>
                  <DateTimePicker
                    value={startDate ?? new Date()}
                    mode="date"
                    display="spinner"
                    minimumDate={new Date()}
                    onChange={(_, selected) => {
                      if (selected) setStartDate(selected);
                    }}
                  />
                  <Button size="small" style={{ alignSelf: 'center', marginTop: 4 }} onPress={() => setShowDatePicker(false)}>
                    {t('common:done', { defaultValue: 'Done' })}
                  </Button>
                </View>
              ) : null}
              {showDatePicker && Platform.OS !== 'ios' ? (
                <DateTimePicker
                  value={startDate ?? new Date()}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={(_, selected) => {
                    setShowDatePicker(false);
                    if (selected) setStartDate(selected);
                  }}
                />
              ) : null}

              <CtaButton
                style={[globalStyle.shadowBtn, { marginTop: 24 }]}
                disabled={!company.trim() || !role.trim() || isGenerating}
                onPress={onGenerate}
              >
                {isGenerating
                  ? () => <Spinner size="small" status="control" />
                  : t('more:whats_next_build_cta', { defaultValue: 'Build my plan' })}
              </CtaButton>
              <Button appearance="outline" style={{ marginTop: 12, marginBottom: 8 }} onPress={() => setShowFormSheet(false)}>
                {t('common:cancel', { defaultValue: 'Cancel' })}
              </Button>
            </Content>
          </Layout>
        </KeyboardAvoidingView>
      </Modal>

      <PeriodicCheckInSheet
        visible={pendingCheckIn !== null}
        title={t('more:whats_next_checkin_title', { defaultValue: "How's the new role going?" })}
        subtitle={t('more:whats_next_checkin_subtitle', {
          week: pendingCheckIn?.weekNumber ?? '',
          company: plan?.company ?? '',
          defaultValue: "Week {{week}} at {{company}} — tell us how it's going.",
        })}
        placeholder={t('more:whats_next_checkin_placeholder', {
          defaultValue: 'e.g. Settling in well, still learning the codebase, my manager has been great...',
        })}
        onSubmit={onSubmitCheckIn}
        onDismiss={onDismissCheckIn}
      />
    </Container>
  );
});

export default WhatsNext;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  // Centers the pre-plan illustration/description/CTA as one block instead
  // of pinning them to the top — same `justify`/`itemsCenter` reasoning as
  // components/ProLockGate.tsx's own `body` Flex (see that file's comment):
  // Flex.tsx defaults `justify` to 'space-between' when omitted.
  introBody: {
    flex: 1,
    paddingTop: 24,
  },
  input: { ...globalStyle.inputField },
  multilineInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Wraps the iOS spinner + Done button (see the BUG FIX comment at the
  // call site) so it reads as one contained control instead of a bare
  // wheel floating in the sheet.
  iosDatePickerWrap: {
    marginTop: 4,
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '88%',
    flexShrink: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pointCard: {
    ...globalStyle.card,
    padding: 16,
    marginBottom: 10,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  completeBanner: {
    marginBottom: 20,
    borderRadius: 8,
    backgroundColor: 'color-success-transparent-200',
  },
  completeBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  timeline: {
    marginTop: 4,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  timelineIndicatorCol: {
    width: 32,
    alignItems: 'center',
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    marginLeft: 14,
  },
});
