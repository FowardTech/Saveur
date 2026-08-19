#import <React/RCTBridgeModule.h>

// Objective-C bridge exposing ShareIntentModule.swift to React Native's
// module registry -- RCT_EXTERN_MODULE/RCT_EXTERN_METHOD are how a Swift
// native module becomes callable from JS without needing this project's
// own Swift code to conform to a codegen'd TurboModule spec. If Xcode
// hasn't already created one (check for
// caren_family-Bridging-Header.h under ios/caren_family/), adding this
// file will prompt Xcode to offer generating one automatically the first
// time the project is opened/built -- accept that prompt. See
// ios/SHARE_EXTENSION_SETUP.md.
@interface RCT_EXTERN_MODULE(ShareIntentModule, NSObject)

RCT_EXTERN_METHOD(getPendingSharedFiles:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
