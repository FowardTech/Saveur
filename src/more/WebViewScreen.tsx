import React, {memo} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {TopNavigation, StyleService, useStyleSheet, useTheme} from '@ui-kitten/components';
import {RouteProp, useRoute} from '@react-navigation/native';
import {WebView} from 'react-native-webview';

import Container from 'components/Container';
import NavigationAction from 'components/NavigationAction';
import Flex from 'components/Flex';
import {RootStackParamList} from 'navigation/types';

// Generic in-app WebView screen — currently used to open a job posting's
// apply page from src/more/JobAlerts.tsx (so tapping a job alert stays
// in-app, "click it and it redirects them to the application page (webview)"
// per the feature request, instead of leaving to the system browser).
// Deliberately generic (title + url params) rather than job-alert-specific,
// so anything else in the app that needs an in-app browser later can reuse
// it too.
const WebViewScreen = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, 'WebViewScreen'>>();
  const {url, title} = route.params ?? {url: ''};
  const [isLoading, setIsLoading] = React.useState(true);

  return (
    <Container style={styles.container}>
      <TopNavigation title={title ?? ''} accessoryLeft={<NavigationAction />} />
      <View style={styles.container}>
        <WebView
          source={{uri: url}}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          startInLoadingState={false}
        />
        {isLoading ? (
          <Flex vertical center style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme['color-primary-500']} />
          </Flex>
        ) : null}
      </View>
    </Container>
  );
});

export default WebViewScreen;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'background-basic-color-1',
  },
});
