import React, {memo} from 'react';
import {View, Image, ImageRequireSource} from 'react-native';
import {StyleService, useStyleSheet} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';

interface EmptyDataProps {
  title: string;
  description: string;
  image: ImageRequireSource;
}

const EmptyData = memo(({title, description, image}: EmptyDataProps) => {
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['common']);
  return (
    <View style={styles.empty}>
      <Image source={image} />
      <Text category="h6" center mt={58} mb={16}>
        {title}
      </Text>
      <Text category="para-m" center mh={36}>
        {description}
      </Text>
    </View>
  );
});

export default EmptyData;

const themedStyles = StyleService.create({
  empty: {
    alignItems: 'center',
    marginTop: 120,
  },
});
