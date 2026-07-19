import React from 'react';
import {TouchableOpacity, View} from 'react-native';

import Text from 'components/Text';
import {
  useStyleSheet,
  StyleService,
  Layout,
  Avatar,
  useTheme,
  Icon,
} from '@ui-kitten/components';
import {
  Onl_State_Types_Enum,
  Request_Status_Type_Enum,
  UserProps,
  WeekdaysProps,
} from 'constants/Types';
import Flex from 'components/Flex';
import {globalStyle} from 'styles/globalStyle';
import {t} from 'i18next';
import useLayout from 'hooks/useLayout';
import dayjs from 'dayjs';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {RootStackParamList} from 'navigation/types';
import Weekdays from 'components/Weekdays';
import OnlStatus from 'components/OnlStatus';

export interface BookingItemProps {
  user: UserProps;
  type: Request_Status_Type_Enum;
  onlineState: Onl_State_Types_Enum;
  children: string[];
  mile: number;
  ageType: string;
  startTime: Date | number;
  meetingTime: string;
  dayInWeek: WeekdaysProps[];
  price: string;
  location: string;
}

export interface BookingProps {
  item: BookingItemProps;
}

const BookingItem = ({item}: BookingProps) => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();

  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const {width} = useLayout();

  return (
    <TouchableOpacity
      onPress={() => {
        navigate('RequestStack', {
          screen: 'BookingDetails',
          params: {type: item.type},
        });
      }}
      activeOpacity={0.54}>
      <Layout style={styles.container} level="1">
        <Flex
          justify="flex-start"
          itemsCenter
          mv={16}
          mh={16}
          style={globalStyle.shadow}>
          <Flex mr={8} style={styles.avatar}>
            <Avatar source={item.user.avatar} size="medium" shape="square" />
            <OnlStatus status={item.onlineState} />
          </Flex>
          <View>
            <Text category="h7" maxWidth={231} bold>
              {item.user.name}
            </Text>
            <Flex mt={8}>
              <Text category="h8" status={'warning'} bold>
                {item.type}
              </Text>
              {item.type === 'Unconfirmed' ? (
                <Text category="h8" ml={8} mt={1} status={'placeholder'}>
                  19 hours left
                </Text>
              ) : null}
            </Flex>
          </View>
        </Flex>
        <Layout level={'2'} style={styles.bottom}>
          <Flex justify="flex-start" itemsCenter mb={8}>
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
          <Flex justify="flex-start" itemsCenter mb={8}>
            <Icon pack="assets" name="location16" style={styles.icon} />
            <Text category="h8-s" ml={8}>
              {item.location}
            </Text>
          </Flex>
          <Flex justify="flex-start">
            <Icon pack="assets" name="bookmarkActive" style={styles.icon} />
            <Flex>
              <View style={styles.startTime}>
                <Text category="h8" status={'placeholder'} bold>
                  Start
                </Text>
                <Text category="h8-s" status={'basic'}>
                  {dayjs(item.startTime).format('ddd, MMM DD')}
                </Text>
                <Weekdays data={item.dayInWeek} status="primary"/>
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
          <Flex mt={12} mr={16} itemsCenter>
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
            <Text category="h3" bold>
              {item.price}
            </Text>
          </Flex>
        </Layout>
      </Layout>
    </TouchableOpacity>
  );
};

export default BookingItem;

const themedStyles = StyleService.create({
  container: {
    marginBottom: 24,
    ...globalStyle.shadowFade,
    borderRadius: 16,
  },
  bottom: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: 'background-basic-color-3',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  icon: {
    width: 14,
    height: 14,
    tintColor: 'text-placeholder-color',
    marginLeft: 16,
    marginTop: 2,
  },
  startTime: {
    marginLeft: 8,
    marginRight: 16,
    width: 124,
  },
  onlineIcon: {
    width: 14,
    height: 14,
    position: 'absolute',
    borderRadius: 99,
    borderWidth: 2,
    borderColor: 'background-basic-color-2',
    bottom: 0,
    left: 48,
  },
  tag: {
    paddingVertical: 8,
    marginLeft: 40,
    alignItems: 'center',
    borderRadius: 8,
    marginTop: 6,
    height: 30,
    backgroundColor: 'color-primary-300',
  },
  avatar: {
    paddingRight: 8,
  },
});
