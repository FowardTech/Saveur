import Foundation
import React

// OS Share Sheet integration (product request: "Ability to share files to
// Saveur from the device and it will go directly to the document section
// of the app") -- the main-app-side counterpart to
// SaveurShareExtension/ShareViewController.swift. That extension runs in
// its own process and can't call back into this app's JS runtime directly,
// so the hand-off is entirely file-based: the extension writes a small
// JSON manifest (list of {path, name, mimeType, sizeBytes}) plus the
// actual copied files into the App Group shared container both targets
// have access to (see caren_family.entitlements' own comment for the App
// Group setup this requires in Xcode), then re-opens this app via a
// saveur://shared-import URL. App.tsx's existing Linking 'url' handling
// picks that up (see shareIntentService.ts's handleIncomingUrl) and calls
// getPendingSharedFiles() below to read + consume that manifest.
//
// Same JS-facing method name/shape as Android's ShareIntentModule.kt
// (getPendingSharedFiles() -> array of {uri, name, mimeType, sizeBytes})
// so shareIntentService.ts's TypeScript layer doesn't need any
// platform-specific branching beyond which NativeModule it talks to.
@objc(ShareIntentModule)
class ShareIntentModule: NSObject {

  // Must match ShareViewController.swift's own constants exactly.
  private let appGroupId = "group.com.ayotundebalogun.saveur"
  private let manifestFileName = "SaveurPendingShare.json"

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc(getPendingSharedFiles:rejecter:)
  func getPendingSharedFiles(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
      // App Group not configured yet (e.g. the extension target hasn't
      // been created/signed in Xcode yet — see SHARE_EXTENSION_SETUP.md)
      // — resolve to an empty list rather than reject, same "nothing
      // pending" outcome as the normal no-share case, so JS doesn't need
      // a separate "feature unavailable" branch.
      resolve([])
      return
    }
    let manifestUrl = container.appendingPathComponent(manifestFileName)
    guard let data = try? Data(contentsOf: manifestUrl),
          let entries = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
      resolve([])
      return
    }
    let importsDir = container.appendingPathComponent("SharedImports", isDirectory: true)
    let result: [[String: Any]] = entries.compactMap { entry in
      guard let path = entry["path"] as? String else { return nil }
      let fileUrl = importsDir.appendingPathComponent(path)
      guard FileManager.default.fileExists(atPath: fileUrl.path) else { return nil }
      return [
        "uri": fileUrl.absoluteString,
        "name": entry["name"] as? String ?? path,
        "mimeType": entry["mimeType"] as? String ?? "application/octet-stream",
        "sizeBytes": entry["sizeBytes"] as? Int ?? 0,
      ]
    }
    // Consumed once read -- same "clear after handing to JS" contract as
    // Android's pendingShareIntent, so the same share never gets
    // re-imported on a later check. The actual files under SharedImports/
    // are deliberately left in place rather than deleted here: JS's own
    // upload (documentsService.uploadDocument, via
    // shareIntentService.ts/MyDocuments.tsx) reads them asynchronously
    // right after this resolves, and deleting them from this synchronous
    // call would risk a race against that still-in-flight read.
    try? FileManager.default.removeItem(at: manifestUrl)
    resolve(result)
  }
}
