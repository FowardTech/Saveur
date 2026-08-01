import React, {memo} from 'react';
import {FlatList, TouchableOpacity} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Button,
  Icon,
} from '@ui-kitten/components';
import {useNavigation} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';
import i18n from 'i18next';

import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import {globalStyle} from 'styles/globalStyle';
import ICheckbox from 'components/ICheckbox';
import {SUPPORTED_LANGUAGES} from 'constants/languages';
import {AuthContext} from '../../../AuthContext';
import CtaButton from 'components/CtaButton';

// Real language switching (see i18n/config.ts) — SUPPORTED_LANGUAGES
// (constants/languages.ts) only lists locales that actually have full
// translations wired up, shared with the signup language picker
// (src/auth/Signup/SignupFirstStep.tsx) so both pickers can never drift out
// of sync with each other.
const SelectLanguage = memo(() => {
  const {goBack} = useNavigation();
  const {bottom} = useLayout();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['filter', 'common']);
  const {updateProfile} = React.useContext(AuthContext);

  const [selectedCode, setSelectedCode] = React.useState(i18n.language?.startsWith('es') ? 'es' : 'en');

  // Switches the app's UI text immediately (i18next), and separately
  // persists the choice to the account (PATCH /api/users/me `locale` — see
  // services/authService.ts) so it's what a) drives the AI coach's TTS
  // voice (services/speechService.ts) and b) follows the user to a new
  // device / after a reinstall (AuthContext.tsx's syncLanguageFromProfile).
  // Fire-and-forget: a failed PATCH shouldn't block the (already-instant)
  // local language switch — it'll just re-sync next time the profile is
  // fetched/updated successfully.
  const onSelect = (code: string) => {
    setSelectedCode(code);
    i18n.changeLanguage(code);
    updateProfile({locale: code}).catch(() => {});
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('common:language')}
        accessoryLeft={
          <TouchableOpacity activeOpacity={0.54} onPress={goBack}>
            {/* Was pack="assets" name="close" -- a raster PNG (ic_close.png)
                with a baked-in fixed dark navy color that can never adapt to
                theme, invisible against this header's dark background in
                dark mode. Switched to the eva icon pack (like every other
                close button in the app) with an explicit theme-aware
                tintColor. */}
            <Icon pack="eva" name="close-outline" style={[globalStyle.icon24, {tintColor: theme['text-basic-color']}]} />
          </TouchableOpacity>
        }
      />
      <FlatList
        data={SUPPORTED_LANGUAGES}
        contentContainerStyle={styles.content}
        scrollEventThrottle={16}
        renderItem={({item}) => {
          return (
            <ICheckbox
              style={styles.checkbox}
              title={`${item.nativeLabel} (${item.label})`}
              checked={item.code === selectedCode}
              onChange={() => onSelect(item.code)}
            />
          );
        }}
        keyExtractor={item => item.code}
        showsVerticalScrollIndicator={false}
      />
      <CtaButton
        children={t('common:ok')}
        style={[styles.button, {bottom: bottom + 8}]}
        onPress={goBack}
      />
    </Container>
  );
});

export default SelectLanguage;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingBottom: 0,
  },
  content: {
    paddingTop: 40,
    paddingBottom: 120,
  },
  button: {
    position: 'absolute',
    left: 24,
    right: 24,
    ...globalStyle.shadowBtn,
  },
  checkbox: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
});
