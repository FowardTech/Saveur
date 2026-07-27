import React, { memo } from 'react';
import { View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
} from '@ui-kitten/components';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { RootStackParamList } from 'navigation/types';

// Full-page "Today's Briefing" — HomeSrc.tsx's dashboard card now only shows
// a 3-line preview with a "Read more" arrow (the full narrative was making
// the home dashboard feel long/cluttered), this is where the rest of it
// lives. Takes the briefing straight via route params rather than
// re-fetching it — see navigation/types.tsx's CareerBriefingDetail entry for
// why that's safe to do here.
const CareerBriefingDetail = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['home']);
  const route = useRoute<RouteProp<RootStackParamList, 'CareerBriefingDetail'>>();
  const { narrative, priorities } = route.params;

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('home:career_os_briefing_title', { defaultValue: "Today's Briefing" })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder contentContainerStyle={styles.content}>
        <Text category="para-m" style={{ lineHeight: 26 }}>{narrative}</Text>
        {priorities.length ? (
          <View style={{ marginTop: 24 }}>
            <Text category="h7" bold mb={12}>
              {t('home:briefing_priorities_title', { defaultValue: "Today's priorities" })}
            </Text>
            {priorities.map((p, i) => (
              <Flex key={i} justify="flex-start" mb={14}>
                <View style={[styles.priorityDot, { backgroundColor: theme['color-primary-500'] }]} />
                <Text category="h9" style={{ marginLeft: 10, flex: 1, lineHeight: 20 }}>
                  <Text category="h9" bold>{p.label}</Text>{p.action ? ` — ${p.action}` : ''}
                </Text>
              </Flex>
            ))}
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
  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginTop: 7,
  },
});
