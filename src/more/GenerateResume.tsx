import React, { memo } from 'react';
import { Alert, Modal, Platform, Share, TouchableOpacity, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
  Button,
  Input,
  Spinner,
} from '@ui-kitten/components';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { DraggableList } from 'components/DraggableList';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import * as resumeGenerationService from 'services/resumeGenerationService';
import * as resumeService from 'services/resumeService';
import {
  downloadDocumentFile,
  saveToAndroidDownloads,
  mimeForFormat,
} from 'services/documentDownloadService';
import { ResumeSections, ResumeStyle, ResumeDocType } from 'services/resumeGenerationService';
import {
  ResumeExperienceEntry,
  ResumeEducationEntry,
  ResumeProjectEntry,
  ResumeVolunteerEntry,
  ResumeReferenceEntry,
} from 'services/resumeService';
import { AuthContext } from '../../AuthContext';
import CtaButton from 'components/CtaButton';

// Module-scope function (not a hook) so it can't just call useTranslation
// itself — callers inside the component pass their own `t` in, same pattern
// as CareerDiary.tsx's categoryLabel().
function getStyleOptions(t: TFunction): { key: ResumeStyle; label: string; description: string }[] {
  return [
    {
      key: 'modern',
      label: t('more:resume_style_modern', { defaultValue: 'Modern' }),
      description: t('more:resume_style_modern_description', {
        defaultValue: 'Bold headings, accent color, single column.',
      }),
    },
    {
      key: 'classic',
      label: t('more:resume_style_classic', { defaultValue: 'Classic' }),
      description: t('more:resume_style_classic_description', {
        defaultValue: 'Traditional serif layout, most ATS-safe.',
      }),
    },
    {
      key: 'minimal',
      label: t('more:resume_style_minimal', { defaultValue: 'Minimal' }),
      description: t('more:resume_style_minimal_description', {
        defaultValue: 'Clean and compact, no color, dense.',
      }),
    },
  ];
}

// JD Analyzer's "build a resume matching this job" flow, and ResumeBuilder's
// standalone "Create My CV" entry point — see services/
// resumeGenerationService.ts for how content is generated (a real backend
// call, POST /api/v1/resume/generate) and services/resumeService.ts's
// updateResumeSections/exportResume for how the actual downloadable file is
// produced (real .docx/.pdf rendering server-side — app/services/
// resume_render_service.py).
//
// Sections shown here are the standard resume/CV set — Contact, Professional
// Summary, Core Skills, Certifications, Professional Experience, Education,
// Projects & Publications, Volunteer Experience, Awards & Achievements,
// Languages, References — deliberately not a generic "Highlights" list.
const GenerateResume = memo(() => {
  const theme = useTheme();
  const { t } = useTranslation(['more', 'common']);
  const styles = useStyleSheet(themedStyles);
  const route = useRoute<RouteProp<RootStackParamList, 'GenerateResume'>>();
  const { profile } = React.useContext(AuthContext);
  const STYLE_OPTIONS = React.useMemo(() => getStyleOptions(t), [t]);

  const docType: ResumeDocType = route.params?.docType ?? 'resume';
  const [role, setRole] = React.useState(route.params?.role ?? profile?.desiredRoles?.[0] ?? '');
  const [style, setStyle] = React.useState<ResumeStyle>('modern');
  const [content, setContent] = React.useState<ResumeSections | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(true);
  const [genError, setGenError] = React.useState<string | null>(null);
  const [downloadingFormat, setDownloadingFormat] = React.useState<'pdf' | 'docx' | null>(null);
  const [showPreview, setShowPreview] = React.useState(false);

  // Tapping a "Consider Adding" chip moves that keyword straight into Core
  // Skills (deduped) and off the suggestions list — this is what the user
  // means by the AI's suggestions being "automatically added to the built
  // resume" on tap, rather than just a static list they'd have to retype
  // themselves.
  const addSuggestedSkill = React.useCallback((skill: string) => {
    setContent(prev => {
      if (!prev) return prev;
      const alreadyHave = prev.coreSkills.some(s => s.toLowerCase() === skill.toLowerCase());
      return {
        ...prev,
        coreSkills: alreadyHave ? prev.coreSkills : [...prev.coreSkills, skill],
        suggestedKeywords: prev.suggestedKeywords.filter(k => k !== skill),
      };
    });
  }, []);

  // Product request item: "Users should be able to drag, rearrange and edit
  // the content of the resume, cover letter generated in the JD analyzer
  // screen... and cv... generated in the resume builder screen." This
  // screen is reused by BOTH entry points (JD Analyzer's "Build Matching
  // Resume" and ResumeBuilder's "Create My CV" — see this file's own top
  // comment), so wiring editing here covers both at once. One generic
  // setter for every section — every section is just a top-level key on
  // `content`, so there's no need for a separate updater per section.
  const updateSection = React.useCallback(<K extends keyof ResumeSections>(key: K, value: ResumeSections[K]) => {
    setContent(prev => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const [savingChanges, setSavingChanges] = React.useState(false);
  const [savedChanges, setSavedChanges] = React.useState(false);
  // Persists whatever's currently in `content` to the user's stored resume
  // (PATCH /api/v1/resume, same endpoint `onDownload` already calls before
  // exporting — see resumeGenerationService.generateResumeDocument). That
  // existing call already saves edits made just before a download, but a
  // user editing/reordering without immediately downloading had no way to
  // persist those changes — this gives them an explicit one.
  const onSaveChanges = React.useCallback(async () => {
    if (!content || savingChanges) return;
    setSavingChanges(true);
    try {
      await resumeService.updateResumeSections({
        contact: content.contact,
        summary: content.summary,
        core_skills: content.coreSkills,
        certifications: content.certifications,
        experience: content.experience,
        education: content.education,
        projects: content.projects,
        volunteer: content.volunteer,
        awards: content.awards,
        languages: content.languages,
        references: content.references,
        suggested_keywords: content.suggestedKeywords,
      });
      setSavedChanges(true);
      setTimeout(() => setSavedChanges(false), 2500);
    } catch (e: any) {
      Alert.alert(
        t('more:resume_save_failed_title', { defaultValue: "Couldn't save your changes" }),
        e?.message ?? t('more:resume_save_failed_message', { defaultValue: 'Please try again in a moment.' }),
      );
    } finally {
      setSavingChanges(false);
    }
  }, [content, savingChanges, t]);

  const buildContent = React.useCallback(
    async (targetRole: string) => {
      setIsGenerating(true);
      setGenError(null);
      try {
        // JDAnalyzer's "tailor an existing resume" choice (product request
        // item 1) — mutually exclusive, see navigation/types.tsx's
        // GenerateResume params comment. Neither set = build fresh, the
        // original/default behavior, unchanged.
        let existingResume: ResumeSections | null | undefined;
        if (route.params?.useStoredResume) {
          // Fetched here (not by JDAnalyzer before navigating) so a stale
          // resume can't be carried across screens, and so this same
          // "regenerate" path (buildContent also runs on the Regenerate
          // button) always tailors against the CURRENT stored resume.
          existingResume = await resumeService.getStoredResumeSections();
        }
        // BUG FIX (product report: "the build resume button should still
        // ask... instead of just building a new one instead of giving the
        // user options"): the choice dialog itself was already correct
        // (see JDAnalyzer.tsx's onBuildResume) — but a user who picked
        // "My generated resume" while having no resume saved in the app
        // yet (getStoredResumeSections() returns null with nothing to
        // tailor) silently got a plain fresh build with zero indication
        // anything different happened, which reads exactly like the
        // "tailor" choice did nothing. Now surfaced explicitly.
        const requestedTailorButNothingToTailor =
          !!route.params?.useStoredResume && !existingResume && !route.params?.existingResumeDocumentId;
        const generated = await resumeGenerationService.generateResumeContent({
          role: targetRole,
          jdText: route.params?.jdText,
          existingResume,
          existingResumeDocumentId: existingResume ? undefined : route.params?.existingResumeDocumentId,
        });
        setContent(generated);
        if (requestedTailorButNothingToTailor) {
          Alert.alert(
            t('more:resume_nothing_to_tailor_title', { defaultValue: "You don't have a saved resume yet" }),
            t('more:resume_nothing_to_tailor_message', {
              defaultValue: "There's nothing in the app yet to tailor, so we built this one from scratch instead. You can edit it below, or go back and choose a file from My Documents to tailor next time.",
            }),
          );
        }
      } catch (e: any) {
        setGenError(e?.message ?? t('more:resume_gen_error', { defaultValue: 'Could not generate resume content.' }));
      } finally {
        setIsGenerating(false);
      }
    },
    [route.params?.jdText, route.params?.useStoredResume, route.params?.existingResumeDocumentId],
  );

  React.useEffect(() => {
    buildContent(role);
    // Only regenerate on mount — role edits are applied via the explicit
    // "Regenerate" button below, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDownload = async (format: 'pdf' | 'docx') => {
    if (!content || downloadingFormat) return;
    setDownloadingFormat(format);
    const label =
      docType === 'cv'
        ? t('more:resume_doc_label_cv', { defaultValue: 'CV' })
        : t('more:resume_doc_label_resume', { defaultValue: 'Resume' });
    const filename = `${label}.${format}`;
    try {
      const { url } = await resumeGenerationService.generateResumeDocument(content, {
        format,
        style,
        docType,
        name: profile?.name,
        role,
      });
      if (!url) {
        // Backend didn't return a usable file link (e.g. no structured
        // content yet) — fall back to sharing the content as plain text so
        // the flow still produces something useful instead of a dead end.
        await Share.share({
          message: resumeGenerationService.toPlainTextResume(content, { name: profile?.name, role, docType }),
          title: label,
        });
        return;
      }
      // Was Share.share({url}) pointed straight at the REMOTE url — on iOS
      // that just shares a web link (the share sheet's top actions are
      // "Copy"/"Open in Safari", not a real file), and RN's Share API has no
      // way to attach a remote URL as a file at all on Android, so it fell
      // back to sharing the link as plain text there too. Either way the
      // user got a link, never an actual .docx/.pdf. Downloading the real
      // bytes first and handing the OS a local file fixes both platforms.
      //
      // Also now goes through documentDownloadService.downloadDocumentFile,
      // which actually validates the response before treating it as a real
      // file — the previous direct `addAndroidDownloads`/CacheDir fetch
      // handed a possibly-404'd URL straight to the OS with no check, so a
      // stale document link would silently save/share an HTML "Not Found"
      // page as if it were the real PDF/DOCX. See that service for the full
      // explanation.
      const tempPath = await downloadDocumentFile(url, filename);
      if (Platform.OS === 'android') {
        // Android's DownloadManager drops the file straight into the public
        // Downloads folder with a real system download notification — this
        // is what "downloading a file" actually looks like on Android, and
        // sidesteps needing a FileProvider just to share a local file:// uri.
        await saveToAndroidDownloads(tempPath, filename, mimeForFormat(format));
        Alert.alert(
          t('more:resume_download_complete_title', { defaultValue: 'Download complete' }),
          t('more:resume_download_complete_message', {
            defaultValue: '{{filename}} was saved to your Downloads folder.',
            filename,
          }),
        );
      } else {
        // iOS has no public "Downloads" folder to drop a file into directly
        // — the real-file equivalent there is downloading to a local temp
        // path, then sharing THAT local file (not the remote url) so
        // "Save to Files" in the share sheet writes actual file bytes.
        await Share.share({ url: `file://${tempPath}`, title: filename });
        // Product request: "give them the options of saving (downloading)
        // it on their device... or saving it in generated documents or in
        // both places" — the export call above already recorded this in
        // Generated Documents server-side (see
        // Saveur-Backend/app/services/generated_document_service.py's
        // record(), called unconditionally inside every export endpoint),
        // independent of whatever the user does in the share sheet. The
        // Android branch above surfaces that in its own "Download complete"
        // alert; iOS has no equivalent system notification for a share
        // sheet action, so this is the only place that fact is ever shown
        // to an iOS user.
        Alert.alert(
          t('more:resume_download_complete_title', { defaultValue: 'Download complete' }),
          t('more:document_saved_to_app_message', {
            defaultValue: 'This document was also saved to your Generated Documents — you can redownload or rename it anytime.',
          }),
        );
      }
    } catch (e: any) {
      Alert.alert(
        t('more:resume_download_failed_title', { defaultValue: "Couldn't download the file" }),
        e?.message ?? t('more:resume_download_failed_message', { defaultValue: 'Please try again in a moment.' }),
      );
    } finally {
      setDownloadingFormat(null);
    }
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={
          docType === 'cv'
            ? t('more:resume_build_cv_title', { defaultValue: 'Build My CV' })
            : t('more:resume_build_matching_title', { defaultValue: 'Build Matching Resume' })
        }
        accessoryLeft={<NavigationAction />}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        <Text category="h8" bold status="placeholder" mb={4}>
          {t('more:resume_target_role', { defaultValue: 'Target Role' })}
        </Text>
        <Flex justify="flex-start" mb={20}>
          <Input value={role} onChangeText={setRole} style={[styles.roleInput, globalStyle.flexOne]} textStyle={globalStyle.inputText} />
          <Button
            size="small"
            appearance="outline"
            style={styles.regenerateBtn}
            disabled={isGenerating}
            onPress={() => buildContent(role)}>
            {isGenerating ? '…' : t('more:resume_regenerate', { defaultValue: 'Regenerate' })}
          </Button>
        </Flex>

        {isGenerating ? (
          <Flex vertical itemsCenter justify="center" style={{ paddingVertical: 60 }}>
            <Spinner size="large" />
            <Text category="h9-s" status="placeholder" mt={12} center>
              {route.params?.useStoredResume || route.params?.existingResumeDocumentId
                ? t('more:resume_tailoring_existing', { defaultValue: 'Tailoring your existing resume to this job…' })
                : docType === 'cv'
                ? t('more:resume_drafting_cv', { defaultValue: 'Drafting your CV…' })
                : t('more:resume_drafting_resume', { defaultValue: 'Drafting your resume…' })}
            </Text>
          </Flex>
        ) : genError ? (
          <Flex vertical itemsCenter justify="center" style={{ paddingVertical: 40 }}>
            <Text category="h9-s" status="danger" center mb={16}>
              {genError}
            </Text>
            <Text category="h9" status="link" bold onPress={() => buildContent(role)}>
              {t('common:try_again', { defaultValue: 'Try again' })}
            </Text>
          </Flex>
        ) : content ? (
          <>
            {/* Product request: "Users should be able to drag, rearrange
                and edit the content of the resume/CV." Every section below
                is now a real editable field, and every list-type section
                (experience, education, projects, volunteer, certifications,
                awards, languages, references, and the bullets inside each
                experience entry) can be reordered by dragging its handle —
                see components/DraggableList.tsx for how the drag mechanic
                itself works and why it deliberately avoids gesture-handler/
                Reanimated. Core Skills stays as add/remove chips (no drag) —
                its own wrapping-row layout isn't a vertical list, so a drag
                handle there doesn't have a natural "which row" meaning the
                way it does everywhere else on this screen. */}
            <SectionHeading>{t('more:resume_contact_info', { defaultValue: 'Contact Info' })}</SectionHeading>
            <View style={styles.contactGrid}>
              <Input
                placeholder={t('more:resume_contact_name', { defaultValue: 'Full name' })}
                value={content.contact.name ?? ''}
                onChangeText={v => updateSection('contact', { ...content.contact, name: v })}
                style={[globalStyle.inputField, styles.contactField]}
                textStyle={globalStyle.inputText}
              />
              <Input
                placeholder={t('more:resume_contact_email', { defaultValue: 'Email' })}
                value={content.contact.email ?? ''}
                onChangeText={v => updateSection('contact', { ...content.contact, email: v })}
                autoCapitalize="none"
                keyboardType="email-address"
                style={[globalStyle.inputField, styles.contactField]}
                textStyle={globalStyle.inputText}
              />
              <Input
                placeholder={t('more:resume_contact_phone', { defaultValue: 'Phone' })}
                value={content.contact.phone ?? ''}
                onChangeText={v => updateSection('contact', { ...content.contact, phone: v })}
                keyboardType="phone-pad"
                style={[globalStyle.inputField, styles.contactField]}
                textStyle={globalStyle.inputText}
              />
              <Input
                placeholder={t('more:resume_contact_location', { defaultValue: 'Location' })}
                value={content.contact.location ?? ''}
                onChangeText={v => updateSection('contact', { ...content.contact, location: v })}
                style={[globalStyle.inputField, styles.contactField]}
                textStyle={globalStyle.inputText}
              />
            </View>

            <SectionHeading mt={24}>{t('more:resume_professional_summary', { defaultValue: 'Professional Summary' })}</SectionHeading>
            <Input
              multiline
              value={content.summary}
              onChangeText={v => updateSection('summary', v)}
              style={[globalStyle.inputField, styles.multilineInput]}
              textStyle={[globalStyle.inputText, styles.multilineText]}
              placeholder={t('more:resume_professional_summary', { defaultValue: 'Professional Summary' })}
            />

            <SectionHeading mt={24}>{t('more:resume_core_skills', { defaultValue: 'Core Skills' })}</SectionHeading>
            <View style={styles.chipsWrap}>
              {content.coreSkills.map((skill, i) => (
                <View key={i} style={[styles.chip, styles.editableChip, { backgroundColor: theme['background-basic-color-2'] }]}>
                  <Text category="h9" bold>
                    {skill}
                  </Text>
                  <TouchableOpacity
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => updateSection('coreSkills', content.coreSkills.filter((_, si) => si !== i))}>
                    <Icon pack="eva" name="close-outline" style={[globalStyle.icon16, { tintColor: theme['text-hint-color'], marginLeft: 6 }]} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <AddChipInput
              placeholder={t('more:resume_add_skill', { defaultValue: 'Add a skill…' })}
              onAdd={skill => updateSection('coreSkills', [...content.coreSkills, skill])}
            />

            <SectionHeading mt={24}>{t('more:resume_certifications', { defaultValue: 'Certifications' })}</SectionHeading>
            <StringListEditor
              items={content.certifications}
              onChange={next => updateSection('certifications', next)}
              placeholder={t('more:resume_add_certification', { defaultValue: 'Add a certification…' })}
            />

            <SectionHeading mt={24}>{t('more:resume_professional_experience', { defaultValue: 'Professional Experience' })}</SectionHeading>
            <DraggableList
              data={content.experience}
              keyExtractor={(_e, i) => `exp-${i}`}
              onReorder={next => updateSection('experience', next)}
              renderItem={(entry, i, handle) => (
                <ExperienceCard
                  entry={entry}
                  handle={handle}
                  onChange={next => {
                    const copy = content.experience.slice();
                    copy[i] = next;
                    updateSection('experience', copy);
                  }}
                  onRemove={() => updateSection('experience', content.experience.filter((_, ei) => ei !== i))}
                  t={t}
                  theme={theme}
                />
              )}
            />
            <AddRowButton
              label={t('more:resume_add_experience', { defaultValue: 'Add work experience' })}
              onPress={() =>
                updateSection('experience', [
                  ...content.experience,
                  { title: '', company: '', location: '', start: '', end: '', bullets: [] },
                ])
              }
            />

            <SectionHeading mt={24}>{t('more:resume_education', { defaultValue: 'Education' })}</SectionHeading>
            <DraggableList
              data={content.education}
              keyExtractor={(_e, i) => `edu-${i}`}
              onReorder={next => updateSection('education', next)}
              renderItem={(entry, i, handle) => (
                <EducationCard
                  entry={entry}
                  handle={handle}
                  onChange={next => {
                    const copy = content.education.slice();
                    copy[i] = next;
                    updateSection('education', copy);
                  }}
                  onRemove={() => updateSection('education', content.education.filter((_, ei) => ei !== i))}
                  t={t}
                />
              )}
            />
            <AddRowButton
              label={t('more:resume_add_education', { defaultValue: 'Add education' })}
              onPress={() =>
                updateSection('education', [...content.education, { school: '', degree: '', field: '', start: '', end: '' }])
              }
            />

            <SectionHeading mt={24}>{t('more:resume_projects_publications', { defaultValue: 'Projects & Publications' })}</SectionHeading>
            <DraggableList
              data={content.projects}
              keyExtractor={(_e, i) => `proj-${i}`}
              onReorder={next => updateSection('projects', next)}
              renderItem={(entry, i, handle) => (
                <ProjectCard
                  entry={entry}
                  handle={handle}
                  onChange={next => {
                    const copy = content.projects.slice();
                    copy[i] = next;
                    updateSection('projects', copy);
                  }}
                  onRemove={() => updateSection('projects', content.projects.filter((_, ei) => ei !== i))}
                  t={t}
                />
              )}
            />
            <AddRowButton
              label={t('more:resume_add_project', { defaultValue: 'Add a project' })}
              onPress={() => updateSection('projects', [...content.projects, { name: '', description: '', link: '' }])}
            />

            <SectionHeading mt={24}>{t('more:resume_volunteer_experience', { defaultValue: 'Volunteer Experience' })}</SectionHeading>
            <DraggableList
              data={content.volunteer}
              keyExtractor={(_e, i) => `vol-${i}`}
              onReorder={next => updateSection('volunteer', next)}
              renderItem={(entry, i, handle) => (
                <VolunteerCard
                  entry={entry}
                  handle={handle}
                  onChange={next => {
                    const copy = content.volunteer.slice();
                    copy[i] = next;
                    updateSection('volunteer', copy);
                  }}
                  onRemove={() => updateSection('volunteer', content.volunteer.filter((_, ei) => ei !== i))}
                  t={t}
                />
              )}
            />
            <AddRowButton
              label={t('more:resume_add_volunteer', { defaultValue: 'Add volunteer experience' })}
              onPress={() => updateSection('volunteer', [...content.volunteer, { org: '', role: '', description: '' }])}
            />

            <SectionHeading mt={24}>{t('more:resume_awards_achievements', { defaultValue: 'Awards & Achievements' })}</SectionHeading>
            <StringListEditor
              items={content.awards}
              onChange={next => updateSection('awards', next)}
              placeholder={t('more:resume_add_award', { defaultValue: 'Add an award…' })}
            />

            <SectionHeading mt={24}>{t('more:resume_languages', { defaultValue: 'Languages' })}</SectionHeading>
            <StringListEditor
              items={content.languages}
              onChange={next => updateSection('languages', next)}
              placeholder={t('more:resume_add_language', { defaultValue: 'Add a language…' })}
            />

            <SectionHeading mt={24}>{t('more:resume_references', { defaultValue: 'References' })}</SectionHeading>
            <DraggableList
              data={content.references}
              keyExtractor={(_e, i) => `ref-${i}`}
              onReorder={next => updateSection('references', next)}
              renderItem={(entry, i, handle) => (
                <ReferenceCard
                  entry={entry}
                  handle={handle}
                  onChange={next => {
                    const copy = content.references.slice();
                    copy[i] = next;
                    updateSection('references', copy);
                  }}
                  onRemove={() => updateSection('references', content.references.filter((_, ei) => ei !== i))}
                  t={t}
                />
              )}
            />
            <AddRowButton
              label={t('more:resume_add_reference', { defaultValue: 'Add a reference' })}
              onPress={() => updateSection('references', [...content.references, { name: '', relationship: '', contact: '' }])}
            />

            <Flex justify="flex-start" itemsCenter mt={24}>
              <Text category="h9" status="link" bold onPress={onSaveChanges}>
                {savingChanges
                  ? t('more:resume_saving', { defaultValue: 'Saving…' })
                  : savedChanges
                  ? t('more:resume_saved', { defaultValue: 'Saved ✓' })
                  : t('more:resume_save_changes', { defaultValue: 'Save changes' })}
              </Text>
            </Flex>

            {content.suggestedKeywords.length ? (
              <>
                <Text category="h6" bold mt={24} mb={8}>
                  {t('more:resume_consider_adding', { defaultValue: 'Consider Adding' })}
                </Text>
                <Text category="h9-s" status="placeholder" mb={4}>
                  {t('more:resume_consider_adding_description', {
                    defaultValue:
                      'This job description also looks for these — worth adding if you have real experience with them.',
                  })}
                </Text>
                <Text category="h10" status="warning" mb={8}>
                  {t('more:resume_consider_adding_hint', { defaultValue: 'Tap a skill to add it to Core Skills' })}
                </Text>
                <View style={styles.chipsWrap}>
                  {content.suggestedKeywords.map((skill, i) => (
                    <TouchableOpacity
                      key={i}
                      activeOpacity={0.6}
                      onPress={() => addSuggestedSkill(skill)}
                      style={[styles.chip, styles.suggestedChip, { backgroundColor: theme['color-warning-transparent-200'] }]}>
                      <Icon
                        pack="eva"
                        name="plus-outline"
                        style={[globalStyle.icon16, { tintColor: theme['text-basic-color'], marginRight: 4 }]}
                      />
                      {/* BUG FIX (illegible orange pill text): `status=
                          "warning"` resolves to this app's only warning
                          shade (#FE9870, a light peach), almost invisible
                          against this same peach-tinted fill. `color-
                          warning-700` (added to appTheme.json) is a proper
                          darkened burnt-orange with real contrast. */}
                      <Text category="h9" bold style={{color: theme['color-warning-700']}}>
                        {skill}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}

            <Text category="h6" bold mt={32} mb={12}>
              {t('more:resume_style', { defaultValue: 'Style' })}
            </Text>
            <Flex justify="flex-start" mb={32}>
              {STYLE_OPTIONS.map(opt => {
                const active = opt.key === style;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    activeOpacity={0.7}
                    onPress={() => setStyle(opt.key)}
                    style={[
                      styles.styleCard,
                      { borderColor: active ? theme['color-primary-500'] : theme['background-basic-color-3'] },
                    ]}>
                    <Text category="h8" bold status={active ? 'link' : 'basic'}>
                      {opt.label}
                    </Text>
                    <Text category="h10" status="placeholder" mt={4}>
                      {opt.description}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </Flex>

            <CtaButton
              children={
                docType === 'cv'
                  ? t('more:resume_preview_cv', { defaultValue: 'Preview CV' })
                  : t('more:resume_preview_resume', { defaultValue: 'Preview Resume' })
              }
              onPress={() => setShowPreview(true)}
              style={[globalStyle.shadowBtn, { marginBottom: 12 }]}
            />
          </>
        ) : null}
      </Content>

      {/* Full document-style preview before committing to a download — per
          user feedback the Style picker + Download buttons alone didn't give
          any sense of what the actual generated resume would look like.
          This mirrors modern/classic/minimal cosmetically (accent color,
          headline weight, spacing) as an approximation of the server-
          rendered file, not a pixel-exact copy — the real PDF/DOCX is still
          rendered server-side (see resumeService.exportResume). */}
      <Modal visible={showPreview} animationType="slide" onRequestClose={() => setShowPreview(false)}>
        <Container style={styles.container}>
          <TopNavigation
            title={t('more:resume_preview_title', { defaultValue: 'Preview' })}
            accessoryLeft={
              <TouchableOpacity onPress={() => setShowPreview(false)} style={styles.previewCloseBtn}>
                {/* Was missing a tintColor entirely -- Eva's close-outline SVG
                    has no fill of its own, so with no tintColor set it falls
                    back to the SVG spec default of solid black, invisible
                    against this header's dark background-basic-color-1 in
                    dark mode. theme['text-basic-color'] tracks the theme
                    correctly, same fix already applied elsewhere in the app
                    (see ResumeBuilder.tsx's own close icon). */}
                <Icon pack="eva" name="close-outline" style={[globalStyle.icon24, {tintColor: theme['text-basic-color']}]} />
              </TouchableOpacity>
            }
          />
          <Content padder contentContainerStyle={styles.content}>
            {content ? (
              <View
                style={[
                  styles.previewCard,
                  style === 'modern'
                    ? { borderTopWidth: 6, borderTopColor: theme['color-primary-500'] }
                    : style === 'classic'
                    ? { borderWidth: 1, borderColor: theme['background-basic-color-3'] }
                    : { borderWidth: 0 },
                ]}>
                <Text
                  category={style === 'minimal' ? 'h6' : 'h4'}
                  bold
                  status={style === 'modern' ? 'link' : 'basic'}>
                  {content.contact.name ||
                    profile?.name ||
                    (docType === 'cv'
                      ? t('more:resume_curriculum_vitae', { defaultValue: 'Curriculum Vitae' })
                      : t('more:resume_your_name', { defaultValue: 'Your Name' }))}
                </Text>
                <Text category="h8" status="placeholder" mb={20}>
                  {role || t('more:resume_target_role', { defaultValue: 'Target Role' })}
                </Text>

                {content.summary ? (
                  <>
                    <Text category="h8" bold mb={6}>{t('more:resume_professional_summary', { defaultValue: 'Professional Summary' })}</Text>
                    <Text category="h9-s" mb={18}>{content.summary}</Text>
                  </>
                ) : null}

                {content.coreSkills.length ? (
                  <>
                    <Text category="h8" bold mb={8}>{t('more:resume_core_skills', { defaultValue: 'Core Skills' })}</Text>
                    <Text category="h9-s" status="placeholder" mb={18}>
                      {content.coreSkills.join('  ·  ')}
                    </Text>
                  </>
                ) : null}

                {content.experience.length ? (
                  <>
                    <Text category="h8" bold mb={8}>{t('more:resume_professional_experience', { defaultValue: 'Professional Experience' })}</Text>
                    {content.experience.map((e, i) => (
                      <View key={i} style={{ marginBottom: 10 }}>
                        <Text category="h9" bold>{[e.title, e.company].filter(Boolean).join(' — ')}</Text>
                        {e.bullets.map((b, bi) => (
                          <Text key={bi} category="h9-s" mb={4}>{'•'} {b}</Text>
                        ))}
                      </View>
                    ))}
                  </>
                ) : null}

                {content.education.length ? (
                  <>
                    <Text category="h8" bold mb={8} mt={6}>{t('more:resume_education', { defaultValue: 'Education' })}</Text>
                    {content.education.map((e, i) => (
                      <Text key={i} category="h9-s" mb={6}>
                        {[e.school, [e.degree, e.field].filter(Boolean).join(', ')].filter(Boolean).join(' — ')}
                      </Text>
                    ))}
                  </>
                ) : null}
              </View>
            ) : null}

            <CtaButton
              children={
                downloadingFormat === 'docx'
                  ? t('more:resume_preparing', { defaultValue: 'Preparing…' })
                  : t('more:resume_download_word', { defaultValue: 'Download as Word (.docx)' })
              }
              disabled={!!downloadingFormat}
              onPress={() => onDownload('docx')}
              style={[globalStyle.shadowBtn, { marginTop: 24, marginBottom: 12 }]}
            />
            <Button
              children={
                downloadingFormat === 'pdf'
                  ? t('more:resume_preparing', { defaultValue: 'Preparing…' })
                  : t('more:resume_download_pdf', { defaultValue: 'Download as PDF' })
              }
              appearance="outline"
              disabled={!!downloadingFormat}
              onPress={() => onDownload('pdf')}
            />
          </Content>
        </Container>
      </Modal>
    </Container>
  );
});

function SectionHeading({ children, mt }: { children: React.ReactNode; mt?: number }) {
  return (
    <Text category="h6" bold mt={mt ?? 0} mb={12}>
      {children}
    </Text>
  );
}

// Small inline "type + Enter/tap-to-add" control used by Core Skills — kept
// separate from StringListEditor below since skills render as wrapping
// chips, not a vertical list (see the comment above the Core Skills section
// on why chips don't get a drag handle).
function AddChipInput({ placeholder, onAdd }: { placeholder: string; onAdd: (value: string) => void }) {
  const [value, setValue] = React.useState('');
  const commit = () => {
    const trimmed = value.trim();
    if (trimmed) onAdd(trimmed);
    setValue('');
  };
  return (
    <Flex justify="flex-start" mb={16} mt={4}>
      <Input
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        onSubmitEditing={commit}
        returnKeyType="done"
        style={[globalStyle.inputField, addChipStyles.input]}
        textStyle={globalStyle.inputText}
      />
      <TouchableOpacity onPress={commit} style={addChipStyles.addBtn}>
        <Icon pack="eva" name="plus-outline" style={globalStyle.icon20} />
      </TouchableOpacity>
    </Flex>
  );
}
const addChipStyles = StyleService.create({
  input: { flex: 1, marginRight: 8 },
  addBtn: {
    width: 40,
    height: 40,
    // FULL RESKIN: square-ish borderRadius: 5 -> 999 (fully circular),
    // matching the app-wide pill/circle convention for filled buttons.
    borderRadius: 999,
    backgroundColor: 'color-primary-100',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// Reorderable, editable, deletable list of plain strings — used by
// Certifications, Awards, and Languages (the resume's three string-array
// sections). One shared implementation instead of three near-identical
// copies.
function StringListEditor({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = React.useState('');
  const commitDraft = () => {
    const trimmed = draft.trim();
    if (trimmed) onChange([...items, trimmed]);
    setDraft('');
  };
  return (
    <>
      <DraggableList
        data={items}
        keyExtractor={(_item, i) => `str-${i}`}
        onReorder={onChange}
        renderItem={(item, i, handle) => (
          <Flex justify="flex-start" itemsCenter mb={8}>
            {handle}
            <Input
              value={item}
              onChangeText={v => {
                const copy = items.slice();
                copy[i] = v;
                onChange(copy);
              }}
              style={[globalStyle.inputField, globalStyle.flexOne]}
              textStyle={globalStyle.inputText}
            />
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => onChange(items.filter((_, ri) => ri !== i))}
              style={rowStyles.removeBtn}>
              <Icon pack="eva" name="trash-2-outline" style={globalStyle.icon16} />
            </TouchableOpacity>
          </Flex>
        )}
      />
      <Flex justify="flex-start" itemsCenter mb={8}>
        <Input
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          onSubmitEditing={commitDraft}
          returnKeyType="done"
          style={[globalStyle.inputField, globalStyle.flexOne]}
          textStyle={globalStyle.inputText}
        />
        <TouchableOpacity onPress={commitDraft} style={rowStyles.removeBtn}>
          <Icon pack="eva" name="plus-outline" style={globalStyle.icon16} />
        </TouchableOpacity>
      </Flex>
    </>
  );
}

function AddRowButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={rowStyles.addRow} activeOpacity={0.7}>
      <Icon pack="eva" name="plus-outline" style={globalStyle.icon16} />
      <Text category="h9" bold ml={6}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function CardShell({ handle, onRemove, children }: { handle: React.ReactNode; onRemove: () => void; children: React.ReactNode }) {
  return (
    <View style={rowStyles.card}>
      <Flex justify="space-between" itemsCenter mb={8}>
        {handle}
        <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={onRemove}>
          <Icon pack="eva" name="trash-2-outline" style={globalStyle.icon16} />
        </TouchableOpacity>
      </Flex>
      {children}
    </View>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <Flex justify="flex-start" mb={8}>{children}</Flex>;
}

function ExperienceCard({
  entry,
  handle,
  onChange,
  onRemove,
  t,
  theme,
}: {
  entry: ResumeExperienceEntry;
  handle: React.ReactNode;
  onChange: (next: ResumeExperienceEntry) => void;
  onRemove: () => void;
  t: TFunction;
  theme: Record<string, string>;
}) {
  const bullets = entry.bullets ?? [];
  return (
    <CardShell handle={handle} onRemove={onRemove}>
      <Input
        value={entry.title ?? ''}
        onChangeText={v => onChange({ ...entry, title: v })}
        placeholder={t('more:resume_field_job_title', { defaultValue: 'Job title' })}
        style={[globalStyle.inputField, rowStyles.field]}
        textStyle={globalStyle.inputText}
      />
      <Input
        value={entry.company ?? ''}
        onChangeText={v => onChange({ ...entry, company: v })}
        placeholder={t('more:resume_field_company', { defaultValue: 'Company' })}
        style={[globalStyle.inputField, rowStyles.field]}
        textStyle={globalStyle.inputText}
      />
      <Input
        value={entry.location ?? ''}
        onChangeText={v => onChange({ ...entry, location: v })}
        placeholder={t('more:resume_field_location', { defaultValue: 'Location' })}
        style={[globalStyle.inputField, rowStyles.field]}
        textStyle={globalStyle.inputText}
      />
      <FieldRow>
        <Input
          value={entry.start ?? ''}
          onChangeText={v => onChange({ ...entry, start: v })}
          placeholder={t('more:resume_field_start_date', { defaultValue: 'Start (e.g. Jan 2022)' })}
          style={[globalStyle.inputField, rowStyles.halfField, { marginRight: 8 }]}
          textStyle={globalStyle.inputText}
        />
        <Input
          value={entry.end ?? ''}
          onChangeText={v => onChange({ ...entry, end: v })}
          placeholder={t('more:resume_field_end_date', { defaultValue: 'End (or Present)' })}
          style={[globalStyle.inputField, rowStyles.halfField]}
          textStyle={globalStyle.inputText}
        />
      </FieldRow>
      <Text category="h10" bold status="placeholder" mt={4} mb={6}>
        {t('more:resume_bullets_label', { defaultValue: 'Highlights' })}
      </Text>
      <DraggableList
        data={bullets}
        keyExtractor={(_b, bi) => `bullet-${bi}`}
        onReorder={next => onChange({ ...entry, bullets: next })}
        renderItem={(bullet, bi, bulletHandle) => (
          <Flex justify="flex-start" itemsCenter mb={6}>
            {bulletHandle}
            <Icon pack="eva" name="checkmark-circle-2-outline" style={[globalStyle.icon16, { tintColor: theme['text-basic-color'], marginRight: 6 }]} />
            <Input
              multiline
              value={bullet}
              onChangeText={v => {
                const copy = bullets.slice();
                copy[bi] = v;
                onChange({ ...entry, bullets: copy });
              }}
              style={[globalStyle.inputField, globalStyle.flexOne]}
              textStyle={globalStyle.inputText}
            />
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => onChange({ ...entry, bullets: bullets.filter((_, ri) => ri !== bi) })}
              style={rowStyles.removeBtn}>
              <Icon pack="eva" name="close-outline" style={globalStyle.icon16} />
            </TouchableOpacity>
          </Flex>
        )}
      />
      <TouchableOpacity onPress={() => onChange({ ...entry, bullets: [...bullets, ''] })} style={rowStyles.addBulletBtn}>
        <Icon pack="eva" name="plus-outline" style={globalStyle.icon16} />
        <Text category="h10" bold ml={4}>
          {t('more:resume_add_bullet', { defaultValue: 'Add highlight' })}
        </Text>
      </TouchableOpacity>
    </CardShell>
  );
}

function EducationCard({
  entry,
  handle,
  onChange,
  onRemove,
  t,
}: {
  entry: ResumeEducationEntry;
  handle: React.ReactNode;
  onChange: (next: ResumeEducationEntry) => void;
  onRemove: () => void;
  t: TFunction;
}) {
  return (
    <CardShell handle={handle} onRemove={onRemove}>
      <Input
        value={entry.school ?? ''}
        onChangeText={v => onChange({ ...entry, school: v })}
        placeholder={t('more:resume_field_school', { defaultValue: 'School' })}
        style={[globalStyle.inputField, rowStyles.field]}
        textStyle={globalStyle.inputText}
      />
      <Input
        value={entry.degree ?? ''}
        onChangeText={v => onChange({ ...entry, degree: v })}
        placeholder={t('more:resume_field_degree', { defaultValue: 'Degree' })}
        style={[globalStyle.inputField, rowStyles.field]}
        textStyle={globalStyle.inputText}
      />
      <Input
        value={entry.field ?? ''}
        onChangeText={v => onChange({ ...entry, field: v })}
        placeholder={t('more:resume_field_field_of_study', { defaultValue: 'Field of study' })}
        style={[globalStyle.inputField, rowStyles.field]}
        textStyle={globalStyle.inputText}
      />
      <FieldRow>
        <Input
          value={entry.start ?? ''}
          onChangeText={v => onChange({ ...entry, start: v })}
          placeholder={t('more:resume_field_start_date', { defaultValue: 'Start (e.g. Jan 2022)' })}
          style={[globalStyle.inputField, rowStyles.halfField, { marginRight: 8 }]}
          textStyle={globalStyle.inputText}
        />
        <Input
          value={entry.end ?? ''}
          onChangeText={v => onChange({ ...entry, end: v })}
          placeholder={t('more:resume_field_end_date', { defaultValue: 'End (or Present)' })}
          style={[globalStyle.inputField, rowStyles.halfField]}
          textStyle={globalStyle.inputText}
        />
      </FieldRow>
    </CardShell>
  );
}

function ProjectCard({
  entry,
  handle,
  onChange,
  onRemove,
  t,
}: {
  entry: ResumeProjectEntry;
  handle: React.ReactNode;
  onChange: (next: ResumeProjectEntry) => void;
  onRemove: () => void;
  t: TFunction;
}) {
  return (
    <CardShell handle={handle} onRemove={onRemove}>
      <Input
        value={entry.name ?? ''}
        onChangeText={v => onChange({ ...entry, name: v })}
        placeholder={t('more:resume_field_project_name', { defaultValue: 'Project name' })}
        style={[globalStyle.inputField, rowStyles.field]}
        textStyle={globalStyle.inputText}
      />
      <Input
        multiline
        value={entry.description ?? ''}
        onChangeText={v => onChange({ ...entry, description: v })}
        placeholder={t('more:resume_field_description', { defaultValue: 'Description' })}
        style={[globalStyle.inputField, rowStyles.field]}
        textStyle={globalStyle.inputText}
      />
      <Input
        value={entry.link ?? ''}
        onChangeText={v => onChange({ ...entry, link: v })}
        placeholder={t('more:resume_field_link', { defaultValue: 'Link (optional)' })}
        autoCapitalize="none"
        style={[globalStyle.inputField, rowStyles.field]}
        textStyle={globalStyle.inputText}
      />
    </CardShell>
  );
}

function VolunteerCard({
  entry,
  handle,
  onChange,
  onRemove,
  t,
}: {
  entry: ResumeVolunteerEntry;
  handle: React.ReactNode;
  onChange: (next: ResumeVolunteerEntry) => void;
  onRemove: () => void;
  t: TFunction;
}) {
  return (
    <CardShell handle={handle} onRemove={onRemove}>
      <Input
        value={entry.role ?? ''}
        onChangeText={v => onChange({ ...entry, role: v })}
        placeholder={t('more:resume_field_role', { defaultValue: 'Role' })}
        style={[globalStyle.inputField, rowStyles.field]}
        textStyle={globalStyle.inputText}
      />
      <Input
        value={entry.org ?? ''}
        onChangeText={v => onChange({ ...entry, org: v })}
        placeholder={t('more:resume_field_organization', { defaultValue: 'Organization' })}
        style={[globalStyle.inputField, rowStyles.field]}
        textStyle={globalStyle.inputText}
      />
      <Input
        multiline
        value={entry.description ?? ''}
        onChangeText={v => onChange({ ...entry, description: v })}
        placeholder={t('more:resume_field_description', { defaultValue: 'Description' })}
        style={[globalStyle.inputField, rowStyles.field]}
        textStyle={globalStyle.inputText}
      />
    </CardShell>
  );
}

function ReferenceCard({
  entry,
  handle,
  onChange,
  onRemove,
  t,
}: {
  entry: ResumeReferenceEntry;
  handle: React.ReactNode;
  onChange: (next: ResumeReferenceEntry) => void;
  onRemove: () => void;
  t: TFunction;
}) {
  return (
    <CardShell handle={handle} onRemove={onRemove}>
      <Input
        value={entry.name ?? ''}
        onChangeText={v => onChange({ ...entry, name: v })}
        placeholder={t('more:resume_field_name', { defaultValue: 'Name' })}
        style={[globalStyle.inputField, rowStyles.field]}
        textStyle={globalStyle.inputText}
      />
      <Input
        value={entry.relationship ?? ''}
        onChangeText={v => onChange({ ...entry, relationship: v })}
        placeholder={t('more:resume_field_relationship', { defaultValue: 'Relationship' })}
        style={[globalStyle.inputField, rowStyles.field]}
        textStyle={globalStyle.inputText}
      />
      <Input
        value={entry.contact ?? ''}
        onChangeText={v => onChange({ ...entry, contact: v })}
        placeholder={t('more:resume_field_contact_info', { defaultValue: 'Contact info' })}
        style={[globalStyle.inputField, rowStyles.field]}
        textStyle={globalStyle.inputText}
      />
    </CardShell>
  );
}

const rowStyles = StyleService.create({
  card: {
    ...globalStyle.card,
    backgroundColor: 'background-basic-color-1',
    // Google-style furnishing pass (see styles/globalStyle.ts's `card`) --
    // 14 -> 20 (redundant with the shared default now, kept explicit for
    // clarity).
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
  },
  field: {
    marginBottom: 8,
  },
  halfField: {
    flex: 1,
  },
  removeBtn: {
    marginLeft: 8,
    padding: 6,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 8,
  },
  addBulletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    marginTop: 2,
  },
});

export default GenerateResume;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  roleInput: {
    ...globalStyle.inputField,
    marginRight: 8,
  },
  regenerateBtn: {
    borderRadius: 12,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 99,
    marginRight: 8,
    marginBottom: 8,
  },
  editableChip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestedChip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  contactField: {
    width: '50%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  // NOTE: `minHeight` on an <Input>'s `style` prop resolves against the
  // OUTER invisible wrapper (see UI Kitten's Input.getComponentStyle --
  // `minHeight` is in PropsService.FlexViewCrossStyleProps, same routing
  // quirk documented in JDAnalyzer.tsx's jdInput/jdText fix), not the
  // visible bordered box or the TextInput itself, so it isn't set here.
  // `multilineText` below carries the real minHeight instead -- it's
  // applied via `textStyle`, which lands directly on the native TextInput,
  // and the visible bordered box then auto-sizes to wrap that.
  multilineInput: {},
  multilineText: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  styleCard: {
    ...globalStyle.card,
    // Bug fix (Android elevation-needs-an-opaque-background — see
    // globalStyle.ts's own comment): plain TouchableOpacity, no `level`
    // wrapper to supply a fill, so the shadow rendered as a heavy gray
    // block instead of a soft lift.
    backgroundColor: 'background-basic-color-1',
    flex: 1,
    borderWidth: 2,
    // Google-style furnishing pass (see styles/globalStyle.ts's `card`) --
    // 14 -> 20.
    borderRadius: 20,
    padding: 14,
    marginRight: 10,
  },
  previewCard: {
    ...globalStyle.card,
    padding: 24,
    // Redesign v2 (full reskin): `card` carries a real shadow again, which
    // needs an opaque fill to render correctly on Android (was
    // 'transparent') — this renders on a plain View (no `level` prop), so
    // the fill has to live here.
    backgroundColor: 'background-basic-color-2',
  },
  previewCloseBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
