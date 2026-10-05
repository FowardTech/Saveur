import React, {memo} from 'react';
import {StyleProp, View, ViewStyle} from 'react-native';
import {Button, Spinner, Text as KittenText, TextProps} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Flex from 'components/Flex';
import {globalStyle} from 'styles/globalStyle';

// Product report, with screenshot: "The Download buttons... the texts are
// not supposed to break they should be in straight line same for the other
// download button in the whole app." Was two plain UI-Kitten <Button>s,
// each with a bare string as `children` -- UI-Kitten's own internal Text
// wraps that string onto a second line the moment it doesn't fit its exact
// measured width instead of shrinking/staying put, which "Download PDF"/
// "Download DOCX" hit inside these half-width, size="small" buttons.
// numberOfLines={1} on an explicit Text render (via Button's render-prop
// `children` form, which hands back the exact TextProps -- color/style --
// the button would have applied to a plain string anyway) forces a single
// line instead.
//
// Extracted as a shared component (previously duplicated byte-for-byte
// between CoverLetterGenerator.tsx and JDCoverLetterGenerator.tsx) so the
// fix -- and any future tweak to this exact button pair -- only has to be
// made once.
export interface DownloadFormatButtonsProps {
  downloadingFormat: 'pdf' | 'docx' | null;
  onDownload: (format: 'pdf' | 'docx') => void;
  style?: StyleProp<ViewStyle>;
}

const DownloadFormatButtons: React.FC<DownloadFormatButtonsProps> = memo(({downloadingFormat, onDownload, style}) => {
  const {t} = useTranslation(['more']);
  const preparingLabel = t('more:resume_preparing', {defaultValue: 'Preparing…'});
  return (
    <Flex justify="space-between" mt={12} style={style}>
      <Button
        size="small"
        style={globalStyle.flexOne}
        disabled={!!downloadingFormat}
        accessoryLeft={downloadingFormat === 'pdf' ? () => <Spinner size="small" status="basic" /> : undefined}
        onPress={() => onDownload('pdf')}>
        {(evaProps: TextProps) => (
          <KittenText {...evaProps} numberOfLines={1}>
            {downloadingFormat === 'pdf' ? preparingLabel : t('more:download_pdf', {defaultValue: 'Download PDF'})}
          </KittenText>
        )}
      </Button>
      <View style={{width: 12}} />
      <Button
        size="small"
        appearance="outline"
        style={globalStyle.flexOne}
        disabled={!!downloadingFormat}
        accessoryLeft={downloadingFormat === 'docx' ? () => <Spinner size="small" status="basic" /> : undefined}
        onPress={() => onDownload('docx')}>
        {(evaProps: TextProps) => (
          <KittenText {...evaProps} numberOfLines={1}>
            {downloadingFormat === 'docx' ? preparingLabel : t('more:download_docx', {defaultValue: 'Download DOCX'})}
          </KittenText>
        )}
      </Button>
    </Flex>
  );
});

export default DownloadFormatButtons;
