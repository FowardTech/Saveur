import React, {memo} from 'react';
import {StyleService, useStyleSheet, Layout, Icon} from '@ui-kitten/components';

import Text from 'components/Text';
import {useTranslation} from 'react-i18next';
import TitleStep from 'components/TitleStep';
import {CreatPostChildren} from 'constants/Types';
import RenderChildren from 'components/RenderChildren';
import Flex from 'components/Flex';
import {globalStyle} from 'styles/globalStyle';
import IToggle from 'components/IToggle';
import useToggle from 'hooks/useToggle';

const AboutFamily = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['request', 'creat_job', 'common']);

  const [children, setChildren] =
    React.useState<Array<CreatPostChildren>>(DATA);
  const [dogs, setDogs] = useToggle(true);
  const [cats, setCats] = useToggle(false);
  const [others, setOthers] = useToggle(false);

  const _onAddChild = () => {};
  return (
    <Layout style={styles.container}>
      <TitleStep
        step={2}
        totalStep={4}
        title={t('creat_job:about-your-family')}
        description={t('request:about-family-des')}
        style={styles.step}
      />
      <Text category="h6" bold mt={40} mb={24}>
        {t('common:children')}
      </Text>
      {children &&
        children.map((item, i) => {
          return (
            <RenderChildren
              key={i}
              typeAge={item.typeAge}
              checked={item.checked}
              name={item.name}
            />
          );
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
      <IToggle onChange={setDogs} checked={dogs} title={t('creat_job:dogs')} />
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
    </Layout>
  );
});

export default AboutFamily;

const themedStyles = StyleService.create({
  container: {
    paddingHorizontal: 24,
  },
  step: {
    marginTop: 16,
  },
});

const DATA = [{name: 'John', typeAge: 'Toddle', checked: true}];
