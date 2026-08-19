import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

// OS Share Sheet integration (product request: "Ability to share files to
// Saveur from the device and it will go directly to the document section
// of the app") -- this extension has no real UI: rather than Apple's
// default SLComposeServiceViewController "add a comment, then Post" flow
// (meant for social-style sharing, not "hand this file to an app"), this
// runs invisibly, copies whatever was shared into the App Group shared
// container (see SaveurShareExtension.entitlements / caren_family's own
// entitlements -- both must list the exact same group id), then re-opens
// the host app via extensionContext?.open(_:completionHandler:) so the
// product ask ("it will go directly to the document section of the app",
// not just to a share-sheet confirmation dialog) is actually true on iOS,
// not just Android.
//
// ShareIntentModule.swift (the MAIN app target, not this extension) reads
// back whatever gets written to MANIFEST_FILE_NAME below.
class ShareViewController: UIViewController {

  // Must match ShareIntentModule.swift's own constant exactly -- this is
  // the filename (inside the shared App Group container) both sides agree
  // on as "the list of files from the most recent share", written here,
  // read + deleted there.
  private let manifestFileName = "SaveurPendingShare.json"
  private let appGroupId = "group.com.ayotundebalogun.saveur"

  override func viewDidLoad() {
    super.viewDidLoad()
    handleShare()
  }

  private func handleShare() {
    guard let items = extensionContext?.inputItems as? [NSExtensionItem] else {
      completeAndReturn()
      return
    }

    let group = DispatchGroup()
    var sharedEntries: [[String: Any]] = []
    let lock = NSLock()

    for item in items {
      guard let attachments = item.attachments else { continue }
      for provider in attachments {
        // File (Files app, Mail attachment, another app's "Share... to
        // Saveur"): the common case, and what MyDocuments.tsx's own
        // upload flow (documentsService.uploadDocument) already expects
        // downstream -- a real local file it can multipart-upload.
        if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) ||
           provider.hasItemConformingToTypeIdentifier(UTType.data.identifier) {
          group.enter()
          provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { [weak self] (data, error) in
            defer { group.leave() }
            guard let self = self else { return }
            var sourceUrl: URL? = data as? URL
            if sourceUrl == nil, let urlData = data as? Data {
              sourceUrl = URL(dataRepresentation: urlData, relativeTo: nil)
            }
            guard let url = sourceUrl, let copied = self.copyIntoSharedContainer(from: url) else { return }
            lock.lock()
            sharedEntries.append(copied)
            lock.unlock()
          }
          continue
        }
        // Web link (Safari/another app's "Share" on a URL) -- saved as a
        // small .url text file into the same shared container so
        // ShareIntentModule.swift's read path stays one shape (a list of
        // {uri, name, mimeType}) rather than needing a second, parallel
        // "it was actually a link, not a file" branch all the way through
        // JS too. See this extension's own Info.plist comment for the
        // matching NSExtensionActivationSupportsWebURLWithMaxCount rule.
        if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
          group.enter()
          provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] (data, error) in
            defer { group.leave() }
            guard let self = self, let url = data as? URL else { return }
            guard let saved = self.saveLinkAsFile(url) else { return }
            lock.lock()
            sharedEntries.append(saved)
            lock.unlock()
          }
        }
      }
    }

    group.notify(queue: .main) { [weak self] in
      guard let self = self else { return }
      if !sharedEntries.isEmpty {
        self.appendToManifest(sharedEntries)
      }
      self.completeAndReturn()
    }
  }

  private func sharedContainerUrl() -> URL? {
    return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId)
  }

  private func copyIntoSharedContainer(from sourceUrl: URL) -> [String: Any]? {
    guard let container = sharedContainerUrl() else { return nil }
    let importsDir = container.appendingPathComponent("SharedImports", isDirectory: true)
    do {
      try FileManager.default.createDirectory(at: importsDir, withIntermediateDirectories: true)
      let originalName = sourceUrl.lastPathComponent
      let destName = "\(Int(Date().timeIntervalSince1970 * 1000))_\(originalName)"
      let destUrl = importsDir.appendingPathComponent(destName)
      // Share-extension-provided file URLs are security-scoped in some
      // cases (e.g. from Files/iCloud Drive) -- start/stopAccessing brackets
      // the actual read so this doesn't silently fail for those sources
      // while still working fine for ones that don't need it (that pair is
      // a documented no-op when not required).
      let needsScope = sourceUrl.startAccessingSecurityScopedResource()
      defer { if needsScope { sourceUrl.stopAccessingSecurityScopedResource() } }
      if FileManager.default.fileExists(atPath: destUrl.path) {
        try FileManager.default.removeItem(at: destUrl)
      }
      try FileManager.default.copyItem(at: sourceUrl, to: destUrl)
      let mimeType = mimeType(forPathExtension: sourceUrl.pathExtension)
      let size = (try? FileManager.default.attributesOfItem(atPath: destUrl.path)[.size] as? Int) ?? 0
      return [
        "path": destName,
        "name": originalName,
        "mimeType": mimeType,
        "sizeBytes": size ?? 0,
      ]
    } catch {
      return nil
    }
  }

  private func saveLinkAsFile(_ url: URL) -> [String: Any]? {
    guard let container = sharedContainerUrl() else { return nil }
    let importsDir = container.appendingPathComponent("SharedImports", isDirectory: true)
    do {
      try FileManager.default.createDirectory(at: importsDir, withIntermediateDirectories: true)
      let name = "Shared Link \(Int(Date().timeIntervalSince1970 * 1000)).txt"
      let destUrl = importsDir.appendingPathComponent(name)
      try url.absoluteString.write(to: destUrl, atomically: true, encoding: .utf8)
      let size = (try? FileManager.default.attributesOfItem(atPath: destUrl.path)[.size] as? Int) ?? 0
      return [
        "path": name,
        "name": name,
        "mimeType": "text/plain",
        "sizeBytes": size ?? 0,
      ]
    } catch {
      return nil
    }
  }

  private func mimeType(forPathExtension ext: String) -> String {
    if let type = UTType(filenameExtension: ext), let mime = type.preferredMIMEType {
      return mime
    }
    return "application/octet-stream"
  }

  private func appendToManifest(_ entries: [[String: Any]]) {
    guard let container = sharedContainerUrl() else { return }
    let manifestUrl = container.appendingPathComponent(manifestFileName)
    var existing: [[String: Any]] = []
    if let data = try? Data(contentsOf: manifestUrl),
       let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
      existing = parsed
    }
    existing.append(contentsOf: entries)
    if let out = try? JSONSerialization.data(withJSONObject: existing) {
      try? out.write(to: manifestUrl)
    }
  }

  // Re-opens the host app so the product ask ("it will go directly to the
  // document section of the app") is actually satisfied, not just "the
  // share sheet said Done". `open(_:completionHandler:)` on
  // NSExtensionContext is the standard (if slightly obscure) way an app
  // extension hands off to its containing app -- iOS itself briefly
  // animates this extension away first, then foregrounds Saveur with this
  // URL as its launch/warm-open URL, landing on App.tsx's existing
  // Linking 'url' handling (see shareIntentService.ts's handleIncomingUrl).
  private func completeAndReturn() {
    let url = URL(string: "saveur://shared-import")!
    extensionContext?.open(url, completionHandler: nil)
    extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
  }
}
