import React, {memo} from 'react';
import {View} from 'react-native';
import {
  TopNavigation,
  useTheme,
  StyleService,
  useStyleSheet,
  Icon,
  Input,
  CheckBox,
  Layout,
  Button,
} from '@ui-kitten/components';
import {useNavigation} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import NavigationAction from 'components/NavigationAction';
import {Controller, useForm} from 'react-hook-form';
import Flex from 'components/Flex';
import useToggle from 'hooks/useToggle';
import ISlider from './Component/ISlider';
import {globalStyle} from 'styles/globalStyle';

const WriteReview = memo(() => {
  const {goBack} = useNavigation();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['find', 'common']);

  const [aboutYourSelf, setAboutYourSelf] = React.useState(DATA_COMMENT.length);

  const {
    control,
    handleSubmit,
    getValues,
    formState: {},
  } = useForm({
    defaultValues: {
      aboutYourSelf: DATA_COMMENT,
    },
  });
  const InputField = React.useCallback(() => {
    return (
      <Text
        category="h8"
        status={'placeholder'}
        right
        mt={24}>{`${aboutYourSelf}/500`}</Text>
    );
  }, [aboutYourSelf]);
  const [rehire, setRehire] = useToggle(true);
  const [valuePunctual, setValuePunctual] = React.useState<number | number[]>(
    8,
  );
  const [valueDependable, setValueDependable] = React.useState<
    number | number[]
  >(8.5);
  return (
    <Container style={styles.container}>
      <TopNavigation accessoryLeft={<NavigationAction />} />
      <Content padder>
        <View style={styles.commentContainer}>
          <Icon
            pack="assets"
            name="quote"
            style={{tintColor: theme['color-basic-400']}}
          />
          <Controller
            control={control}
            name="aboutYourSelf"
            render={({field: {onChange, onBlur, value}}) => (
              <Input
                style={styles.comment}
                value={value}
                onTouchStart={handleSubmit(() => {})}
                onTouchEnd={handleSubmit(() => {})}
                onChangeText={text => {
                  onChange(text), setAboutYourSelf(text.length);
                }}
                onBlur={onBlur}
                keyboardType="email-address"
                maxLength={500}
                multiline
                appearance="arena"
                size="large"
                textStyle={styles.textStyle}
              />
            )}
          />
          <InputField />
        </View>
        <View>
          <Text bold>{t('find:will_you_rehire_her')}</Text>
          <Flex mt={24} justify="flex-start">
            <CheckBox
              children={t('common:yes')}
              checked={rehire}
              onChange={setRehire}
              style={styles.checkbox}
            />
            <CheckBox
              children={t('common:no')}
              checked={!rehire}
              onChange={setRehire}
            />
          </Flex>
        </View>
        <View>
          <Text bold mt={40} mb={32}>
            {t('find:punctual')}
          </Text>
          <ISlider
            valueSlider={valuePunctual}
            setValueSlider={setValuePunctual}
            maximumValue={10}
            step={0.5}
          />
        </View>
        <View>
          <Text bold mt={40} mb={32}>
            {t('find:dependable')}
          </Text>
          <ISlider
            valueSlider={valueDependable}
            setValueSlider={setValueDependable}
            maximumValue={10}
            step={0.5}
          />
        </View>
      </Content>
      <Layout style={styles.bottom}>
        <Button
          children={t('find:submit_review')}
          style={globalStyle.shadowBtn}
          onPress={goBack}
        />
      </Layout>
    </Container>
  );
});

export default WriteReview;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  commentContainer: {
    borderBottomWidth: 1,
    borderColor: 'background-basic-color-3',
    paddingBottom: 24,
    marginBottom: 40,
  },
  comment: {
    marginTop: 8,
  },
  textStyle: {
    lineHeight: 24,
  },
  checkbox: {
    marginRight: 48,
  },
  bottom: {
    marginHorizontal: 24,
    paddingVertical: 8,
  },
});
const DATA_COMMENT =
  "Edith was very warm and sweet with our 18 month old. Our daughter didn't cry when I left which was a great sign. She seemed happy and relaxed when I came home. We will definitely use again!";
