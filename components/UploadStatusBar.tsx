import React from 'react';
import {TouchableOpacity, View} from 'react-native';
import {Icon, StyleService, useStyleSheet, useTheme} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';
import Text from 'components/Text';
import {globalStyle} from 'styles/globalStyle';
import type {UploadStatusState} from 'hooks/useUploadStatus';

function formatBytes(n?: number | null): string {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Inline upload feedback: file name + size, live percentage bar, a
 * "processing" pulse once the bytes are sent, then a clear success/failed
 * state (testers couldn't tell whether an upload had gone through). */
const UploadStatusBar = ({status, onDismiss}: {status: UploadStatusState | null; onDismiss?: () => void}) => {
  const {t} = useTranslation(['more', 'common']);
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  if (!status) return null;

  const {phase, percent} = status;
  const tone =
    phase === 'done' ? theme['color-success-500'] : phase === 'error' ? theme['color-danger-500'] : theme['text-basic-color'];
  const label =
    phase === 'uploading'
      ? t('more:upload_progress_percent', {defaultValue: 'Uploading… {{percent}}%', percent})
      : phase === 'processing'
      ? t('more:upload_processing', {defaultValue: 'Upload complete — processing…'})
      : phase === 'done'
      ? t('more:upload_done', {defaultValue: 'Uploaded successfully'})
      : status.error || t('more:upload_failed', {defaultValue: 'Upload failed'});
  const icon = phase === 'done' ? 'checkmark-circle-2-outline' : phase === 'error' ? 'alert-circle-outline' : 'file-text-outline';
  const inFlight = phase === 'uploading' || phase === 'processing';

  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <View style={styles.row}>
        <Icon pack="eva" name={icon} style={[globalStyle.icon20, {tintColor: tone}]} />
        <View style={styles.texts}>
          {status.name ? (
            <Text category="h9" bold numberOfLines={1}>
              {status.name}
            </Text>
          ) : null}
          <Text category="h9-s" style={{color: tone}} numberOfLines={2}>
            {label}
            {status.sizeBytes != null && phase !== 'error' ? `  ·  ${formatBytes(status.sizeBytes)}` : ''}
          </Text>
        </View>
        {!inFlight && onDismiss ? (
          <TouchableOpacity onPress={onDismiss} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Icon pack="eva" name="close-outline" style={[globalStyle.icon20, {tintColor: theme['text-hint-color']}]} />
          </TouchableOpacity>
        ) : null}
      </View>
      {inFlight ? (
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              {
                width: `${phase === 'processing' ? 100 : Math.max(3, percent)}%`,
                backgroundColor: theme['color-primary-100'],
                opacity: phase === 'processing' ? 0.5 : 1,
              },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
};

export default UploadStatusBar;

const themedStyles = StyleService.create({
  card: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    backgroundColor: 'background-basic-color-2',
    borderWidth: 1,
    borderColor: 'background-basic-color-3',
  },
  row: {flexDirection: 'row', alignItems: 'center'},
  texts: {flex: 1, marginHorizontal: 10},
  track: {height: 6, borderRadius: 3, marginTop: 10, overflow: 'hidden', backgroundColor: 'background-basic-color-3'},
  fill: {height: '100%', borderRadius: 3},
});
