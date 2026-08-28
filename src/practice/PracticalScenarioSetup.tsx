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
  Spinner,
} from '@ui-kitten/components';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import * as practicalService from 'services/practicalService';
import { PracticalType } from 'services/practicalService';
import { ADDON_CODES, hasAddon } from 'services/entitlementsService';
import CtaButton from 'components/CtaButton';

// Practical Scenarios setup — "coding practice already gives software
// engineers something hands-on to actually DO; every other career type only
// gets talk-based mock interviews" (product request). Picks a career track
// + target role, then starts a real multi-step decision scenario (see
// services/practicalService.ts) where the AI generates each situation live
// from the whole decision history so far — the learner's earlier choices
// genuinely shape what happens next.
const TYPE_ICONS: Record<PracticalType, string> = {
  healthcare: 'heart-outline',
  sales: 'trending-up-outline',
  marketing: 'bar-chart-outline',
  finance: 'pie-chart-outline',
  consulting: 'briefcase-outline',
  science: 'bulb-outline',
};

const TYPE_LABEL_KEYS: Record<PracticalType, string> = {
  healthcare: 'practical_type_healthcare',
  sales: 'practical_type_sales',
  marketing: 'practical_type_marketing',
  finance: 'practical_type_finance',
  consulting: 'practical_type_consulting',
  science: 'practical_type_science',
};

const ALL_TYPES: PracticalType[] = ['healthcare', 'sales', 'marketing', 'finance', 'consulting', 'science'];

const PracticalScenarioSetup = memo(() => {
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['find', 'common']);

  const [type, setType] = React.useState<PracticalType>('healthcare');
  const [role, setRole] = React.useState('');
  const [isStarting, setIsStarting] = React.useState(false);

  const onStart = async () => {
    if (isStarting) return;
    setIsStarting(true);
    try {
      // PRODUCT DECISION: Practical Scenarios is now its own one-time paid
      // add-on, independent of subscription tier/free-session cap — same
      // treatment as Coding Practice. Same alert/navigate-to-AddOns pattern
      // as MockInterviewSetup.tsx's addonCodeForInterviewType gate; see
      // Saveur-Backend's app/api/practical.py create_session() for the
      // matching backend @require_addon gate.
      if (!(await hasAddon(ADDON_CODES.practicalScenario))) {
        Alert.alert(
          t('find:addon_required_title_generic', { defaultValue: 'This is a paid add-on' }),
          t('find:addon_required_body', {
            defaultValue: 'Purchase the add-on once to unlock it for good.',
          }),
          [
            { text: t('common:cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
            {
              text: t('more:addons_title', { defaultValue: 'Add-ons' }),
              onPress: () => navigate('AddOns', { highlightCode: ADDON_CODES.practicalScenario }),
            },
          ],
        );
        return;
      }
      const { session, step } = await practicalService.createSession(type, role.trim());
      navigate('PracticalScenarioSession', { sessionId: session.id, type, role: role.trim() || undefined, initialStep: step });
    } catch (e: any) {
      Alert.alert(
        t('find:start_interview_failed', { defaultValue: 'Could not start interview' }),
        e?.message ?? t('common:something_went_wrong', { defaultValue: 'Something went wrong. Please try again.' }),
      );
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('find:practical_scenarios', { defaultValue: 'Practical Scenarios' })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        <Text category="h9-s" status="placeholder" mb={20}>
          {t('find:practical_scenarios_description', {
            defaultValue: "A realistic, multi-step situation for your field — your choices shape what happens next, and the AI scores your judgment at the end.",
          })}
        </Text>

        <Text category="h8" bold mb={12}>
          {t('find:practical_type_label', { defaultValue: 'Choose a field' })}
        </Text>
        <Flex wrap justify="flex-start" style={{ marginHorizontal: -4, marginBottom: 20 }}>
          {ALL_TYPES.map(ptype => {
            const selected = ptype === type;
            return (
              <TouchableOpacity
                key={ptype}
                activeOpacity={0.7}
                onPress={() => setType(ptype)}
                style={[
                  styles.typeChip,
                  { borderColor: selected ? theme['color-primary-500'] : theme['border-basic-color-3'] },
                  selected ? { backgroundColor: theme['color-primary-transparent-200'] } : null,
                ]}
              >
                <Icon
                  pack="eva"
                  name={TYPE_ICONS[ptype]}
                  style={[globalStyle.icon16, { tintColor: selected ? theme['text-basic-color'] : theme['text-hint-color'] }]}
                />
                {/* Was status={selected ? 'primary' : 'basic'} -- 'primary'
                    resolves to text-primary-color, a near-white token meant
                    for text on a solid color-primary button, not this pale
                    transparent chip. Made the selected label invisible in
                    light mode. Using the brand blue directly instead, same
                    fix as the chip's own icon tintColor two lines up. */}
                <Text
                  category="h9-s"
                  bold={selected}
                  style={selected ? { color: theme['color-primary-500'] } : undefined}
                  ml={6}
                >
                  {t(`find:${TYPE_LABEL_KEYS[ptype]}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Flex>

        <Text category="h10" status="placeholder" mb={6}>
          {t('find:practical_role_label', { defaultValue: 'Target role (optional)' })}
        </Text>
        <Input
          placeholder={t('find:practical_role_placeholder', { defaultValue: 'e.g. ICU Nurse, Enterprise AE, Lab Technician' })}
          value={role}
          onChangeText={setRole}
          style={[styles.input, { marginBottom: 24 }]}
          textStyle={globalStyle.inputText}
        />

        <CtaButton
          style={globalStyle.shadowBtn}
          disabled={isStarting}
          onPress={onStart}
        >
          {isStarting
            ? () => <Spinner size="small" status="control" />
            : t('find:practical_start_cta', { defaultValue: 'Start scenario' })}
        </CtaButton>
      </Content>
    </Container>
  );
});

export default PracticalScenarioSetup;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  input: { ...globalStyle.inputField },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    margin: 4,
  },
});
