import React, {memo} from 'react';
import {StyleService, useStyleSheet, Icon} from '@ui-kitten/components';

import Text from 'components/Text';
import Flex from 'components/Flex';
import {globalStyle} from 'styles/globalStyle';

interface RatingProps {
  title: string;
  numOfChildren: number;
}

const Rating = memo(({title, numOfChildren}: RatingProps) => {
  const styles = useStyleSheet(themedStyles);
  const BabyIcon = () => {
    return <Icon pack="assets" name="baby" style={styles.icon} />;
  };
  return (
    <Flex itemsCenter justify="flex-start" mb={16}>
      <Text category='h7' style={styles.text}>{title}</Text>
      <Flex ml={32}>
        {numOfChildren === 1 ? (
          <BabyIcon />
        ) : numOfChildren === 2 ? (
          <>
            <BabyIcon />
            <BabyIcon />
          </>
        ) : numOfChildren === 3 ? (
          <>
            <BabyIcon />
            <BabyIcon />
            <BabyIcon />
          </>
        ) : (
          <>
            <BabyIcon />
            <BabyIcon />
            <BabyIcon />
            <BabyIcon />
          </>
        )}
      </Flex>
    </Flex>
  );
});

export default Rating;

const themedStyles = StyleService.create({
  icon: {
    ...globalStyle.icon16,
    tintColor: 'text-basic-color',
    marginRight: 8,
  },
  text: {
    width: '50%',
  },
});
