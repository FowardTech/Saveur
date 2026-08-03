import React, { memo } from 'react';
import { TouchableOpacity, View } from 'react-native';
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
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import * as emotionalCoachService from 'services/emotionalCoachService';
import { Mood, MOODS, MoodCheckIn } from 'services/emotionalCoachService';
import { AuthContext } from '../../AuthContext';
import ProLockGate from 'components/ProLockGate';
import CtaButton from 'components/CtaButton';

const MOOD_EMOJI: Record<Mood, string> = {
  great: '😄', okay: '🙂', stressed: '😥', overwhelmed: '😩', discouraged: '😞',
};

function moodLabel(mood: Mood, t: TFunction): string {
  const map: Record<Mood, string> = {
    great: t('more:mood_great', { defaultValue: 'Great' }),
    okay: t('more:mood_okay', { defaultValue: 'Okay' }),
    stressed: t('more:mood_stressed', { defaultValue: 'Stressed' }),
    overwhelmed: t('more:mood_overwhelmed', { defaultValue: 'Overwhelmed' }),
    discouraged: t('more:mood_discouraged', { defaultValue: 'Discouraged' }),
  };
  return map[mood];
}

// AI Emotional Coach — product request item, Pro Premium feature. A
// lightweight mood check-in with a real, activity-aware AI response — see
// app/api/emotional_coach.py's module docstring for the deliberate
// support-not-therapy scope.
const EmotionalCoach = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common']);
  const { isPremium } = React.useContext(AuthContext);

  const [selectedMood, setSelectedMood] = React.useState<Mood | null>(null);
  const [note, setNote] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [latest, setLatest] = React.useState<MoodCheckIn | null>(null);
  const [history, setHistory] = React.useState<MoodCheckIn[]>([]);

  React.useEffect(() => {
    if (isPremium) emotionalCoachService.getHistory().then(setHistory);
  }, [isPremium]);

  const onSubmit = async () => {
    if (!selectedMood || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await emotionalCoachService.checkIn(selectedMood, note.trim());
      setLatest(result);
      setHistory(prev => [result, ...prev]);
      setNote('');
      setSelectedMood(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isPremium) {
    return (
      <ProLockGate
        variant="premium"
        title={t('more:emotional_coach', { defaultValue: 'Emotional Coach' })}
        description={t('more:emotional_coach_pro_gate_description', {
          defaultValue: 'Check in on how the job search is affecting you and get real, supportive AI coaching — a Pro Premium feature.',
        })}
      />
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:emotional_coach', { defaultValue: 'Emotional Coach' })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        <Text category="h9-s" status="placeholder" mb={20}>
          {t('more:emotional_coach_description', { defaultValue: 'How are you feeling about your job search today?' })}
        </Text>

        <View style={styles.moodRow}>
          {MOODS.map(mood => (
            <TouchableOpacity
              key={mood}
              activeOpacity={0.7}
              onPress={() => setSelectedMood(mood)}
              style={[
                styles.moodChip,
                { borderColor: selectedMood === mood ? theme['color-primary-500'] : theme['color-basic-400'] },
                selectedMood === mood ? { backgroundColor: theme['color-primary-transparent-200'] } : null,
              ]}
            >
              <Text category="h6" center>{MOOD_EMOJI[mood]}</Text>
              <Text category="h10" status={selectedMood === mood ? 'primary' : 'placeholder'} center mt={4}>
                {moodLabel(mood, t)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input
          placeholder={t('more:mood_note_placeholder', { defaultValue: "What's on your mind? (optional)" })}
          value={note}
          onChangeText={setNote}
          multiline
          textStyle={[globalStyle.inputText, { minHeight: 60 }]}
          style={[styles.input, { marginTop: 20 }]}
        />

        <CtaButton
          style={[globalStyle.shadowBtn, { marginTop: 20 }]}
          disabled={!selectedMood || isSubmitting}
          onPress={onSubmit}
        >
          {isSubmitting ? () => <Spinner size="small" status="control" /> : t('more:check_in_cta', { defaultValue: 'Check In' })}
        </CtaButton>

        {latest ? (
          <Layout level="2" style={[styles.card, { marginTop: 24 }]}>
            <Flex justify="flex-start" itemsCenter mb={10}>
              <Icon pack="eva" name="heart-outline" style={[globalStyle.icon20, { tintColor: theme['text-basic-color'] }]} />
              <Text category="h8" bold ml={8}>{t('more:coach_says', { defaultValue: 'Your coach says' })}</Text>
            </Flex>
            <Text category="h9-s" mb={latest.suggestedActions.length ? 12 : 0}>{latest.aiResponse}</Text>
            {latest.suggestedActions.map((action, i) => (
              <Flex key={i} justify="flex-start" itemsCenter mt={6}>
                <Icon pack="eva" name="checkmark-circle-2-outline" style={[globalStyle.icon16, { tintColor: theme['text-basic-color'] }]} />
                <Text category="h10" style={{ marginLeft: 8, flex: 1 }}>{action}</Text>
              </Flex>
            ))}
          </Layout>
        ) : null}

        {history.length > 1 ? (
          <View style={{ marginTop: 32 }}>
            <Text category="h7" bold mb={12}>{t('more:checkin_history', { defaultValue: 'Past Check-ins' })}</Text>
            {history.slice(1).map(h => (
              <Layout key={h.id} level="2" style={styles.historyRow}>
                <Text category="h9" bold>{MOOD_EMOJI[h.mood]} {moodLabel(h.mood, t)}</Text>
                {h.note ? <Text category="h10" status="placeholder" mt={4}>{h.note}</Text> : null}
              </Layout>
            ))}
          </View>
        ) : null}
      </Content>
    </Container>
  );
});

export default EmotionalCoach;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  moodChip: {
    flex: 1,
    marginHorizontal: 3,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  input: { ...globalStyle.inputField },
  card: {
    ...globalStyle.card,
    padding: 16,
    // Redesign v2 (full reskin): `card` carries a real shadow again, which
    // needs an opaque fill on Android — dropped the 'transparent' override
    // so this Layout's own `level="2"` background shows through instead.
  },
  historyRow: {
    ...globalStyle.card,
    padding: 12,
    marginBottom: 8,
    // Same as `card` above — renders via <Layout level="2" .../>.
  },
});
