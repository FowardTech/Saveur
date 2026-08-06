import React from 'react';
import {View, ViewStyle, TouchableOpacity} from 'react-native';

import Text from 'components/Text';
import {
  useStyleSheet,
  StyleService,
  Layout,
  Avatar,
} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';
import {PlanProps, Onl_State_Types_Enum} from 'constants/Types';
import {globalStyle} from 'styles/globalStyle';
import ButtonFill from 'components/ButtonFill';
import useLayout from 'hooks/useLayout';
import Flex from 'components/Flex';

interface PlanItemProps {
  item: PlanProps;
  style?: ViewStyle;
  onPress?(): void;
}

const PlanItem = ({item, style, onPress}: PlanItemProps) => {
  const styles = useStyleSheet(themedStyles);
  const {width} = useLayout();
  const {t} = useTranslation(['home', 'common']);

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        activeOpacity={0.54}
        onPress={onPress}
        style={{width: width - 48}}>
        <Layout level={'2'} style={styles.content}>
          <View>
            <Text category="h8" bold status={'warning'}>
              {item.type?.toUpperCase()}
            </Text>
            <Text category="h7" mv={8} bold>
              {item.user?.name}
            </Text>
            <Flex>
              <Text category="h8-s">{t('home:today', {defaultValue: 'Today'})}</Text>
              <Layout style={styles.dot} />
              <Text category="h8-s">{item.meeting_time}</Text>
            </Flex>
          </View>
          <Avatar source={item.user?.avatar} size="medium" shape="rounded" />
          {item.user?.onlineState === Onl_State_Types_Enum.Online ? (
            <ButtonFill
              icon="callSmall"
              status="basic"
              size="tiny"
              style={styles.onlState}
            />
          ) : (
            <ButtonFill
              icon="messageSmall"
              status="success"
              size="tiny"
              style={styles.onlState}
            />
          )}
        </Layout>
      </TouchableOpacity>
    </View>
  );
};

export default PlanItem;

const themedStyles = StyleService.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 24,
  },
  dot: {
    width: 3,
    height: 3,
    marginHorizontal: 8,
    alignSelf: 'center',
    backgroundColor: 'text-placeholder-color',
  },
  content: {
    borderRadius: 14,
    padding: 16,
    ...globalStyle.shadow,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  onlState: {
    position: 'absolute',
    bottom: 16,
    right: 8,
  },
});
