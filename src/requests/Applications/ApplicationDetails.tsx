import React, {memo} from 'react';
import {Alert, View} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Button,
  Avatar,
} from '@ui-kitten/components';
import {NavigationProp, useNavigation, useRoute} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Container from 'components/Container';

import {globalStyle} from 'styles/globalStyle';
import Flex from 'components/Flex';
import {ApplicationDetailsScreenNavigationProp, RootStackParamList} from 'navigation/types';
import {Application_Stage_Enum, JobApplicationProps} from 'constants/Types';
import * as applicationsService from 'services/applicationsService';
import NavigationAction from 'components/NavigationAction';
import Content from 'components/Content';
import dayjs from 'dayjs';

const STAGE_ORDER = [
  Application_Stage_Enum.Applied,
  Application_Stage_Enum.Interviewing,
  Application_Stage_Enum.Offer,
];

const getStageStatus = (stage: Application_Stage_Enum) => {
  switch (stage) {
    case Application_Stage_Enum.Applied:
      return 'info';
    case Application_Stage_Enum.Interviewing:
      return 'warning';
    case Application_Stage_Enum.Offer:
      return 'success';
    case Application_Stage_Enum.Rejected:
      return 'danger';
    default:
      return 'basic';
  }
};

// Fetches the single application from applicationsService.listApplications()
// (there's no GET-by-id endpoint in the tracker contract, only list/create/
// patch/delete) and finds the one matching the `id` passed via navigation —
// see ApplicationItem.tsx's onPress, which now passes {id: item.id} instead
// of the old {type: item.stage} (that old param shape couldn't distinguish
// between two applications in the same stage, and looked the record up from
// static mock data rather than the real tracked list).
const ApplicationDetails = memo(() => {
  const {goBack, navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const {bottom} = useLayout();
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const {t} = useTranslation(['request', 'common']);

  const route = useRoute<ApplicationDetailsScreenNavigationProp>();
  const {id} = route.params;

  const [application, setApplication] = React.useState<JobApplicationProps | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = React.useState(false);
  const [isMovingStage, setIsMovingStage] = React.useState(false);

  const loadApplication = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const all = await applicationsService.listApplications();
      const found = all.find(item => String(item.id) === String(id)) ?? null;
      setApplication(found);
      if (!found) setError("This application couldn't be found — it may have been removed.");
    } catch (e: any) {
      setError(e?.message ?? "Couldn't load this application.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    loadApplication();
  }, [loadApplication]);

  const onWithdraw = async () => {
    if (!application || isWithdrawing) return;
    setIsWithdrawing(true);
    try {
      await applicationsService.deleteApplication(application.id);
      goBack();
    } catch (e: any) {
      Alert.alert(
        'Could not withdraw application',
        e?.message ?? 'Something went wrong. Please try again.',
      );
    } finally {
      setIsWithdrawing(false);
    }
  };

  const onMoveToNextStage = async () => {
    if (!application || isMovingStage) return;
    const currentIndex = STAGE_ORDER.indexOf(application.stage);
    const nextStage =
      currentIndex >= 0 && currentIndex < STAGE_ORDER.length - 1
        ? STAGE_ORDER[currentIndex + 1]
        : null;
    if (!nextStage) return;
    setIsMovingStage(true);
    try {
      const updated = await applicationsService.updateApplicationStage(application.id, nextStage);
      if (updated) setApplication(updated);
    } catch (e: any) {
      Alert.alert(
        'Could not update stage',
        e?.message ?? 'Something went wrong. Please try again.',
      );
    } finally {
      setIsMovingStage(false);
    }
  };

  const onPracticeForThis = () => navigate('MockInterviewSetup', {});

  if (isLoading) {
    return (
      <Container style={styles.container}>
        <TopNavigation
          accessoryLeft={<NavigationAction icon={'back'} onPress={goBack} />}
          title={<Text status={'primary'} center category="h6">{t('request:requestDetails')}</Text>}
        />
        <Flex vertical center style={globalStyle.flexOne}>
          <Text category="h9-s" status="placeholder">Loading…</Text>
        </Flex>
      </Container>
    );
  }

  if (error || !application) {
    return (
      <Container style={styles.container}>
        <TopNavigation
          accessoryLeft={<NavigationAction icon={'back'} onPress={goBack} />}
          title={<Text status={'primary'} center category="h6">{t('request:requestDetails')}</Text>}
        />
        <Flex vertical center style={globalStyle.flexOne}>
          <Text category="h9-s" status="danger" center mh={24}>
            {error ?? 'Application not found.'}
          </Text>
        </Flex>
      </Container>
    );
  }

  const stage = application.stage;
  const canAdvance = STAGE_ORDER.indexOf(stage) >= 0 && STAGE_ORDER.indexOf(stage) < STAGE_ORDER.length - 1;

  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={<NavigationAction icon={'back'} onPress={goBack} />}
        title={
          <Text status={'primary'} center category="h6">
            {t('request:requestDetails')}
          </Text>
        }
      />
      <Text
        center
        category="h8"
        bold
        status={getStageStatus(stage) as any}
        mb={8}>
        {stage}
      </Text>
      <Content padder contentContainerStyle={styles.content}>
        <Flex justify="flex-start" itemsCenter mb={32}>
          <Avatar source={application.logo} size="giant" shape="rounded" />
          <View style={{marginLeft: 16, flexShrink: 1}}>
            <Text category="h5" bold numberOfLines={2}>
              {application.role}
            </Text>
            <Text category="h7-s" status="placeholder" mt={4}>
              {application.company}
            </Text>
          </View>
        </Flex>

        <Text category="h8" status={'placeholder'} bold mb={8}>
          {t('request:where')}
        </Text>
        <Text category="h7" bold mb={24}>
          {application.location}
        </Text>

        <Text category="h8" status={'placeholder'} bold mb={8}>
          {t('request:when')}
        </Text>
        <Text category="h7" bold mb={24}>
          {dayjs(application.appliedDate).format('MMM DD, YYYY')}
        </Text>

        {/* Stage tracker */}
        <Text bold mb={16} category="h3">
          {t('request:application-stage')}
        </Text>
        <Flex justify="flex-start" mb={32}>
          {STAGE_ORDER.map((s, i) => {
            const reached =
              stage === Application_Stage_Enum.Rejected
                ? i === 0
                : STAGE_ORDER.indexOf(stage) >= i;
            return (
              <React.Fragment key={s}>
                <View
                  style={[
                    styles.stageDot,
                    {
                      backgroundColor: reached
                        ? theme['color-primary-500']
                        : theme['background-basic-color-3'],
                    },
                  ]}
                />
                {i < STAGE_ORDER.length - 1 ? (
                  <View
                    style={[
                      styles.stageLine,
                      {
                        backgroundColor: reached
                          ? theme['color-primary-500']
                          : theme['background-basic-color-3'],
                      },
                    ]}
                  />
                ) : null}
              </React.Fragment>
            );
          })}
        </Flex>
        <Flex justify="space-between" mb={32}>
          {STAGE_ORDER.map(s => (
            <Text key={s} category="h9" status="placeholder">
              {s}
            </Text>
          ))}
        </Flex>

        {application.nextStep ? (
          <>
            <Text bold mb={12} category="h3">
              {t('request:next-step')}
            </Text>
            <Text mb={32}>{application.nextStep}</Text>
          </>
        ) : null}

        <Button
          children={t('request:practice-for-this-interview')}
          status="primary"
          onPress={onPracticeForThis}
          style={{marginBottom: 24}}
        />
      </Content>
      <Layout style={[styles.bottom, {paddingBottom: bottom + 8}]} level="2">
        <Button
          children={isWithdrawing ? 'Withdrawing…' : t('request:cancelApplication')}
          status="outline"
          disabled={isWithdrawing}
          style={[globalStyle.flexOne, {marginRight: 16}]}
          onPress={onWithdraw}
        />
        <Button
          children={isMovingStage ? 'Updating…' : t('common:update')}
          style={globalStyle.flexOne}
          status={stage === Application_Stage_Enum.Rejected ? 'danger' : 'basic'}
          disabled={isMovingStage || !canAdvance}
          onPress={onMoveToNextStage}
        />
      </Layout>
    </Container>
  );
});

export default ApplicationDetails;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingBottom: 0,
  },
  content: {
    ...globalStyle.topBorder16,
    paddingHorizontal: 24,
    backgroundColor: 'background-basic-color-1',
    paddingBottom: 80,
  },
  stageDot: {
    width: 16,
    height: 16,
    borderRadius: 99,
  },
  stageLine: {
    flex: 1,
    height: 4,
    marginHorizontal: 4,
    alignSelf: 'center',
  },
  bottom: {
    paddingHorizontal: 24,
    paddingTop: 14,
    ...globalStyle.topBorder24,
    ...globalStyle.shadowFade,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
