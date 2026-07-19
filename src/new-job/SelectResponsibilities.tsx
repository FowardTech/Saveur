import React, {memo} from 'react';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import NavigationAction from 'components/NavigationAction';
import ICheckbox from 'components/ICheckbox';
import useToggle from 'hooks/useToggle';
import IFitBottom from 'components/IFitBottom';
import {CreateJobStackParamList} from 'navigation/types';

const SelectResponsibilities = memo(() => {
  const {navigate} = useNavigation<NavigationProp<CreateJobStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['creat_job', 'common']);

  const RenderCheckBox = React.useCallback(({item}) => {
    const [isCheck, setIsCheck] = useToggle(item.checked);
    return (
      <ICheckbox
        title={item.title}
        style={styles.item}
        checked={isCheck}
        onChange={setIsCheck}
      />
    );
  }, []);

  const _onSave = () => {};
  const _onNext = () => {
    navigate('CreatePostDetails');
  };
  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={<NavigationAction />}
        accessoryRight={
          <Text bold status={'link'} mr={20} onPress={_onSave}>
            {t('common:save')}
          </Text>
        }
      />
      <Content padder>
        <Text mt={16} category="h7">
          {t('creat_job:step-6-of-7')}
        </Text>
        <Text mt={8} category="h2" bold mb={40}>
          {t('creat_job:responsibilities')}
        </Text>

        {DATA_RES.map((item, i) => {
          return <RenderCheckBox key={i} item={item} />;
        })}
      </Content>
      <IFitBottom
        title={t('creat_job:job-title-and-detail')}
        onPress={_onNext}
      />
    </Container>
  );
});

export default SelectResponsibilities;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  item: {
    marginBottom: 24,
  },
});
export const DATA_RES = [
  {
    title: 'Driving the kids',
    checked: false,
  },
  {
    title: 'Homework help',
    checked: true,
  },
  {
    title: 'Prepares food',
    checked: true,
  },
  {
    title: 'Light housework',
    checked: false,
  },
  {
    title: 'Run errands',
    checked: true,
  },
  {
    title: 'Do laundry',
    checked: false,
  },
  {
    title: 'Sleep training',
    checked: true,
  },
  {
    title: 'Potty Training',
    checked: true,
  },
  {
    title: 'Will provide sick care',
    checked: true,
  },
];
