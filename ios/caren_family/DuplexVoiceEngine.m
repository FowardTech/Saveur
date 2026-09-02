#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// Objective-C bridge exposing DuplexVoiceEngine.swift to React Native --
// same RCT_EXTERN_MODULE/RCT_EXTERN_METHOD pattern already established in
// this project by ShareIntentModule.m (see that file's own comment on why
// this approach, and on Xcode's bridging-header prompt if one doesn't
// already exist). Unlike ShareIntentModule.m (RCT_EXTERN_MODULE(...,
// NSObject)), DuplexVoiceEngine.swift subclasses RCTEventEmitter (needed
// for its onTranscript/onListeningState/onSpeakingState/onError events),
// so RCT_EXTERN_MODULE's second argument below is RCTEventEmitter, not
// NSObject -- that macro expands to an @interface declaring
// RCTEventEmitter as this class's actual Objective-C superclass, which
// under Clang's module system requires RCTEventEmitter.h to be imported
// explicitly here too, not just RCTBridgeModule.h (build error without
// this: "Declaration of 'RCTEventEmitter' must be imported from module
// 'React.RCTEventEmitter' before it is required").
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

RCT_EXTERN_METHOD(speakRemoteAudio:(NSString *)uri
                  headers:(NSDictionary *)headers
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
