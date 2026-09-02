import React, {memo} from 'react';
import {ScrollView, View} from 'react-native';
import {TopNavigation, Button, Spinner} from '@ui-kitten/components';

import Text from 'components/Text';
import Container from 'components/Container';
import NavigationAction from 'components/NavigationAction';
import * as duplexVoiceService from 'services/duplexVoiceService';

// DEV-ONLY test screen for services/duplexVoiceService.ts / the native
// DuplexVoiceEngine module (ios/caren_family/DuplexVoiceEngine.swift) —
// reachable from Settings only when __DEV__ (see src/more/MoreSrc.tsx),
// never in a release build.
//
// WHY THIS SCREEN EXISTS: DuplexVoiceEngine is a from-scratch native audio
// module built specifically to solve real speak-to-interrupt for the AI
// Career Coach's voice screen, after two prior attempts both failed on a
// real device (see VoiceCoachView.tsx's header comment for that full
// history). This screen exercises the new engine in COMPLETE isolation —
// no turn-taking, no silence detection, no barge-in logic, none of
// VoiceCoachView's own state machine — so that if something's wrong, it's
// obviously either (a) this engine's own core mechanism (echo cancellation
// not actually working, audio silent/distorted, mic not capturing) or (b)
// something in VoiceCoachView's integration layer, not a tangle of both at
// once. Test THIS screen on a real device first; only once it demonstrably
// works here does it make sense to wire it into the real coach screen
// (see VoiceCoachView.tsx's own TODO once that happens).
//
// What "working" looks like here: tap Start, say something, watch the
// transcript update live. Tap Speak, and WHILE it's talking, say something
// — if the transcript below updates with YOUR words (not a garbled version
// of what the screen itself just said, and not nothing at all), the core
// duplex+echo-cancellation mechanism is working. If the transcript instead
// fills up with a mangled version of the spoken text, that's this attempt
// repeating attempt 2's failure (echo not actually cancelled). If nothing
// is audible at all, that's closer to attempt 1's failure mode.
const DuplexVoiceTestScreen = memo(() => {
  const [started, setStarted] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [transcript, setTranscript] = React.useState('');
  const [log, setLog] = React.useState<string[]>([]);

  const appendLog = React.useCallback((line: string) => {
    setLog(prev => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 50));
  }, []);

  React.useEffect(() => {
    const subs = [
      duplexVoiceService.addTranscriptListener(e => {
        setTranscript(e.text);
        if (e.isFinal) appendLog(`transcript (final): "${e.text}"`);
      }),
      duplexVoiceService.addListeningStateListener(e => {
        setListening(e.listening);
        appendLog(`listening: ${e.listening}`);
      }),
      duplexVoiceService.addSpeakingStateListener(e => {
        setSpeaking(e.speaking);
        appendLog(`speaking: ${e.speaking}`);
      }),
      duplexVoiceService.addErrorListener(e => {
        appendLog(`ERROR [${e.context}]: ${e.message}`);
      }),
    ];
    return () => {
      subs.forEach(sub => sub?.remove());
      duplexVoiceService.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onStart = React.useCallback(async () => {
    setStarting(true);
    try {
      await duplexVoiceService.start();
      setStarted(true);
      appendLog('start() resolved');
    } catch (e: any) {
      appendLog(`start() failed: ${e?.message ?? e}`);
    } finally {
      setStarting(false);
    }
  }, [appendLog]);

  const onStop = React.useCallback(async () => {
    try {
      await duplexVoiceService.stop();
    } finally {
      setStarted(false);
      setTranscript('');
    }
  }, []);

  const onSpeak = React.useCallback(async () => {
    appendLog('speak() called — try talking over this');
    try {
      await duplexVoiceService.speak(
        'This is a test of the duplex voice engine. While I am still talking, try saying something and watch the transcript below.',
      );
      appendLog('speak() resolved (finished naturally, not interrupted)');
    } catch (e: any) {
      appendLog(`speak() failed: ${e?.message ?? e}`);
    }
  }, [appendLog]);

  const onInterrupt = React.useCallback(async () => {
    await duplexVoiceService.stopSpeaking();
    appendLog('stopSpeaking() called (manual interrupt)');
  }, [appendLog]);

  return (
    <Container>
      <TopNavigation title="Duplex Voice Test (dev only)" accessoryLeft={() => <NavigationAction />} />
      <View style={{flex: 1, padding: 16}}>
        {!duplexVoiceService.isDuplexVoiceSupported() ? (
          <Text category="h8" center mt={40}>
            Not supported on this platform (iOS only, phase 1).
          </Text>
        ) : (
          <>
            <Text category="h7" bold>
              listening: {String(listening)} · speaking: {String(speaking)}
            </Text>
            <Text category="h8" mt={12} style={{minHeight: 60}}>
              {transcript || '(no transcript yet)'}
            </Text>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', marginTop: 16}}>
              <Button onPress={onStart} disabled={starting || started} style={{margin: 4}}>
                {starting ? <Spinner size="small" /> : 'Start'}
              </Button>
              <Button onPress={onSpeak} disabled={!started} style={{margin: 4}}>
                Speak
              </Button>
              <Button onPress={onInterrupt} disabled={!speaking} status="warning" style={{margin: 4}}>
                Interrupt
              </Button>
              <Button onPress={onStop} disabled={!started} status="danger" style={{margin: 4}}>
                Stop
              </Button>
            </View>
            <Text category="h9" bold mt={20}>
              Log
            </Text>
            <ScrollView style={{flex: 1, marginTop: 8}}>
              {log.map((line, i) => (
                <Text key={i} category="h10" style={{fontFamily: 'Courier'}}>
                  {line}
                </Text>
              ))}
            </ScrollView>
          </>
        )}
      </View>
    </Container>
  );
});

export default DuplexVoiceTestScreen;
