import React, { memo } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Share, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Button,
  Input,
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
import * as resumeVariantsService from 'services/resumeVariantsService';
import { ResumeVariant } from 'services/resumeVariantsService';
import { toPlainTextResume } from 'services/resumeGenerationService';
import { downloadDocumentFile } from 'services/documentDownloadService';
import { AuthContext } from '../../AuthContext';
import ProLockGate from 'components/ProLockGate';
import CtaButton from 'components/CtaButton';

// AI Resume Evolution — product request item, Pro Premium feature: multiple
// independently AI-tailored resume variants saved side by side (one per
// target role/company) instead of a single resume that gets overwritten
// each time. See services/resumeVariantsService.ts.
const ResumeVariants = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common']);
  const { isPremium } = React.useContext(AuthContext);

  const [variants, setVariants] = React.useState<ResumeVariant[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showCreate, setShowCreate] = React.useState(false);
  const [label, setLabel] = React.useState('');
  const [targetRole, setTargetRole] = React.useState('');
  const [targetCompany, setTargetCompany] = React.useState('');
  const [isCreating, setIsCreating] = React.useState(false);
  const [sharingId, setSharingId] = React.useState<number | null>(null);

  const load = React.useCallback(() => {
    setIsLoading(true);
    resumeVariantsService.listVariants().then(setVariants).finally(() => setIsLoading(false));
  }, []);

  React.useEffect(() => {
    if (isPremium) load();
    else setIsLoading(false);
  }, [isPremium, load]);

  const onCreate = async () => {
    if (!label.trim() || !targetRole.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const variant = await resumeVariantsService.createVariant({
        label: label.trim(), targetRole: targetRole.trim(), targetCompany: targetCompany.trim(),
      });
      setVariants(prev => [variant, ...prev]);
      setShowCreate(false);
      setLabel(''); setTargetRole(''); setTargetCompany('');
    } catch (e: any) {
      Alert.alert(
        t('more:resume_variant_failed_title', { defaultValue: "Couldn't create variant" }),
        e?.response?.data?.detail || t('common:something_went_wrong', { defaultValue: 'Something went wrong. Please try again.' }),
      );
    } finally {
      setIsCreating(false);
    }
  };

  const onDelete = (variant: ResumeVariant) => {
    Alert.alert(
      t('more:delete_variant_title', { defaultValue: 'Delete this variant?' }),
      variant.label,
      [
        { text: t('common:cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common:delete', { defaultValue: 'Delete' }), style: 'destructive',
          onPress: async () => {
            setVariants(prev => prev.filter(v => v.id !== variant.id));
            await resumeVariantsService.deleteVariant(variant.id);
          },
        },
      ],
    );
  };

  // Was Share.share({message: toPlainTextResume(...)}) — a plain-text dump,
  // because there was no real file to hand the share sheet. Now renders
  // this variant's own tailored sections to a real PDF (POST /api/v1/
  // resume/variants/<id>/export) and shares THAT, same download-then-share
  // pattern as GenerateResume.tsx's onDownload (a remote https url shared
  // directly only ever produces a web-link share on both platforms, never
  // an actual file — see that file's comment for the full explanation).
  // Falls back to the old plain-text share only if rendering/downloading
  // genuinely fails, so this is strictly an upgrade, never a new dead end.
  const onShare = async (variant: ResumeVariant) => {
    if (sharingId) return;
    setSharingId(variant.id);
    try {
      const { url } = await resumeVariantsService.exportVariant(variant.id, 'pdf');
      if (!url) throw new Error('no_url');
      const filename = `${variant.label || 'Resume'}.pdf`;
      // Goes through documentDownloadService.downloadDocumentFile so a
      // stale/404'd export URL can't silently be shared as if it were a
      // real PDF (see that service) -- falls through to the plain-text
      // share below on any failure, same as before.
      const tempPath = await downloadDocumentFile(url, filename);
      await Share.share({ url: `file://${tempPath}`, title: filename });
    } catch {
      const text = toPlainTextResume(variant.sections, { role: variant.targetRole });
      Share.share({ message: text }).catch(() => {});
    } finally {
      setSharingId(null);
    }
  };

  if (!isPremium) {
    return (
      <ProLockGate
        variant="premium"
        title={t('more:resume_evolution', { defaultValue: 'Resume Evolution' })}
        description={t('more:resume_evolution_pro_gate_description', {
          defaultValue: 'Keep multiple AI-tailored resume variants side by side, one per target role or company — a Pro Premium feature.',
        })}
      />
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:resume_evolution', { defaultValue: 'Resume Evolution' })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder contentContainerStyle={styles.content}>
        <Text category="h9-s" status="placeholder" mb={20}>
          {t('more:resume_evolution_description', {
            defaultValue: 'Keep a tailored resume variant for each role or company you\'re targeting.',
          })}
        </Text>

        <CtaButton
          style={[globalStyle.shadowBtn, { marginBottom: 20 }]}
          onPress={() => setShowCreate(true)}
        >
          {t('more:new_variant', { defaultValue: '+ New Variant' })}
        </CtaButton>

        {isLoading ? (
          <Flex center style={{ paddingVertical: 40 }}><Spinner size="large" /></Flex>
        ) : variants.length === 0 ? (
          <Text category="h9-s" status="placeholder" center mt={20}>
            {t('more:no_variants_yet', { defaultValue: 'No variants yet — create your first one above.' })}
          </Text>
        ) : (
          variants.map(variant => (
            <Layout key={variant.id} level="2" style={styles.variantCard}>
              <Flex justify="space-between" itemsCenter mb={4}>
                <Text category="h8" bold style={globalStyle.flexOne}>{variant.label}</Text>
                <Icon
                  pack="eva" name="trash-2-outline"
                  style={[globalStyle.icon20, { tintColor: theme['text-basic-color'] }]}
                  onPress={() => onDelete(variant)}
                />
              </Flex>
              <Text category="h9-s" status="placeholder" mb={12}>
                {[variant.targetRole, variant.targetCompany].filter(Boolean).join(' · ')}
              </Text>
              <Button
                size="small"
                appearance="outline"
                disabled={sharingId === variant.id}
                accessoryLeft={sharingId === variant.id ? () => <Spinner size="small" status="basic" /> : undefined}
                onPress={() => onShare(variant)}>
                {sharingId === variant.id
                  ? t('more:sharing', { defaultValue: 'Sharing…' })
                  : t('more:share', { defaultValue: 'Share' })}
              </Button>
            </Layout>
          ))
        )}
      </Content>

      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        {/* Bug report: "the keyboard is covering the input field while
            typing" — a raw <Modal> bottom sheet does nothing on its own
            when the keyboard opens, same issue as ShareToUserModal.tsx. */}
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Layout level="1" style={styles.modalSheet}>
            <Text category="h7" bold mb={16}>{t('more:new_variant', { defaultValue: '+ New Variant' })}</Text>
            <Input
              placeholder={t('more:variant_label_placeholder', { defaultValue: 'e.g. Fintech Backend Roles' })}
              value={label}
              onChangeText={setLabel}
              style={[styles.input, { marginBottom: 12 }]}
              textStyle={globalStyle.inputText}
            />
            <Input
              placeholder={t('more:role_placeholder', { defaultValue: 'e.g. Senior Product Manager' })}
              value={targetRole}
              onChangeText={setTargetRole}
              style={[styles.input, { marginBottom: 12 }]}
              textStyle={globalStyle.inputText}
            />
            <Input
              placeholder={t('more:company_placeholder', { defaultValue: 'e.g. Acme Corp' })}
              value={targetCompany}
              onChangeText={setTargetCompany}
              style={[styles.input, { marginBottom: 20 }]}
              textStyle={globalStyle.inputText}
            />
            <CtaButton disabled={!label.trim() || !targetRole.trim() || isCreating} onPress={onCreate}>
              {isCreating ? () => <Spinner size="small" status="control" /> : t('more:generate', { defaultValue: 'Generate' })}
            </CtaButton>
            <Button appearance="outline" style={{ marginTop: 12 }} onPress={() => setShowCreate(false)}>
              {t('common:cancel', { defaultValue: 'Cancel' })}
            </Button>
          </Layout>
        </KeyboardAvoidingView>
      </Modal>
    </Container>
  );
});

export default ResumeVariants;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  variantCard: {
    ...globalStyle.card,
    padding: 16,
    marginBottom: 12,
    // Redesign v2 (full reskin): `card` carries a real shadow again, which
    // needs an opaque fill on Android — dropped the 'transparent' override
    // so this Layout's own `level="2"` background shows through instead.
  },
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
