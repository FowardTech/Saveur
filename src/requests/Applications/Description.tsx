import React, {memo} from 'react';
import {View} from 'react-native';
import {StyleService, useStyleSheet, Layout} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Flex from 'components/Flex';
import {globalStyle} from 'styles/globalStyle';

interface DescriptionProps {
  tagQualifications: string[];
  tagResponsibilities: string[];
}

const Description = memo(
  ({tagQualifications, tagResponsibilities}: DescriptionProps) => {
    const styles = useStyleSheet(themedStyles);
    const {t} = useTranslation(['request', 'common']);
    return (
      <View style={styles.container}>
        <View style={styles.description}>
          <Text category="h3" mb={24} bold>
            {t('request:description')}
          </Text>
          <Text category="para-m" mb={32}>
            {t('request:description_1')}
          </Text>
          <Text category="para-m" mb={32}>
            {t('request:description_2')}
          </Text>
        </View>
        <View>
          <Text category="h3" mb={24}>
            {t('request:qualifications')}
          </Text>
          {tagQualifications.map((item, i) => {
            return (
              <Flex key={i} justify="flex-start" itemsCenter mb={12}>
                <Layout style={globalStyle.dot} level="6" />
                <Text category="para-m">{item}</Text>
              </Flex>
            );
          })}
        </View>
        <Layout style={styles.line} level="3" />
        <View>
          <Text category="h3" mb={24}>
            {t('find:qualifications')}
          </Text>
          {tagResponsibilities.map((item, i) => {
            return (
              <Flex key={i} justify="flex-start" itemsCenter mb={12}>
                <Layout style={globalStyle.dot} level="5" />
                <Text category="para-m">{item}</Text>
              </Flex>
            );
          })}
        </View>
        <Text status={'placeholder'} category="h8-s" mt={56}>
          Posted by Marian on August 6, 2019
        </Text>
      </View>
    );
  },
);

export default Description;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  description: {
    borderBottomWidth: 1,
    borderColor: 'background-basic-color-3',
    marginBottom: 56,
  },
  line: {
    marginBottom: 56,
    height: 1,
    marginTop: 12,
  },
});
