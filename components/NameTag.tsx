import React from 'react';
import {TouchableOpacity} from 'react-native';
import {StyleService, useStyleSheet, Icon} from '@ui-kitten/components';
import Text from 'components/Text';
import Flex from './Flex';
import {globalStyle} from 'styles/globalStyle';

interface NameTagProps {
  title: string;
  onPress?(): void;
  onRemove?(): void;
}

const NameTag = ({title, onPress, onRemove}: NameTagProps) => {
  const styles = useStyleSheet(themedStyles);
  return (
    <Flex style={styles.container} onPress={onPress}>
      <TouchableOpacity>
        <Icon pack="assets" name="close" style={styles.icon} />
      </TouchableOpacity>
      <Text status={'primary'} category="h9" bold mh={8}>
        {title}
      </Text>
    </Flex>
  );
};

export default NameTag;

const themedStyles = StyleService.create({
  container: {
    backgroundColor: 'text-link-color',
    padding: 8,
    borderRadius: 8,
    marginRight: 12,
  },
  icon: {
    ...globalStyle.icon16,
    marginLeft: 8,
    tintColor: 'background-basic-color-1',
  },
});
