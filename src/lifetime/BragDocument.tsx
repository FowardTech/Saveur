import React from 'react';
import {Alert, TouchableOpacity, View} from 'react-native';
import {Icon, useTheme} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import {globalStyle} from 'styles/globalStyle';
import * as svc from 'services/lifetimeService';
import {LifetimeScreen, Card, Loading, PrimaryButton, Pill, useAsyncAction} from './Scaffold';

const BragDocument = () => {
  const {t} = useTranslation(['more', 'common']);
  const theme = useTheme();
  const {busy, run} = useAsyncAction(t);
  const [items, setItems] = React.useState<svc.BragItem[] | null>(null);

  const load = React.useCallback(async () => {
    try {
      setItems(await svc.getBrag());
    } catch {
      setItems([]);
    }
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);

  const generate = () =>
    run(async () => {
      await svc.generateBrag();
      await load();
    });
  const apply = () =>
    run(async () => {
      const n = await svc.applyBragToResume();
      await load();
      Alert.alert(
        String(t('more:lt_brag_applied_title', {defaultValue: 'Resume updated'})),
        n > 0
          ? String(t('more:lt_brag_applied_body', {defaultValue: '{{count}} achievements were added to your resume.', count: n}))
          : String(t('more:lt_brag_nothing_new', {defaultValue: 'Everything is already on your resume.'})),
      );
    });
  const remove = (id: number) =>
    run(async () => {
      await svc.deleteBrag(id);
      await load();
    });

  const pending = (items ?? []).filter(i => !i.applied_to_resume).length;

  return (
    <LifetimeScreen title={t('more:lt_brag_title', {defaultValue: 'Brag Document'})}>
      <Text category="h9-s" status="placeholder" mb={12}>
        {t('more:lt_brag_intro', {
          defaultValue: 'Turns your Career Diary into promotion-ready achievements you can paste into reviews and your resume.',
        })}
      </Text>
      <PrimaryButton label={t('more:lt_brag_generate', {defaultValue: 'Build from my diary'})} loading={busy} onPress={generate} style={{marginBottom: 8}} />
      {pending > 0 ? (
        <PrimaryButton
          label={t('more:lt_brag_apply', {defaultValue: 'Add {{count}} to my resume', count: pending})}
          loading={busy}
          onPress={apply}
          style={{marginBottom: 12}}
        />
      ) : null}
      {!items ? (
        <Loading />
      ) : items.length === 0 ? (
        <Text category="h9-s" status="placeholder" center mt={24}>
          {t('more:lt_brag_empty', {defaultValue: 'No achievements yet. Log what you did in your Career Diary, then build your brag document.'})}
        </Text>
      ) : (
        items.map(i => (
          <Card key={i.id}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'}}>
              <Text category="h8" bold style={{flex: 1, marginRight: 8}}>
                {i.title}
              </Text>
              <TouchableOpacity onPress={() => remove(i.id)} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                <Icon pack="eva" name="trash-2-outline" style={[globalStyle.icon20, {tintColor: theme['text-hint-color']}]} />
              </TouchableOpacity>
            </View>
            <Text category="h9" mt={6} style={{lineHeight: 22}}>
              {i.bullet}
            </Text>
            {i.impact ? (
              <Text category="h9-s" status="placeholder" mt={6}>
                {i.impact}
              </Text>
            ) : null}
            <View style={{flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, alignItems: 'center'}}>
              {i.skills.map(s => (
                <View key={s} style={{marginRight: 6, marginBottom: 4}}>
                  <Pill label={s} />
                </View>
              ))}
              {i.applied_to_resume ? <Pill label={t('more:lt_on_resume', {defaultValue: 'On resume'})} color="#19B87A" /> : null}
            </View>
          </Card>
        ))
      )}
    </LifetimeScreen>
  );
};

export default BragDocument;
