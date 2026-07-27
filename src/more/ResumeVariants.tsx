import React, { memo } from 'react';
import { Alert, Modal, Share, View } from 'react-native';
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
import { AuthContext } from '../../AuthContext';
import ProLockGate from 'components/ProLockGate';

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

  const onShare = (variant: ResumeVariant) => {
    const text = toPlainTextResume(variant.sections, { role: variant.targetRole });
    Share.share({ message: text }).catch(() => {});
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

        <Button
          style={[globalStyle.shadowBtn, { marginBottom: 20 }]}
          onPress={() => setShowCreate(true)}
        >
          {t('more:new_variant', { defaultValue: '+ New Variant' })}
        </Button>

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
                  style={[globalStyle.icon20, { tintColor: theme['color-danger-500'] }]}
                  onPress={() => onDelete(variant)}
                />
              </Flex>
              <Text category="h9-s" status="placeholder" mb={12}>
                {[variant.targetRole, variant.targetCompany].filter(Boolean).join(' · ')}
              </Text>
              <Button size="small" appearance="outline" onPress={() => onShare(variant)}>
                {t('more:share', { defaultValue: 'Share' })}
              </Button>
            </Layout>
          ))
        )}
      </Content>

      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <Layout level="1" style={styles.modalSheet}>
            <Text category="h7" bold mb={16}>{t('more:new_variant', { defaultValue: '+ New Variant' })}</Text>
            <Input
              placeholder={t('more:variant_label_placeholder', { defaultValue: 'e.g. Fintech Backend Roles' })}
              value={label}
              onChangeText={setLabel}
              style={[styles.input, { marginBottom: 12 }]}
            />
            <Input
              placeholder={t('more:role_placeholder', { defaultValue: 'e.g. Senior Product Manager' })}
              value={targetRole}
              onChangeText={setTargetRole}
              style={[styles.input, { marginBottom: 12 }]}
            />
            <Input
              placeholder={t('more:company_placeholder', { defaultValue: 'e.g. Acme Corp' })}
              value={targetCompany}
              onChangeText={setTargetCompany}
              style={[styles.input, { marginBottom: 20 }]}
            />
            <Button disabled={!label.trim() || !targetRole.trim() || isCreating} onPress={onCreate}>
              {isCreating ? () => <Spinner size="small" status="control" /> : t('more:generate', { defaultValue: 'Generate' })}
            </Button>
            <Button appearance="outline" style={{ marginTop: 12 }} onPress={() => setShowCreate(false)}>
              {t('common:cancel', { defaultValue: 'Cancel' })}
            </Button>
          </Layout>
        </View>
      </Modal>
    </Container>
  );
});

export default ResumeVariants;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  variantCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  input: { borderRadius: 12 },
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
