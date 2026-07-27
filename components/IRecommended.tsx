import React, { memo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import {
  StyleService,
  useStyleSheet,
  Avatar,
  Layout,
  Icon,
} from '@ui-kitten/components';

import Text from 'components/Text';
import { UserProps } from 'constants/Types';
import OnlStatus from './OnlStatus';
import { globalStyle } from 'styles/globalStyle';
import Flex, { FlexProps } from './Flex';
import useToggle from 'hooks/useToggle';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from 'navigation/types';

export interface RecommendedProps extends FlexProps {
  item: UserProps;
  onPress?(): void;
}

const IRecommended = memo(({ item, onPress, ...rest }: RecommendedProps) => {
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const [liked, setLike] = useToggle(false);
  const _onPress = React.useCallback(() => {
    onPress ? onPress() : null;
    navigate('CaregiverProfile');
  }, [onPress]);
  return (
    <Flex style={styles.container} {...rest} onPress={_onPress}>
      <TouchableOpacity
        style={styles.avatar}
        activeOpacity={0.54}
        onPress={() => {}}
      >
        <Avatar shape="rounded" size={'large'} source={item.avatar} />
        <OnlStatus status={item.onlineState} />
      </TouchableOpacity>
      <Layout level={'2'} style={styles.content}>
        <View style={styles.leftContent}>
          {item.backgroundCheck ? (
            <Icon pack="assets" name="bgCheck" style={globalStyle.icon24} />
          ) : null}
          {item.carePro ? (
            <Icon pack="assets" name="carePro" style={globalStyle.icon24} />
          ) : null}
        </View>
        <View style={styles.rightContent}>
          <Text category="h7" mb={14} bold>
            {item.name}
          </Text>
          <TouchableOpacity style={styles.buttonLike} onPress={setLike}>
            <Icon
              pack="assets"
              name={liked ? 'like_comment_active' : 'like_comment'}
              style={{ ...globalStyle.icon16 }}
            />
          </TouchableOpacity>
          <Flex itemsCenter justify="flex-start">
            {/* See Personal.tsx for why the fallback is needed — `gender` is
               optional, and Icon crashes app-wide on an undefined name. */}
            <Icon pack="assets" name={item.gender ?? 'male'} style={styles.icon} />
            <Text category="h8-s">{item.age}</Text>
            <Layout style={styles.dot} level="5" />
            <Text category="h8-s">{item.experience} yrs paid experience</Text>
          </Flex>
          <Flex itemsCenter justify="flex-start">
            <Icon
              pack="assets"
              name={'homeActive'}
              style={globalStyle.icon16}
            />
            <Text category="h8-s" ml={8} mv={8}>
              {item.address}
            </Text>
          </Flex>
          <Flex itemsCenter justify="flex-start" mb={8}>
            <Icon pack="assets" name={'rateFull'} style={globalStyle.icon16} />
            <Text category="h8" ml={8}>
              {item.rate}
            </Text>
            <Text category="h9-s" ml={8} status="placeholder">
              ({item.reviews} reviews)
            </Text>
          </Flex>
          <Flex justify="flex-start" itemsCenter>
            <Icon pack="assets" name="hourlyRate" style={globalStyle.icon16} />
            <Text category="h8" ml={8}>
              {item.hourlyRate}
            </Text>
            <Text category="h9-s" ml={8} status="placeholder">
              Cared for {item.cared} families
            </Text>
          </Flex>
        </View>
      </Layout>
    </Flex>
  );
});

export default IRecommended;

const themedStyles = StyleService.create({
  container: {
    marginBottom: 24,
  },
  avatar: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 10,
  },
  content: {
    flex: 1,
    marginTop: 16,
    marginLeft: 16,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    ...globalStyle.shadow,
  },
  rightContent: {
    marginLeft: 32,
  },
  icon: {
    ...globalStyle.icon16,
    tintColor: 'button-basic-color',
    marginRight: 8,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 99,
    marginHorizontal: 8,
  },
  leftContent: {
    alignSelf: 'flex-end',
    height: 60,
    justifyContent: 'space-between',
  },
  onlineIcon: {
    width: 16,
    height: 16,
    position: 'absolute',
    borderRadius: 99,
    borderWidth: 2,
    borderColor: 'background-basic-color-2',
    bottom: 0,
    right: 0,
  },
  buttonLike: {
    position: 'absolute',
    top: 0,
    right: 8,
  },
});
