# iOS Share Extension — one-time Xcode setup

This finishes the "share files to Saveur from the device" feature on iOS
(product request: *"Ability to share files to Saveur from the device and it
will go directly to the document section of the app"*). Android needed no
manual setup — its half is pure source/config (`AndroidManifest.xml`,
`ShareIntentModule.kt`, `MainActivity.kt`) and works as soon as you build.

iOS is different: adding a **Share Extension** to an app requires creating
a real second build **target** inside the `.xcodeproj`, which only Xcode
itself can do safely — the project file (`caren_family.xcodeproj/project.pbxproj`)
is a fragile, mostly-binary-structured format that this repo's own tooling
never hand-edits (see that file's own git history — it's treated as
build-machine-local, not something to touch directly). Everything that
*can* be written as a plain source/config file has already been created for
you:

- `ios/SaveurShareExtension/ShareViewController.swift` — the extension's
  logic (no UI — it copies the shared file(s) into an App Group container
  and re-opens Saveur).
- `ios/SaveurShareExtension/Info.plist` — the extension's own manifest
  (what file/link types it accepts).
- `ios/SaveurShareExtension/SaveurShareExtension.entitlements` — the App
  Group entitlement the extension needs.
- `ios/caren_family/caren_family.entitlements` — already updated with the
  matching App Group entitlement for the **main app** target.
- `ios/caren_family/ShareIntentModule.swift` + `ShareIntentModule.m` — the
  main app's native module that reads what the extension wrote. This is
  plain Swift/Obj-C source in the existing `caren_family` folder, so it
  will be picked up automatically once you open the project — no target
  creation needed for this part.

You still need to do the following in Xcode, once:

## 1. Open the project

```
open ios/caren_family.xcworkspace
```

(the `.xcworkspace`, not the `.xcodeproj` — same as any other build/pod
install in this repo).

## 2. Add the Share Extension target

1. File → New → Target…
2. Choose **Share Extension** (under iOS).
3. Product Name: `SaveurShareExtension`
4. Team: your usual signing team (same one `caren_family` already uses).
5. Uncheck "Activate scheme" if prompted (doesn't matter either way).
6. Xcode will generate its own `ShareViewController.swift`/`Info.plist`/
   `MainInterface.storyboard` for the new target — **delete the
   generated `ShareViewController.swift` and `Info.plist`** it creates,
   then drag in the real ones from `ios/SaveurShareExtension/` (the two
   files listed above) — check "Copy items if needed" is **off** (they're
   already in the right place) and that "SaveurShareExtension" is the
   target membership.
7. Delete the auto-generated `MainInterface.storyboard` too, and in the
   new target's Info.plist entry (or Xcode's target summary UI), clear the
   Main Interface / Storyboard Name field — this extension has no UI, it's
   handled entirely in code (`ShareViewController.viewDidLoad`).

## 3. Set the entitlements file

1. Select the `SaveurShareExtension` target → **Signing & Capabilities**.
2. Click **+ Capability** → **App Groups**.
3. Add `group.com.ayotundebalogun.saveur` (must match exactly what's
   already in both entitlements files above).
4. Xcode should auto-set `CODE_SIGN_ENTITLEMENTS` to point at
   `SaveurShareExtension.entitlements` — if it instead generated a new
   one, delete the generated file and point the build setting at
   `ios/SaveurShareExtension/SaveurShareExtension.entitlements` (the real
   one, already written) instead.

## 4. Add the same App Group to the main app target

1. Select the `caren_family` target → **Signing & Capabilities**.
2. Click **+ Capability** → **App Groups** (if not already present from
   push notifications/other entitlements).
3. Add the exact same `group.com.ayotundebalogun.saveur`.
4. This should sync into `ios/caren_family/caren_family.entitlements`
   (already has this key written in — Xcode should just confirm it, not
   need to add it again).

## 5. Confirm the main app's Swift bridge is picked up

`ios/caren_family/ShareIntentModule.swift` + `ShareIntentModule.m` are
plain files already sitting in the `caren_family` folder — if Xcode
doesn't show them in the project navigator after opening, right-click the
`caren_family` group → **Add Files to "caren_family"…** and select both.
If this is the very first Swift file paired with an Obj-C bridge in this
target (it isn't — `AppDelegate.swift` already exists), Xcode may prompt
to create an Objective-C bridging header — accept that prompt if it
appears.

## 6. Build & test

1. Build and run on a real device or simulator (Share Sheet testing works
   in the simulator too, via Files/Safari's own Share button).
2. From Files, Mail, Safari, etc., tap **Share** → **Saveur** should now
   appear in the share sheet.
3. Share a file — Saveur should open directly to **My Documents**, with
   the shared file uploading automatically (see
   `src/more/MyDocuments.tsx`'s `pendingImport` handling).

## Bundle identifiers

The extension target's bundle id should be
`com.ayotundebalogun.saveur.ShareExtension` (Xcode usually suggests this
automatically as `<main-app-bundle-id>.<ProductName>` — confirm it matches
before archiving/submitting, since App Store Connect needs both the app and
its extension registered).

## If any of this needs to change later

- **App Group id**: search this repo for `group.com.ayotundebalogun.saveur`
  (three files: both entitlements files + `ShareViewController.swift` +
  `ShareIntentModule.swift`) and update all four occurrences together —
  they must always match exactly.
- **Accepted share types**: edit
  `ios/SaveurShareExtension/Info.plist`'s `NSExtensionActivationRule`
  dictionary (see that file's own comment for what each key means).
