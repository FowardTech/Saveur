import React, { memo } from 'react';
import { View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Icon,
} from '@ui-kitten/components';
import { NavigationProp, RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import dayjs from 'utils/dayjs';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';

// Full-page "Today's Briefing" — HomeSrc.tsx's dashboard card only shows a
// 3-line preview with a "Read more" arrow into here. Visual redesign (product
// feedback: the plain text-on-white layout "doesn't look professional") —
// now mirrors the rest of the app's card language (icon-badge header,
// bordered/shadowed cards, the same borderRadius 16 / padding 16 convention
// as HomeSrc's own briefingCard) instead of unstyled paragraphs. Priorities
// that clearly map to a real destination (Career Roadmap, Resume Builder,
// Mock Interview) are now tappable — see PRIORITY_DESTINATIONS below —
// rather than inert bullet text.
const PRIORITY_DESTINATIONS: { match: string; screen: keyof RootStackParamList }[] = [
  { match: 'career roadmap', screen: 'CareerRoadmap' },
  { match: 'resume', screen: 'ResumeBuilder' },
  { match: 'mock interview', screen: 'MockInterviewSetup' },
];

function destinationFor(label: string): keyof RootStackParamList | null {
  const lower = label.toLowerCase();
  const hit = PRIORITY_DESTINATIONS.find(d => lower.includes(d.match));
  return hit ? hit.screen : null;
}

const CareerBriefingDetail = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['home']);
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'CareerBriefingDetail'>>();
  const { narrative, priorities, isTeaser } = route.params;

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={isTeaser
          ? t('home:career_os_get_started_title', { defaultValue: 'Get Started' })
          : t('home:career_os_briefing_title', { defaultValue: "Today's Briefing" })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder contentContainerStyle={styles.content}>
        <Layout
          level="2"
          style={[styles.heroCard, { borderColor: theme['color-primary-transparent-300'] }]}
        >
          <Flex justify="flex-start" itemsCenter mb={14}>
            <View style={[styles.iconBadge, { backgroundColor: theme['color-primary-transparent-200'] }]}>
              <Icon
                pack="eva"
                name={isTeaser ? 'bulb-outline' : 'sun-outline'}
                style={[globalStyle.icon20, { tintColor: theme['color-primary-500'] }]}
              />
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text category="h7" bold>
                {isTeaser
                  ? t('home:career_os_get_started_title', { defaultValue: 'Get Started' })
                  : t('home:career_os_briefing_title', { defaultValue: "Today's Briefing" })}
              </Text>
              <Text category="h10" status="placeholder" mt={2}>
                {dayjs().format('dddd, MMMM D')}
              </Text>
            </View>
          </Flex>
          <Text category="para-m" style={{ lineHeight: 24 }}>{narrative}</Text>
        </Layout>

        {priorities.length ? (
          <View style={{ marginTop: 24 }}>
            <Text category="h7" bold mb={12}>
              {t('home:briefing_priorities_title', { defaultValue: "Today's priorities" })}
            </Text>
            {priorities.map((p, i) => {
              const destination = destinationFor(p.label);
              return (
                <Flex
                  key={i}
                  level="2"
                  style={styles.priorityCard}
                  justify="flex-start"
                  itemsCenter
                  onPress={destination ? () => navigate(destination as any) : undefined}
                >
                  <View style={[styles.priorityBadge, { backgroundColor: theme['color-primary-transparent-200'] }]}>
                    {/* Was status="primary" -- text-primary-color is a
                        near-white token meant for text on a solid
                        color-primary surface, not this pale transparent
                        badge -- made the number invisible. Same fix as
                        JobAlerts.tsx/HomeSrc.tsx: the actual brand blue. */}
                    <Text category="h9" bold style={{color: theme['color-primary-500']}}>{i + 1}</Text>
                  </View>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text category="h9-s" bold>{p.label}</Text>
                    {p.action ? (
                      <Text category="h10" status="placeholder" mt={2} style={{ lineHeight: 18 }}>
                        {p.action}
                      </Text>
                    ) : null}
                  </View>
                  {destination ? (
                    <Icon pack="assets" name="arrowRight" style={globalStyle.icon16} />
                  ) : null}
                </Flex>
              );
            })}
          </View>
        ) : null}
      </Content>
    </Container>
  );
});

export default CareerBriefingDetail;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  heroCard: {
    ...globalStyle.card,
    padding: 18,
    borderWidth: 1,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityCard: {
    ...globalStyle.card,
    padding: 14,
    marginBottom: 10,
  },
  priorityBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
