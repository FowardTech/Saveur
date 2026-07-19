import React, {memo} from 'react';
import {View, Animated, TouchableOpacity} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Icon,
  CheckBox,
  Layout,
  Button,
} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import NavigationAction from 'components/NavigationAction';
import EmptyCard from './EmptyCard';
import {isEmpty} from 'lodash';
import {DATA_PAYMENT} from 'constants/Data';
import {RectButton, Swipeable} from 'react-native-gesture-handler';
import {globalStyle} from 'styles/globalStyle';
import Flex from 'components/Flex';
import {RootStackParamList} from 'navigation/types';

const SelectCard = memo(() => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const {width} = useLayout();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['payment', 'success', 'common']);

  const [active, setActive] = React.useState(0);
  const [dataCard, setDataCard] = React.useState([1]);

  const AnimatedView = Animated.createAnimatedComponent(View);
  const refSwipeable = React.useRef<Swipeable>(null);

  const onAdd = () => navigate('AddMorePayment');

  const _onPay = React.useCallback(() => {
    navigate('SuccessScr', {
      successScr: {
        title: t('success:payment-successful'),
        description: t('success:payment-successful-title'),
        children: [
          {
            title: t('success:see_your_dashboard'),
            onPress: () => navigate('MainBottomTab'),
            status: 'basic',
          },
        ],
        buttonsViewStyle: {marginHorizontal: 68},
      },
    });
  }, []);

  const widthAction = 75 * (width / 375);
  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation,
    dragX: Animated.AnimatedInterpolation,
  ) => {
    const scaleDelete = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
    const scaleEdit = dragX.interpolate({
      inputRange: [-110, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
    return (
      <>
        <RectButton style={[{width: widthAction}]} onPress={() => {}}>
          <AnimatedView
            style={[{transform: [{scale: scaleDelete}]}, styles.deleteAction]}>
            <Text category="h6" status={'primary'}>
              {t('common:delete')}
            </Text>
          </AnimatedView>
        </RectButton>
        <RectButton
          style={[{width: widthAction}]}
          onPress={() => {}}
          activeOpacity={0.54}>
          <AnimatedView
            style={[{transform: [{scale: scaleEdit}]}, styles.editAction]}>
            <Text category="h6" status={'primary'}>
              {t('common:edit')}
            </Text>
          </AnimatedView>
        </RectButton>
      </>
    );
  };
  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('payment:select-card')}
        accessoryLeft={<NavigationAction />}
        accessoryRight={
          <NavigationAction
            icon="plusImg"
            size="small"
            onPress={onAdd}
            marginRight={4}
          />
        }
      />
      {isEmpty(dataCard) ? (
        <EmptyCard />
      ) : (
        <Content style={styles.content}>
          {DATA_PAYMENT.map((item, i) => {
            return (
              <TouchableOpacity
                onPress={() => setActive(i)}
                key={i}
                style={styles.item}
                activeOpacity={0.54}>
                <Swipeable
                  key={i}
                  ref={refSwipeable}
                  friction={2}
                  enableTrackpadTwoFingerGesture
                  rightThreshold={50}
                  renderRightActions={renderRightActions}>
                  <Flex
                    level="2"
                    pv={24}
                    ml={24}
                    padder
                    justify="flex-start"
                    border={12}>
                    <CheckBox
                      checked={active === i}
                      onChange={() => setActive(i)}
                    />
                    <Icon
                      pack="assets"
                      name="master"
                      style={styles.iconLogoBank}
                    />
                    <View>
                      <Text category="h6">{item.nameCard}</Text>
                      <Text category="h8" mt={8} status="placeholder">
                        xxxx - xxxx - xxxx - {item.last4number}
                      </Text>
                    </View>
                  </Flex>
                </Swipeable>
              </TouchableOpacity>
            );
          })}
        </Content>
      )}
      <Layout style={styles.bottom}>
        <Button
          children={t('payment:pay-now')}
          style={globalStyle.shadowBtn}
          onPress={_onPay}
          accessoryLeft={() => {
            return (
              <Icon pack="assets" name="security" style={globalStyle.icon16} />
            );
          }}
        />
      </Layout>
    </Container>
  );
});

export default SelectCard;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  deleteAction: {
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: 'text-danger-color',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAction: {
    backgroundColor: 'text-warning-color',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: {
    ...globalStyle.shadow,
    marginBottom: 24,
    borderRadius: 12,
    marginRight: 24,
  },
  iconLogoBank: {
    width: 48,
    height: 48,
    alignSelf: 'center',
    marginHorizontal: 16,
  },
  content: {
    paddingTop: 32,
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
});
