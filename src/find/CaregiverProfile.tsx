import React, { memo } from 'react';
import { View, Modal } from 'react-native';
import {
  StyleService,
  useStyleSheet,
  Avatar,
  Layout,
  Button,
  ViewPager,
} from '@ui-kitten/components';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import useLayout from 'hooks/useLayout';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Container from 'components/Container';
import { RootStackParamList } from 'navigation/types';
import { Images } from 'assets/images';
import FocusAwareStatusBar from 'components/FocusAwareStatusBar';
import { globalStyle } from 'styles/globalStyle';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import Personal from './Component/Personal';
import { MY_FAVORITES, MY_RECOMMENDED } from 'constants/Data';
import BasicTabBar from 'components/BasicTabBar';
import AnimationHeader from './Component/AnimationHeader';
import Summary from './Summary/Summary';
import OnlStatus from 'components/OnlStatus';
import { Onl_State_Types_Enum } from 'constants/Types';
import ModalOption from './Component/ModalOption';
import CoverList from './Component/CoverList';
import Calendar from './Calendar/Calendar';
import ReviewTitle from './Component/ReviewTitle';
import Reviews from './Reviews';
import useToggle from 'hooks/useToggle';

const CaregiverProfile = memo(() => {
  const { navigate, goBack } =
    useNavigation<NavigationProp<RootStackParamList>>();
  const { height, width, top, bottom } = useLayout();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['find', 'common']);
  let DATA_USER = {
    ...MY_FAVORITES[4],
    about:
      'FULL OF FUN!! I am high energy, and enjoy keeping up with the day to day adventures that children bring! I was a nanny for over 6 years and then decided to further my career in Early Childhood',
  };

  const translationY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler(
    event => (translationY.value = event.contentOffset.y),
  );

  const [activeTab, setActiveTab] = React.useState(2);
  const [showOption, setShowOption] = React.useState(false);
  const [showContact, setShowContact] = React.useState(false);

  const [firstTimeContact, setFirstTime] = useToggle(true);
  const _onContact = React.useCallback(() => {
    setShowContact(true);
  }, []);

  const _onSendMessage = () => {};
  const _onRequestInterview = () => {
    navigate('RequestStack', { screen: 'RequestInterview' });
  };
  const _onBookingRequest = () => {
    navigate('RequestStack', { screen: 'BookingRequest' });
  };
  const _addFavorites = () => {};
  const _shareTo = () => {};
  const _onReport = () => {};

  const layoutStyle = React.useMemo(
    () => ({
      marginTop: (280 + top) * (height / 812),
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    }),
    [top, height],
  );

  const tabRendering = (i: number) => {
    switch (i) {
      case 0:
        return (
          <Summary
            about_me={DATA_USER.about}
            tag_about_me={[
              'Accepts credit cards',
              'Booked by 9 repeat families',
              '56 bookings',
              'Responds in 4 hours to booking',
            ]}
          />
        );
      case 1:
        return <Calendar />;
      case 2:
        return <Reviews />;
      default:
        return null;
    }
  };
  return (
    <Container style={styles.container} level="2">
      <FocusAwareStatusBar barStyle={'dark-content'} />
      {/* Header Animation */}
      <AnimationHeader
        animationValue={translationY}
        selectedTab={activeTab}
        setSelectedTab={setActiveTab}
        tabs={[t('find:summary'), t('find:calendar'), t('find:reviews')]}
        user={MY_RECOMMENDED[1]}
      />
      {/* Content */}
      <Animated.ScrollView
        scrollEventThrottle={1}
        onScroll={scrollHandler}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Layout style={styles.headerContent}>
          <CoverList list={DATA_COVER} />
          <Layout style={layoutStyle}>
            <View style={styles.avatar}>
              <Avatar source={DATA_USER.avatar} size="giant" shape="rounded" />
              <OnlStatus status={Onl_State_Types_Enum.JustLeave} />
            </View>
            <Personal
              user={DATA_USER}
              trustedFamily
              carePro
              mt={24}
              mb={32}
              moreInformation={true}
            />
            <BasicTabBar
              onChange={setActiveTab}
              activeIndex={activeTab}
              style={styles.tabBar}
              tabs={[t('find:summary'), t('find:calendar'), t('find:reviews')]}
            />
          </Layout>
        </Layout>
        {tabRendering(activeTab)}
      </Animated.ScrollView>
      {/* Bottom */}
      <Layout
        level={'2'}
        style={[styles.bottom, { paddingBottom: bottom + 8 }]}
      >
        <View>
          <Text category="h3" bold>
            $15-$20/hr
          </Text>
          <ReviewTitle rate={4.86} reviews={256} />
        </View>
        <Button
          children={t('find:contact_her').toString()}
          style={styles.contact}
          onPress={_onContact}
        />
      </Layout>
      {/* Modal Option */}
      <Modal
        visible={showOption}
        transparent
        style={[
          styles.modal,
          {
            paddingBottom: bottom + 16,
          },
        ]}
      >
        <ModalOption
          onHide={() => setShowOption(false)}
          children={[
            {
              title: t('find:add_to_favorites'),
              onPress: _addFavorites,
              status: 'basic',
            },
            {
              title: t('find:share_to'),
              onPress: _shareTo,
              status: 'basic',
            },
            {
              title: t('find:report'),
              onPress: _onReport,
              status: 'danger',
            },
          ]}
        />
      </Modal>
      <Modal
        style={[
          styles.modal,
          {
            paddingBottom: bottom + 16,
          },
        ]}
        visible={showContact}
        transparent
      >
        {firstTimeContact ? (
          <ModalOption
            onHide={() => {
              setShowContact(false);
              setFirstTime();
            }}
            children={[
              {
                title: t('find:request_an_interview'),
                onPress: () => {
                  _onRequestInterview();
                  setShowContact(false);
                },
                status: 'basic',
              },
              {
                title: t('find:send_a_message'),
                onPress: _onSendMessage,
                status: 'basic',
              },
            ]}
          />
        ) : (
          <ModalOption
            onHide={() => {
              setShowContact(false);
              setFirstTime();
            }}
            children={[
              {
                title: t('find:request_an_booking'),
                onPress: () => {
                  _onBookingRequest();
                  setShowContact(false);
                },
                status: 'basic',
              },
              {
                title: t('find:send_a_message'),
                onPress: _onSendMessage,
                status: 'basic',
              },
            ]}
          />
        )}
      </Modal>
    </Container>
  );
});

export default CaregiverProfile;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingBottom: 0,
    paddingTop: 0,
  },
  content: {
    paddingBottom: 120,
    backgroundColor: 'background-basic-color-2',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  bottom: {
    ...globalStyle.topBorder16,
    paddingTop: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    ...globalStyle.shadowFade,
  },
  tabBar: {
    marginHorizontal: 12,
  },
  headerContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginBottom: 40,
    ...globalStyle.shadowFade,
    paddingBottom: 12,
  },
  contact: {
    paddingHorizontal: 12,
    ...globalStyle.shadowBtn,
  },
  avatar: {
    alignSelf: 'center',
    marginTop: -48,
  },
  modal: {
    justifyContent: 'flex-end',
    flex: 1,
    height: '100%',
  },
});
export const DATA_COVER = [Images.cover, Images.cover1, Images.cover2];
