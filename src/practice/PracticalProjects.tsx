import React, {memo} from 'react';
import {Alert, TouchableOpacity, View} from 'react-native';
import {TopNavigation, StyleService, useStyleSheet, useTheme, Icon, Input, Spinner, Layout} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {pick, isErrorWithCode, errorCodes, types as documentTypes} from '@react-native-documents/picker';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import CtaButton from 'components/CtaButton';
import ShareToUserModal from 'components/ShareToUserModal';
import FormSheet from 'components/FormSheet';
import SimpleMarkdown from 'components/SimpleMarkdown';
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
  const [newOpen, setNewOpen] = React.useState(false);
  const [stageOpen, setStageOpen] = React.useState<number | null>(null);
  const [draft, setDraft] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [attachments, setAttachments] = React.useState<service.StageAttachment[]>([]);
  const [mediaUrl, setMediaUrl] = React.useState('');
  const [attaching, setAttaching] = React.useState(false);
  const [finishing, setFinishing] = React.useState(false);
  const [expanded, setExpanded] = React.useState<number | null>(null);
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
      setNewOpen(false);
      load();
    } catch (e: any) {
      Alert.alert(t('common:something_went_wrong', {defaultValue: 'Something went wrong'}), e?.message);
    } finally {
      setCreating(false);
    }
  };

  const openStage = (n: number) => {
    if (!active) return;
    const f0 = active.files.find(f => f.path === `STAGE_${n}.md`);
    const file = f0?.content_original ?? f0?.content ?? '';
    setDraft(file);
    setAttachments([]);
    setMediaUrl('');
    setStageOpen(n);
  };

  const attachErrorMessage = (e: any) =>
    e?.response?.data?.detail ?? e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong'});

  const onPickDocument = async () => {
    if (!active || attaching) return;
    try {
      const [res] = await pick({
        type: [
          documentTypes.pdf,
          documentTypes.doc,
          documentTypes.docx,
          documentTypes.ppt,
          documentTypes.pptx,
          documentTypes.xls,
          documentTypes.xlsx,
          documentTypes.csv,
          documentTypes.plainText,
        ],
      });
      setAttaching(true);
      const att = await service.uploadStageDocument(active.id, {uri: res.uri, name: res.name ?? 'document', mimeType: res.type});
      setAttachments(prev => [...prev, att].slice(0, 5));
    } catch (e: any) {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return;
      Alert.alert(t('more:upload_failed', {defaultValue: 'Upload failed'}), attachErrorMessage(e));
    } finally {
      setAttaching(false);
    }
  };

  const onAttachUrl = async () => {
    if (!active || attaching || !mediaUrl.trim()) return;
    setAttaching(true);
    try {
      const att = await service.attachStageMediaUrl(active.id, mediaUrl.trim());
      setAttachments(prev => [...prev, att].slice(0, 5));
      setMediaUrl('');
    } catch (e: any) {
      Alert.alert(t('more:upload_failed', {defaultValue: 'Upload failed'}), attachErrorMessage(e));
    } finally {
      setAttaching(false);
    }
  };

  const submitStage = async () => {
    if (!active || stageOpen == null || submitting) return;
    setSubmitting(true);
    try {
      const template = active.state?.stages.find(x => x.n === stageOpen)?.template ?? '';
      // An untouched generated template is not the learner's work - don't send it when they attached their own.
      const content = attachments.length > 0 && draft.trim() === template.trim() ? '' : draft;
      const updated = await service.submitProjectStage(active.id, stageOpen, content, attachments);
      setActive(updated);
      setExpanded(stageOpen);
      setStageOpen(null);
    } catch (e: any) {
      Alert.alert(t('common:something_went_wrong', {defaultValue: 'Something went wrong'}), e?.message);
    } finally {
      setSubmitting(false);
    }
  };

  const finish = async () => {
    if (!active || finishing) return;
    setFinishing(true);
    try {
      setActive(await service.finishPracticalProject(active.id));
    } catch (e: any) {
      Alert.alert(t('common:something_went_wrong', {defaultValue: 'Something went wrong'}), e?.message);
    } finally {
      setFinishing(false);
    }
  };

  const needSaved = (fn: () => void) => fn();

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
            <CtaButton onPress={() => setNewOpen(true)}>
              {t('find:practical_projects_generate', {defaultValue: 'Start a new project'})}
            </CtaButton>
            <FormSheet
              visible={newOpen}
              title={t('find:practical_projects_generate', {defaultValue: 'Start a new project'}).toString()}
              subtitle={t('find:practical_projects_sheet_sub', {defaultValue: 'Pick your field. Your AI manager will brief you and guide you through 4 stages.'}).toString()}
              onClose={() => setNewOpen(false)}>
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
                {creating ? () => <Spinner size="small" status="control" /> : t('find:practical_projects_begin', {defaultValue: 'Begin project'})}
              </CtaButton>
            </FormSheet>

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
            {active.state ? (
              <Text category="h10" status="placeholder" mb={8}>
                {t('find:practical_reporting_to', {defaultValue: 'You report to {{name}}, {{title}}', name: active.state.persona.name, title: active.state.persona.title})}
              </Text>
            ) : null}
            <Layout level="2" style={[styles.row, {marginBottom: 16, alignItems: 'flex-start'}]}>
              <View style={globalStyle.flexOne}>
                <SimpleMarkdown text={brief} />
              </View>
            </Layout>

            {active.state?.stages.map(st => {
              const locked = st.status === 'locked';
              const done = st.status === 'done';
              const fb = st.feedback;
              return (
                <Layout key={st.n} level="2" style={[styles.stageCard, locked ? {opacity: 0.5} : null]}>
                  <Flex itemsCenter justify="flex-start">
                    <View style={[styles.stageDot, {backgroundColor: done ? theme['text-basic-color'] : theme['background-basic-color-3']}]}>
                      <Text category="h10" bold style={{color: done ? theme['background-basic-color-2'] : theme['text-basic-color']}}>
                        {done ? '✓' : st.n}
                      </Text>
                    </View>
                    <Text category="h8" bold style={globalStyle.flexOne}>{st.title}</Text>
                    {fb ? <Text category="h9" bold>{fb.score}/100</Text> : null}
                  </Flex>
                  {!locked ? (
                    <>
                      <Text category="h9-s" mt={8}>{st.task}</Text>
                      {st.twist ? (
                        <View style={styles.twist}>
                          <Text category="h10" bold>{t('find:practical_twist', {defaultValue: 'Update from your manager'})}</Text>
                          <Text category="h9-s" mt={2}>{st.twist}</Text>
                        </View>
                      ) : null}
                      {fb ? (
                        <TouchableOpacity onPress={() => setExpanded(expanded === st.n ? null : st.n)} style={{marginTop: 10}}>
                          <Text category="h9" bold>
                            {fb.passed ? t('find:practical_feedback_pass', {defaultValue: 'Approved — see feedback'}) : t('find:practical_feedback_revise', {defaultValue: 'Needs revision — see feedback'})}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      {fb && expanded === st.n ? (
                        <View style={styles.feedback}>
                          <Text category="h9-s">{fb.summary}</Text>
                          {fb.strengths.map((x, i) => <Text key={`s${i}`} category="h9-s" mt={4}>+ {x}</Text>)}
                          {fb.improvements.map((x, i) => <Text key={`i${i}`} category="h9-s" mt={4}>→ {x}</Text>)}
                          {fb.follow_up ? <Text category="h9-s" bold mt={8}>“{fb.follow_up}”</Text> : null}
                        </View>
                      ) : null}
                      <CtaButton
                        style={{marginTop: 12}}
                        onPress={() => openStage(st.n)}>
                        {done
                          ? t('find:practical_edit_stage', {defaultValue: 'Revise my work'})
                          : fb
                          ? t('find:practical_resubmit', {defaultValue: 'Revise and resubmit'})
                          : t('find:practical_start_stage', {defaultValue: 'Start this stage'})}
                      </CtaButton>
                    </>
                  ) : (
                    <Text category="h10" status="placeholder" mt={6}>
                      {t('find:practical_locked', {defaultValue: 'Complete the previous stage to unlock'})}
                    </Text>
                  )}
                </Layout>
              );
            })}

            {active.state && active.state.stages.every(x => x.status === 'done') ? (
              active.state.final ? (
                <Layout level="2" style={styles.stageCard}>
                  <Text category="h8" bold>
                    {t('find:practical_final_title', {defaultValue: 'Final review'})} · {active.state.final.overall_score}/100
                  </Text>
                  <Text category="h9-s" mt={6}>{active.state.final.verdict}</Text>
                  {active.state.final.top_strengths.map((x, i) => <Text key={`fs${i}`} category="h9-s" mt={4}>+ {x}</Text>)}
                  {active.state.final.growth_areas.map((x, i) => <Text key={`fg${i}`} category="h9-s" mt={4}>→ {x}</Text>)}
                  <Text category="h10" status="placeholder" mt={10}>
                    {t('find:practical_portfolio_ready', {defaultValue: 'Your portfolio write-up is saved. Use download or share above.'})}
                  </Text>
                </Layout>
              ) : (
                <CtaButton disabled={finishing} onPress={finish}>
                  {finishing ? () => <Spinner size="small" status="control" /> : t('find:practical_finish', {defaultValue: 'Finish and get final review'})}
                </CtaButton>
              )
            ) : null}

            <FormSheet
              visible={stageOpen != null}
              title={active.state?.stages.find(x => x.n === stageOpen)?.title ?? ''}
              subtitle={active.state?.stages.find(x => x.n === stageOpen)?.task}
              onClose={() => setStageOpen(null)}>
              <Input
                multiline
                value={draft}
                onChangeText={setDraft}
                textStyle={{minHeight: 260, textAlignVertical: 'top'}}
                style={{marginBottom: 12}}
              />
              {(() => {
                const dtype = active.state?.stages.find(x => x.n === stageOpen)?.deliverable_type ?? 'text';
                const isMedia = dtype === 'audio' || dtype === 'video';
                return (
                  <View style={{marginBottom: 12}}>
                    <Text category="h10" bold mb={4}>
                      {t('find:practical_attach_title', {defaultValue: 'Or attach your own work'})}
                    </Text>
                    <Text category="h10" status="placeholder" mb={8}>
                      {isMedia
                        ? t('find:practical_attach_media_hint', {
                            defaultValue: 'Upload your {{type}} to Google Drive, Dropbox or similar, set it to “anyone with the link”, and paste the link. The AI will transcribe and review it.',
                            type: dtype,
                          })
                        : t('find:practical_attach_doc_hint', {
                            defaultValue: 'Upload a PDF, Word, PowerPoint, Excel, CSV or text file instead of editing the draft. The AI will read it.',
                          })}
                    </Text>
                    {isMedia ? (
                      <Flex justify="space-between" itemsCenter>
                        <Input
                          placeholder={t('find:practical_attach_url_placeholder', {defaultValue: 'https://… public link'}).toString()}
                          value={mediaUrl}
                          onChangeText={setMediaUrl}
                          autoCapitalize="none"
                          autoCorrect={false}
                          keyboardType="url"
                          style={[{flex: 1, marginRight: 8}, globalStyle.sheetInput]}
                          textStyle={globalStyle.inputText}
                        />
                        <CtaButton size="small" disabled={attaching || !mediaUrl.trim()} loading={attaching} onPress={onAttachUrl}>
                          {t('find:practical_attach_add', {defaultValue: 'Add'})}
                        </CtaButton>
                      </Flex>
                    ) : (
                      <CtaButton loading={attaching} disabled={attaching || attachments.length >= 5} onPress={onPickDocument}>
                        {t('find:practical_attach_file', {defaultValue: 'Choose a file'})}
                      </CtaButton>
                    )}
                    {attachments.map((a, i) => (
                      <Flex key={`${a.name}-${i}`} justify="space-between" itemsCenter style={{marginTop: 8}}>
                        <Flex justify="flex-start" itemsCenter style={{flex: 1}}>
                          <Icon
                            pack="eva"
                            name={a.kind === 'media' ? 'headphones-outline' : 'file-text-outline'}
                            style={[globalStyle.icon20, {tintColor: theme['text-basic-color']}]}
                          />
                          <Text category="h9" numberOfLines={1} ml={8} style={{flex: 1}}>
                            {a.name}
                          </Text>
                        </Flex>
                        <TouchableOpacity onPress={() => setAttachments(prev => prev.filter((_, j) => j !== i))} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                          <Icon pack="eva" name="close-outline" style={[globalStyle.icon20, {tintColor: theme['text-basic-color']}]} />
                        </TouchableOpacity>
                      </Flex>
                    ))}
                  </View>
                );
              })()}
              <CtaButton disabled={submitting || (draft.trim().length < 40 && attachments.length === 0)} onPress={submitStage}>
                {submitting
                  ? () => <Spinner size="small" status="control" />
                  : t('find:practical_submit_manager', {defaultValue: 'Submit to {{name}}', name: active.state?.persona.name ?? 'manager'})}
              </CtaButton>
            </FormSheet>
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
  stageCard: {borderRadius: 14, padding: 14, marginBottom: 12},
  stageDot: {width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 10},
  twist: {marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: 'background-basic-color-3'},
  feedback: {marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: 'background-basic-color-3'},
  row: {borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center'},
});
