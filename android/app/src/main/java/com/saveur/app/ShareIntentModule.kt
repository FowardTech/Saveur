package com.saveur.app

import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.FileOutputStream

/**
 * OS Share Sheet integration (product request: "Ability to share files to
 * Saveur from the device and it will go directly to the document section of
 * the app") -- the JS-facing half of AndroidManifest.xml's ACTION_SEND /
 * ACTION_SEND_MULTIPLE intent-filters on MainActivity.
 *
 * A shared file arrives as a content:// Uri (Files, Mail, a browser's
 * "Share" sheet, etc. never hand over a real filesystem path), which isn't
 * something FormData/RN's own file-upload plumbing can stream from
 * directly the way it can a plain file:// path -- see
 * documentsService.ts's uploadDocument, which is exactly the existing
 * upload call this whole feature is meant to feed into, unchanged. Each
 * shared Uri is copied into this app's own cache dir once, here, and only
 * the resulting real file:// path/name/mimeType are handed to JS.
 *
 * Two paths a share can arrive on, both funneled through the same
 * `pendingShareIntent`:
 *   - Cold start: MainActivity.onCreate's own intent already has the
 *     ACTION_SEND action when the app wasn't running (see
 *     MainActivity.kt's onCreate override) -- getPendingSharedFiles() below
 *     picks this up once JS is ready to ask for it.
 *   - Warm/backgrounded: MainActivity is singleTask, so a share while the
 *     app is already running arrives via onNewIntent instead of a fresh
 *     onCreate -- see MainActivity.kt's onNewIntent override, which emits
 *     the "SaveurShareReceived" JS event this module also exposes for.
 */
class ShareIntentModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ShareIntentModule"

  companion object {
    // Set by MainActivity.onCreate/onNewIntent, read (and cleared) by
    // getPendingSharedFiles() below -- a single pending intent is enough
    // since MainActivity is singleTask (only ever one instance, so there's
    // never more than one "most recent share" to track at once).
    var pendingShareIntent: Intent? = null
  }

  private fun resolveDisplayName(uri: Uri): String {
    var name: String? = null
    try {
      reactContext.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
        val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        if (nameIndex >= 0 && cursor.moveToFirst()) {
          name = cursor.getString(nameIndex)
        }
      }
    } catch (e: Exception) {
      // Best-effort -- some providers (rare) don't support this query at
      // all; falls through to the generic name below rather than failing
      // the whole share.
    }
    return name ?: "Shared file ${System.currentTimeMillis()}"
  }

  private fun copyToCache(uri: Uri, displayName: String): File? {
    return try {
      val input = reactContext.contentResolver.openInputStream(uri) ?: return null
      // Own subdirectory so these never collide with/get swept up by any
      // other cache usage elsewhere in the app, and are easy to spot/clean
      // manually if ever needed.
      val dir = File(reactContext.cacheDir, "shared_imports")
      if (!dir.exists()) dir.mkdirs()
      // Prefixed with a timestamp -- two different apps can share files
      // both named "resume.pdf" in the same session, and this dir is never
      // cleared between shares (each import is a one-shot upload-then-
      // discard from JS's point of view, so no cleanup logic lives here).
      val safeName = displayName.replace(Regex("[^A-Za-z0-9._-]"), "_")
      val outFile = File(dir, "${System.currentTimeMillis()}_$safeName")
      FileOutputStream(outFile).use { output ->
        input.copyTo(output)
      }
      input.close()
      outFile
    } catch (e: Exception) {
      null
    }
  }

  private fun uriToFileMap(uri: Uri): WritableMap? {
    val displayName = resolveDisplayName(uri)
    val file = copyToCache(uri, displayName) ?: return null
    val mimeType = reactContext.contentResolver.getType(uri)
    val map = Arguments.createMap()
    map.putString("uri", "file://${file.absolutePath}")
    map.putString("name", displayName)
    map.putString("mimeType", mimeType ?: "application/octet-stream")
    map.putDouble("sizeBytes", file.length().toDouble())
    return map
  }

  private fun filesFromIntent(intent: Intent?): WritableArray {
    val out: WritableArray = Arguments.createArray()
    if (intent == null) return out
    when (intent.action) {
      Intent.ACTION_SEND -> {
        val uri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
        if (uri != null) {
          uriToFileMap(uri)?.let { out.pushMap(it) }
        }
      }
      Intent.ACTION_SEND_MULTIPLE -> {
        val uris = intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
        uris?.forEach { uri ->
          uriToFileMap(uri)?.let { out.pushMap(it) }
        }
      }
    }
    return out
  }

  /**
   * Called from JS on launch/foreground (see shareIntentService.ts) to pick
   * up a share that was already waiting (cold start, or a warm-start share
   * that arrived before any JS listener was attached yet). Clears
   * pendingShareIntent after reading so the same share is never re-imported
   * on a later check.
   */
  @ReactMethod
  fun getPendingSharedFiles(promise: Promise) {
    val intent = pendingShareIntent
    pendingShareIntent = null
    promise.resolve(filesFromIntent(intent))
  }

  // Required by React Native's built-in NativeEventEmitter contract even
  // though this module only ever emits (never needs JS to explicitly
  // subscribe/unsubscribe at the native layer) -- same no-op pattern every
  // other event-emitting native module in the RN ecosystem implements.
  @ReactMethod
  fun addListener(eventName: String) {}

  @ReactMethod
  fun removeListeners(count: Int) {}

  fun emitShareReceived(intent: Intent) {
    val files = filesFromIntent(intent)
    if (files.size() == 0) return
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("SaveurShareReceived", files)
  }
}
