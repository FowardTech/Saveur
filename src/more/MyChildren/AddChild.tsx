import React, {memo} from 'react';
import {
  View,
  ImageBackground,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  TopNavigation,
  useTheme,
  StyleService,
  useStyleSheet,
  Input,
  Icon,
  Layout,
  Button,
} from '@ui-kitten/components';
import {useNavigation} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';
import {pick, isErrorWithCode, errorCodes, types as documentTypes} from '@react-native-documents/picker';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import NavigationAction from 'components/NavigationAction';
import {Controller, useForm} from 'react-hook-form';
import {globalStyle} from 'styles/globalStyle';
import {Images} from 'assets/images';
import * as documentsService from 'services/documentsService';
import {UploadableFile} from 'services/documentsService';

// Real device file access — opens the native document picker
// (@react-native-documents/picker, same lib ResumeBuilder.tsx uses) instead
// of the old "type picker with nothing actually attached" stub, then uploads
// via POST /api/v1/documents/upload (services/documentsService.ts).
async function pickDocument(): Promise<UploadableFile | null> {
  try {
    const [result] = await pick({
      type: [documentTypes.pdf, documentTypes.doc, documentTypes.docx, documentTypes.plainText, documentTypes.images],
    });
    return {
      uri: result.uri,
      name: result.name ?? 'Selected file',
      sizeBytes: result.size,
      mimeType: result.type,
    };
  } catch (err) {
    if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
      return null;
    }
    throw err;
  }
}

const AddChild = memo(() => {
  const {goBack} = useNavigation();
  const {width} = useLayout();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['more', 'filter', 'creat_job', 'common']);

  const {
    control,
    handleSubmit,
    setValue,
    formState: {errors},
  } = useForm({
    defaultValues: {
      name: '',
    },
  });
  const SIZE_BG = 80 * (width / 375);

  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [typeAge, setTypeAge] = React.useState<string>('Resume');
  const [pickedFile, setPickedFile] = React.useState<UploadableFile | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  const DATA = [
    {
      id: 0,
      title: 'Resume',
      description: 'PDF or DOCX',
      icon: 'myPost',
    },
    {
      id: 1,
      title: 'Cover Letter',
      description: 'PDF or DOCX',
      icon: 'edit_full',
    },
    {
      id: 2,
      title: 'Certificate',
      description: 'PDF or image',
      icon: 'bgCheck',
    },
    {
      id: 3,
      title: 'Transcript',
      description: 'PDF',
      icon: 'term',
    },
    {
      id: 4,
      title: 'Portfolio',
      description: 'Link or PDF',
      icon: 'photoLibrary',
    },
  ];

  const onChoose = React.useCallback(
    ({item, i}) =>
      () => {
        setSelectedIndex(i), setTypeAge(item.title);
      },
    [],
  );

  const onPickFile = async () => {
    try {
      const file = await pickDocument();
      if (!file) return; // user canceled the native picker
      setPickedFile(file);
      setValue('name', file.name, {shouldValidate: true});
    } catch (e: any) {
      Alert.alert(
        t('more:upload_failed', {defaultValue: 'Upload failed'}),
        e?.message ?? 'Something went wrong. Please try again.',
      );
    }
  };

  const onAdd = handleSubmit(async ({name}) => {
    if (!pickedFile) {
      Alert.alert(
        t('more:no_file_selected', {defaultValue: 'No file selected'}),
        t('more:choose_a_file_first', {defaultValue: 'Choose a file to upload first.'}),
      );
      return;
    }
    setIsUploading(true);
    try {
      await documentsService.uploadDocument({
        ...pickedFile,
        name: name?.trim() || pickedFile.name,
        docType: typeAge,
      });
      goBack();
    } catch (e: any) {
      Alert.alert(
        t('more:upload_failed', {defaultValue: 'Upload failed'}),
        e?.message ?? 'Something went wrong. Please try again.',
      );
    } finally {
      setIsUploading(false);
    }
  });
  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={<NavigationAction />}
        title={t('more:add-document', {defaultValue: 'Add Document'})}
      />
      <Content padder>
        <Text category="h8" mt={24} mb={24}>
          {t('more:add-document-title', {
            defaultValue:
              "Upload your resume, cover letter, certificates, or transcript so your AI coach can tailor feedback to you.",
          })}
        </Text>
        <Button
          status={pickedFile ? 'basic' : 'primary'}
          appearance={pickedFile ? 'outline' : 'filled'}
          onPress={onPickFile}
          style={{marginBottom: pickedFile ? 8 : 16}}>
          {pickedFile
            ? t('more:choose_different_file', {defaultValue: 'Choose a different file'})
            : t('more:choose_file', {defaultValue: 'Choose a file'})}
        </Button>
        {pickedFile ? (
          <Text category="h9-s" status="success" mb={16}>
            {t('more:file_selected', {name: pickedFile.name, defaultValue: `Selected: ${pickedFile.name}`})}
          </Text>
        ) : null}
        <Controller
          control={control}
          name="name"
          render={({field: {onChange, onBlur, value}}) => (
            <Input
              label={t('more:document-name', {defaultValue: 'File Name'}).toString()}
              status={errors.name ? 'warning' : 'basic'}
              style={styles.name}
              value={value}
              onChangeText={onChange}
              onTouchStart={handleSubmit(() => {})}
              onTouchEnd={handleSubmit(() => {})}
              onBlur={onBlur}
              keyboardType="email-address"
              caption={errors.name?.message}
            />
          )}
        />
        <Text category="h6" bold mb={32}>
          {t('more:document-type', {defaultValue: 'Document Type'})}
        </Text>
        <View style={styles.content}>
          {DATA.map((item, i) => {
            return (
              <TouchableOpacity
                activeOpacity={0.54}
                onPress={onChoose({i, item})}
                style={[
                  styles.item,
                  {
                    width: 108 * (width / 375),
                  },
                ]}
                key={i}>
                <ImageBackground
                  source={i === selectedIndex ? Images.fillActive : Images.fill}
                  style={[
                    {
                      width: SIZE_BG,
                      height: SIZE_BG,
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                    selectedIndex === i
                      ? {...globalStyle.shadowBtn}
                      : undefined,
                  ]}>
                  <Icon
                    pack="assets"
                    name={item.icon}
                    style={{
                      ...globalStyle.icon40,
                      tintColor:
                        selectedIndex === i
                          ? theme['text-primary-color']
                          : theme['text-placeholder-color'],
                      zIndex: 10,
                      alignSelf: 'center',
                    }}
                  />
                </ImageBackground>
                <Text
                  category="h8"
                  bold
                  status={i === selectedIndex ? 'link' : 'placeholder'}
                  mt={12}>
                  {item.title}
                </Text>
                <Text category="h10" status={'placeholder'} mt={4}>
                  {item.description}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Content>
      <Layout style={styles.bottom}>
        <Button
          children={
            isUploading
              ? t('more:uploading', {defaultValue: 'Uploading…'})
              : t('more:add-document', {defaultValue: 'Add Document'})
          }
          disabled={isUploading || !pickedFile}
          style={globalStyle.shadowBtn}
          onPress={onAdd}
        />
      </Layout>
    </Container>
  );
});

export default AddChild;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  name: {
    borderBottomWidth: 2,
    marginBottom: 40,
  },
  item: {
    paddingHorizontal: 9,
    alignItems: 'center',
    marginBottom: 24,
  },
  content: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
});
