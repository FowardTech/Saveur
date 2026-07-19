import React, {memo} from 'react';
import {FlatList, TouchableOpacity} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Button,
  Icon,
} from '@ui-kitten/components';
import {useNavigation} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';
import i18n from 'i18next';

import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import keyExtractor from 'utils/keyExtractor';
import {globalStyle} from 'styles/globalStyle';
import ICheckbox from 'components/ICheckbox';

// Real language switching (see i18n/config.ts) — only the two locales that
// actually have translations wired up are listed (rather than a long list
// of fake/unsupported languages) so picking one genuinely re-renders the
// app in that language via i18next's `changeLanguage`.
const LANGUAGES: Array<{name: string; code: string}> = [
  {name: 'English', code: 'en'},
  {name: 'Español (Spanish)', code: 'es'},
];

const SelectLanguage = memo(() => {
  const {goBack} = useNavigation();
  const {bottom} = useLayout();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['filter', 'common']);

  const [selectedCode, setSelectedCode] = React.useState(i18n.language?.startsWith('es') ? 'es' : 'en');

  const onSelect = (code: string) => {
    setSelectedCode(code);
    i18n.changeLanguage(code);
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('common:language')}
        accessoryLeft={
          <TouchableOpacity activeOpacity={0.54} onPress={goBack}>
            <Icon pack="assets" name="close" />
          </TouchableOpacity>
        }
      />
      <FlatList
        data={LANGUAGES}
        contentContainerStyle={styles.content}
        scrollEventThrottle={16}
        renderItem={({item}) => {
          return (
            <ICheckbox
              style={styles.checkbox}
              title={item.name}
              checked={item.code === selectedCode}
              onChange={() => onSelect(item.code)}
            />
          );
        }}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
      />
      <Button
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
