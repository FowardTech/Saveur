import React, {memo} from 'react';
import {View} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import BrandWordmark from 'components/BrandWordmark';
import {globalStyle} from 'styles/globalStyle';
import {RootStackParamList} from 'navigation/types';
import {DATA_MESSAGES} from 'constants/Data';
import MessagesItem from './Components/MessagesItem';

// "Coach" tab — the AI career coach is a single persistent contact, not a
// caregiver-style inbox. Tapping the hero card or any suggested topic opens
// the same Chat thread. TODO: replace with a real assistant/session backend.
const MessagesScreen = memo(() => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['message', 'common']);

  const onOpenChat = React.useCallback(() => {
    navigate('MessagesStack', {screen: 'Chat'});
  }, [navigate]);

  const [primary, ...topics] = DATA_MESSAGES;

  return (
    <Container style={styles.container}>
      <TopNavigation title={t('message:title').toString()} />
      <Content contentContainerStyle={styles.content} padder>
        <Flex
          style={styles.hero}
          justify="flex-start"
          itemsCenter
          onPress={onOpenChat}>
          <View style={styles.heroAvatar}>
            <BrandWordmark markOnly size={56} />
          </View>
          <View style={globalStyle.flexOne}>
            <Text category="h6" status="control" bold>
              {t('message:ai_coach_name', {defaultValue: 'AI Career Coach'})}
            </Text>
            <Text category="h9-s" status="control" mt={4} numberOfLines={2}>
              {primary.title}
            </Text>
          </View>
          <Icon
            pack="assets"
            name="arrowRight"
            style={[globalStyle.icon16, {tintColor: theme['text-control-color']}]}
          />
        </Flex>

        <Flex
          style={styles.negotiationCard}
          justify="flex-start"
          itemsCenter
          onPress={() => navigate('SalaryNegotiation')}>
          <View style={globalStyle.flexOne}>
            <Text category="h7" bold>
              {t('message:salary_negotiation_title', {defaultValue: 'Salary Negotiation Simulator'})}
            </Text>
            <Text category="h9-s" status="placeholder" mt={4}>
              {t('message:salary_negotiation_description', {
                defaultValue: 'Practice countering a mock offer over a few rounds.',
              })}
            </Text>
          </View>
          <Icon pack="assets" name="arrowRight" style={globalStyle.icon16} />
        </Flex>

        <Text category="h6" bold mt={32} mb={16}>
          {t('message:suggested_topics', {defaultValue: 'Suggested Topics'})}
        </Text>
        {topics.map((item, i) => (
          <MessagesItem item={item} _onPress={onOpenChat} key={i} />
        ))}
      </Content>
    </Container>
  );
});

export default MessagesScreen;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  hero: {
    marginTop: 16,
    padding: 20,
    borderRadius: 24,
    backgroundColor: 'button-basic-color',
    ...globalStyle.shadowBtn,
  },
  heroAvatar: {
    marginRight: 16,
  },
  negotiationCard: {
    marginTop: 16,
    padding: 20,
    borderRadius: 20,
    backgroundColor: 'background-basic-color-2',
  },
});
