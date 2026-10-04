import React, {memo} from 'react';
import {Alert, Modal, TouchableOpacity, View} from 'react-native';
import {TopNavigation, StyleService, useStyleSheet, useTheme, Icon, Input} from '@ui-kitten/components';
import {NavigationProp, useNavigation, useFocusEffect} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import EmptyState from 'components/EmptyState';
import CtaButton from 'components/CtaButton';
import {SkeletonList} from 'components/Skeleton';
import {globalStyle} from 'styles/globalStyle';
import {RootStackParamList} from 'navigation/types';
import dayjs from 'utils/dayjs';
import {ADDON_CODES, hasAddon} from 'services/entitlementsService';
import * as codingProjectsService from 'services/codingProjectsService';
import {CodingProjectSummary, ProjectType} from 'services/codingProjectsService';

// Coding Projects hub — the project list for the new persisted, multi-file/
// folder code workspace feature (product: backend built by a teammate,
// commit 7fa99e9; this is the mobile UI for it). Sibling feature to
// CodingPracticeHub.tsx's single-file problem bank, reached from a card on
// that screen (see its onOpenCodingProjects), gated by the same
// coding_practice add-on. Tapping a project opens CodingProjectEditor.tsx.
const CodingProjectsHub = memo(() => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['find', 'more', 'common']);

  // undefined = not checked yet, null = checked and NOT owned (renders the
  // locked state below instead of the list), true = owned. Checked here too
  // (not just at the CodingPracticeHub.tsx card that links in) so a direct
  // deep link / back-forward navigation into this screen can't bypass the
  // gate -- same fail-closed hasAddon() this app's other add-on gates use
  // (see entitlementsService.ts's own doc comment on hasAddon).
  const [addonOwned, setAddonOwned] = React.useState<boolean | null | undefined>(undefined);

  const [projects, setProjects] = React.useState<CodingProjectSummary[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [showNewModal, setShowNewModal] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newType, setNewType] = React.useState<ProjectType>('script');
  const [isCreating, setIsCreating] = React.useState(false);

  const [renameTarget, setRenameTarget] = React.useState<CodingProjectSummary | null>(null);
  const [renameValue, setRenameValue] = React.useState('');
  const [isRenaming, setIsRenaming] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await codingProjectsService.listProjects();
      setProjects(list);
    } catch (e: any) {
      setLoadError(e?.message ?? t('find:coding_projects_load_failed', {defaultValue: 'Could not load your projects.'}));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      hasAddon(ADDON_CODES.codingPractice).then(owned => {
        if (cancelled) return;
        setAddonOwned(owned);
        if (owned) load();
      });
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const onCreateProject = async () => {
    const name = newName.trim();
    if (!name || isCreating) return;
    setIsCreating(true);
    try {
      const created = await codingProjectsService.createProject(name, newType);
      setShowNewModal(false);
      setNewName('');
      setNewType('script');
      setProjects(prev => (prev ? [created, ...prev] : [created]));
      navigate('CodingProjectEditor', {projectId: created.id});
    } catch (e: any) {
      Alert.alert(
        t('find:coding_project_create_failed', {defaultValue: 'Could not create project'}),
        e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
      );
    } finally {
      setIsCreating(false);
    }
  };

  const onRowMenu = (p: CodingProjectSummary) => {
    Alert.alert(
      p.name,
      undefined,
      [
        {text: t('common:cancel', {defaultValue: 'Cancel'}).toString(), style: 'cancel'},
        {text: t('find:coding_project_rename', {defaultValue: 'Rename'}).toString(), onPress: () => onRenamePrompt(p)},
        {
          text: t('common:delete', {defaultValue: 'Delete'}).toString(),
          style: 'destructive',
          onPress: () => onConfirmDelete(p),
        },
      ],
      {cancelable: true},
    );
  };

  const onRenamePrompt = (p: CodingProjectSummary) => {
    // Alert.prompt is iOS-only — this app targets both platforms, so rename
    // reuses the same new-project modal's text input instead of a native
    // prompt, pre-filled with the current name.
    setRenameTarget(p);
    setRenameValue(p.name);
  };

  const onSubmitRename = async () => {
    if (!renameTarget || isRenaming) return;
    const name = renameValue.trim();
    if (!name) return;
    setIsRenaming(true);
    try {
      await codingProjectsService.renameProject(renameTarget.id, name);
      setProjects(prev => (prev ? prev.map(item => (item.id === renameTarget.id ? {...item, name} : item)) : prev));
      setRenameTarget(null);
    } catch (e: any) {
      Alert.alert(
        t('find:coding_project_rename_failed', {defaultValue: 'Could not rename project'}),
        e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
      );
    } finally {
      setIsRenaming(false);
    }
  };

  const onConfirmDelete = (p: CodingProjectSummary) => {
    Alert.alert(
      t('find:coding_project_delete_title', {defaultValue: 'Delete this project?'}),
      t('find:coding_project_delete_body', {
        defaultValue: '"{{name}}" and all its files will be permanently deleted. This can\'t be undone.',
        name: p.name,
      }).toString(),
      [
        {text: t('common:cancel', {defaultValue: 'Cancel'}).toString(), style: 'cancel'},
        {
          text: t('common:delete', {defaultValue: 'Delete'}).toString(),
          style: 'destructive',
          onPress: async () => {
            const prevProjects = projects;
            setProjects(prev => (prev ? prev.filter(item => item.id !== p.id) : prev));
            try {
              await codingProjectsService.deleteProject(p.id);
            } catch (e: any) {
              setProjects(prevProjects);
              Alert.alert(
                t('find:coding_project_delete_failed', {defaultValue: 'Could not delete project'}),
                e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
              );
            }
          },
        },
      ],
    );
  };

  if (addonOwned === undefined) {
    return (
      <Container style={styles.container}>
        <TopNavigation
          title={t('find:coding_projects_title', {defaultValue: 'Coding Projects'})}
          accessoryLeft={() => <NavigationAction />}
        />
        <EmptyState variant="loading" />
      </Container>
    );
  }

  if (!addonOwned) {
    // Same locked-feature pattern as this app's other add-on gates (see
    // MockInterviewSetup.tsx's onStart / CodingPracticeHub.tsx's
    // onOpenCodingProjects) — reused here as a full-screen state rather than
    // just an Alert since this screen can be reached directly (not only via
    // that card's own pre-check).
    return (
      <Container style={styles.container}>
        <TopNavigation
          title={t('find:coding_projects_title', {defaultValue: 'Coding Projects'})}
          accessoryLeft={() => <NavigationAction />}
        />
        <Content padder contentContainerStyle={styles.content}>
          <EmptyState
            title={t('find:addon_required_title_generic', {defaultValue: 'This is a paid add-on'}).toString()}
            body={t('find:addon_required_body', {defaultValue: 'Purchase the add-on once to unlock it for good.'}).toString()}
            actionLabel={t('more:addons_title', {defaultValue: 'Add-ons'}).toString()}
            onAction={() => navigate('AddOns', {highlightCode: ADDON_CODES.codingPractice})}
          />
        </Content>
      </Container>
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('find:coding_projects_title', {defaultValue: 'Coding Projects'})}
        accessoryLeft={() => <NavigationAction />}
      />
      <Content padder contentContainerStyle={styles.content}>
        {isLoading && !projects ? (
          <SkeletonList count={3} style={{paddingHorizontal: 0}} />
        ) : loadError && !projects ? (
          <EmptyState
            variant="error"
            title={t('common:something_went_wrong', {defaultValue: 'Something went wrong'}).toString()}
            body={loadError}
            actionLabel={t('common:try_again', {defaultValue: 'Try again'}).toString()}
            onAction={load}
          />
        ) : !projects || projects.length === 0 ? (
          <EmptyState
            title={t('find:coding_projects_empty_title', {defaultValue: 'No projects yet'}).toString()}
            body={t('find:coding_projects_empty_body', {
              defaultValue: 'Create a multi-file script or a small web app — it saves to your account automatically.',
            }).toString()}
          />
        ) : (
          projects.map(p => (
            <TouchableOpacity
              key={p.id}
              activeOpacity={0.75}
              style={[globalStyle.card, styles.projectRow]}
              onPress={() => navigate('CodingProjectEditor', {projectId: p.id})}>
              <View style={[styles.typeBadge, {backgroundColor: p.projectType === 'web' ? '#3B82F61F' : '#10B9811F'}]}>
                <Icon
                  pack="eva"
                  name={p.projectType === 'web' ? 'globe-outline' : 'terminal-outline'}
                  style={[globalStyle.icon20, {tintColor: p.projectType === 'web' ? '#3B82F6' : '#10B981'}]}
                />
              </View>
              <View style={globalStyle.flexOne}>
                <Text category="h8" bold numberOfLines={1}>
                  {p.name}
                </Text>
                <Text category="h10" status="placeholder" mt={2}>
                  {t('find:coding_project_meta', {
                    defaultValue: 'Updated {{when}} · {{files}} files · {{size}}',
                    when: dayjs(p.updatedAt).fromNow(),
                    files: p.fileCount,
                    size: codingProjectsService.formatBytes(p.totalSizeBytes),
                  })}
                </Text>
              </View>
              <TouchableOpacity
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                onPress={() => onRowMenu(p)}>
                <Icon pack="eva" name="more-vertical-outline" style={[globalStyle.icon20, {tintColor: theme['text-hint-color']}]} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}

        <CtaButton style={{marginTop: 8}} onPress={() => setShowNewModal(true)}>
          {t('find:coding_project_new_cta', {defaultValue: '+ New Project'}).toString()}
        </CtaButton>
      </Content>

      {/* New Project — name + web/script type. Kept as a plain centered
          Modal (same shape as GoalsScreen.tsx's own edit-value modal)
          rather than a dedicated screen since it's a two-field, one-step
          prompt. */}
      <Modal visible={showNewModal} animationType="fade" transparent onRequestClose={() => setShowNewModal(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.modalCard, {backgroundColor: theme['background-basic-color-1']}]}>
            <Text category="h7" bold center mb={16}>
              {t('find:coding_project_new_title', {defaultValue: 'New Project'})}
            </Text>
            <Input
              autoFocus
              placeholder={t('find:coding_project_name_placeholder', {defaultValue: 'Project name'}).toString()}
              value={newName}
              onChangeText={setNewName}
              style={[[globalStyle.inputField, {marginBottom: 16}], globalStyle.sheetInput]}
              textStyle={globalStyle.inputText}
            />
            <Flex justify="flex-start" mb={20}>
              {(['script', 'web'] as ProjectType[]).map(type => {
                const active = newType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    activeOpacity={0.7}
                    onPress={() => setNewType(type)}
                    style={[
                      styles.typeChip,
                      {backgroundColor: active ? theme['color-primary-solid'] : theme['background-basic-color-2']},
                    ]}>
                    <Text category="h9" bold status={active ? 'control' : 'basic'}>
                      {type === 'script'
                        ? t('find:coding_project_type_script', {defaultValue: 'Script'})
                        : t('find:coding_project_type_web', {defaultValue: 'Web (HTML/CSS/JS)'})}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </Flex>
            <CtaButton loading={isCreating} disabled={!newName.trim()} onPress={onCreateProject}>
              {t('common:create', {defaultValue: 'Create'}).toString()}
            </CtaButton>
            <Text
              category="h9"
              status="placeholder"
              center
              mt={16}
              onPress={() => (isCreating ? undefined : setShowNewModal(false))}>
              {t('common:cancel', {defaultValue: 'Cancel'})}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Rename */}
      <Modal visible={!!renameTarget} animationType="fade" transparent onRequestClose={() => setRenameTarget(null)}>
        <View style={styles.backdrop}>
          <View style={[styles.modalCard, {backgroundColor: theme['background-basic-color-1']}]}>
            <Text category="h7" bold center mb={16}>
              {t('find:coding_project_rename', {defaultValue: 'Rename'})}
            </Text>
            <Input
              autoFocus
              value={renameValue}
              onChangeText={setRenameValue}
              style={[[globalStyle.inputField, {marginBottom: 20}], globalStyle.sheetInput]}
              textStyle={globalStyle.inputText}
            />
            <CtaButton loading={isRenaming} disabled={!renameValue.trim()} onPress={onSubmitRename}>
              {t('common:save', {defaultValue: 'Save'}).toString()}
            </CtaButton>
            <Text category="h9" status="placeholder" center mt={16} onPress={() => (isRenaming ? undefined : setRenameTarget(null))}>
              {t('common:cancel', {defaultValue: 'Cancel'})}
            </Text>
          </View>
        </View>
      </Modal>
    </Container>
  );
});

export default CodingProjectsHub;

const themedStyles = StyleService.create({
  container: {flex: 1},
  content: {paddingBottom: 60},
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    backgroundColor: 'background-basic-color-2',
  },
  typeBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  typeChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 99,
    marginRight: 8,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalCard: {
    borderRadius: 20,
    padding: 20,
  },
});
