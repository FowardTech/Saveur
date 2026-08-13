import React, { memo } from 'react';
import { Alert, TouchableOpacity, View } from 'react-native';
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
  Datepicker,
  Text as EvaText,
} from '@ui-kitten/components';
import { NavigationProp, RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import dayjs from 'dayjs';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import * as studentVerificationService from 'services/studentVerificationService';
import { University, StudentProfile, YEAR_OPTIONS } from 'services/studentVerificationService';
import * as configService from 'services/configService';
import CtaButton from 'components/CtaButton';

// The perks shown below are all real, already-shipped behavior — not
// aspirational copy. "3% off" alone undersold what verifying actually
// unlocks and made the screen (and the "Student Verification" name itself)
// feel thinner than it is, hence the rename to "Student Package and
// Verification" plus this list surfacing the other two pieces that were
// otherwise invisible anywhere in the UI:
//  - The discount (StudentProfile.studentDiscountActive, billing.py).
//  - Student-tailored AI framing across Coach, Career OS, Resume/Cover
//    Letter, Company Intel, and Salary Coach — see
//    student_service.get_active_student_profile, wired into each of those
//    endpoints so responses assume coursework/internships instead of
//    professional work history until graduation.
//  - The verified-student badge on the Profile screen (ProfileSrc.tsx).
//
// The discount percentage itself is admin-configurable (Admin > Config >
// Student Eligibility) — see configService.ts's StudentEligibilityConfig
// and saveur-backend's app_config_service.py's "student_eligibility"
// section. Every "3%" below used to be a hardcoded literal in this file
// (and in stripe_service.py's coupon creation); now all four read the same
// live value via i18n interpolation, so an admin can change it without a
// mobile release.
function studentPerks(t: TFunction, discountPercent: number): {icon: string; title: string; body: string}[] {
  return [
    {
      icon: 'percent-outline',
      title: t('more:student_perk_discount_title', {defaultValue: '{{percent}}% off Saveur Pro', percent: discountPercent}),
      body: t('more:student_perk_discount_body', {defaultValue: 'Discounted pricing for as long as you’re a final-year student — until your graduation date.'}),
    },
    {
      icon: 'bulb-outline',
      title: t('more:student_perk_ai_title', {defaultValue: 'AI tailored to student life'}),
      body: t('more:student_perk_ai_body', {defaultValue: 'Your AI Coach, resumes, cover letters, interview prep, and salary guidance all shift to focus on coursework, internships, and landing your first role.'}),
    },
    {
      icon: 'award-outline',
      title: t('more:student_perk_badge_title', {defaultValue: 'A verified student badge'}),
      body: t('more:student_perk_badge_body', {defaultValue: 'Shows on your profile until you graduate.'}),
    },
  ];
}

function yearLabel(value: string, t: TFunction): string {
  const map: Record<string, string> = {
    '1st_year': t('more:year_1', { defaultValue: '1st Year' }),
    '2nd_year': t('more:year_2', { defaultValue: '2nd Year' }),
    '3rd_year': t('more:year_3', { defaultValue: '3rd Year' }),
    final_year: t('more:year_final', { defaultValue: 'Final Year' }),
  };
  return map[value] ?? value;
}

// Student verification + discounted billing — product request item. Real,
// worldwide university search (see services/studentVerificationService.ts),
// school-email one-time-code verification, and server-enforced
// final-year-only eligibility. Reachable both from the More menu (any time,
// for new and existing users) and, with `fromSignup: true`, as an optional
// step right after account creation in SignupThirdStep.tsx — it has to be
// *after* signup rather than during it because every verify endpoint
// requires an authenticated user (@require_auth), and no Firebase account
// exists yet in the earlier signup steps.
const StudentVerification = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common', 'success']);
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'StudentVerification'>>();
  const fromSignup = !!route.params?.fromSignup;
  const discountPercent = configService.getCachedConfig().student_eligibility.discount_percent;

  // "Student Package and Verification" is long enough that it was
  // overlapping the Skip button (fromSignup variant, see accessoryRight
  // below). The real cause: eva's TopNavigation defaults `alignment` to
  // "center" (see constants/theme/mapping.json's TopNavigation
  // variantGroups), which renders the title in a container that's
  // POSITION-ABSOLUTE and spans the entire header bar edge-to-edge,
  // centered — not just the leftover space between the back button and
  // Skip. A long centered title then visually sits on top of/behind both
  // side accessories, and numberOfLines alone doesn't fix that, because
  // that absolute-fill container never constrains the Text's width in the
  // first place (there's nothing to truncate against). `alignment="start"`
  // switches to eva's other layout, where the title renders in a normal
  // flex:1 box actually sandwiched between the left/right accessories, so
  // it can no longer overlap them — see src/more/WebViewScreen.tsx for the
  // same fix applied earlier for the same underlying bug. numberOfLines +
  // ellipsizeMode + flexShrink still matter on top of that, so the title
  // truncates with "…" instead of overflowing past its now-bounded box
  // when there isn't enough room (e.g. next to Skip).
  const renderTitle = React.useCallback(
    (props: any) => (
      <EvaText
        {...props}
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[props?.style, { flexShrink: 1 }]}
      >
        {t('more:student_verification', { defaultValue: 'Student Package and Verification' })}
      </EvaText>
    ),
    [t],
  );

  // Mirrors SignupThirdStep.tsx's goToSuccess — when this screen is reached
  // as part of signup, finishing (or skipping) it should continue on into
  // the same celebratory success screen signup would otherwise have gone to
  // directly, not strand the user here.
  const goToSuccess = React.useCallback(() => {
    navigate('SuccessScr', {
      successScr: {
        title: t('success:title_2'),
        logo: true,
        description: t('success:description_2'),
        children: [
          {
            title: t('success:see_your_dashboard'),
            onPress: () => navigate('MainBottomTab'),
            status: 'outline',
          },
          {
            title: t('success:start_practicing', { defaultValue: 'Start Practicing' }),
            onPress: () => navigate('MockInterviewSetup', {}),
            status: 'basic',
          },
        ],
        buttonsViewStyle: { marginHorizontal: 68 },
      },
    });
  }, [navigate, t]);

  const [status, setStatus] = React.useState<StudentProfile | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = React.useState(true);

  const [universityQuery, setUniversityQuery] = React.useState('');
  const [universityResults, setUniversityResults] = React.useState<University[]>([]);
  const [selectedUniversity, setSelectedUniversity] = React.useState<University | null>(null);
  const [isSearching, setIsSearching] = React.useState(false);

  const [schoolEmail, setSchoolEmail] = React.useState('');
  const [yearOfStudy, setYearOfStudy] = React.useState<string | null>(null);
  const [graduationDate, setGraduationDate] = React.useState<Date>(
    new Date(new Date().setMonth(new Date().getMonth() + 6)),
  );

  const [step, setStep] = React.useState<'form' | 'code'>('form');
  const [code, setCode] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    studentVerificationService.getStatus().then(setStatus).finally(() => setIsLoadingStatus(false));
  }, []);

  React.useEffect(() => {
    if (!universityQuery.trim() || universityQuery.trim().length < 3) {
      setUniversityResults([]);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    const handle = setTimeout(() => {
      studentVerificationService.searchUniversities(universityQuery.trim()).then(results => {
        if (!cancelled) setUniversityResults(results);
      }).finally(() => { if (!cancelled) setIsSearching(false); });
    }, 400);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [universityQuery]);

  const selectedYearOption = YEAR_OPTIONS.find(o => o.value === yearOfStudy);
  // Live, client-side-only hint (see studentVerificationService.ts's
  // schoolEmailWarning) — the actual enforcement happens server-side in
  // start_verification, this just surfaces the same reasoning before the
  // round trip so the user isn't surprised by the rejection.
  const emailWarning = studentVerificationService.schoolEmailWarning(schoolEmail, selectedUniversity);
  const canSendCode =
    !!selectedUniversity && !!schoolEmail.trim() && emailWarning?.severity !== 'block'
    && !!selectedYearOption?.isEligible && !isSubmitting;

  const onSendCode = async () => {
    if (!canSendCode || !selectedUniversity) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await studentVerificationService.sendVerificationCode({
        universityName: selectedUniversity.name,
        universityCountry: selectedUniversity.countryCode,
        schoolEmail: schoolEmail.trim(),
        yearOfStudy: 'final_year',
        graduationDate: dayjs(graduationDate).format('YYYY-MM-DD'),
        universityDomains: selectedUniversity.domains,
      });
      setStep('code');
    } catch (e: any) {
      setError(e?.response?.data?.detail || t('more:student_verify_failed', { defaultValue: "Couldn't send a verification code. Please try again." }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onConfirmCode = async () => {
    if (!code.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const profile = await studentVerificationService.confirmVerificationCode(code.trim());
      setStatus(profile);
      Alert.alert(
        t('more:student_verified_title', { defaultValue: 'Verified! 🎓' }),
        t('more:student_verified_body', { defaultValue: 'Your student discount is now active.' }),
        fromSignup ? [{ text: t('more:continue', { defaultValue: 'Continue' }), onPress: goToSuccess }] : undefined,
      );
    } catch (e: any) {
      setError(e?.response?.data?.detail || t('more:student_code_invalid', { defaultValue: "That code doesn't match. Please try again." }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingStatus) {
    return (
      <Container style={styles.container}>
        <TopNavigation alignment="start" title={renderTitle} accessoryLeft={<NavigationAction />} />
        <Flex center style={globalStyle.flexOne}><Spinner size="large" /></Flex>
      </Container>
    );
  }

  if (status?.studentDiscountActive) {
    return (
      <Container style={styles.container}>
        <TopNavigation alignment="start" title={renderTitle} accessoryLeft={<NavigationAction />} />
        <Content padder contentContainerStyle={styles.content}>
          <Layout level="2" style={styles.card}>
            <Icon pack="eva" name="checkmark-circle-2-outline" style={[globalStyle.icon24, { tintColor: theme['color-success-500'] }]} />
            <Text category="h7" bold mt={12} mb={6}>
              {t('more:student_discount_active_title', { defaultValue: 'Student discount active' })}
            </Text>
            <Text category="h9-s" status="placeholder">
              {t('more:student_discount_active_body', {
                defaultValue: '{{university}} · {{percent}}% off until {{date}}',
                university: status.universityName,
                percent: discountPercent,
                date: status.graduationDate ? dayjs(status.graduationDate).format('MMM D, YYYY') : '',
              })}
            </Text>
          </Layout>
          {fromSignup ? (
            <CtaButton style={[globalStyle.shadowBtn, { marginTop: 24 }]} onPress={goToSuccess}>
              {t('more:continue', { defaultValue: 'Continue' })}
            </CtaButton>
          ) : null}
        </Content>
      </Container>
    );
  }

  if (status?.graduated) {
    return (
      <Container style={styles.container}>
        <TopNavigation alignment="start" title={renderTitle} accessoryLeft={<NavigationAction />} />
        <Content padder contentContainerStyle={styles.content}>
          <Layout level="2" style={styles.card}>
            <Text category="h7" bold mb={6}>{t('more:student_graduated_title', { defaultValue: 'Congratulations on graduating!' })}</Text>
            <Text category="h9-s" status="placeholder">
              {t('more:student_graduated_body', { defaultValue: 'Your student discount period has ended.' })}
            </Text>
          </Layout>
        </Content>
      </Container>
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        alignment="start"
        title={renderTitle}
        accessoryLeft={<NavigationAction />}
        accessoryRight={fromSignup ? () => (
          <Button appearance="ghost" status="basic" size="small" onPress={goToSuccess}>
            {t('common:skip', { defaultValue: 'Skip' })}
          </Button>
        ) : undefined}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        {step === 'form' ? (
          <>
            <Text category="h9-s" status="placeholder" mb={20}>
              {fromSignup
                ? t('more:student_verification_signup_description', {
                    defaultValue: "Are you a final-year student? Get {{percent}}% off Saveur Pro until graduation — verify your school email to unlock it. You can always do this later from Settings.",
                    percent: discountPercent,
                  })
                : t('more:student_verification_description', {
                    defaultValue: 'Final-year students get {{percent}}% off Saveur Pro until graduation. Verify your school email to unlock it.',
                    percent: discountPercent,
                  })}
            </Text>

            <Layout level="2" style={styles.perksCard}>
              {studentPerks(t, discountPercent).map((perk, i) => (
                <Flex key={i} mb={i < 2 ? 14 : 0}>
                  <Icon
                    pack="eva" name={perk.icon}
                    style={[globalStyle.icon20, { tintColor: theme['text-basic-color'], marginTop: 2 }]}
                  />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text category="h9" bold>{perk.title}</Text>
                    <Text category="h10" status="placeholder" mt={2}>{perk.body}</Text>
                  </View>
                </Flex>
              ))}
            </Layout>

            <Text category="h10" status="placeholder" mb={6}>{t('more:university_label', { defaultValue: 'University' })}</Text>
            <Input
              placeholder={t('more:university_search_placeholder', { defaultValue: 'Search for your university…' })}
              value={selectedUniversity ? selectedUniversity.name : universityQuery}
              onChangeText={text => { setUniversityQuery(text); setSelectedUniversity(null); }}
              style={styles.input}
              textStyle={globalStyle.inputText}
            />
            {isSearching ? <Spinner size="tiny" style={{ marginTop: 8 }} /> : null}
            {!selectedUniversity && universityResults.length > 0 ? (
              <View style={styles.resultsList}>
                {universityResults.map((u, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.resultRow, globalStyle.divider]}
                    onPress={() => { setSelectedUniversity(u); setUniversityQuery(u.name); setUniversityResults([]); }}
                  >
                    <Text category="h9">{u.name}</Text>
                    <Text category="h10" status="placeholder">{u.country}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <Text category="h10" status="placeholder" mt={20} mb={6}>{t('more:school_email_label', { defaultValue: 'School email' })}</Text>
            <Input
              placeholder={t('more:school_email_placeholder', { defaultValue: 'you@university.edu' })}
              value={schoolEmail}
              onChangeText={setSchoolEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              status={emailWarning ? (emailWarning.severity === 'block' ? 'danger' : 'warning') : 'basic'}
              style={styles.input}
              textStyle={globalStyle.inputText}
            />
            {emailWarning ? (
              <Text category="h10" status={emailWarning.severity === 'block' ? 'danger' : 'warning'} mt={6}>
                {emailWarning.message}
              </Text>
            ) : (
              <Text category="h10" status="placeholder" mt={6}>
                {t('more:school_email_hint', { defaultValue: "Must be your official school-issued email — personal providers like Gmail don't qualify." })}
              </Text>
            )}

            <Text category="h10" status="placeholder" mt={20} mb={6}>{t('more:year_of_study_label', { defaultValue: 'Year of study' })}</Text>
            <View style={styles.yearRow}>
              {YEAR_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  activeOpacity={0.7}
                  onPress={() => setYearOfStudy(opt.value)}
                  style={[
                    styles.yearChip,
                    { borderColor: yearOfStudy === opt.value ? theme['color-primary-500'] : theme['color-basic-400'] },
                    yearOfStudy === opt.value ? { backgroundColor: theme['color-primary-transparent-200'] } : null,
                  ]}
                >
                  {/* BUG FIX (app-wide sweep, product report: "so many
                      buttons... the text are in white in light mode") —
                      same status="primary"-on-a-light-tint-fill bug as
                      Leaderboard.tsx/EmotionalCoach.tsx: this chip's
                      selected background is a light, transparent primary
                      tint, not a solid fill. status="link" reads as this
                      app's blue in both themes instead of going near-
                      invisible white. */}
                  <Text category="h10" status={yearOfStudy === opt.value ? 'link' : 'basic'} center>
                    {yearLabel(opt.value, t)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {yearOfStudy && !selectedYearOption?.isEligible ? (
              <Text category="h10" status="warning" mt={8}>
                {t('more:student_final_year_only', { defaultValue: 'Student pricing is only available to final-year students.' })}
              </Text>
            ) : null}

            <Text category="h10" status="placeholder" mt={20} mb={6}>{t('more:graduation_date_label', { defaultValue: 'Expected graduation date' })}</Text>
            <Datepicker
              date={graduationDate}
              min={new Date()}
              max={new Date(new Date().setFullYear(new Date().getFullYear() + 2))}
              onSelect={setGraduationDate}
              /* @ts-ignore */
              placeholder={null}
              style={styles.input}
              accessoryLeft={props => (
                <Flex>
                  <Icon pack="assets" name="calendar" {...props} />
                  <Text center category="h9" ml={12}>{dayjs(graduationDate).format('MMM D, YYYY')}</Text>
                </Flex>
              )}
            />

            {error ? <Text category="h9-s" status="danger" mt={16} center>{error}</Text> : null}

            <CtaButton
              style={[globalStyle.shadowBtn, { marginTop: 24 }]}
              disabled={!canSendCode}
              onPress={onSendCode}
            >
              {isSubmitting ? () => <Spinner size="small" status="control" /> : t('more:send_code', { defaultValue: 'Send Verification Code' })}
            </CtaButton>
            {fromSignup ? (
              <Button appearance="ghost" status="basic" style={{ marginTop: 12 }} onPress={goToSuccess}>
                {t('more:student_skip_for_now', { defaultValue: "I'm not a student — skip for now" })}
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <Text category="h9-s" status="placeholder" mb={20}>
              {t('more:enter_code_description', {
                defaultValue: 'We sent a 6-digit code to {{email}}.',
                email: schoolEmail,
              })}
            </Text>
            <Input
              placeholder={t('more:code_placeholder', { defaultValue: '6-digit code' })}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              style={styles.input}
              textStyle={globalStyle.inputText}
            />
            {error ? <Text category="h9-s" status="danger" mt={16} center>{error}</Text> : null}
            <CtaButton
              style={[globalStyle.shadowBtn, { marginTop: 24 }]}
              disabled={!code.trim() || isSubmitting}
              onPress={onConfirmCode}
            >
              {isSubmitting ? () => <Spinner size="small" status="control" /> : t('more:verify_code', { defaultValue: 'Verify' })}
            </CtaButton>
            <Button appearance="outline" style={{ marginTop: 12 }} onPress={() => setStep('form')}>
              {t('common:back', { defaultValue: 'Back' })}
            </Button>
            {fromSignup ? (
              <Button appearance="ghost" status="basic" style={{ marginTop: 12 }} onPress={goToSuccess}>
                {t('more:student_skip_for_now', { defaultValue: "I'm not a student — skip for now" })}
              </Button>
            ) : null}
          </>
        )}
      </Content>
    </Container>
  );
});

export default StudentVerification;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  input: { ...globalStyle.inputField },
  // Redesign v2 (full reskin): `card` carries a real shadow again, which
  // needs an opaque fill on Android — dropped the 'transparent' overrides
  // below so each Layout's own `level="2"` background shows through
  // instead.
  card: {
    ...globalStyle.card,
    padding: 20,
  },
  perksCard: {
    ...globalStyle.card,
    padding: 16,
    marginBottom: 20,
  },
  resultsList: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  // borderBottom comes from the shared globalStyle.divider at the usage
  // site instead of a duplicated inline rgba value.
  resultRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  yearRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  yearChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
  },
});
