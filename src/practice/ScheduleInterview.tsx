import React, { memo } from 'react';
import { Alert, Platform, TouchableOpacity, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
  Button,
  Input,
} from '@ui-kitten/components';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import { DATA_PRACTICE_MODES, DATA_INTERVIEW_TYPES, DATA_DIFFICULTY, DATA_COMPANIES, COMPANY_ANY } from 'constants/Data';
import { Difficulty_Enum, Interview_Type_Enum, Practice_Mode_Enum } from 'constants/Types';
import * as scheduledInterviewService from 'services/scheduledInterviewService';
import { getInterviewTypeLabel, getPracticeModeLabel, getDifficultyLabel } from 'utils/interviewTypeLabels';
import { AuthContext } from '../../AuthContext';
import CtaButton from 'components/CtaButton';

const DURATION_OPTIONS_MIN = [15, 30, 45, 60];

// Sets a real future reminder for the Home dashboard's "Upcoming Session"
// card (see services/scheduledInterviewService.ts) — that card used to be a
// single hardcoded entry from constants/Data.ts that never changed and
// couldn't be created/canceled. This screen is intentionally a near-twin of
// MockInterviewSetup.tsx (same mode/type/role/difficulty/company/duration
// choices) plus a date+time picker, since tapping the resulting reminder
// hands every one of those fields straight to MockInterviewSetup as initial
// route params — the user lands there pre-filled and just taps Start.
const ScheduleInterview = memo(() => {
  const { goBack, navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['find', 'common']);
  const { isPremium } = React.useContext(AuthContext);

  const [mode, setMode] = React.useState<Practice_Mode_Enum>(Practice_Mode_Enum.Voice);
  const [interviewType, setInterviewType] = React.useState<Interview_Type_Enum>(Interview_Type_Enum.Behavioral);
  const [role, setRole] = React.useState('');
  const [difficulty, setDifficulty] = React.useState<Difficulty_Enum>(Difficulty_Enum.Intermediate);
  const [durationMin, setDurationMin] = React.useState(30);
  const [company, setCompany] = React.useState<string | undefined>(undefined);
  const [companySearch, setCompanySearch] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  // Defaults to an hour from now, rounded — a reasonable "later today"
  // starting point the user can adjust from.
  const [scheduledAt, setScheduledAt] = React.useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [showTimePicker, setShowTimePicker] = React.useState(false);

  const filteredCompanies = React.useMemo(() => {
    const query = companySearch.trim().toLowerCase();
    const list = query ? DATA_COMPANIES.filter(name => name.toLowerCase().includes(query)) : DATA_COMPANIES;
    return [...list, COMPANY_ANY];
  }, [companySearch]);

  const onChangeDate = (_event: unknown, selected?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (!selected) return;
    setScheduledAt(prev => {
      const next = new Date(prev);
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      return next;
    });
  };

  const onChangeTime = (_event: unknown, selected?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (!selected) return;
    setScheduledAt(prev => {
      const next = new Date(prev);
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      return next;
    });
  };

  // Video mode is a Pro Premium feature (see MockInterviewSetup.tsx's
  // onSelectMode and saveur-backend/app/api/interviews.py's create_session,
  // which is the actual enforcement point — this just avoids scheduling a
  // reminder for a mode the user will get bounced from later).
  const onSelectMode = (selected: Practice_Mode_Enum) => {
    if (selected === Practice_Mode_Enum.Video && !isPremium) {
      Alert.alert(
        t('find:video_premium_gate_title', { defaultValue: 'Video is a Pro Premium feature' }),
        t('find:video_premium_gate_body', {
          defaultValue: 'Practicing on camera with video analysis needs Saveur Pro Premium or Pro (Yearly).',
        }),
        [
          { text: t('common:cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
          {
            text: t('find:upgrade_to_pro', { defaultValue: 'Upgrade' }),
            onPress: () => navigate('Subscription'),
          },
        ],
      );
      return;
    }
    setMode(selected);
  };

  const onSchedule = async () => {
    if (isSaving) return;
    if (!role.trim()) {
      Alert.alert(
        t('find:target_role_required', { defaultValue: 'Target role required' }),
        t('find:target_role_required_description', {
          defaultValue: 'Let us know what role you’re practicing for so questions can be tailored to it.',
        }),
      );
      return;
    }
    if (scheduledAt.getTime() <= Date.now()) {
      Alert.alert(
        t('find:schedule_time_past_title', { defaultValue: 'Pick a future time' }),
        t('find:schedule_time_past_body', { defaultValue: 'The date and time you picked has already passed.' }),
      );
      return;
    }
    setIsSaving(true);
    try {
      await scheduledInterviewService.createScheduled({
        interviewType,
        mode,
        difficulty,
        role,
        company,
        durationMin,
        scheduledAt: scheduledAt.getTime(),
      });
      goBack();
    } catch (e: any) {
      Alert.alert(
        t('find:schedule_failed', { defaultValue: 'Could not schedule interview' }),
        e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('find:schedule_interview', { defaultValue: 'Schedule an Interview' })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        <Text category="h8" bold status="placeholder" mb={16}>
          {t('find:when', { defaultValue: 'When' })}
        </Text>
        <Flex justify="flex-start" mb={32}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowDatePicker(true)}
            style={[styles.dateTimePill, { borderColor: theme['background-basic-color-3'] }]}>
            <Icon pack="eva" name="calendar-outline" style={[globalStyle.icon16, { tintColor: theme['text-placeholder-color'] }]} />
            <Text category="h9" bold ml={8}>
              {scheduledAt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowTimePicker(true)}
            style={[styles.dateTimePill, { borderColor: theme['background-basic-color-3'], marginLeft: 12 }]}>
            <Icon pack="eva" name="clock-outline" style={[globalStyle.icon16, { tintColor: theme['text-placeholder-color'] }]} />
            <Text category="h9" bold ml={8}>
              {scheduledAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
        </Flex>
        {showDatePicker ? (
          <DateTimePicker value={scheduledAt} mode="date" display="default" minimumDate={new Date()} onChange={onChangeDate} />
        ) : null}
        {showTimePicker ? (
          <DateTimePicker value={scheduledAt} mode="time" display="default" onChange={onChangeTime} />
        ) : null}

        <Text category="h8" bold status="placeholder" mb={16}>
          {t('find:choose_mode')}
        </Text>
        <Flex justify="flex-start" wrap mb={32}>
          {DATA_PRACTICE_MODES.map((item, i) => {
            const active = item.mode === mode;
            const locked = item.mode === Practice_Mode_Enum.Video && !isPremium;
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.7}
                onPress={() => onSelectMode(item.mode)}
                style={[
                  styles.modeCard,
                  { borderColor: active ? theme['color-primary-500'] : theme['background-basic-color-3'] },
                ]}>
                {locked ? (
                  <View style={[styles.lockBadge, { backgroundColor: theme['background-basic-color-3'] }]}>
                    <Icon pack="eva" name="lock-outline" style={[globalStyle.icon16, { tintColor: theme['text-placeholder-color'] }]} />
                  </View>
                ) : null}
                <Icon
                  pack="assets"
                  name={item.icon}
                  style={[globalStyle.icon24, { tintColor: active ? theme['color-primary-500'] : theme['text-placeholder-color'] }]}
                />
                <Text category="h8" bold mt={8} status={active ? 'link' : 'basic'}>
                  {getPracticeModeLabel(item.mode, t)}
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
                  { backgroundColor: active ? theme['color-primary-500'] : theme['background-basic-color-2'] },
                ]}>
                <Text category="h9" bold status={active ? 'control' : 'basic'}>
                  {getInterviewTypeLabel(item.type, t)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text category="h8" bold status="placeholder" mt={32} mb={4}>
          {t('find:target_role', { defaultValue: 'Target Role' })}
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
                  {getDifficultyLabel(item, t)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Flex>

        <Text category="h8" bold status="placeholder" mt={16} mb={4}>
          {t('find:company', { defaultValue: 'Company (optional)' })}
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
                  { backgroundColor: active ? theme['color-primary-500'] : theme['background-basic-color-2'] },
                ]}>
                <Text category="h9" bold status={active ? 'control' : 'basic'}>
                  {name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text category="h8" bold status="placeholder" mt={32} mb={16}>
          {t('find:session_length', { defaultValue: 'Session Length' })}
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
                  {min} {t('find:minutes_unit', { defaultValue: 'min' })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Flex>

        <CtaButton
          children={isSaving ? t('find:scheduling', { defaultValue: 'Scheduling…' }) : t('find:schedule_interview', { defaultValue: 'Schedule Interview' })}
          onPress={onSchedule}
          disabled={isSaving}
          style={globalStyle.shadowBtn}
        />
      </Content>
    </Container>
  );
});

export default ScheduleInterview;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  dateTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 99,
    borderWidth: 1,
  },
  modeCard: {
    ...globalStyle.card,
    // Bug fix — same Android elevation-needs-an-opaque-background issue as
    // MockInterviewSetup.tsx's identical modeCard style (see that file's
    // comment for the full explanation).
    backgroundColor: 'background-basic-color-1',
    width: '31%',
    borderWidth: 2,
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginRight: '2%',
    marginBottom: 12,
    position: 'relative',
  },
  lockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  companySearchInput: {
    ...globalStyle.inputField,
    marginBottom: 12,
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
