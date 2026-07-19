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
    // corresponding runtime risk notes. If builds fail with duplicate
    // worklet-transform errors, this ordering (and/or dropping one of the
    // two plugins) is the first thing to try.
    ['react-native-worklets-core/plugin'],
    ['react-native-worklets/plugin'], // must be last
  ],
};
