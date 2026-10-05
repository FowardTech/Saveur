import React from 'react';
import {StyleProp, ViewStyle} from 'react-native';
import {WebView, WebViewMessageEvent} from 'react-native-webview';

// ---------------------------------------------------------------------------
// CodeEditorWebView — the actual multi-file code editing widget for Coding
// Projects (src/practice/CodingProjectEditor.tsx).
//
// WHY A WEBVIEW + CODEMIRROR, NOT A NATIVE EDITOR: this repo has no
// code-editor-capable dependency already installed (checked package.json for
// @rivascva/react-native-code-editor, react-native-syntax-highlighter, and
// similar — none present; CodingProblemSolve.tsx's single-file editor is
// just a plain UI Kitten <Input multiline>, no syntax highlighting at all).
// This app is also a BARE (non-Expo) React Native project — no "expo" entry
// in package.json, real android/ios native project folders present — so a
// native editor library isn't blocked by a managed-workflow restriction, but
// it WOULD still need `pod install`/a full native rebuild on both platforms
// to link, which isn't something this change can verify actually builds
// cleanly end-to-end here. react-native-webview is already a first-party
// dependency used elsewhere in this exact way (src/more/WebViewScreen.tsx),
// so hosting a small embedded CodeMirror 5 instance (loaded from a CDN
// <script> tag, content in/out via postMessage) needs zero native changes,
// works identically on iOS/Android, and gives real syntax highlighting +
// line numbers + bracket matching — the same well-established RN pattern
// used for "real" code editors given native TextInput's total lack of any
// of that. CodeMirror (not another JS editor lib) specifically to match
// whatever the web teammate's parallel Coding Projects build is already
// using, per the product spec.
//
// ONE PERSISTENT WEBVIEW, NOT ONE PER FILE: switching files does NOT remount
// this component — CodingProjectEditor.tsx keeps a single instance mounted
// for the whole editing session and pushes the newly-opened file's content
// in via `value`/`language` prop changes, which this component forwards to
// the page over postMessage. Remounting per file would mean re-fetching the
// CodeMirror CDN bundle (or at least re-running the whole <script> boot)
// every single file switch — slow and pointless when the same page can just
// swap its buffer.
// ---------------------------------------------------------------------------

export interface CodeEditorWebViewProps {
  /** Current file's full text content. */
  value: string;
  /** A CodeMirror 5 MIME type or mode name — see codeMirrorModeForPath()
   * below for the extension -> mode mapping callers should use. */
  language: string;
  onChangeText: (text: string) => void;
  editable?: boolean;
  style?: StyleProp<ViewStyle>;
}

const CM_VERSION = '5.65.16';
const CM_BASE = `https://cdnjs.cloudflare.com/ajax/libs/codemirror/${CM_VERSION}`;

// Curated set of modes covering every language this app's coding practice /
// projects feature realistically touches (see languageIdForPath /
// codeMirrorModeForPath in CodingProjectEditor.tsx) — not CodeMirror's full
// mode catalogue, to keep the page's boot-time script list short.
const EDITOR_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  html, body { margin:0; padding:0; height:100%; background:#1E1E2E; overscroll-behavior:none; }
  .CodeMirror { height:100%; font-family: Menlo, "Courier New", monospace; font-size:13px; }
  .cm-s-material-darker.CodeMirror { background:#1E1E2E; }
  .CodeMirror-gutters { background:#1E1E2E; border-right:1px solid #2E2E42; }
</style>
<link rel="stylesheet" href="${CM_BASE}/codemirror.min.css">
<link rel="stylesheet" href="${CM_BASE}/theme/material-darker.min.css">
</head>
<body>
<textarea id="editor"></textarea>
<script src="${CM_BASE}/codemirror.min.js"></script>
<script src="${CM_BASE}/mode/javascript/javascript.min.js"></script>
<script src="${CM_BASE}/mode/python/python.min.js"></script>
<script src="${CM_BASE}/mode/xml/xml.min.js"></script>
<script src="${CM_BASE}/mode/css/css.min.js"></script>
<script src="${CM_BASE}/mode/htmlmixed/htmlmixed.min.js"></script>
<script src="${CM_BASE}/mode/clike/clike.min.js"></script>
<script src="${CM_BASE}/mode/php/php.min.js"></script>
<script src="${CM_BASE}/mode/ruby/ruby.min.js"></script>
<script src="${CM_BASE}/mode/shell/shell.min.js"></script>
<script src="${CM_BASE}/mode/sql/sql.min.js"></script>
<script src="${CM_BASE}/mode/yaml/yaml.min.js"></script>
<script src="${CM_BASE}/mode/markdown/markdown.min.js"></script>
<script src="${CM_BASE}/mode/go/go.min.js"></script>
<script src="${CM_BASE}/addon/edit/matchbrackets.min.js"></script>
<script src="${CM_BASE}/addon/edit/closebrackets.min.js"></script>
<script src="${CM_BASE}/addon/selection/active-line.min.js"></script>
<script>
(function () {
  var cm = null;

  function post(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
  }

  var plain = null; // fallback <textarea> editor when the CodeMirror CDN can't load

  function initPlain() {
    var ta = document.getElementById('editor');
    ta.style.cssText = 'display:block;width:100%;height:100%;box-sizing:border-box;border:0;outline:0;resize:none;padding:10px;background:#1E1E2E;color:#E6E6F0;font:13px Menlo,"Courier New",monospace;white-space:pre;overflow:auto;';
    ta.setAttribute('autocapitalize', 'off');
    ta.setAttribute('autocorrect', 'off');
    ta.setAttribute('spellcheck', 'false');
    ta.addEventListener('input', function () { post({type: 'change', content: ta.value}); });
    plain = ta;
    post({type: 'ready'});
  }

  function init() {
    if (typeof CodeMirror === 'undefined') { initPlain(); return; }
    try {
      cm = CodeMirror.fromTextArea(document.getElementById('editor'), {
        lineNumbers: true,
        theme: 'material-darker',
        mode: 'text/plain',
        matchBrackets: true,
        autoCloseBrackets: true,
        styleActiveLine: true,
        indentUnit: 2,
        tabSize: 2,
        viewportMargin: Infinity,
        lineWrapping: false,
      });
      cm.on('change', function (instance, changeObj) {
        // 'setValue' is the origin CodeMirror gives a programmatic
        // cm.setValue() call (see handleMessage's 'setContent' branch below)
        // -- filtering it out here is what stops RN's own pushed update
        // from bouncing straight back up as if the user had typed it.
        if (changeObj.origin === 'setValue') return;
        post({type: 'change', content: cm.getValue()});
      });
      post({type: 'ready'});
    } catch (e) {
      post({type: 'error', message: String(e)});
    }
  }

  function handleMessage(raw) {
    var msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!cm && plain) {
      if (msg.type === 'setContent') {
        plain.readOnly = !!msg.readOnly;
        if (plain.value !== (msg.content || '')) plain.value = msg.content || '';
      } else if (msg.type === 'setReadOnly') {
        plain.readOnly = !!msg.readOnly;
      }
      return;
    }
    if (!cm) return;
    if (msg.type === 'setContent') {
      cm.setOption('mode', msg.mode || 'text/plain');
      cm.setOption('readOnly', !!msg.readOnly);
      var cur = cm.getValue();
      if (cur !== (msg.content || '')) {
        cm.setValue(msg.content || '');
        cm.clearHistory();
        cm.setCursor(0, 0);
      }
    } else if (msg.type === 'setReadOnly') {
      cm.setOption('readOnly', !!msg.readOnly);
    }
  }

  document.addEventListener('message', function (e) { handleMessage(e.data); });
  window.addEventListener('message', function (e) { handleMessage(e.data); });

  // Scripts above are loaded synchronously, so everything that is going to
  // load already has - boot now instead of waiting for the window 'load' event
  // (which stalls if any single CDN script hangs).
  init();
})();
</script>
</body>
</html>`;

const CodeEditorWebView = React.forwardRef<WebView, CodeEditorWebViewProps>(
  ({value, language, onChangeText, editable = true, style}, ref) => {
    const webviewRef = React.useRef<WebView>(null);
    React.useImperativeHandle(ref, () => webviewRef.current as WebView);

    const isReadyRef = React.useRef(false);
    // Tracks the last content this component either sent TO the page or
    // received FROM it — lets the sync effect below tell "the open file
    // changed underneath us" (send it) apart from "this is just our own
    // onChangeText echo coming back around as a new `value` prop" (skip it,
    // see this file's own module comment for why re-sending that would reset
    // the cursor/undo history on every keystroke).
    const lastSyncedRef = React.useRef<string>('');
    // Recently emitted edits. A parent's `value` prop echoing an OLDER keystroke
    // back while the user has already typed more must NOT be re-sent to the page
    // (that would overwrite the newer text and make typing look frozen).
    const emittedRef = React.useRef<string[]>([]);

    const sendContent = React.useCallback((content: string, mode: string, readOnly: boolean) => {
      lastSyncedRef.current = content;
      webviewRef.current?.postMessage(JSON.stringify({type: 'setContent', content, mode, readOnly}));
    }, []);

    const onMessage = React.useCallback(
      (e: WebViewMessageEvent) => {
        let msg: any;
        try {
          msg = JSON.parse(e.nativeEvent.data);
        } catch {
          return;
        }
        if (msg.type === 'ready') {
          isReadyRef.current = true;
          sendContent(value, language, !editable);
        } else if (msg.type === 'change') {
          lastSyncedRef.current = msg.content;
          emittedRef.current = [...emittedRef.current.slice(-30), msg.content];
          onChangeText(msg.content);
        }
      },
      // Deliberately NOT re-running this on every `value` keystroke update --
      // only `ready` needs the latest value/language/editable at the moment
      // the page finishes booting; `change` doesn't reference them at all.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [language, editable, onChangeText, sendContent],
    );

    React.useEffect(() => {
      if (!isReadyRef.current) return;
      if (value === lastSyncedRef.current) return;
      if (emittedRef.current.includes(value)) return;
      emittedRef.current = [];
      sendContent(value, language, !editable);
    }, [value, language, editable, sendContent]);

    return (
      // Pre-existing project-wide typing mismatch between this app's React/
      // TS versions and react-native-webview's own .d.ts — every other
      // <WebView> call site in this app (e.g. src/more/WebViewScreen.tsx)
      // hits the exact same "no overload matches" TS2769 on its JSX tag;
      // this isn't a real type error in this component's own props.
      // @ts-ignore
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{html: EDITOR_HTML}}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        style={[{backgroundColor: '#1E1E2E'}, style]}
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView
      />
    );
  },
);

export default CodeEditorWebView;

/**
 * File extension -> CodeMirror 5 MIME/mode name. Shared by
 * CodingProjectEditor.tsx for both the editor pane (`language` prop above)
 * and isn't used for the /run endpoint's `language` field -- see that
 * screen's separate runLanguageForPath() for the Judge0-style language id
 * mapping, a different vocabulary entirely.
 */
export function codeMirrorModeForPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
    case 'ts':
    case 'tsx':
      return 'text/javascript';
    case 'json':
      return 'application/json';
    case 'py':
      return 'text/x-python';
    case 'html':
    case 'htm':
      return 'text/html';
    case 'css':
      return 'text/css';
    case 'java':
      return 'text/x-java';
    case 'c':
      return 'text/x-csrc';
    case 'h':
    case 'hpp':
    case 'cc':
    case 'cpp':
      return 'text/x-c++src';
    case 'php':
      return 'application/x-httpd-php';
    case 'rb':
      return 'text/x-ruby';
    case 'go':
      return 'text/x-go';
    case 'sh':
    case 'bash':
      return 'text/x-sh';
    case 'sql':
      return 'text/x-sql';
    case 'yml':
    case 'yaml':
      return 'text/x-yaml';
    case 'md':
      return 'text/x-markdown';
    case 'xml':
      return 'application/xml';
    default:
      return 'text/plain';
  }
}
