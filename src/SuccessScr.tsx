import React, {memo} from 'react';
import {useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {ModalScreenNavigationProp} from 'navigation/types';
import NotificationScreen from 'components/NotificationScreen';

const SuccessScr = memo(() => {
  const route = useRoute<ModalScreenNavigationProp>();
  const {t} = useTranslation(['common']);
  // Fallback-only copy, used if a screen ever navigates here without
  // explicit successScr params (every known call site today supplies its
  // own already-translated title/description). Was hardcoded English —
  // wrapped in t() as a safety net so it doesn't silently ignore the app's
  // language if that ever happens.
  const initValue = {
    goBack: true,
    title: t('common:oops_title', {defaultValue: 'Oops!'}),
    description: t('common:generic_error_retry', {
      defaultValue: 'Something went wrong somewhere.\nWould you like to try again?',
    }),
    children: [],
    logo: false,
  };
  const {title, description, children, buttonsViewStyle, logo} =
    route?.params?.successScr || initValue;

  return (
    <NotificationScreen
      title={title}
      description={description}
      children={children}
      buttonsViewStyle={buttonsViewStyle}
      logo={logo}
    />
  );
});

export default SuccessScr;
