import React, { memo } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Share, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Icon,
  Input,
  Spinner,
  Button,
} from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import CtaButton from 'components/CtaButton';
import { globalStyle } from 'styles/globalStyle';
import * as generatedDocumentsService from 'services/generatedDocumentsService';
import { GeneratedDocument, GeneratedDocumentKind } from 'services/generatedDocumentsService';
import {
  downloadDocumentFile,
  saveToAndroidDownloads,
  mimeForFormat,
  DocumentUnavailableError,
} from 'services/documentDownloadService';

// "Generated Documents" (product request item): redownload any resume/CV,
// cover letter, or tailored resume variant this user has ever exported to
// PDF/DOCX — previously every export was a one-time share-sheet action with
// nothing left behind once it was dismissed. See
// services/generatedDocumentsService.ts.
//
// Distinct from src/more/MyDocuments.tsx ("My Documents"), which manages
// the user's own uploaded SOURCE files (resumes, certificates,
// transcripts) — this screen is the opposite direction: things the app
// generated FOR the user (see app/models/generated_document.py).
// `status` drives the "colored glass" icon treatment below (app-wide
// consistency pass) — was one flat gray circle for every kind, now each
// kind gets its own tinted circle + matching solid icon color, same
// convention as src/home/Notification/ApplicationItem.tsx's KIND_STYLE.
const KIND_META: Record<GeneratedDocumentKind, { icon: string; labelKey: string; defaultLabel: string; status: 'primary' | 'warning' | 'success' }> = {
  resume: { icon: 'file-text-outline', labelKey: 'more:doc_kind_resume', defaultLabel: 'Resume/CV', status: 'primary' },
  cover_letter: { icon: 'email-outline', labelKey: 'more:doc_kind_cover_letter', defaultLabel: 'Cover Letter', status: 'warning' },
  resume_variant: { icon: 'copy-outline', labelKey: 'more:doc_kind_resume_variant', defaultLabel: 'Resume Variant', status: 'success' },
};

const KIND_COLOR: Record<'primary' | 'warning' | 'success', {bg: string; fg: string}> = {
  primary: {bg: 'color-primary-transparent-200', fg: 'color-primary-500'},
  warning: {bg: 'color-warning-transparent-200', fg: 'color-warning-500'},
  success: {bg: 'color-success-transparent-200', fg: 'color-success-500'},
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const GeneratedDocuments = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common']);

  const [documents, setDocuments] = React.useState<GeneratedDocument[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [downloadingId, setDownloadingId] = React.useState<number | null>(null);
  // Rename (product request: "they should be able to rename the
  // document") — same bottom-sheet Modal + Input pattern ResumeVariants.tsx
  // uses for naming a new variant, reused here for editing an existing
  // document's label.
  const [renamingDoc, setRenamingDoc] = React.useState<GeneratedDocument | null>(null);
  const [renameValue, setRenameValue] = React.useState('');
  const [isSavingRename, setIsSavingRename] = React.useState(false);

  const load = React.useCallback(() => {
    setIsLoading(true);
    generatedDocumentsService.listGeneratedDocuments().then(setDocuments).finally(() => setIsLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const onDownload = async (doc: GeneratedDocument) => {
    if (downloadingId || !doc.url) return;
    setDownloadingId(doc.id);
    try {
      const ext = (doc.format || 'pdf').toLowerCase();
      const filename = `${doc.label || 'Document'}.${ext}`;
      // Goes through documentDownloadService.downloadDocumentFile, which
      // validates the response instead of blindly saving whatever comes
      // back -- this screen redownloads OLDER generated documents, which
      // are exactly the ones most likely to hit a stale/expired link (e.g.
      // one exported before a storage fix), so without this check a dead
      // link here would silently produce an HTML "Not Found" page saved as
      // if it were the real PDF/DOCX.
      const tempPath = await downloadDocumentFile(doc.url, filename);
      if (Platform.OS === 'android') {
        await saveToAndroidDownloads(tempPath, filename, mimeForFormat(ext));
        Alert.alert(
          t('more:resume_download_complete_title', { defaultValue: 'Download complete' }),
          t('more:resume_download_complete_message', {
            defaultValue: '{{filename}} was saved to your Downloads folder.',
            filename,
          }),
        );
      } else {
        await Share.share({ url: `file://${tempPath}`, title: filename });
      }
    } catch (e: any) {
      const isStale = e instanceof DocumentUnavailableError;
      Alert.alert(
        t('more:download_failed_title', { defaultValue: "Couldn't open this document" }),
        isStale
          ? t('more:document_stale_message', {
              defaultValue: "This document is too old to redownload. Please generate it again from scratch.",
            })
          : t('common:something_went_wrong', { defaultValue: 'Something went wrong. Please try again.' }),
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const onOpenRename = (doc: GeneratedDocument) => {
    setRenamingDoc(doc);
    setRenameValue(doc.label);
  };

  const onCloseRename = () => {
    if (isSavingRename) return;
    setRenamingDoc(null);
    setRenameValue('');
  };

  const onSaveRename = async () => {
    if (!renamingDoc) return;
    const label = renameValue.trim();
    if (!label) return;
    setIsSavingRename(true);
    try {
      const updated = await generatedDocumentsService.renameGeneratedDocument(renamingDoc.id, label);
      setDocuments(prev => prev.map(d => (d.id === updated.id ? updated : d)));
      setRenamingDoc(null);
      setRenameValue('');
    } catch {
      Alert.alert(
        t('more:rename_document_failed_title', { defaultValue: "Couldn't rename document" }),
        t('common:something_went_wrong', { defaultValue: 'Something went wrong. Please try again.' }),
      );
    } finally {
      setIsSavingRename(false);
    }
  };

  const onDelete = (doc: GeneratedDocument) => {
    Alert.alert(
      t('more:delete_document_title', { defaultValue: 'Remove this document?' }),
      doc.label,
      [
        { text: t('common:cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common:delete', { defaultValue: 'Delete' }), style: 'destructive',
          onPress: async () => {
            setDocuments(prev => prev.filter(d => d.id !== doc.id));
            await generatedDocumentsService.deleteGeneratedDocument(doc.id);
          },
        },
      ],
    );
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:generated_documents', { defaultValue: 'Generated Documents' })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder contentContainerStyle={styles.content}>
        <Text category="h9-s" status="placeholder" mb={20}>
          {t('more:generated_documents_description', {
            defaultValue: 'Every resume, cover letter, and tailored variant you\'ve generated — redownload any of them anytime.',
          })}
        </Text>

        {isLoading ? (
          <Flex center style={{ paddingVertical: 40 }}><Spinner size="large" /></Flex>
        ) : documents.length === 0 ? (
          <Text category="h9-s" status="placeholder" center mt={20}>
            {t('more:no_generated_documents_yet', { defaultValue: "Nothing here yet — anything you download from Resume Builder, Cover Letter Generator, or Resume Evolution will show up here." })}
          </Text>
        ) : (
          documents.map(doc => {
            const meta = KIND_META[doc.kind] ?? KIND_META.resume;
            const kindColor = KIND_COLOR[meta.status];
            return (
              <Layout key={doc.id} level="2" style={styles.docCard}>
                <Flex itemsCenter>
                  <View style={[styles.iconCircle, { backgroundColor: theme[kindColor.bg] }]}>
                    <Icon pack="eva" name={meta.icon} style={[globalStyle.icon20, { tintColor: theme[kindColor.fg] }]} />
                  </View>
                  <Flex vertical style={globalStyle.flexOne} ml={12}>
                    <Text category="h9" bold numberOfLines={1}>{doc.label || t(meta.labelKey, { defaultValue: meta.defaultLabel })}</Text>
                    <Text category="h10" status="placeholder">
                      {t(meta.labelKey, { defaultValue: meta.defaultLabel })}
                      {doc.format ? ` · ${doc.format.toUpperCase()}` : ''}
                      {doc.createdAt ? ` · ${formatDate(doc.createdAt)}` : ''}
                    </Text>
                  </Flex>
                  {downloadingId === doc.id ? (
                    <Spinner size="small" status="basic" />
                  ) : (
                    <Flex itemsCenter>
                      <Icon
                        pack="eva" name="edit-2-outline"
                        style={[globalStyle.icon20, { tintColor: theme['text-basic-color'], marginRight: 16 }]}
                        onPress={() => onOpenRename(doc)}
                      />
                      <Icon
                        pack="eva" name="download-outline"
                        style={[globalStyle.icon24, { tintColor: theme['text-basic-color'], marginRight: 16 }]}
                        onPress={() => onDownload(doc)}
                      />
                      <Icon
                        pack="eva" name="trash-2-outline"
                        style={[globalStyle.icon20, { tintColor: theme['text-basic-color'] }]}
                        onPress={() => onDelete(doc)}
                      />
                    </Flex>
                  )}
                </Flex>
              </Layout>
            );
          })
        )}
      </Content>

      <Modal visible={!!renamingDoc} transparent animationType="slide" onRequestClose={onCloseRename}>
        {/* Same KeyboardAvoidingView wrapper as ResumeVariants.tsx's own
            naming sheet — a raw Modal bottom sheet doesn't move out of the
            keyboard's way on its own. */}
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Layout level="1" style={styles.modalSheet}>
            <Text category="h7" bold mb={16}>
              {t('more:rename_document_title', { defaultValue: 'Rename document' })}
            </Text>
            <Input
              placeholder={t('more:document_label_placeholder', { defaultValue: 'Document name' })}
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
              style={[styles.input, { marginBottom: 20 }]}
              textStyle={globalStyle.inputText}
            />
            <CtaButton disabled={!renameValue.trim() || isSavingRename} onPress={onSaveRename}>
              {isSavingRename ? () => <Spinner size="small" status="control" /> : t('common:save', { defaultValue: 'Save' })}
            </CtaButton>
            <Button appearance="outline" style={{ marginTop: 12 }} onPress={onCloseRename} disabled={isSavingRename}>
              {t('common:cancel', { defaultValue: 'Cancel' })}
            </Button>
          </Layout>
        </KeyboardAvoidingView>
      </Modal>
    </Container>
  );
});

export default GeneratedDocuments;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 60 },
  docCard: {
    ...globalStyle.card,
    padding: 14,
    marginBottom: 12,
    // Redesign v2 (full reskin): `card` carries a real shadow again, which
    // needs an opaque fill on Android — dropped the 'transparent' override
    // so this Layout's own `level="2"` background shows through instead.
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Rename modal — same bottom-sheet treatment as ResumeVariants.tsx's own
  // naming sheet (see that file's own styles for the pattern this copies).
  input: { ...globalStyle.inputField },
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
});
