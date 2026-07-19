import React, {memo} from 'react';
import {View, TouchableOpacity} from 'react-native';
import {StyleService, useStyleSheet, Avatar, Icon} from '@ui-kitten/components';

import Text from 'components/Text';
import {useTranslation} from 'react-i18next';
import {UserProps} from 'constants/Types';
import Flex from 'components/Flex';
import {globalStyle} from 'styles/globalStyle';
import dayjs from 'dayjs';
import useToggle from 'hooks/useToggle';

export interface ReviewItemProps {
  id: string | number;
  user: UserProps;
  comment: string;
  date: Date;
  rate: number;
  liked: boolean;
}

const ReviewItem = memo(
  ({id, user, comment, date, rate, liked}: ReviewItemProps) => {
    const styles = useStyleSheet(themedStyles);
    const {t} = useTranslation(['find', 'common']);

    const [isLike, setLike] = useToggle(liked);
    return (
      <View style={styles.container}>
        <Flex justify="flex-start">
          <Avatar source={user.avatar} shape="rounded" size={'tiny'} />
          <View style={globalStyle.flexOne}>
            <Text ml={16} bold category="h7">
              {user.name}
            </Text>
            <Flex ml={16} justify={'space-between'} style={globalStyle.flexOne}>
              <Flex itemsCenter>
                <Icon
                  pack="assets"
                  name="rateFull"
                  style={globalStyle.icon16}
                />
                <Text bold category="h8" ml={4}>
                  {rate}
                </Text>
              </Flex>
              <Text category="h8" status="placeholder">
                {dayjs(date).format('MMM DD YYYY')}
              </Text>
            </Flex>
          </View>
        </Flex>
        <Text category="h8" mv={16} mh={2}>
          {comment}
        </Text>
        <Flex>
          <Flex>
            <Text category="h8" status={'link'} mr={40}>
              {t('common:reply')}
            </Text>
            <Text category="h8" status={'placeholder'}>
              {t('common:report')}
            </Text>
          </Flex>
          <TouchableOpacity activeOpacity={0.54} onPress={setLike}>
            <Icon
              pack="assets"
              name={isLike ? 'like_comment_active' : 'like_comment'}
              style={{...globalStyle.icon16}}
            />
          </TouchableOpacity>
        </Flex>
      </View>
    );
  },
);

export default ReviewItem;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    marginHorizontal: 24,
    marginBottom: 32,
  },
});
