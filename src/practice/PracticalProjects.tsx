import React, {memo} from 'react';
import {Alert, TouchableOpacity, View} from 'react-native';
import {TopNavigation, StyleService, useStyleSheet, useTheme, Icon, Input, Spinner, Layout} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import CtaButton from 'components/CtaButton';
import ShareToUserModal from 'components/ShareToUserModal';
import {globalStyle} from 'styles/globalStyle';
import {RootStackParamList} from 'navigation/types';
import {ADDON_CODES, hasAddon} from 'services/entitlementsService';
import * as service from 'services/practicalProjectsService';
import * as projectActions from 'services/projectActionsService';

const INDUSTRIES = ['healthcare', 'sales', 'marketing', 'finance', 'consulting', 'science'];

// Industry projects for Practical Scenarios: pick an industry, the AI writes a
// realistic project brief, the learner writes their solution, then can send it
// to the AI coach for analysis, share it, or export it as a zip.
const PracticalProjects = memo(() => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['find', 'common', 'more']);

  const [industry, setIndustry] = React.useState(INDUSTRIES[0]);
  const [role, setRole] = React.useState('');
  const [projects, setProjects] = React.useState<service.PracticalProjectSummary[]>([]);
  const [active, setActive] = React.useState<service.PracticalProjectDetail | null>(null);
  const [solution, setSolution] = React.useState('');
  const [dirty, setDirty] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [shareVisible, setShareVisible] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setProjects(await service.listPracticalProjects());
    } catch {
      setProjects([]);
    }
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);

  const openProject = async (id: number) => {
    try {
      const p = await service.getPracticalProject(id);
      setActive(p);
      setSolution(p.files.find(f => f.path === 'SOLUTION.md')?.content ?? '');
      setDirty(false);
    } catch (e: any) {
      Alert.alert(t('common:something_went_wrong', {defaultValue: 'Something went wrong'}), e?.message);
    }
  };

  const create = async () => {
    if (creating) return;
    if (!(await hasAddon(ADDON_CODES.practicalScenario))) {
      Alert.alert(
        t('find:addon_required_title_generic', {defaultValue: 'This is a paid add-on'}),
        t('find:addon_required_body', {defaultValue: 'Purchase the add-on once to unlock it for good.'}),
        [
          {text: t('common:cancel', {defaultValue: 'Cancel'}), style: 'cancel'},
          {text: t('more:addons_title', {defaultValue: 'Add-ons'}), onPress: () => navigate('AddOns', {highlightCode: ADDON_CODES.practicalScenario})},
        ],
      );
      return;
    }
    setCreating(true);
    try {
      const p = await service.createPracticalProject(industry, role.trim() || undefined);
      setActive(p);
      setSolution(p.files.find(f => f.path === 'SOLUTION.md')?.content ?? '');
      setDirty(false);
      load();
    } catch (e: any) {
      Alert.alert(t('common:something_went_wrong', {defaultValue: 'Something went wrong'}), e?.message);
    } finally {
      setCreating(false);
    }
  };

  const save = async () => {
    if (!active || saving) return;
    setSaving(true);
    try {
      await service.savePracticalProject(active.id, [{path: 'SOLUTION.md', content: solution}]);
      setDirty(false);
    } catch (e: any) {
      Alert.alert(t('common:something_went_wrong', {defaultValue: 'Something went wrong'}), e?.message);
    } finally {
      setSaving(false);
    }
  };

  const needSaved = (fn: () => void) => {
    if (dirty) {
      Alert.alert(t('find:coding_project_unsaved_title', {defaultValue: 'Unsaved changes'}), t('find:coding_project_save_first', {defaultValue: 'Save your changes first.'}).toString());
      return;
    }
    fn();
  };

  const onExport = async () => {
    if (!active || exporting) return;
    setExporting(true);
    try {
      await projectActions.exportProjectZip('practical', active.id);
    } catch (e: any) {
      Alert.alert(t('more:resume_download_failed_title', {defaultValue: "Couldn't download the file"}), e?.message ?? '');
    } finally {
      setExporting(false);
    }
  };

  const onAnalyze = () => {
    if (!active) return;
    navigate('MainBottomTab', {
      screen: 'Coach',
      params: {
        screen: 'Chat',
        params: {
          initialPrompt: t('find:analyze_project_prompt', {defaultValue: 'Can you review my coding project "{{name}}"? I\'ve attached it below.', name: active.name}).toString(),
          codingProjectId: String(active.id),
        },
      },
    } as never);
  };

  const brief = active?.files.find(f => f.path === 'BRIEF.md')?.content ?? '';

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('find:practical_projects_title', {defaultValue: 'Industry Projects'})}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        {!active ? (
          <>
            <Text category="h9-s" status="placeholder" mb={16}>
              {t('find:practical_projects_description', {defaultValue: 'Build a realistic project for your field, then get your AI coach to review it.'})}
            </Text>
            <Flex wrap justify="flex-start" style={{marginHorizontal: -4, marginBottom: 16}}>
              {INDUSTRIES.map(i => {
                const selected = i === industry;
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setIndustry(i)}
                    style={[styles.chip, {borderColor: selected ? theme['color-primary-500'] : theme['border-basic-color-3']}, selected ? {backgroundColor: theme['color-primary-transparent-200']} : null]}>
                    <Text category="h9-s" bold={selected} style={selected ? {color: theme['color-primary-500']} : undefined}>
                      {t(`find:practical_type_${i}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </Flex>
            <Input
              placeholder={t('find:practical_role_placeholder', {defaultValue: 'e.g. ICU Nurse, Enterprise AE, Lab Technician'}).toString()}
              value={role}
              onChangeText={setRole}
              style={{marginBottom: 16}}
              textStyle={globalStyle.inputText}
            />
            <CtaButton disabled={creating} onPress={create}>
              {creating ? () => <Spinner size="small" status="control" /> : t('find:practical_projects_generate', {defaultValue: 'Generate a project'})}
            </CtaButton>

            {projects.length > 0 ? (
              <View style={{marginTop: 24}}>
                <Text category="h8" bold mb={8}>{t('find:practical_projects_yours', {defaultValue: 'Your projects'})}</Text>
                {projects.map(p => (
                  <TouchableOpacity key={p.id} onPress={() => openProject(p.id)}>
                    <Layout level="2" style={styles.row}>
                      <Text category="h9" bold style={globalStyle.flexOne} numberOfLines={2}>{p.name}</Text>
                      <Text category="h10" status="placeholder">{p.industry}</Text>
                    </Layout>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Flex justify="space-between" itemsCenter mb={12}>
              <TouchableOpacity onPress={() => setActive(null)}>
                <Text category="h9" status="link" bold>{t('common:back', {defaultValue: 'Back'})}</Text>
              </TouchableOpacity>
              <Flex itemsCenter>
                <TouchableOpacity onPress={() => needSaved(() => setShareVisible(true))} style={{marginRight: 14}}>
                  <Icon pack="eva" name="share-outline" style={[globalStyle.icon24, {tintColor: theme['color-primary-500']}]} />
                </TouchableOpacity>
                <TouchableOpacity disabled={exporting} onPress={() => needSaved(onExport)} style={{marginRight: 14}}>
                  {exporting ? <Spinner size="small" /> : <Icon pack="eva" name="download-outline" style={[globalStyle.icon24, {tintColor: theme['color-primary-500']}]} />}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => needSaved(onAnalyze)}>
                  <Icon pack="eva" name="message-circle-outline" style={[globalStyle.icon24, {tintColor: theme['color-primary-500']}]} />
                </TouchableOpacity>
              </Flex>
            </Flex>
            <Text category="h7" bold mb={8}>{active.name}</Text>
            <Layout level="2" style={[styles.row, {marginBottom: 12}]}>
              <Text category="h9-s">{brief}</Text>
            </Layout>
            <Input
              multiline
              value={solution}
              onChangeText={v => {
                setSolution(v);
                setDirty(true);
              }}
              textStyle={{minHeight: 260, textAlignVertical: 'top'}}
              style={{marginBottom: 12}}
            />
            <CtaButton disabled={saving || !dirty} onPress={save}>
              {saving ? () => <Spinner size="small" status="control" /> : dirty ? t('common:save', {defaultValue: 'Save'}) : t('common:saved', {defaultValue: 'Saved'})}
            </CtaButton>
            <ShareToUserModal
              visible={shareVisible}
              onClose={() => setShareVisible(false)}
              contentType="project"
              contentId={active.id}
              getPublicLink={() => projectActions.getProjectPublicUrl('practical', active.id)}
            />
          </>
        )}
      </Content>
    </Container>
  );
});

export default PracticalProjects;

const themedStyles = StyleService.create({
  container: {flex: 1},
  content: {paddingBottom: 80},
  chip: {borderWidth: 1.5, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, margin: 4},
  row: {borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center'},
});
