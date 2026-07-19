import React, {memo} from 'react';
import {View, StyleProp, ViewStyle} from 'react-native';

import Text from 'components/Text';
import {useTranslation} from 'react-i18next';
import Flex from './Flex';

interface TitleStepProps {
  step: number;
  totalStep: number;
  title: string;
  description?: string;
  style?: StyleProp<ViewStyle>;
}

const TitleStep = memo(
  ({step, style, title, totalStep, description}: TitleStepProps) => {
    const {t} = useTranslation(['common']);
    return (
      <View style={style}>
        <Flex justify="flex-start">
          <Text>
            {t('common:step')} {step} {t('common:of')} {totalStep}
          </Text>
        </Flex>
        <Text category="h2" mt={8} bold>
          {title}
        </Text>
        {description ? (
          <Text category="h8" lineHeight={22} mt={16}>
            {description}
          </Text>
        ) : null}
      </View>
    );
  },
);

export default TitleStep;
