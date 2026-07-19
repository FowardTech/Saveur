import React, { memo } from 'react';
import { TouchableOpacity } from 'react-native';
import {
  TopNavigation,
  useTheme,
  StyleService,
  useStyleSheet,
  Icon,
  RangeDatepicker,
  CalendarRange,
  Input,
  Button,
  Layout,
} from '@ui-kitten/components';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import Container from 'components/Container';
import { useTranslation } from 'react-i18next';
import TabBar from 'components/TabBar';
import { globalStyle } from 'styles/globalStyle';
import dayjs from 'dayjs';
import Flex from 'components/Flex';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import SliderDistance from 'src/home/Components/SliderDistance';
import FilterHour from '../Components/FilterHour';
import Totalizator from 'components/Totalizator';
import _ from 'lodash';
import ICheckbox from 'components/ICheckbox';
import useToggle from 'hooks/useToggle';
import NameTagList from './NameTagList';
import { RootStackParamList } from 'navigation/types';

interface FilterProps {
  onHide?(): void;
}

const FavoritesFilter = memo(({ onHide }: FilterProps) => {
  const { goBack, navigate } =
    useNavigation<NavigationProp<RootStackParamList>>();
  const { height, width, top, bottom } = useLayout();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['filter', 'common']);

  // General
  const [babysitter, setBabysitter] = React.useState(0);
  const [gender, setGender] = React.useState(0);
  const [range, setRange] = React.useState<CalendarRange<Date>>({});
  const [valueDistance, setValueDistance] = React.useState<number>(10);
  const [valueHourly, setValueHourly] = React.useState<number>(20);
  const [yearExp, setExp] = React.useState<number>(0);

  // Experience
  const [infant, setInfant] = React.useState<number>(1);
  const [toddler, setToddler] = React.useState<number>(0);
  const [preSchool, setPreSchool] = React.useState<number>(0);
  const [elementary, setElementary] = React.useState<number>(0);
  const [junior, setJunior] = React.useState<number>(0);
  //
  const [asap, setAsap] = useToggle(false);
  const [hasACar, setHasCar] = useToggle(false);
  const [comfortable, setComfortable] = useToggle(false);
  const [provideSickCare, setProvideSickCare] = useToggle(false);
  const [noneSmoking, setNoneSmoking] = useToggle(false);
  const [educated, setEducated] = useToggle(false);
  const [backgroundCheck, setBackgroundCheck] = useToggle(false);

  const [sortBy, setSortBy] = React.useState(0);
  let DATA_EXP_WITH = [t('filter:diabetes'), t('filter:down_syndrome')];
  const DATA_LANGUAGE = ['French', 'English'];

  const _onClear = React.useCallback(() => {}, []);
  const _onLanguage = () => {
    navigate('SelectLanguage');
  };
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      location: 'Manhattan, NY',
      search: '',
    },
  });

  return (
    <Container style={[styles.container]}>
      <TopNavigation
        title={t('filter:title').toString()}
        accessoryLeft={() => (
          <TouchableOpacity activeOpacity={0.54} onPress={goBack}>
            <Icon pack="assets" name="close" />
          </TouchableOpacity>
        )}
        accessoryRight={() => (
          <Text category="h7" status={'link'} bold>
            {t('common:clear')}
          </Text>
        )}
      />
      <KeyboardAwareScrollView
        scrollEventThrottle={16}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text category="h2" mb={16} bold>
          {t('filter:general')}
        </Text>
        <Text category="h7" mb={24} bold>
          {t('filter:type_of_care')}
        </Text>
        <TabBar
          selectedIndex={babysitter}
          onChange={setBabysitter}
          tabs={[t('filter:babysitter'), t('filter:nanny')]}
        />
        <Text category="h7" mb={24} bold mt={40}>
          {t('filter:available_on')}
        </Text>
        <RangeDatepicker
          range={range}
          label={t('filter:from_to')}
          placeholder={undefined}
          status="range"
          accessoryLeft={props => {
            return (
              <Flex>
                <Icon pack="assets" name="calendar" {...props} />
                <Text
                  ml={12}
                  category="h7"
                  bold
                  children={`${dayjs(range.startDate).format(
                    'MMM DD',
                  )} - ${dayjs(range.endDate).format('MMM DD YYYY')}`}
                />
              </Flex>
            );
          }}
          onSelect={nextRange => setRange(nextRange)}
        />
        <Text category="h7" bold mt={40} mb={26}>
          {t('common:gender')}
        </Text>
        <TabBar
          selectedIndex={gender}
          onChange={setGender}
          tabs={[t('common:all'), t('common:male'), t('common:female')]}
        />
        <Controller
          control={control}
          name="location"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label={t('common:location').toString()}
              status={errors.location ? 'warning' : 'basic'}
              style={styles.location}
              allowFontScaling
              value={value}
              onTouchStart={handleSubmit(() => {})}
              onTouchEnd={handleSubmit(() => {})}
              onChangeText={onChange}
              onBlur={onBlur}
              keyboardType="email-address"
              caption={errors.location?.message}
              accessoryLeft={() => (
                <Icon pack="assets" name="search" style={styles.iconSearch} />
              )}
            />
          )}
        />
        <Text category="h7" mb={24} bold mt={40}>
          {t('common:distance')}
        </Text>
        <SliderDistance
          valueSlider={valueDistance}
          setValueSlider={setValueDistance}
        />
        <Text category="h7" mb={24} bold mt={32}>
          {t('filter:under_this_amount_per_hour')}
        </Text>
        <FilterHour valueSlider={valueHourly} setValueSlider={setValueHourly} />

        <Text category="h2" mb={24} bold mt={56}>
          {t('common:experience')}
        </Text>
        <Text category="h8-s" mb={16}>
          {t('filter:minimum_yrs_exp')}
        </Text>
        <TabBar
          selectedIndex={yearExp}
          onChange={setExp}
          tabs={[t('common:any'), '3+', '5+', '7+']}
        />
        <Text category="h7" bold mb={24} mt={40}>
          {t('filter:able_to_care_for')}
        </Text>
        <Totalizator
          title={t('filter:infant')}
          label={t('filter:infant_age')}
          value={infant}
          setValue={setInfant}
          style={styles.totalizator}
        />
        <Totalizator
          title={t('filter:toddler')}
          label={t('filter:toddler_age')}
          value={toddler}
          setValue={setToddler}
          style={styles.totalizator}
        />
        <Totalizator
          title={t('filter:pre_school')}
          label={t('filter:pre_school_age')}
          value={preSchool}
          setValue={setPreSchool}
          style={styles.totalizator}
        />
        <Totalizator
          title={t('filter:elementary')}
          label={t('filter:elementary_age')}
          value={elementary}
          setValue={setElementary}
          style={styles.totalizator}
        />
        <Totalizator
          title={t('filter:junior_high')}
          label={t('filter:junior_high_age')}
          value={junior}
          setValue={setJunior}
          style={styles.totalizator}
        />
        <NameTagList
          mt={40}
          data={DATA_EXP_WITH}
          title={t('filter:experience_with')}
        />
        <Text category="h2" mb={24} bold mt={56}>
          {t('filter:qualifications')}
        </Text>
        <ICheckbox
          title={t('filter:available_asap')}
          checked={asap}
          onChange={setAsap}
          marginBottom={24}
        />
        <ICheckbox
          title={t('filter:has_a_car')}
          checked={hasACar}
          onChange={setHasCar}
          marginBottom={24}
        />
        <ICheckbox
          title={t('filter:comfortable_with_pets')}
          checked={comfortable}
          onChange={setComfortable}
          marginBottom={24}
        />
        <ICheckbox
          title={t('filter:will_provide_sick_care')}
          checked={provideSickCare}
          onChange={setProvideSickCare}
          marginBottom={24}
        />
        <ICheckbox
          title={t('filter:none_smoking')}
          checked={noneSmoking}
          onChange={setNoneSmoking}
          marginBottom={24}
        />
        <ICheckbox
          title={t('filter:college_educated')}
          checked={educated}
          onChange={setEducated}
          marginBottom={24}
        />
        <ICheckbox
          title={t('filter:background_check')}
          checked={backgroundCheck}
          onChange={setBackgroundCheck}
          marginBottom={24}
        />
        <Text category="h2" bold mt={32}>
          {t('common:others')}
        </Text>
        <NameTagList
          onSeeAll={_onLanguage}
          mt={24}
          data={DATA_LANGUAGE}
          title={t('common:language')}
          mb={32}
        />
        <Controller
          control={control}
          name="search"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              status={errors.search ? 'warning' : 'basic'}
              style={globalStyle.shadowFade}
              value={value}
              placeholder={t('common:enter_something')}
              appearance="primary"
              size={'large'}
              onTouchStart={handleSubmit(() => {})}
              onTouchEnd={handleSubmit(() => {})}
              onChangeText={onChange}
              onBlur={onBlur}
              keyboardType="email-address"
              accessoryLeft={() => (
                <Icon pack="assets" name="search" style={styles.iconSearch} />
              )}
            />
          )}
        />
        <Text category="h7" bold mb={24} mt={40}>
          {t('common:sort_by')}
        </Text>
        <TabBar
          selectedIndex={sortBy}
          onChange={setSortBy}
          tabs={[
            t('filter:best_match'),
            t('filter:closest'),
            t('filter:lowest_rate'),
          ]}
        />
      </KeyboardAwareScrollView>
      <Layout
        style={[
          styles.bottom,
          {
            marginBottom: 8 + bottom,
          },
        ]}
      >
        <Button children={'See 69+ Caregivers'} style={globalStyle.shadowBtn} />
      </Layout>
    </Container>
  );
});

export default FavoritesFilter;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingBottom: 0,
  },
  content: {
    marginHorizontal: 24,
    paddingBottom: 40,
  },
  date: {},
  location: {
    marginTop: 48,
    borderBottomWidth: 2,
  },
  iconSearch: {
    tintColor: 'text-placeholder-color',
    marginRight: 12,
  },
  totalizator: {
    marginBottom: 24,
  },
  bottom: {
    marginHorizontal: 24,
    marginTop: 8,
  },
});
