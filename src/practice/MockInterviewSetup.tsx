import React, { memo } from 'react';
import { Alert, View, TouchableOpacity } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
  Button,
  Input,
} from '@ui-kitten/components';
import { NavigationProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList, MockInterviewSetupScreenNavigationProp } from 'navigation/types';
import { DATA_PRACTICE_MODES, DATA_INTERVIEW_TYPES, DATA_DIFFICULTY, DATA_COMPANIES, COMPANY_ANY } from 'constants/Data';
import { Difficulty_Enum, Interview_Type_Enum, Practice_Mode_Enum } from 'constants/Types';
import * as interviewService from 'services/interviewService';

const DURATION_OPTIONS_MIN = [15, 30, 45, 60];

// Setup wizard for a mock interview: pick mode, interview type, target role,
// difficulty, company, and session length. "Start" kicks off a real session
// via interviewService.startSession (POST /api/v1/interviews/sessions — see
// services/interviewService.ts) and routes to the live voice/video session
// for Voice/Text/Video modes, or straight to the coding editor for a Coding
// interview — the sessionId is threaded through so InterviewFeedback can
// pull the real scored report.
//
// "Target Role" and the duration pills are new here: the real backend
// contract requires `role` and `duration_min` on session creation, neither
// of which the old mock's on/off "Timed Interview" toggle collected.
const MockInterviewSetup = memo(() => {
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<MockInterviewSetupScreenNavigationProp>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['find', 'common']);

  const [mode, setMode] = React.useState<Practice_Mode_Enum>(Practice_Mode_Enum.Voice);
  const [interviewType, setInterviewType] = React.useState<Interview_Type_Enum>(
    route.params?.interviewType ?? Interview_Type_Enum.Behavioral,
  );
  const [role, setRole] = React.useState('');
  const [difficulty, setDifficulty] = React.useState<Difficulty_Enum>(
    Difficulty_Enum.Intermediate,
  );
  const [durationMin, setDurationMin] = React.useState(30);
  const [isStarting, setIsStarting] = React.useState(false);
  // undefined/COMPANY_ANY both mean "no specific company" — kept as
  // undefined when threading through to the session config/navigation so
  // downstream screens only see a real company name or nothing.
  const [company, setCompany] = React.useState<string | undefined>(undefined);
  const [companySearch, setCompanySearch] = React.useState('');

  const filteredCompanies = React.useMemo(() => {
    const query = companySearch.trim().toLowerCase();
    const list = query
      ? DATA_COMPANIES.filter(name => name.toLowerCase().includes(query))
      : DATA_COMPANIES;
    return [...list, COMPANY_ANY];
  }, [companySearch]);

  const onStart = async () => {
    if (isStarting) return;
    if (!role.trim()) {
      Alert.alert(
        t('find:target_role_required', { defaultValue: 'Target role required' }),
        t('find:target_role_required_description', {
          defaultValue: 'Let us know what role you’re practicing for so questions can be tailored to it.',
        }),
      );
      return;
    }
    setIsStarting(true);
    try {
      const { sessionId } = await interviewService.startSession({
        interviewType,
        mode,
        difficulty,
        role,
        company,
        durationMin,
      });
      if (interviewType === Interview_Type_Enum.Coding) {
        navigate('CodingInterview', { sessionId, interviewType });
      } else {
        navigate('LiveInterviewSession', { sessionId, interviewType, mode, company });
      }
    } catch (e: any) {
      Alert.alert(
        t('find:start_interview_failed', { defaultValue: 'Could not start interview' }),
        e?.message ?? 'Something went wrong. Please try again.',
      );
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('find:mock_interview_setup')}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder contentContainerStyle={styles.content}>
        <Text category="h8" bold status="placeholder" mb={16}>
          {t('find:choose_mode')}
        </Text>
        <Flex justify="flex-start" wrap mb={32}>
          {DATA_PRACTICE_MODES.map((item, i) => {
            const active = item.mode === mode;
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.7}
                onPress={() => setMode(item.mode)}
                style={[
                  styles.modeCard,
                  { borderColor: active ? theme['color-primary-500'] : theme['background-basic-color-3'] },
                ]}>
                <Icon
                  pack="assets"
                  name={item.icon}
                  style={[globalStyle.icon24, { tintColor: active ? theme['color-primary-500'] : theme['text-placeholder-color'] }]}
                />
                <Text category="h8" bold mt={8} status={active ? 'link' : 'basic'}>
                  {item.mode}
                </Text>
                <Text category="h9-s" status="placeholder" mt={4} center>
                  {item.description}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Flex>

        <Text category="h8" bold status="placeholder" mb={16}>
          {t('find:interview_type')}
        </Text>
        <View style={styles.chipsWrap}>
          {DATA_INTERVIEW_TYPES.map((item, i) => {
            const active = item.type === interviewType;
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.7}
                onPress={() => setInterviewType(item.type)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme['color-primary-500'] : theme['background-basic-color-2'],
                  },
                ]}>
                <Text category="h9" bold status={active ? 'control' : 'basic'}>
                  {item.type}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text category="h8" bold status="placeholder" mt={32} mb={4}>
          {t('find:target_role', { defaultValue: 'Target Role' })}
        </Text>
        <Text category="h9-s" status="placeholder" mb={16}>
          {t('find:target_role_description', {
            defaultValue: 'What role are you interviewing for? Used to tailor your questions.',
          })}
        </Text>
        <Input
          placeholder={t('find:target_role_placeholder', { defaultValue: 'e.g. Software Engineer' })}
          value={role}
          onChangeText={setRole}
          style={styles.companySearchInput}
        />

        <Text category="h8" bold status="placeholder" mt={16} mb={16}>
          {t('find:difficulty')}
        </Text>
        <Flex justify="flex-start" mb={32}>
          {DATA_DIFFICULTY.map((item, i) => {
            const active = item === difficulty;
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.7}
                onPress={() => setDifficulty(item)}
                style={[
                  styles.difficultyPill,
                  {
                    backgroundColor: active ? theme['color-primary-500'] : 'transparent',
                    borderColor: active ? theme['color-primary-500'] : theme['background-basic-color-3'],
                  },
                ]}>
                <Text category="h9" bold status={active ? 'control' : 'basic'}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Flex>

        <Text category="h8" bold status="placeholder" mt={32} mb={4}>
          {t('find:company', { defaultValue: 'Company (optional)' })}
        </Text>
        <Text category="h9-s" status="placeholder" mb={16}>
          {t('find:company_description', {
            defaultValue: 'Get a company-flavored intro on your questions.',
          })}
        </Text>
        <Input
          placeholder={t('find:search_company', { defaultValue: 'Search companies…' })}
          value={companySearch}
          onChangeText={setCompanySearch}
          style={styles.companySearchInput}
          accessoryLeft={props => <Icon {...props} pack="assets" name="search" />}
        />
        <View style={styles.chipsWrap}>
          {filteredCompanies.map((name, i) => {
            const active = name === COMPANY_ANY ? company === undefined : company === name;
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.7}
                onPress={() => setCompany(name === COMPANY_ANY ? undefined : name)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme['color-primary-500'] : theme['background-basic-color-2'],
                  },
                ]}>
                <Text category="h9" bold status={active ? 'control' : 'basic'}>
                  {name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text category="h8" bold status="placeholder" mt={32} mb={4}>
          {t('find:session_length', { defaultValue: 'Session Length' })}
        </Text>
        <Text category="h9-s" status="placeholder" mb={16}>
          {t('find:session_length_description', {
            defaultValue: 'How long should this interview run?',
          })}
        </Text>
        <Flex justify="flex-start" mb={40}>
          {DURATION_OPTIONS_MIN.map(min => {
            const active = min === durationMin;
            return (
              <TouchableOpacity
                key={min}
                activeOpacity={0.7}
                onPress={() => setDurationMin(min)}
                style={[
                  styles.difficultyPill,
                  {
                    backgroundColor: active ? theme['color-primary-500'] : 'transparent',
                    borderColor: active ? theme['color-primary-500'] : theme['background-basic-color-3'],
                  },
                ]}>
                <Text category="h9" bold status={active ? 'control' : 'basic'}>
                  {min} min
                </Text>
              </TouchableOpacity>
            );
          })}
        </Flex>

        <Button
          children={isStarting ? 'Starting…' : t('find:start_interview')}
          onPress={onStart}
          disabled={isStarting}
          style={globalStyle.shadowBtn}
        />
      </Content>
    </Container>
  );
});

export default MockInterviewSetup;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  modeCard: {
    width: '31%',
    borderWidth: 2,
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginRight: '2%',
    marginBottom: 12,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  companySearchInput: {
    marginBottom: 12,
    borderRadius: 12,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 99,
    marginRight: 8,
    marginBottom: 8,
  },
  difficultyPill: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 99,
    borderWidth: 1,
    marginRight: 12,
  },
});
