import React, {memo} from 'react';
import {Alert, TouchableOpacity, View} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Button,
  Icon,
  Spinner,
} from '@ui-kitten/components';
import {pick, isErrorWithCode, errorCodes, types as documentTypes} from '@react-native-documents/picker';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import {globalStyle} from 'styles/globalStyle';
import {renderCenteredLabel} from 'utils/buttonLabel';
import * as documentsService from 'services/documentsService';
import {DocumentRecord} from 'services/documentsService';

function formatSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Real "My Documents" screen — previously the More menu's "My Documents" row
// (see src/more/MoreSrc.tsx) mis-navigated to MyChildren, a leftover from
// the pre-Saveur childcare template, since no actual document manager screen
// had ever been built despite documentsService.ts already having a full
// working upload/list/delete implementation with nothing calling it. Now a
// real, standalone management screen (list/upload/delete). ResumeBuilder's
// "choose from My Documents" import option has its own compact inline
// picker (DocumentPickerModal in src/more/ResumeBuilder.tsx) rather than
// reusing this screen directly, since that flow needs a value returned to
// the caller rather than a management UI.
const MyDocuments = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['more', 'common']);

  const [documents, setDocuments] = React.useState<DocumentRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const loadDocuments = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await documentsService.listDocuments();
      setDocuments(list);
    } catch (e: any) {
      setLoadError(e?.message ?? t('more:documents_load_failed', {defaultValue: 'Could not load your documents.'}));
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const onUpload = async () => {
    try {
      const [result] = await pick({
        type: [documentTypes.pdf, documentTypes.doc, documentTypes.docx, documentTypes.plainText, documentTypes.images],
      });
      setIsUploading(true);
      const doc = await documentsService.uploadDocument({
        uri: result.uri,
        name: result.name ?? t('more:documents_selected_file_fallback', {defaultValue: 'Selected file'}),
        sizeBytes: result.size,
        mimeType: result.type,
      });
      setDocuments(prev => [doc, ...prev]);
    } catch (e: any) {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return;
      Alert.alert(
        t('more:documents_upload_failed_title', {defaultValue: 'Upload failed'}),
        e?.message ?? t('more:documents_upload_failed_body', {defaultValue: 'Something went wrong. Please try again.'}),
      );
    } finally {
      setIsUploading(false);
    }
  };

  const onDelete = (doc: DocumentRecord) => {
    Alert.alert(
      t('more:documents_delete_confirm_title', {defaultValue: 'Delete document?'}),
      t('more:documents_delete_confirm_body', {
        defaultValue: 'Remove "{{name}}" from My Documents?',
        name: doc.name ?? t('more:documents_untitled_file_fallback', {defaultValue: 'this file'}),
      }),
      [
        {text: t('common:cancel', {defaultValue: 'Cancel'}), style: 'cancel'},
        {
          text: t('common:delete', {defaultValue: 'Delete'}),
          style: 'destructive',
          onPress: async () => {
            setDeletingId(doc.id);
            try {
              await documentsService.deleteDocument(doc.id);
              setDocuments(prev => prev.filter(d => d.id !== doc.id));
            } catch (e: any) {
              Alert.alert(
                t('more:documents_delete_failed_title', {defaultValue: "Couldn't delete"}),
                e?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
              );
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <Container style={styles.container}>
      <TopNavigation title={t('more:my_documents', {defaultValue: 'My Documents'})} accessoryLeft={<NavigationAction />} />
      <Content padder contentContainerStyle={styles.content}>
        <Button
          children={renderCenteredLabel(
            isUploading
              ? t('more:documents_uploading', {defaultValue: 'Uploading…'})
              : t('more:documents_upload_a_file', {defaultValue: 'Upload a File'}),
            {stretch: false},
          )}
          disabled={isUploading}
          accessoryLeft={props => <Icon {...props} pack="eva" name="upload-outline" />}
          onPress={onUpload}
          style={[globalStyle.shadowBtn, {marginBottom: 20}]}
        />

        {isLoading ? (
          <Flex vertical itemsCenter justify="center" style={{paddingVertical: 40}}>
            <Spinner size="large" />
          </Flex>
        ) : loadError ? (
          <Flex vertical itemsCenter justify="center" style={{paddingVertical: 40}}>
            <Text category="h9-s" status="danger" center mb={12}>
              {loadError}
            </Text>
            <Button size="small" onPress={loadDocuments}>
              {t('common:try_again', {defaultValue: 'Try again'})}
            </Button>
          </Flex>
        ) : documents.length === 0 ? (
          <Flex vertical itemsCenter justify="center" style={{paddingVertical: 40}}>
            <Text category="h9-s" status="placeholder" center>
              {t('more:documents_empty', {
                defaultValue:
                  'No documents yet — upload a resume, cover letter, certificate, or transcript to keep it here for reuse across the app.',
              })}
            </Text>
          </Flex>
        ) : (
          documents.map(doc => (
            <Layout key={doc.id} level="2" style={styles.docRow}>
              <Icon pack="assets" name="myPost" style={[globalStyle.icon24, {tintColor: theme['color-primary-500']}]} />
              <View style={[globalStyle.flexOne, {marginLeft: 12}]}>
                <Text category="h9" bold numberOfLines={1}>
                  {doc.name ?? t('more:documents_untitled_file', {defaultValue: 'Untitled file'})}
                </Text>
                {formatSize(doc.sizeBytes) ? (
                  <Text category="h10" status="placeholder" mt={2}>
                    {formatSize(doc.sizeBytes)}
                  </Text>
                ) : null}
              </View>
              {deletingId === doc.id ? (
                <Spinner size="small" />
              ) : (
                <TouchableOpacity onPress={() => onDelete(doc)} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                  <Icon pack="eva" name="trash-2-outline" style={[globalStyle.icon20, {tintColor: theme['color-danger-500']}]} />
                </TouchableOpacity>
              )}
            </Layout>
          ))
        )}
      </Content>
    </Container>
  );
});

export default MyDocuments;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
});
