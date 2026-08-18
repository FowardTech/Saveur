import React, { memo } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Button,
  Input,
  Icon,
} from '@ui-kitten/components';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import EmptyState from 'components/EmptyState';
import { SkeletonList } from 'components/Skeleton';
import { globalStyle } from 'styles/globalStyle';
import * as careerDiaryService from 'services/careerDiaryService';
import { CareerDiaryEntry, DiaryCategory } from 'services/careerDiaryService';
import CtaButton from 'components/CtaButton';

const CATEGORY_KEYS: DiaryCategory[] = ['did', 'learned', 'achieved'];

// `t` is passed in rather than called via a hook here since this is a plain
// module-scope function (outside the component, so no hooks allowed) —
// callers (the component below) already have `t` from useTranslation.
function categoryLabel(key: DiaryCategory, t: (k: string, o?: any) => string): string {
  const defaults: Record<DiaryCategory, string> = { did: 'Did', learned: 'Learned', achieved: 'Achieved' };
  return t(`more:career_diary_category_${key}`, { defaultValue: defaults[key] });
}

function formatDateHeader(dateStr: string, t: (k: string, o?: any) => string): string {
  if (!dateStr) return '';
  const today = new Date();
  const d = new Date(`${dateStr}T00:00:00`);
  const isToday = d.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isToday) return t('more:today', { defaultValue: 'Today' });
  if (d.toDateString() === yesterday.toDateString()) return t('more:yesterday', { defaultValue: 'Yesterday' });
  // BUG FIX (product report: "a lot of things in this app are not auto
  // translated") — `undefined` locale falls back to the device's system
  // locale rather than the language picked inside the app. `i18n.language`
  // (the shared i18next singleton, imported directly since this is a
  // standalone helper outside the component) is the correct app-selected
  // locale to format with, same fix as UpcomingSessionHomeCard.tsx.
  return d.toLocaleDateString(i18n.language, { weekday: 'short', month: 'short', day: 'numeric' });
}

// Career Diary — a plain journal for logging what the user did, learned, or
// achieved day-to-day regarding a role, career, or job. Real backend CRUD
// (services/careerDiaryService.ts, app/api/career_diary.py) — no AI
// involved here; this is the user's own record, kept simple by design.
const CareerDiary = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common']);

  const [entries, setEntries] = React.useState<CareerDiaryEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [text, setText] = React.useState('');
  const [role, setRole] = React.useState('');
  const [category, setCategory] = React.useState<DiaryCategory | undefined>(undefined);
  const [isSaving, setIsSaving] = React.useState(false);
  // Product request: "the form in the career diary too has to be a bottom
  // sheet" — same Modal + KeyboardAvoidingView + rounded Layout pattern as
  // DreamCompanies.tsx / JobAlerts.tsx / NetworkingAssistant.tsx, all
  // converted from an always-open inline card the same way.
  const [showComposer, setShowComposer] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const items = await careerDiaryService.listEntries();
      setEntries(items);
    } catch (e: any) {
      setLoadError(e?.message ?? t('more:career_diary_load_failed', {defaultValue: 'Could not load your Career Diary.'}));
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const onAdd = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSaving) return;
    setIsSaving(true);
    try {
      const entry = await careerDiaryService.createEntry({
        text: trimmed,
        category,
        role: role.trim() || undefined,
      });
      setEntries(prev => [entry, ...prev]);
      setText('');
      setRole('');
      setCategory(undefined);
      setShowComposer(false);
    } catch (e: any) {
      Alert.alert(
        t('more:career_diary_save_failed_title', {defaultValue: "Couldn't save that entry"}),
        e?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = (entry: CareerDiaryEntry) => {
    Alert.alert(
      t('more:career_diary_delete_confirm_title', {defaultValue: 'Delete entry?'}),
      t('more:career_diary_delete_confirm_body', {defaultValue: 'This cannot be undone.'}),
      [
      { text: t('common:cancel', {defaultValue: 'Cancel'}), style: 'cancel' },
      {
        text: t('common:delete', {defaultValue: 'Delete'}),
        style: 'destructive',
        onPress: async () => {
          setEntries(prev => prev.filter(e => e.id !== entry.id));
          try {
            await careerDiaryService.deleteEntry(entry.id);
          } catch {
            // Best-effort local removal already happened; a full reload
            // will restore it if the delete genuinely failed server-side.
            load();
          }
        },
      },
    ]);
  };

  // Group by entryDate for date-header rendering, preserving the
  // already-sorted (most-recent-first) order from the API.
  const groups: { date: string; items: CareerDiaryEntry[] }[] = [];
  entries.forEach(entry => {
    const last = groups[groups.length - 1];
    if (last && last.date === entry.entryDate) {
      last.items.push(entry);
    } else {
      groups.push({ date: entry.entryDate, items: [entry] });
    }
  });

  return (
    <Container style={styles.container}>
      <TopNavigation title={t('more:career_diary', {defaultValue: 'Career Diary'})} accessoryLeft={<NavigationAction />} />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        <Text category="h9-s" status="placeholder" mb={20}>
          {t('more:career_diary_description', {
            defaultValue:
              'Log what you did, learned, or achieved today regarding a role, career, or job — a running record you can look back on.',
          })}
        </Text>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.addTrigger}
          onPress={() => setShowComposer(true)}>
          {/* REVERTED (product ask: "remove the backgrounds from the
              icons... give the icons themselves the platform blue") --
              this cycled through a color-primary-transparent-100 tint
              circle and a GradientIconBadge; no badge/background now,
              plain plus glyph tinted platform blue (#0063f8) directly. */}
          <Icon pack="eva" name="plus-outline" style={[globalStyle.icon20, { tintColor: '#0063f8' }]} />
          <Text category="h9" bold style={globalStyle.flexOne} ml={12}>
            {t('more:career_diary_add_entry', {defaultValue: 'Add Entry'})}
          </Text>
          <Icon pack="eva" name="arrow-forward-outline" style={[globalStyle.icon16, { tintColor: theme['text-hint-color'] }]} />
        </TouchableOpacity>

        <Modal visible={showComposer} transparent animationType="slide" onRequestClose={() => setShowComposer(false)}>
          <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Layout level="1" style={styles.modalSheet}>
              {/* Product request: "all bottom sheets should have a close
                  button" -- see NetworkingAssistant.tsx's identical fix for
                  the fuller reasoning; same header-row treatment here. */}
              <Flex justify="space-between" itemsCenter mb={16}>
                <Text category="h7" bold>
                  {t('more:career_diary_add_entry', {defaultValue: 'Add Entry'})}
                </Text>
                <TouchableOpacity onPress={() => setShowComposer(false)} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                  <Icon pack="eva" name="close-outline" style={[globalStyle.icon24, {tintColor: theme['text-basic-color']}]} />
                </TouchableOpacity>
              </Flex>
              <Input
                multiline
                placeholder={t('more:career_diary_composer_placeholder', {defaultValue: 'What did you do, learn, or achieve today?'})}
                value={text}
                onChangeText={setText}
                style={styles.textInput}
                textStyle={[globalStyle.inputText, styles.textInputInner]}
              />
              <Flex justify="flex-start" mt={12} mb={12}>
                {CATEGORY_KEYS.map(key => {
                  const active = category === key;
                  return (
                    <Text
                      key={key}
                      category="h10"
                      bold
                      status={active ? 'control' : 'basic'}
                      onPress={() => setCategory(active ? undefined : key)}
                      style={[
                        styles.categoryPill,
                        { backgroundColor: active ? theme['color-primary-500'] : theme['background-basic-color-3'] },
                      ]}>
                      {categoryLabel(key, t)}
                    </Text>
                  );
                })}
              </Flex>
              <Input
                placeholder={t('more:career_diary_role_placeholder', {defaultValue: 'Role / career / job (optional)'})}
                value={role}
                onChangeText={setRole}
                style={styles.roleInput}
                textStyle={globalStyle.inputText}
              />
              <CtaButton
                disabled={!text.trim() || isSaving}
                onPress={onAdd}
                style={{ marginTop: 12 }}>
                {isSaving ? t('more:career_diary_saving', {defaultValue: 'Saving…'}) : t('more:career_diary_add_entry', {defaultValue: 'Add Entry'})}
              </CtaButton>
              <Button appearance="outline" style={{ marginTop: 12 }} onPress={() => setShowComposer(false)}>
                {t('common:cancel', {defaultValue: 'Cancel'})}
              </Button>
            </Layout>
          </KeyboardAvoidingView>
        </Modal>

        {isLoading ? (
          <SkeletonList count={4} style={{ paddingHorizontal: 16 }} />
        ) : loadError ? (
          <EmptyState
            variant="error"
            title={t('common:something_went_wrong', {defaultValue: 'Something went wrong'})}
            body={loadError}
            actionLabel={t('common:try_again', {defaultValue: 'Try again'})}
            onAction={load}
          />
        ) : entries.length === 0 ? (
          <EmptyState
            icon="edit-2-outline"
            title={t('more:career_diary_empty_title', {defaultValue: 'No entries yet'})}
            body={t('more:career_diary_empty', {defaultValue: 'Add your first one above.'})}
          />
        ) : (
          groups.map(group => (
            <View key={group.date} style={{ marginTop: 24 }}>
              <Text category="h9" bold status="placeholder" mb={10}>
                {formatDateHeader(group.date, t)}
              </Text>
              {group.items.map(entry => (
                <Layout key={entry.id} level="2" style={styles.entryCard}>
                  <Flex justify="space-between" itemsCenter mb={6}>
                    <Flex justify="flex-start" itemsCenter>
                      {entry.category ? (
                        <View style={[styles.entryTag, { backgroundColor: theme['color-primary-transparent-200'] }]}>
                          {/* Was status="primary" -- near-white
                              text-primary-color, invisible on this pale
                              transparent tag in light mode. Same fix as
                              elsewhere: the actual brand blue. */}
                          <Text category="h10" bold style={{color: theme['color-primary-500']}}>
                            {CATEGORY_KEYS.includes(entry.category as DiaryCategory)
                              ? categoryLabel(entry.category as DiaryCategory, t)
                              : entry.category}
                          </Text>
                        </View>
                      ) : null}
                      {entry.role ? (
                        <View style={[styles.entryTag, { backgroundColor: theme['background-basic-color-3'], marginLeft: 6 }]}>
                          <Text category="h10" bold status="basic">
                            {entry.role}
                          </Text>
                        </View>
                      ) : null}
                    </Flex>
                    <TouchableOpacity onPress={() => onDelete(entry)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Icon
                        pack="assets"
                        name="trash"
                        style={[globalStyle.icon16, { tintColor: theme['text-hint-color'] }]}
                      />
                    </TouchableOpacity>
                  </Flex>
                  <Text category="h9-s">{entry.text}</Text>
                </Layout>
              ))}
            </View>
          ))
        )}
      </Content>
    </Container>
  );
});

export default CareerDiary;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  addTrigger: {
    ...globalStyle.card,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  textInput: {
    ...globalStyle.inputField,
    minHeight: 70,
  },
  textInputInner: {
    minHeight: 60,
  },
  categoryPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 99,
    marginRight: 8,
    overflow: 'hidden',
  },
  roleInput: {
    ...globalStyle.inputField,
  },
  entryCard: {
    ...globalStyle.card,
    padding: 14,
    marginBottom: 10,
    // Same as composerCard above — renders via <Layout level="2" .../>.
  },
  entryTag: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 99,
  },
});
