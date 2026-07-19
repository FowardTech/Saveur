import React, {memo} from 'react';
import {View, StyleSheet, TouchableOpacity} from 'react-native';
import Text from 'components/Text';
import {MessagesItemProps} from 'constants/Types';
import {Avatar, Layout, useTheme} from '@ui-kitten/components';
import useLayout from 'hooks/useLayout';
import Flex from 'components/Flex';

interface ItemProps {
  item: MessagesItemProps;
  _onPress?(): void;
}

const MessagesItem = memo(({item, _onPress}: ItemProps) => {
  const theme = useTheme();
  const {width} = useLayout();
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={_onPress}
      activeOpacity={0.54}>
      <View
        style={[
          styles.readed,
          {
            backgroundColor: !item.readed
              ? theme['color-danger-100']
              : 'transparent',
          },
        ]}
      />
      <View style={styles.viewAvatar}>
        <Avatar source={item.avatar} size="medium" shape="rounded" />
        <View
          style={[
            styles.onlineIcon,
            {
              backgroundColor:
                item.onlineState === 0
                  ? theme['color-success-100']
                  : item.onlineState === 1
                  ? theme['color-basic-400']
                  : item.onlineState === 2
                  ? theme['color-danger-100']
                  : theme['color-warning-100'],
              borderColor: theme['background-basic-color-2'],
            },
          ]}
        />
      </View>
      <View>
        <Text category="h7" bold={!item.readed}>
          {item.name}
        </Text>
        <Flex itemsCenter>
          <Text
            category={item.readed ? 'h8-s' : 'h8'}
            status={item.readed ? 'placeholder' : 'basic'}
            maxWidth={195 * (width / 375)}
            mt={2}
            numberOfLines={1}
            mb={4}
            bold={!item.readed}>
            {item.title}
          </Text>
          <Layout style={styles.dot} level="5" />
          <Text category="h8-s" status={'placeholder'} bold={!item.readed}>
            {item.isWeb ? 'Web' : item.time}
          </Text>
        </Flex>
      </View>
    </TouchableOpacity>
  );
});

export default MessagesItem;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  viewAvatar: {
    marginRight: 12,
  },
  onlineIcon: {
    width: 14,
    height: 14,
    position: 'absolute',
    borderRadius: 99,
    borderWidth: 2,
    bottom: 0,
    right: 0,
  },
  dot: {
    width: 2,
    height: 2,
    marginHorizontal: 8,
  },
  readed: {
    width: 8,
    height: 8,
    marginHorizontal: 8,
    borderRadius: 24,
  },
});
