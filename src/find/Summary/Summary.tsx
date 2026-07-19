import React, {memo} from 'react';
import {View} from 'react-native';
import {StyleService, useStyleSheet} from '@ui-kitten/components';

import Text from 'components/Text';
import {useTranslation} from 'react-i18next';
import ReadMore from 'components/ReadMore';
import Flex from 'components/Flex';
import {globalStyle} from 'styles/globalStyle';

import Rating from '../Component/Rating';
import Tag from '../Component/Tag';
import YearOrExp from './YearOrExp';
import TrustAndSafety from './TrustAndSafety';

interface SummaryProps {
  about_me: string;
  tag_about_me: Array<string>;
}

const Summary = memo(({about_me, tag_about_me}: SummaryProps) => {
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['find', 'filter', 'common']);

  const DATA_EXP = [
    {title: t('filter:infant'), age: t('filter:infant_age'), exp: '6+'},
    {title: t('filter:toddler'), age: t('filter:toddler_age'), exp: '6+'},
    {title: t('filter:pre_school'), age: t('filter:pre_school_age'), exp: '6+'},
  ];
  const DATA_OTHER = [
    {
      title: 'English:',
      status: 'Native speaker',
    },
    {
      title: 'Languages:',
      status: 'American Sign Language, Spanish',
    },
    {
      title: 'Lives in:',
      status: 'Boston, NY',
    },
    {
      title: 'Willing to work within:',
      status: '50 miles',
    },
  ];
  return (
    <View style={styles.container}>
      <Text category="h3" bold>
        {t('find:about_me')}
      </Text>
      <ReadMore
        text={about_me}
        maxCount={190}
        containerStyle={styles.readmore}
      />
      <View style={styles.underline}>
        {tag_about_me.map((item, index) => {
          return <Tag title={item} key={index} />;
        })}
      </View>
      <View style={styles.underline}>
        <Text mt={56} category="h3" bold mb={24}>
          {t('find:rating')}
        </Text>
        {DATA_RATING.map((item, i) => {
          return <Rating numOfChildren={i + 1} title={item} key={i} />;
        })}
      </View>
      <View style={styles.underline}>
        <Text category="h3" bold mt={56} mb={24}>
          {t('find:general_availability')}
        </Text>
        {General_Availability.map((item, index) => {
          return <Tag title={item} key={index} />;
        })}
      </View>
      <YearOrExp data={DATA_EXP} />
      <View style={styles.underline}>
        <Text category="h3" bold mt={56} mb={24}>
          {t('find:special_experience')}
        </Text>
        {Special_Experience.map((item, index) => {
          return <Tag title={item} key={index} />;
        })}
      </View>
      <TrustAndSafety
        backgroundCheck={true}
        vehicleRecordsCheck={true}
        firstAidCertification={true}
        cprCertification={false}
      />
      <View style={styles.underline}>
        <Text category="h3" bold mt={56} mb={24}>
          {t('find:education')}
        </Text>
        <Text category="h7" bold mb={8}>
          {t('find:astronomy_&_physics')}
        </Text>
        <Text category="h7" status={'placeholder'} mb={8}>
          Graduated from University of Arizona
        </Text>
        <Text category="h7" status={'placeholder'} mb={8}>
          2017
        </Text>
      </View>
      <Text category="h3" bold mt={56} mb={24}>
        {t('common:others')}
      </Text>
      {DATA_OTHER.map((item, i) => {
        return (
          <Flex
            key={i}
            justify="flex-start"
            mb={24}
            vertical={item.status.length > 30 ? true : false}>
            <Text bold mr={4} mb={item.status.length > 30 ? 8 : 0}>
              {item.title}
            </Text>
            <Text children={`${item.status}`} />
          </Flex>
        );
      })}
    </View>
  );
});

export default Summary;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  readmore: {
    marginBottom: 32,
  },
  underline: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: 'background-basic-color-3',
  },

  icon: {
    ...globalStyle.icon16,
    tintColor: 'text-basic-color',
  },
});
const DATA_RATING = [
  '$15 - $20 per hour',
  '$17 - $25 per hour',
  '$25 - $30 per hour',
  '$30 - $50 per hour',
];
const General_Availability = [
  'Generally available mornings, afternoons, evernings, late night and weekends.',
  'After school care',
];
const Special_Experience = [
  'Asperger syndrome/Autism',
  'Tourette syndrome',
  'Physically challenged',
  'Diabetes',
  'ADHD',
  'Behavior challenged',
  'Food allergies',
];
