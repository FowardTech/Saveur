import React, {memo} from 'react';
import {View, TouchableOpacity} from 'react-native';
import {StyleService, useStyleSheet, Layout} from '@ui-kitten/components';

import Text from 'components/Text';
import {useTranslation} from 'react-i18next';
import dayjs from 'dayjs';
import Flex from 'components/Flex';
import ButtonFill from 'components/ButtonFill';
import {globalStyle} from 'styles/globalStyle';
import useLayout from 'hooks/useLayout';

interface AvailableProps {
  id: string | number | null;
  availableTime: {
    morning: boolean;
    afternoon: boolean;
  };
  date: Date;
}
interface IAvailableItemProps {
  startTime: Date;
  endTime: Date;
  data: AvailableProps[];
  onPress?(): void;
}

const AvailableItem = memo(
  ({data, startTime, endTime, onPress}: IAvailableItemProps) => {
    const styles = useStyleSheet(themedStyles);
    const {width} = useLayout();
    const {t} = useTranslation(['find', 'common']);
    let morning_office_hours = '08:00 - 11:00 ';
    let afternoon_office_hours = '13:30 - 18:00 ';
    const Opacity = 0.54;
    return (
      <Flex style={styles.container} mt={8} mb={32}>
        <View style={globalStyle.flexOne}>
          <Text category="h10" uppercase status={'placeholder'} ml={56} mb={16}>
            {dayjs(startTime).format('MMMM DD')} -{' '}
            {dayjs(endTime).format('MMMM DD')}
          </Text>
          {data.map((item, i) => {
            return (
              <View key={i}>
                <Flex mb={i !== data.length - 1 ? 32 : 0}>
                  <View style={styles.date}>
                    <Text uppercase>{dayjs(item.date).format('ddd')}</Text>
                    <Text bold>{dayjs(item.date).format('DD')}</Text>
                  </View>
                  <View style={globalStyle.flexOne}>
                    {item.availableTime.morning === true ? (
                      <TouchableOpacity
                        onPress={onPress}
                        activeOpacity={Opacity}>
                        <Layout level={'7'} style={styles.item}>
                          <Flex>
                            <View>
                              <Text category="h7" bold status={'success'}>
                                {t('find:available')}
                              </Text>
                              <Text category="h8" status="success">
                                {morning_office_hours}
                              </Text>
                            </View>
                            <ButtonFill icon="add_plan" status="white-blue" />
                          </Flex>
                        </Layout>
                      </TouchableOpacity>
                    ) : null}
                    {item.availableTime.afternoon === true ? (
                      <TouchableOpacity
                        onPress={onPress}
                        activeOpacity={Opacity}>
                        <Layout level={'7'} style={styles.item}>
                          <Flex>
                            <View>
                              <Text category="h7" bold status={'success'}>
                                {t('find:available')}
                              </Text>
                              <Text category="h8" status="success">
                                {afternoon_office_hours}
                              </Text>
                            </View>
                            <ButtonFill icon="add_plan" status="white-blue" />
                          </Flex>
                        </Layout>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </Flex>
              </View>
            );
          })}
        </View>
      </Flex>
    );
  },
);

export default AvailableItem;

const themedStyles = StyleService.create({
  container: {
    marginHorizontal: 24,
  },
  item: {
    borderRadius: 12,
    marginBottom: 8,
    padding: 16,
  },
  date: {
    alignItems: 'center',
    marginRight: 24,
    width: 32,
  },
});
