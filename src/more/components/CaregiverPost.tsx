import React, {memo} from 'react';
import {View, TouchableOpacity} from 'react-native';
import {
  StyleService,
  useStyleSheet,
  Layout,
  Avatar,
  Icon,
} from '@ui-kitten/components';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import {useTranslation} from 'react-i18next';
import {ApplicationItemProps} from 'src/requests/Applications/ApplicationItem';
import {globalStyle} from 'styles/globalStyle';
import OnlStatus from 'components/OnlStatus';
import Flex from 'components/Flex';
import dayjs from 'dayjs';
import Weekdays from 'components/Weekdays';
import {useNavigation, NavigationProp} from '@react-navigation/native';
import {RootStackParamList} from 'navigation/types';

const CaregiverPost = memo(({item}: ApplicationItemProps) => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();

  const {height, width, top, bottom} = useLayout();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['more', 'common']);

  const _onPress=()=>navigate('CaregiverPostDetails')
  return (
    <TouchableOpacity activeOpacity={0.54} onPress={_onPress}>
      <Layout style={styles.container} level="2">
        <Layout style={styles.title} level="1">
          <TouchableOpacity>
            <View style={styles.avatar}>
              <Avatar source={item.user.avatar} shape="rounded" />
              <OnlStatus status={item.user.onlineState} />
            </View>
          </TouchableOpacity>
          <Text bold maxWidth={230 * (width / 375)}>
            {item.jobDescription}
          </Text>
        </Layout>
        <Flex justify="flex-start" itemsCenter mb={8} mh={16} mt={16}>
          <Icon pack="assets" name="baby" style={styles.icon} />
          {item.children.map((item, i) => {
            return (
              <Text category="h8" ml={8} key={i} bold>
                {item}
              </Text>
            );
          })}
          <Layout style={globalStyle.dot} level="5" />
          <Text category="h8-s">{item.ageType}</Text>
        </Flex>
        <Flex justify="flex-start" itemsCenter mb={8} mh={16}>
          <Icon pack="assets" name="location16" style={styles.icon} />
          <Text category="h8-s" ml={8}>
            {item.location}
          </Text>
        </Flex>
        <Flex justify="flex-start" mh={16}>
          <Icon pack="assets" name="bookmarkActive" style={styles.icon} />
          <Flex>
            <View style={styles.startTime}>
              <Text category="h8" status={'placeholder'} bold>
                Start
              </Text>
              <Text category="h8-s" status={'basic'}>
                {dayjs(item.startTime).format('ddd, MMM DD')}
              </Text>
              <Weekdays data={item.dayInWeek} status="primary" />
            </View>
            <View>
              <Text category="h8" status={'placeholder'} bold>
                Hours
              </Text>
              <Text category="h8-s" status={'basic'}>
                {item.meetingTime}
              </Text>
            </View>
          </Flex>
        </Flex>
        <Flex mt={12} mr={16} mb={16}>
          <View
            style={[
              styles.tag,
              {
                width: 92 * (width / 375),
              },
            ]}>
            <Text category="h9" status={'primary'} bold>
              {t('common:regularly')}
            </Text>
          </View>
          <Text category="h3" bold mt={8}>
            {item.price}
          </Text>
        </Flex>
      </Layout>
    </TouchableOpacity>
  );
});

export default CaregiverPost;

const themedStyles = StyleService.create({
  container: {
    borderRadius: 16,
    ...globalStyle.shadow,
  },
  avatar: {
    marginRight: 8,
    paddingRight: 8,
  },
  title: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomWidth: 1,
    borderColor: 'background-basic-color-4',
  },
  icon: {
    width: 14,
    height: 14,
    tintColor: 'text-placeholder-color',
    marginTop: 2,
  },
  startTime: {
    marginLeft: 8,
    width: 124,
  },
  tag: {
    paddingVertical: 8,
    marginLeft: 24,
    alignItems: 'center',
    borderRadius: 8,
    marginTop: 6,
    height: 30,
    backgroundColor: 'color-primary-300',
  },
});
