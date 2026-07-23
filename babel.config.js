module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['.'],
        alias: {
          utils: './utils',
          src: './src',
          navigation: './navigation',
          hooks: './hooks',
          components: './components',
          assets: './assets',
          constants: './constants',
          configs: './configs',
          styles: './styles',
          i18n: './i18n',
          services: './services',
        },
      },
    ],
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    // react-native-vision-camera's frame processors (v4.x API, used for
    // on-device face detection in video-mode interviews) run on the
    // react-native-worklets-core runtime, which is a SEPARATE worklet
    // system from Reanimated 4's react-native-worklets below. Both plugins
    // transform functions marked with a 'worklet' directive, so this is a
    // real risk area — see services/videoAnalysisService.ts for the
    // corresponding runtime risk notes.
    //
    // ORDER SWAPPED as a first experiment against the video-interview-screen
    // crash (instant, silent, full-app-close on opening the screen, before
    // the camera preview even appears — reported, not yet confirmed via an
    // actual Xcode crash trace). react-native-worklets/plugin (Reanimated 4)
    // now runs first and react-native-worklets-core/plugin (VisionCamera's
    // face detector) runs last. This is a real behavior change (which
    // runtime's Babel transform "wins" when both plugins see the same
    // 'worklet'-directive function can differ by order) and is genuinely a
    // guess — if the crash persists after a clean Metro cache reset
    // (`npx react-native start --reset-cache`) and reinstall, this ordering
    // isn't the cause and should be reverted; the real fix will need the
    // actual native crash trace (see LiveInterviewSession.tsx for what to
    // capture from Xcode's debugger panel when it happens).
    ['react-native-worklets/plugin'],
    ['react-native-worklets-core/plugin'],
  ],
};
