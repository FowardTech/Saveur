import React, {memo} from 'react';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Icon,
  Layout,
} from '@ui-kitten/components';
import {
  NavigationProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import NavigationAction from 'components/NavigationAction';
import Flex from 'components/Flex';
import {globalStyle} from 'styles/globalStyle';
import useToggle from 'hooks/useToggle';
import IFitBottom from 'components/IFitBottom';
import IToggle from 'components/IToggle';
import {
  AboutYourFamilyScreenNavigationProp,
  CreateJobStackParamList,
} from 'navigation/types';
import {CreatPostChildren} from 'constants/Types';
import ICheckbox from 'components/ICheckbox';

const AboutYourFamily = memo(() => {
  const {navigate} = useNavigation<NavigationProp<CreateJobStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['creat_job', 'common']);

  const [dogs, setDogs] = useToggle(true);
  const [cats, setCats] = useToggle(false);
  const [others, setOthers] = useToggle(false);

  const route = useRoute<AboutYourFamilyScreenNavigationProp>();
  const CHILDREN_DATA = route.params.children;
  const [children, setChildren] = React.useState<Array<CreatPostChildren>>([]);

  React.useEffect(() => {
    setChildren([...children, ...CHILDREN_DATA]);
  }, [route.params.children]);

  const RenderChildren = React.useCallback(({item}) => {
    const [active, setActive] = useToggle(item.checked);
    return (
      <Flex mb={24} onPress={setActive}>
        <Flex justify="flex-start" itemsCenter>
          <Icon pack="assets" name="babyActive" style={globalStyle.icon24} />
          <Text bold ml={12}>
            {item.name}
          </Text>
          <Layout style={globalStyle.dot} level="4" />
          <Text mt={4}>{item.typeAge}</Text>
        </Flex>
        <ICheckbox checked={active} title={''} onChange={setActive} />
      </Flex>
    );
  }, []);

  const _onSave = () => {};
  const _onNext = () => {
    navigate('HourlyRate');
  };
  const _onAddChild = () => {
    navigate('AboutYourChild');
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
      <Content padder contentContainerStyle={styles.content}>
        <Text mt={16} category="h7">
          {t('creat_job:step-3-of-7')}
        </Text>
        <Text mt={8} category="h2" bold>
          {t('creat_job:about-your-family')}
        </Text>
        <Text mt={16} category="h8">
          {t('creat_job:about-your-family-title')}
        </Text>
        <Text category="h6" bold mt={40} mb={24}>
          {t('common:children')}
        </Text>
        {children &&
          children.map((item, i) => {
            return <RenderChildren key={i} item={item} />;
          })}
        <Flex justify="flex-start" itemsCenter onPress={_onAddChild}>
          <Icon pack="assets" name="add" style={globalStyle.icon24} />
          <Text status="link" ml={12}>
            {t('creat_job:add-children')}
          </Text>
        </Flex>
        <Text category="h6" bold mb={16} mt={40}>
          {t('common:pets')}
        </Text>
        <IToggle
          onChange={setDogs}
          checked={dogs}
          title={t('creat_job:dogs')}
        />
        <IToggle
          onChange={setCats}
          checked={cats}
          title={t('creat_job:cats')}
          mv={24}
        />
        <IToggle
          onChange={setOthers}
          checked={others}
          title={t('common:others')}
        />
      </Content>
      <IFitBottom title={t('creat_job:set-hourly-rate')} onPress={_onNext} />
    </Container>
  );
});

export default AboutYourFamily;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  containerModal: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  bottom: {
    paddingVertical: 8,
    marginHorizontal: 24,
  },
  name: {
    borderBottomWidth: 1,
  },
});
