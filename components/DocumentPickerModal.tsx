import React, { memo } from 'react';
import { Modal, ScrollView, TouchableOpacity, View } from 'react-native';
import { Icon, Layout, Spinner, StyleService, useStyleSheet, useTheme } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from './Text';
import Flex from './Flex';
import { globalStyle } from 'styles/globalStyle';
import * as documentsService from 'services/documentsService';
import { DocumentRecord } from 'services/documentsService';

// Extracted out of src/more/ResumeBuilder.tsx (product follow-up — JDAnalyzer's
// new "tailor an existing resume" flow needs the exact same "choose a file
// from My Documents" bottom sheet, and it makes no sense to hand-roll a
// second copy of the same fetch/loading/empty/error states). Behavior is
// unchanged from ResumeBuilder's original inline version; this is a pure
// extraction, not a redesign.
export interface DocumentPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (doc: DocumentRecord) => void;
  title?: string;
  emptyMessage?: string;
  // Only show documents whose `kind` matches one of these (case-
  // insensitive) — e.g. ['resume'] when picking a resume to tailor to a
  // JD, so a certificate/portfolio upload doesn't show up as a confusing
  // option. Omit to show every uploaded document, same as the original
  // ResumeBuilder picker (which has no kind filter — any file can be
  // attached as any import source there).
  kindFilter?: string[];
}

const DocumentPickerModal: React.FC<DocumentPickerModalProps> = memo(
  ({ visible, onClose, onSelect, title, emptyMessage, kindFilter }) => {
    const styles = useStyleSheet(themedStyles);
    const theme = useTheme();
    const { t } = useTranslation(['more']);
    const [documents, setDocuments] = React.useState<DocumentRecord[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
      if (!visible) return;
      setIsLoading(true);
      setError(null);
      documentsService
        .listDocuments()
        .then(setDocuments)
        .catch((e: any) =>
          setError(e?.message ?? t('more:could_not_load_my_documents', { defaultValue: 'Could not load My Documents.' }).toString()),
        )
        .finally(() => setIsLoading(false));
    }, [visible, t]);

    const filtered = kindFilter?.length
      ? documents.filter(d => d.kind && kindFilter.some(k => k.toLowerCase() === d.kind!.toLowerCase()))
      : documents;

    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Flex justify="space-between" itemsCenter mb={16}>
              <Text category="h7" bold>
                {title ?? t('more:choose_a_document', { defaultValue: 'Choose a document' })}
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon pack="eva" name="close-outline" style={[globalStyle.icon24, { tintColor: theme['text-basic-color'] }]} />
              </TouchableOpacity>
            </Flex>
            {isLoading ? (
              <Flex vertical itemsCenter justify="center" style={styles.stateBlock}>
                <Spinner size="large" />
              </Flex>
            ) : error ? (
              <Flex vertical itemsCenter justify="center" style={styles.stateBlock}>
                <Text category="h9-s" status="danger" center>
                  {error}
                </Text>
              </Flex>
            ) : filtered.length === 0 ? (
              <Flex vertical itemsCenter justify="center" style={styles.stateBlock}>
                <Text category="h9-s" status="placeholder" center>
                  {emptyMessage ??
                    t('more:no_documents_choose_device', {
                      defaultValue: 'Nothing in My Documents yet — upload a file there first, or choose from your device instead.',
                    })}
                </Text>
              </Flex>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {filtered.map(doc => (
                  <TouchableOpacity key={doc.id} activeOpacity={0.7} onPress={() => onSelect(doc)}>
                    <Layout level="2" style={styles.row}>
                      <Icon pack="assets" name="myPost" style={[globalStyle.icon20, { tintColor: theme['text-basic-color'] }]} />
                      <Text category="h9" ml={10} style={globalStyle.flexOne} numberOfLines={1}>
                        {doc.name ?? t('more:untitled_file', { defaultValue: 'Untitled file' })}
                      </Text>
                    </Layout>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    );
  },
);

export default DocumentPickerModal;

const themedStyles = StyleService.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    backgroundColor: 'background-basic-color-2',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  stateBlock: {
    paddingVertical: 30,
  },
});
