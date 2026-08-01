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
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import * as resumeGenerationService from 'services/resumeGenerationService';
import {
  downloadDocumentFile,
  saveToAndroidDownloads,
  mimeForFormat,
} from 'services/documentDownloadService';
import { ResumeSections, ResumeStyle, ResumeDocType } from 'services/resumeGenerationService';
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

  const buildContent = React.useCallback(
    async (targetRole: string) => {
      setIsGenerating(true);
      setGenError(null);
      try {
        const generated = await resumeGenerationService.generateResumeContent({
          role: targetRole,
          jdText: route.params?.jdText,
        });
        setContent(generated);
      } catch (e: any) {
        setGenError(e?.message ?? t('more:resume_gen_error', { defaultValue: 'Could not generate resume content.' }));
      } finally {
        setIsGenerating(false);
      }
    },
    [route.params?.jdText],
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
          <Input value={role} onChangeText={setRole} style={[styles.roleInput, globalStyle.flexOne]} />
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
              {docType === 'cv'
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
            {content.summary ? (
              <>
                <Text category="h6" bold mb={8}>
                  {t('more:resume_professional_summary', { defaultValue: 'Professional Summary' })}
                </Text>
                <Text category="h9-s" status="placeholder" mb={24}>
                  {content.summary}
                </Text>
              </>
            ) : null}

            {content.coreSkills.length ? (
              <>
                <Text category="h6" bold mb={12}>
                  {t('more:resume_core_skills', { defaultValue: 'Core Skills' })}
                </Text>
                <View style={styles.chipsWrap}>
                  {content.coreSkills.map((skill, i) => (
                    <View key={i} style={[styles.chip, { backgroundColor: theme['background-basic-color-2'] }]}>
                      <Text category="h9" bold>
                        {skill}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {content.certifications.length ? (
              <SimpleListSection
                title={t('more:resume_certifications', { defaultValue: 'Certifications' })}
                items={content.certifications}
                theme={theme}
              />
            ) : null}

            {content.experience.length ? (
              <>
                <Text category="h6" bold mt={24} mb={12}>
                  {t('more:resume_professional_experience', { defaultValue: 'Professional Experience' })}
                </Text>
                {content.experience.map((e, i) => (
                  <View key={i} style={{ marginBottom: 16 }}>
                    <Text category="h8" bold>
                      {[e.title, e.company].filter(Boolean).join(' — ')}
                    </Text>
                    {e.location || e.start || e.end ? (
                      <Text category="h10" status="placeholder" mb={6}>
                        {[e.location, [e.start, e.end].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                    {e.bullets.map((b, bi) => (
                      <Flex key={bi} justify="flex-start" itemsCenter mb={6}>
                        <Icon pack="eva" name="checkmark-circle-2-outline" style={[globalStyle.icon16, { tintColor: theme['text-basic-color'] }]} />
                        <Text category="h9-s" ml={10} style={globalStyle.flexOne}>
                          {b}
                        </Text>
                      </Flex>
                    ))}
                  </View>
                ))}
              </>
            ) : null}

            {content.education.length ? (
              <>
                <Text category="h6" bold mt={12} mb={12}>
                  {t('more:resume_education', { defaultValue: 'Education' })}
                </Text>
                {content.education.map((e, i) => (
                  <View key={i} style={{ marginBottom: 10 }}>
                    <Text category="h8" bold>
                      {[e.school, [e.degree, e.field].filter(Boolean).join(', ')].filter(Boolean).join(' — ')}
                    </Text>
                    {e.start || e.end ? (
                      <Text category="h10" status="placeholder">
                        {[e.start, e.end].filter(Boolean).join(' – ')}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </>
            ) : null}

            {content.projects.length ? (
              <>
                <Text category="h6" bold mt={12} mb={12}>
                  {t('more:resume_projects_publications', { defaultValue: 'Projects & Publications' })}
                </Text>
                {content.projects.map((p, i) => (
                  <View key={i} style={{ marginBottom: 10 }}>
                    <Text category="h8" bold>{p.name}</Text>
                    {p.description ? <Text category="h9-s" status="placeholder">{p.description}</Text> : null}
                  </View>
                ))}
              </>
            ) : null}

            {content.volunteer.length ? (
              <>
                <Text category="h6" bold mt={12} mb={12}>
                  {t('more:resume_volunteer_experience', { defaultValue: 'Volunteer Experience' })}
                </Text>
                {content.volunteer.map((v, i) => (
                  <View key={i} style={{ marginBottom: 10 }}>
                    <Text category="h8" bold>{[v.role, v.org].filter(Boolean).join(' — ')}</Text>
                    {v.description ? <Text category="h9-s" status="placeholder">{v.description}</Text> : null}
                  </View>
                ))}
              </>
            ) : null}

            {content.awards.length ? (
              <SimpleListSection
                title={t('more:resume_awards_achievements', { defaultValue: 'Awards & Achievements' })}
                items={content.awards}
                theme={theme}
              />
            ) : null}

            {content.languages.length ? (
              <>
                <Text category="h6" bold mt={12} mb={8}>
                  {t('more:resume_languages', { defaultValue: 'Languages' })}
                </Text>
                <Text category="h9-s" status="placeholder" mb={12}>
                  {content.languages.join(' • ')}
                </Text>
              </>
            ) : null}

            {content.references.length ? (
              <>
                <Text category="h6" bold mt={12} mb={12}>
                  {t('more:resume_references', { defaultValue: 'References' })}
                </Text>
                {content.references.map((r, i) => (
                  <Text key={i} category="h9-s" status="placeholder" mb={4}>
                    {[r.name, r.relationship, r.contact].filter(Boolean).join(' — ')}
                  </Text>
                ))}
              </>
            ) : null}

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
                      <Text category="h9" status="warning" bold>
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

function SimpleListSection({ title, items, theme }: { title: string; items: string[]; theme: Record<string, string> }) {
  return (
    <>
      <Text category="h6" bold mt={12} mb={12}>
        {title}
      </Text>
      {items.map((item, i) => (
        <Flex key={i} justify="flex-start" itemsCenter mb={6}>
          <Icon pack="eva" name="checkmark-circle-2-outline" style={[globalStyle.icon16, { tintColor: theme['text-basic-color'] }]} />
          <Text category="h9-s" ml={10} style={globalStyle.flexOne}>
            {item}
          </Text>
        </Flex>
      ))}
    </>
  );
}

export default GenerateResume;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  roleInput: {
    borderRadius: 12,
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
  suggestedChip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  styleCard: {
    ...globalStyle.card,
    flex: 1,
    borderWidth: 2,
    borderRadius: 16,
    padding: 14,
    marginRight: 10,
  },
  previewCard: {
    ...globalStyle.card,
    borderRadius: 16,
    padding: 24,
    backgroundColor: 'transparent',
  },
  previewCloseBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
