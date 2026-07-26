import React, {memo} from 'react';
import {Alert} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import NavigationAction from 'components/NavigationAction';
import {RootStackParamList} from 'navigation/types';
import SwiperCard from 'components/SwiperCard';
import {globalStyle} from 'styles/globalStyle';
import Flex from 'components/Flex';
import * as documentsService from 'services/documentsService';
import {DocumentRecord} from 'services/documentsService';

// "My Documents" — generic S3-backed document storage (resume/cover
// letter/certificate/transcript/portfolio files), separate from the
// resume-specific import flow in ResumeBuilder.tsx. Backed by
// services/documentsService.ts (GET/DELETE /api/v1/documents,
// POST /api/v1/documents/upload — the upload itself happens on the
// "Add Document" screen, see AddChild.tsx in this same folder). Component
// file/route names ("MyChildren"/"AddChild") are leftover from an earlier
// version of this app and haven't been renamed, but the screen itself is a
// real document manager, not a childcare feature.
const MyChildren = memo(() => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const {navigate} = navigation;
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['more', 'common']);

  const [documents, setDocuments] = React.useState<DocumentRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadDocuments = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await documentsService.listDocuments();
      setDocuments(list);
    } catch (e: any) {
      setError(e?.message ?? "Couldn't load your documents.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh on mount and whenever this screen regains focus (e.g. coming
  // back from "Add Document" after a successful upload).
  React.useEffect(() => {
    loadDocuments();
    const unsubscribe = navigation.addListener('focus', loadDocuments);
    return unsubscribe;
  }, [navigation, loadDocuments]);

  const onAdd = () => {
    navigate('AddChild');
  };
  const onDelete = (doc: DocumentRecord) => {
    Alert.alert(
      t('more:delete_document', {defaultValue: 'Delete document'}),
      t('more:delete_document_confirm', {
        name: doc.name ?? t('more:this_document', {defaultValue: 'this document'}),
        defaultValue: `Remove "${doc.name ?? 'this document'}"? This can't be undone.`,
      }),
      [
        {text: t('common:cancel', {defaultValue: 'Cancel'}), style: 'cancel'},
        {
          text: t('common:delete', {defaultValue: 'Delete'}),
          style: 'destructive',
          onPress: async () => {
            try {
              await documentsService.deleteDocument(doc.id);
              setDocuments(prev => prev.filter(d => d.id !== doc.id));
            } catch (e: any) {
              Alert.alert(
                t('more:delete_failed', {defaultValue: 'Delete failed'}),
                e?.message ?? 'Something went wrong. Please try again.',
              );
            }
          },
        },
      ],
    );
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:my-documents', {defaultValue: 'My Documents'})}
        accessoryLeft={<NavigationAction />}
        accessoryRight={
          <NavigationAction icon="plusImg" size="small" onPress={onAdd} />
        }
      />
      <Content contentContainerStyle={styles.content}>
        {isLoading ? (
          <Text category="h8-s" status="placeholder" center mt={24}>
            {t('more:loading_documents', {defaultValue: 'Loading documents…'})}
          </Text>
        ) : error ? (
          <Text category="h8-s" status="danger" center mt={24}>
            {error}
          </Text>
        ) : documents.length === 0 ? (
          <Flex vertical center style={{paddingVertical: 40}}>
            <Text category="h9-s" status="placeholder" center>
              {t('more:no_documents', {
                defaultValue: 'No documents yet — add your resume, cover letter, or a certificate.',
              })}
            </Text>
          </Flex>
        ) : (
          documents.map((item, i) => (
            <SwiperCard
              id={`${i}_${item.id}`}
              key={item.id}
              widthAction={75}
              containerStyle={styles.swiperContainer}
              onDelete={() => onDelete(item)}>
              <Flex
                vertical
                level="2"
                pv={24}
                ml={24}
                justify="flex-start"
                border={12}>
                <Text category="h6" bold ml={16} numberOfLines={1}>
                  {item.name ?? 'Document'}
                </Text>
                <Text category="h8" mt={8} status="placeholder" ml={16}>
                  {item.createdAt
                    ? `Uploaded ${new Date(item.createdAt).toLocaleDateString()}`
                    : (item.mimeType ?? 'File')}
                </Text>
              </Flex>
            </SwiperCard>
          ))
        )}
      </Content>
    </Container>
  );
});

export default MyChildren;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 32,
  },
  swiperContainer: {
    ...globalStyle.shadow,
    marginBottom: 24,
    borderRadius: 12,
    marginRight: 24,
  },
});
