import React, { memo } from 'react';
import { Alert, Platform, Share, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Icon,
  Spinner,
} from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
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
const KIND_META: Record<GeneratedDocumentKind, { icon: string; labelKey: string; defaultLabel: string }> = {
  resume: { icon: 'file-text-outline', labelKey: 'more:doc_kind_resume', defaultLabel: 'Resume/CV' },
  cover_letter: { icon: 'email-outline', labelKey: 'more:doc_kind_cover_letter', defaultLabel: 'Cover Letter' },
  resume_variant: { icon: 'copy-outline', labelKey: 'more:doc_kind_resume_variant', defaultLabel: 'Resume Variant' },
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
            return (
              <Layout key={doc.id} level="2" style={styles.docCard}>
                <Flex itemsCenter>
                  <View style={[styles.iconCircle, { backgroundColor: theme['background-basic-color-3'] }]}>
                    <Icon pack="eva" name={meta.icon} style={[globalStyle.icon20, { tintColor: theme['color-primary-500'] }]} />
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
                        pack="eva" name="download-outline"
                        style={[globalStyle.icon24, { tintColor: theme['color-primary-500'], marginRight: 16 }]}
                        onPress={() => onDownload(doc)}
                      />
                      <Icon
                        pack="eva" name="trash-2-outline"
                        style={[globalStyle.icon20, { tintColor: theme['color-danger-500'] }]}
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
    </Container>
  );
});

export default GeneratedDocuments;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 60 },
  docCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
