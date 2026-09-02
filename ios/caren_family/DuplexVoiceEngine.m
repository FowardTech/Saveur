#import <React/RCTBridgeModule.h>

// Objective-C bridge exposing DuplexVoiceEngine.swift to React Native --
// same RCT_EXTERN_MODULE/RCT_EXTERN_METHOD pattern already established in
// this project by ShareIntentModule.m (see that file's own comment on why
// this approach, and on Xcode's bridging-header prompt if one doesn't
// already exist).
@interface RCT_EXTERN_MODULE(DuplexVoiceEngine, RCTEventEmitter)

RCT_EXTERN_METHOD(start:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stop:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(speak:(NSString *)text
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopSpeaking:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
