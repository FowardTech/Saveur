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
  const canSendCode =
    !!selectedUniversity && !!schoolEmail.trim() && !!selectedYearOption?.isEligible && !isSubmitting;

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
        <TopNavigation title={t('more:student_verification', { defaultValue: 'Student Verification' })} accessoryLeft={<NavigationAction />} />
        <Flex center style={globalStyle.flexOne}><Spinner size="large" /></Flex>
      </Container>
    );
  }

  if (status?.studentDiscountActive) {
    return (
      <Container style={styles.container}>
        <TopNavigation title={t('more:student_verification', { defaultValue: 'Student Verification' })} accessoryLeft={<NavigationAction />} />
        <Content padder contentContainerStyle={styles.content}>
          <Layout level="2" style={styles.card}>
            <Icon pack="eva" name="checkmark-circle-2-outline" style={[globalStyle.icon24, { tintColor: theme['color-success-500'] }]} />
            <Text category="h7" bold mt={12} mb={6}>
              {t('more:student_discount_active_title', { defaultValue: 'Student discount active' })}
            </Text>
            <Text category="h9-s" status="placeholder">
              {t('more:student_discount_active_body', {
                defaultValue: '{{university}} · 3% off until {{date}}',
                university: status.universityName,
                date: status.graduationDate ? dayjs(status.graduationDate).format('MMM D, YYYY') : '',
              })}
            </Text>
          </Layout>
          {fromSignup ? (
            <Button style={[globalStyle.shadowBtn, { marginTop: 24 }]} onPress={goToSuccess}>
              {t('more:continue', { defaultValue: 'Continue' })}
            </Button>
          ) : null}
        </Content>
      </Container>
    );
  }

  if (status?.graduated) {
    return (
      <Container style={styles.container}>
        <TopNavigation title={t('more:student_verification', { defaultValue: 'Student Verification' })} accessoryLeft={<NavigationAction />} />
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
        title={t('more:student_verification', { defaultValue: 'Student Verification' })}
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
                    defaultValue: "Are you a final-year student? Get 3% off Saveur Pro until graduation — verify your school email to unlock it. You can always do this later from Settings.",
                  })
                : t('more:student_verification_description', {
                    defaultValue: 'Final-year students get 3% off Saveur Pro until graduation. Verify your school email to unlock it.',
                  })}
            </Text>

            <Text category="h10" status="placeholder" mb={6}>{t('more:university_label', { defaultValue: 'University' })}</Text>
            <Input
              placeholder={t('more:university_search_placeholder', { defaultValue: 'Search for your university…' })}
              value={selectedUniversity ? selectedUniversity.name : universityQuery}
              onChangeText={text => { setUniversityQuery(text); setSelectedUniversity(null); }}
              style={styles.input}
            />
            {isSearching ? <Spinner size="tiny" style={{ marginTop: 8 }} /> : null}
            {!selectedUniversity && universityResults.length > 0 ? (
              <View style={styles.resultsList}>
                {universityResults.map((u, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.resultRow}
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
              style={styles.input}
            />

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
                  <Text category="h10" status={yearOfStudy === opt.value ? 'primary' : 'basic'} center>
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

            <Button
              style={[globalStyle.shadowBtn, { marginTop: 24 }]}
              disabled={!canSendCode}
              onPress={onSendCode}
            >
              {isSubmitting ? () => <Spinner size="small" status="control" /> : t('more:send_code', { defaultValue: 'Send Verification Code' })}
            </Button>
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
            />
            {error ? <Text category="h9-s" status="danger" mt={16} center>{error}</Text> : null}
            <Button
              style={[globalStyle.shadowBtn, { marginTop: 24 }]}
              disabled={!code.trim() || isSubmitting}
              onPress={onConfirmCode}
            >
              {isSubmitting ? () => <Spinner size="small" status="control" /> : t('more:verify_code', { defaultValue: 'Verify' })}
            </Button>
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
  input: { borderRadius: 12 },
  card: {
    borderRadius: 16,
    padding: 20,
  },
  resultsList: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  resultRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.15)',
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
