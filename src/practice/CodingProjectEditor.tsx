import React, {memo} from 'react';
import {Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, TouchableOpacity, View} from 'react-native';
import {TopNavigation, StyleService, useStyleSheet, useTheme, Icon, Input, Spinner} from '@ui-kitten/components';
import {NavigationProp, RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {WebView} from 'react-native-webview';

import Text from 'components/Text';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import EmptyState from 'components/EmptyState';
import CtaButton from 'components/CtaButton';
import {globalStyle} from 'styles/globalStyle';
import {RootStackParamList} from 'navigation/types';
import {ADDON_CODES, hasAddon} from 'services/entitlementsService';
import * as codingProjectsService from 'services/codingProjectsService';
import {CodingProjectDetail, ProjectRunResult} from 'services/codingProjectsService';
import CodeEditorWebView, {codeMirrorModeForPath} from 'components/CodeEditorWebView';

// Coding Projects editor — the actual multi-file/folder code workspace
// screen. Reached from CodingProjectsHub.tsx's project list. See that
// file's own header comment and services/codingProjectsService.ts for the
// wider feature context (backend contract, add-on gating).
//
// MOBILE-SPECIFIC UX CHOICE (per the product spec's own guidance): a full
// desktop-style tab strip doesn't fit a phone screen alongside a usable
// code pane. This uses a single-line "currently editing: <path>" switcher
// bar that opens a bottom-sheet file tree (create/rename/delete/tap-to-
// open) instead — an intentional simplification of desktop's tab strip,
// not a missing feature.
const MONO_FONT = Platform.select({ios: 'Courier New', android: 'monospace', default: 'monospace'});

type WorkingFile = {path: string; content: string};

// --- Extension -> Judge0-style run language id, for POST .../run's
// `language` field. A DIFFERENT vocabulary from CodeEditorWebView's
// codeMirrorModeForPath (CodeMirror MIME/mode names) -- kept as its own
// function rather than reused, since the two mappings serve unrelated APIs
// and happen to only partially overlap.
function runLanguageForPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'py':
      return 'python';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'ts':
      return 'typescript';
    case 'rb':
      return 'ruby';
    case 'php':
      return 'php';
    case 'java':
      return 'java';
    case 'c':
      return 'c';
    case 'cpp':
    case 'cc':
    case 'cxx':
      return 'cpp';
    case 'go':
      return 'go';
    default:
      return ext || 'plaintext';
  }
}

function iconForPath(path: string | null): string {
  if (!path) return 'file-outline';
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'html' || ext === 'htm') return 'globe-outline';
  if (ext === 'css') return 'droplet-outline';
  if (ext === 'json') return 'code-outline';
  return 'file-text-outline';
}

/** "main.py"/"index.js"/first file — the entry-point guess pre-selected in
 * the run picker (and used as the initially-opened file for a freshly
 * opened project) so the user usually doesn't have to hunt for it. Always
 * just a starting point, never enforced — Run's entry picker lets any file
 * be picked instead. */
function guessEntryPath(files: WorkingFile[], projectType: codingProjectsService.ProjectType): string | null {
  const real = files.filter(f => !f.path.endsWith('/.gitkeep'));
  if (!real.length) return null;
  if (projectType === 'web') {
    return real.find(f => f.path === 'index.html')?.path ?? real[0].path;
  }
  const candidates = ['main.py', 'app.py', 'index.js', 'main.js', 'index.ts', 'main.rb', 'main.php', 'Main.java', 'main.go'];
  for (const c of candidates) {
    const match = real.find(f => f.path === c);
    if (match) return match.path;
  }
  return real[0].path;
}

// --- Simple flat-paths -> tree, for the file-tree bottom sheet's display
// only (the source of truth stays the flat `files` array everywhere else,
// since that's the shape both the save/run endpoints expect). Folders are
// implied entirely by path prefixes -- there's no separate "folder" record
// on the backend, so an intentionally-empty folder is represented by a
// hidden `<folder>/.gitkeep` placeholder file (created by onCreateFolder,
// filtered out of the visible leaf list below).
interface DirNode {
  type: 'dir';
  name: string;
  path: string;
  children: Array<DirNode | FileNode>;
}
interface FileNode {
  type: 'file';
  name: string;
  path: string;
}
function buildTree(paths: string[]): DirNode {
  const root: DirNode = {type: 'dir', name: '', path: '', children: []};
  const dirIndex = new Map<string, DirNode>([['', root]]);
  [...paths].sort().forEach(p => {
    const parts = p.split('/');
    let currentPath = '';
    let currentDir = root;
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      let dir = dirIndex.get(currentPath);
      if (!dir) {
        dir = {type: 'dir', name: parts[i], path: currentPath, children: []};
        dirIndex.set(currentPath, dir);
        currentDir.children.push(dir);
      }
      currentDir = dir;
    }
    const fileName = parts[parts.length - 1];
    if (fileName === '.gitkeep') return; // placeholder-only folders still show up via dirIndex above
    currentDir.children.push({type: 'file', name: fileName, path: p});
  });
  const sortDir = (dir: DirNode) => {
    dir.children.sort((a, b) => (a.type !== b.type ? (a.type === 'dir' ? -1 : 1) : a.name.localeCompare(b.name)));
    dir.children.forEach(c => c.type === 'dir' && sortDir(c));
  };
  sortDir(root);
  return root;
}
function flattenTree(dir: DirNode, depth = 0, out: Array<{node: DirNode | FileNode; depth: number}> = []) {
  dir.children.forEach(c => {
    out.push({node: c, depth});
    if (c.type === 'dir') flattenTree(c, depth + 1, out);
  });
  return out;
}

const CodingProjectEditor = memo(() => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'CodingProjectEditor'>>();
  const {projectId} = route.params;
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['find', 'more', 'common']);

  const [addonOwned, setAddonOwned] = React.useState<boolean | null | undefined>(undefined);
  const [project, setProject] = React.useState<CodingProjectDetail | null>(null);
  const [files, setFiles] = React.useState<WorkingFile[]>([]);
  const [activeFilePath, setActiveFilePath] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const savedSnapshotRef = React.useRef<string>('[]');

  const [saving, setSaving] = React.useState(false);
  const [running, setRunning] = React.useState(false);

  const [fileTreeVisible, setFileTreeVisible] = React.useState(false);
  const [newItem, setNewItem] = React.useState<{visible: boolean; isFolder: boolean; parentDir: string; name: string}>({
    visible: false,
    isFolder: false,
    parentDir: '',
    name: '',
  });
  const [renameState, setRenameState] = React.useState<{path: string; isFolder: boolean; value: string} | null>(null);

  const [runPickerVisible, setRunPickerVisible] = React.useState(false);
  const [runEntry, setRunEntry] = React.useState<string | null>(null);
  const [runStdin, setRunStdin] = React.useState('');
  const [runResult, setRunResult] = React.useState<ProjectRunResult | null>(null);
  const [runResultVisible, setRunResultVisible] = React.useState(false);

  const [previewVisible, setPreviewVisible] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    hasAddon(ADDON_CODES.codingPractice).then(owned => {
      if (cancelled) return;
      setAddonOwned(owned);
      if (!owned) {
        setIsLoading(false);
        return;
      }
      codingProjectsService
        .getProject(projectId)
        .then(detail => {
          if (cancelled) return;
          setProject(detail);
          const working = detail.files.map(f => ({path: f.path, content: f.content}));
          setFiles(working);
          savedSnapshotRef.current = JSON.stringify(working);
          setActiveFilePath(guessEntryPath(working, detail.projectType));
          setRunEntry(guessEntryPath(working, detail.projectType));
        })
        .catch((e: any) => {
          if (!cancelled) setLoadError(e?.message ?? t('find:coding_project_load_failed', {defaultValue: 'Could not load this project.'}));
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const isDirty = JSON.stringify(files) !== savedSnapshotRef.current;
  const isDirtyRef = React.useRef(false);
  React.useEffect(() => {
    isDirtyRef.current = isDirty;
  });

  const totalBytes = React.useMemo(() => codingProjectsService.totalProjectBytes(files), [files]);
  const overLimit = totalBytes > codingProjectsService.MAX_PROJECT_BYTES;

  const activeFile = files.find(f => f.path === activeFilePath) ?? null;

  const onChangeActiveFileContent = React.useCallback(
    (text: string) => {
      if (!activeFilePath) return;
      setFiles(prev => prev.map(f => (f.path === activeFilePath ? {...f, content: text} : f)));
    },
    [activeFilePath],
  );

  const onSave = React.useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const snapshot = files;
      await codingProjectsService.saveProjectFiles(projectId, snapshot.map(f => ({path: f.path, content: f.content})));
      savedSnapshotRef.current = JSON.stringify(snapshot);
    } catch (e) {
      if (codingProjectsService.isProjectTooLargeError(e)) {
        Alert.alert(
          t('find:coding_project_too_large_title', {defaultValue: 'Project is too large'}),
          t('find:coding_project_too_large_body', {
            defaultValue:
              'Your files total {{actual}}, over the {{max}} limit. Remove or shrink some files, then save again.',
            actual: codingProjectsService.formatBytes(e.actualBytes),
            max: codingProjectsService.formatBytes(e.maxBytes),
          }).toString(),
        );
      } else {
        Alert.alert(
          t('find:coding_project_save_failed', {defaultValue: 'Could not save'}),
          (e as any)?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}).toString(),
        );
      }
    } finally {
      setSaving(false);
    }
  }, [files, projectId, saving, t]);

  // Product request: "when a user have created a project. There should be
  // a button in the created folder or project saying 'Analyze with your
  // coach' and then the AI coach can analyze the whole project together
  // with the users."
  //
  // BUG FIX (product report: "For the Analyzing of the coding project by
  // the AI, instead of auto pasting the code in the project to the AI
  // chat it should just auto upload the project file or folder or the
  // project hyperlink. auto pasting the full code in the chat will be
  // very long and consume a whole chat interface"): this used to build
  // the whole project's code (capped at 6000 chars, but still a wall of
  // raw code) into initialPrompt itself. Now sends a short, human message
  // plus this project's real, already-saved id -- Chat.tsx's auto-send
  // effect passes codingProjectId through to coachService.sendMessage,
  // which the backend (app/api/coach.py's advice()) uses to fetch the
  // project's files server-side and attach them to its own system prompt
  // instead of ever putting the code in the visible chat message.
  const onAnalyzeWithCoach = React.useCallback(() => {
    const message = t('find:analyze_project_prompt', {
      defaultValue: 'Can you review my coding project "{{name}}"? I\'ve attached it below.',
      name: project?.name ?? 'Untitled',
    });
    navigation.navigate('MainBottomTab', {
      screen: 'Coach',
      params: {
        screen: 'Chat',
        params: {initialPrompt: message.toString(), codingProjectId: String(projectId)},
      },
    });
  }, [project, projectId, navigation, t]);

  // Warn on the way out with unsaved changes — same beforeRemove pattern
  // WebViewScreen.tsx already uses for its own "did you apply?" fallback.
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', e => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      Alert.alert(
        t('find:coding_project_unsaved_title', {defaultValue: 'Unsaved changes'}),
        t('find:coding_project_unsaved_body', {defaultValue: 'Save your changes before leaving?'}).toString(),
        [
          {text: t('common:cancel', {defaultValue: 'Cancel'}).toString(), style: 'cancel'},
          {
            text: t('common:discard', {defaultValue: 'Discard'}).toString(),
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
          {
            text: t('common:save', {defaultValue: 'Save'}).toString(),
            onPress: async () => {
              await onSave();
              navigation.dispatch(e.data.action);
            },
          },
        ],
      );
    });
    return unsubscribe;
  }, [navigation, onSave, t]);

  const openNewItemModal = (isFolder: boolean) => {
    // New files/folders are created at the project root for simplicity —
    // once created, they can be dragged... actually renamed (there's no
    // drag-and-drop here) into a nested path by editing the name to include
    // "subfolder/name" directly, same trick most lightweight mobile file
    // pickers use in lieu of real drag-and-drop.
    setFileTreeVisible(false);
    setNewItem({visible: true, isFolder, parentDir: '', name: ''});
  };

  const onSubmitNewItem = () => {
    const raw = newItem.name.trim().replace(/^\/+|\/+$/g, '');
    if (!raw) return;
    const full = newItem.parentDir ? `${newItem.parentDir}/${raw}` : raw;
    if (newItem.isFolder) {
      const prefix = `${full}/`;
      if (files.some(f => f.path === full || f.path.startsWith(prefix))) {
        Alert.alert(t('find:coding_project_duplicate_path', {defaultValue: 'That path already exists.'}));
        return;
      }
      setFiles(prev => [...prev, {path: `${full}/.gitkeep`, content: ''}]);
    } else {
      if (files.some(f => f.path === full)) {
        Alert.alert(t('find:coding_project_duplicate_path', {defaultValue: 'That path already exists.'}));
        return;
      }
      setFiles(prev => [...prev, {path: full, content: ''}]);
      setActiveFilePath(full);
    }
    setNewItem({visible: false, isFolder: false, parentDir: '', name: ''});
  };

  const onRenameRow = (node: FileNode | DirNode) => {
    setFileTreeVisible(false);
    setRenameState({path: node.path, isFolder: node.type === 'dir', value: node.name});
  };

  const onSubmitRename = () => {
    if (!renameState) return;
    const newName = renameState.value.trim();
    if (!newName || newName.includes('/')) return;
    const parentDir = renameState.path.includes('/') ? renameState.path.slice(0, renameState.path.lastIndexOf('/')) : '';
    const newFull = parentDir ? `${parentDir}/${newName}` : newName;
    if (renameState.isFolder) {
      const oldPrefix = `${renameState.path}/`;
      setFiles(prev => prev.map(f => (f.path.startsWith(oldPrefix) ? {...f, path: `${newFull}/${f.path.slice(oldPrefix.length)}`} : f)));
      if (activeFilePath?.startsWith(oldPrefix)) setActiveFilePath(`${newFull}/${activeFilePath.slice(oldPrefix.length)}`);
    } else {
      setFiles(prev => prev.map(f => (f.path === renameState.path ? {...f, path: newFull} : f)));
      if (activeFilePath === renameState.path) setActiveFilePath(newFull);
    }
    setRenameState(null);
  };

  const onDeleteRow = (node: FileNode | DirNode) => {
    Alert.alert(
      t('find:coding_project_delete_item_title', {defaultValue: 'Delete "{{name}}"?', name: node.name}),
      node.type === 'dir'
        ? t('find:coding_project_delete_folder_body', {defaultValue: 'This folder and everything in it will be deleted.'}).toString()
        : undefined,
      [
        {text: t('common:cancel', {defaultValue: 'Cancel'}).toString(), style: 'cancel'},
        {
          text: t('common:delete', {defaultValue: 'Delete'}).toString(),
          style: 'destructive',
          onPress: () => {
            if (node.type === 'dir') {
              const prefix = `${node.path}/`;
              setFiles(prev => prev.filter(f => !f.path.startsWith(prefix)));
              if (activeFilePath?.startsWith(prefix)) setActiveFilePath(null);
            } else {
              setFiles(prev => prev.filter(f => f.path !== node.path));
              if (activeFilePath === node.path) setActiveFilePath(null);
            }
          },
        },
      ],
    );
  };

  const onRun = async () => {
    if (running || !runEntry) return;
    setRunning(true);
    setRunResult(null);
    try {
      const result = await codingProjectsService.runProject(
        projectId,
        runEntry,
        runLanguageForPath(runEntry),
        runStdin || undefined,
      );
      setRunResult(result);
      setRunPickerVisible(false);
      setRunResultVisible(true);
    } catch (e: any) {
      Alert.alert(
        t('find:run_failed', {defaultValue: 'Run failed'}),
        e?.message ?? t('find:run_code_failed_body', {defaultValue: 'Could not run your code. Please try again.'}),
      );
    } finally {
      setRunning(false);
    }
  };

  const previewHtml = React.useMemo(() => {
    if (project?.projectType !== 'web') return null;
    const index = files.find(f => f.path === 'index.html');
    if (!index) return null;
    const byPath = new Map(files.map(f => [f.path, f.content]));
    let html = index.content;
    html = html.replace(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi, (match, href) => {
      const clean = String(href).replace(/^\.\//, '');
      if (!clean.toLowerCase().endsWith('.css')) return match;
      const css = byPath.get(clean);
      return css === undefined ? match : `<style>${css}</style>`;
    });
    html = html.replace(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi, (match, src) => {
      const clean = String(src).replace(/^\.\//, '');
      if (!clean.toLowerCase().endsWith('.js')) return match;
      const js = byPath.get(clean);
      return js === undefined ? match : `<script>${js}</script>`;
    });
    return html;
  }, [files, project?.projectType]);

  const tree = React.useMemo(() => buildTree(files.map(f => f.path)), [files]);
  const treeRows = React.useMemo(() => flattenTree(tree), [tree]);
  const fileOnlyPaths = React.useMemo(() => files.filter(f => !f.path.endsWith('/.gitkeep')).map(f => f.path), [files]);

  if (addonOwned === undefined || isLoading) {
    return (
      <Container style={styles.container}>
        <TopNavigation title={t('find:coding_projects_title', {defaultValue: 'Coding Projects'})} accessoryLeft={() => <NavigationAction />} />
        <EmptyState variant="loading" />
      </Container>
    );
  }

  if (!addonOwned) {
    return (
      <Container style={styles.container}>
        <TopNavigation title={t('find:coding_projects_title', {defaultValue: 'Coding Projects'})} accessoryLeft={() => <NavigationAction />} />
        <View style={{paddingHorizontal: 16}}>
          <EmptyState
            title={t('find:addon_required_title_generic', {defaultValue: 'This is a paid add-on'}).toString()}
            body={t('find:addon_required_body', {defaultValue: 'Purchase the add-on once to unlock it for good.'}).toString()}
            actionLabel={t('more:addons_title', {defaultValue: 'Add-ons'}).toString()}
            onAction={() => navigation.navigate('AddOns', {highlightCode: ADDON_CODES.codingPractice})}
          />
        </View>
      </Container>
    );
  }

  if (loadError && !project) {
    return (
      <Container style={styles.container}>
        <TopNavigation title={t('find:coding_projects_title', {defaultValue: 'Coding Projects'})} accessoryLeft={() => <NavigationAction />} />
        <View style={{paddingHorizontal: 16}}>
          <EmptyState variant="error" title={t('common:something_went_wrong', {defaultValue: 'Something went wrong'}).toString()} body={loadError} />
        </View>
      </Container>
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={project?.name ?? ''}
        accessoryLeft={() => <NavigationAction />}
        accessoryRight={() => (
          <Flex justify="flex-start" itemsCenter>
            <TouchableOpacity
              disabled={saving}
              onPress={onSave}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              style={{marginRight: 16}}>
              {saving ? (
                <Spinner size="small" />
              ) : (
                <View>
                  <Icon pack="eva" name="save-outline" style={[globalStyle.icon24, {tintColor: isDirty ? theme['color-primary-500'] : theme['text-hint-color']}]} />
                  {isDirty ? <View style={[styles.dirtyDot, {backgroundColor: theme['color-primary-500']}]} /> : null}
                </View>
              )}
            </TouchableOpacity>
            {project?.projectType === 'script' ? (
              <TouchableOpacity
                disabled={running || !fileOnlyPaths.length}
                onPress={() => setRunPickerVisible(true)}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                {running ? <Spinner size="small" /> : <Icon pack="eva" name="play-circle-outline" style={[globalStyle.icon24, {tintColor: theme['color-primary-500']}]} />}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                disabled={!previewHtml}
                onPress={() => setPreviewVisible(true)}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Icon pack="eva" name="eye-outline" style={[globalStyle.icon24, {tintColor: previewHtml ? theme['color-primary-500'] : theme['text-hint-color']}]} />
              </TouchableOpacity>
            )}
          </Flex>
        )}
      />

      {/* File switcher — mobile-appropriate substitute for a desktop tab
          strip (see this file's own header comment). Opens the bottom-sheet
          file tree below. */}
      <TouchableOpacity activeOpacity={0.75} onPress={() => setFileTreeVisible(true)} style={styles.fileSwitcher}>
        <Icon pack="eva" name={iconForPath(activeFilePath)} style={[globalStyle.icon16, {tintColor: '#8B8BA7'}]} />
        <Text category="h9" bold ml={8} numberOfLines={1} style={[globalStyle.flexOne, {color: '#E4E4F0', fontFamily: MONO_FONT}]}>
          {activeFilePath ?? t('find:coding_project_no_file_open', {defaultValue: 'No file open — tap to browse files'})}
        </Text>
        <Text category="h10" style={{color: overLimit ? '#FF6B6B' : '#8B8BA7', marginRight: 8}}>
          {codingProjectsService.formatBytes(totalBytes)}
        </Text>
        <Icon pack="eva" name="chevron-down-outline" style={[globalStyle.icon16, {tintColor: '#8B8BA7'}]} />
      </TouchableOpacity>

      {/* Product request: "There should be a button in the created folder
          or project saying 'Analyze with your coach'." A slim full-width
          row (not an icon-only button) so the label the user explicitly
          asked for is actually visible, placed right below the file
          switcher rather than inside the header's already icon-only
          accessoryRight row -- matches this screen's own convention of
          full-width status rows just above the editor (see fileSwitcher
          above). Hidden once there are no real files yet, since there's
          nothing to analyze. */}
      {files.filter(f => !f.path.endsWith('/.gitkeep')).length > 0 ? (
        <TouchableOpacity activeOpacity={0.85} onPress={onAnalyzeWithCoach} style={styles.analyzeBar}>
          <Icon pack="eva" name="message-circle-outline" style={[globalStyle.icon16, {tintColor: theme['color-primary-500']}]} />
          <Text category="h9" bold ml={8} style={{color: theme['color-primary-500']}}>
            {t('find:analyze_with_coach', {defaultValue: 'Analyze with your coach'})}
          </Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.editorArea}>
        <CodeEditorWebView
          value={activeFile?.content ?? ''}
          language={activeFilePath ? codeMirrorModeForPath(activeFilePath) : 'text/plain'}
          editable={!!activeFile}
          onChangeText={onChangeActiveFileContent}
          style={{flex: 1}}
        />
        {!activeFile ? (
          <View style={styles.noFileOverlay} pointerEvents="none">
            <Text category="h9-s" style={{color: '#8B8BA7'}} center>
              {files.length
                ? t('find:coding_project_pick_a_file', {defaultValue: 'Pick a file from the switcher above'})
                : t('find:coding_project_create_first_file', {defaultValue: 'Create your first file to start editing'})}
            </Text>
          </View>
        ) : null}
      </View>

      {/* --- File tree bottom sheet --- */}
      <Modal visible={fileTreeVisible} animationType="slide" transparent onRequestClose={() => setFileTreeVisible(false)}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setFileTreeVisible(false)} />
        <View style={[styles.sheet, {backgroundColor: theme['background-basic-color-1']}]}>
          <Flex justify="space-between" itemsCenter mb={12}>
            <Text category="h7" bold>
              {t('find:coding_project_files_title', {defaultValue: 'Files'})}
            </Text>
            <Flex justify="flex-start" itemsCenter>
              <TouchableOpacity onPress={() => openNewItemModal(true)} style={{marginRight: 16}}>
                <Icon pack="eva" name="folder-add-outline" style={[globalStyle.icon20, {tintColor: theme['color-primary-500']}]} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openNewItemModal(false)}>
                <Icon pack="eva" name="file-add-outline" style={[globalStyle.icon20, {tintColor: theme['color-primary-500']}]} />
              </TouchableOpacity>
            </Flex>
          </Flex>
          <ScrollView style={{maxHeight: 360}}>
            {treeRows.length === 0 ? (
              <Text category="h9-s" status="placeholder" center mt={16} mb={16}>
                {t('find:coding_project_no_files', {defaultValue: 'No files yet — create one above.'})}
              </Text>
            ) : (
              treeRows.map(({node, depth}) => (
                <TouchableOpacity
                  key={node.path}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (node.type !== 'file') return;
                    setActiveFilePath(node.path);
                    setFileTreeVisible(false);
                  }}
                  style={[styles.treeRow, {paddingLeft: 12 + depth * 18}]}>
                  <Icon
                    pack="eva"
                    name={node.type === 'dir' ? 'folder-outline' : iconForPath(node.path)}
                    style={[globalStyle.icon16, {tintColor: node.type === 'dir' ? '#F59E0B' : theme['text-hint-color']}]}
                  />
                  <Text category="h9" ml={8} style={globalStyle.flexOne} numberOfLines={1}>
                    {node.name}
                  </Text>
                  <TouchableOpacity hitSlop={{top: 8, bottom: 8, left: 8, right: 8}} onPress={() => onRenameRow(node)} style={{marginRight: 12}}>
                    <Icon pack="eva" name="edit-2-outline" style={[globalStyle.icon16, {tintColor: theme['text-hint-color']}]} />
                  </TouchableOpacity>
                  <TouchableOpacity hitSlop={{top: 8, bottom: 8, left: 8, right: 8}} onPress={() => onDeleteRow(node)}>
                    <Icon pack="eva" name="trash-2-outline" style={[globalStyle.icon16, {tintColor: '#EF4444'}]} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* --- New file / folder --- */}
      <Modal visible={newItem.visible} animationType="fade" transparent onRequestClose={() => setNewItem(s => ({...s, visible: false}))}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalCard, {backgroundColor: theme['background-basic-color-1']}]}>
            <Text category="h7" bold center mb={16}>
              {newItem.isFolder
                ? t('find:coding_project_new_folder_title', {defaultValue: 'New Folder'})
                : t('find:coding_project_new_file_title', {defaultValue: 'New File'})}
            </Text>
            <Input
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={
                newItem.isFolder
                  ? t('find:coding_project_folder_name_placeholder', {defaultValue: 'e.g. src or src/utils'}).toString()
                  : t('find:coding_project_file_name_placeholder', {defaultValue: 'e.g. main.py or src/helpers.js'}).toString()
              }
              value={newItem.name}
              onChangeText={v => setNewItem(s => ({...s, name: v}))}
              style={[globalStyle.inputField, {marginBottom: 20}]}
              textStyle={globalStyle.inputText}
            />
            <CtaButton disabled={!newItem.name.trim()} onPress={onSubmitNewItem}>
              {t('common:create', {defaultValue: 'Create'}).toString()}
            </CtaButton>
            <Text category="h9" status="placeholder" center mt={16} onPress={() => setNewItem(s => ({...s, visible: false}))}>
              {t('common:cancel', {defaultValue: 'Cancel'})}
            </Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- Rename --- */}
      <Modal visible={!!renameState} animationType="fade" transparent onRequestClose={() => setRenameState(null)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalCard, {backgroundColor: theme['background-basic-color-1']}]}>
            <Text category="h7" bold center mb={16}>
              {t('find:coding_project_rename', {defaultValue: 'Rename'})}
            </Text>
            <Input
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              value={renameState?.value ?? ''}
              onChangeText={v => setRenameState(s => (s ? {...s, value: v} : s))}
              style={[globalStyle.inputField, {marginBottom: 20}]}
              textStyle={globalStyle.inputText}
            />
            <CtaButton disabled={!renameState?.value.trim()} onPress={onSubmitRename}>
              {t('common:save', {defaultValue: 'Save'}).toString()}
            </CtaButton>
            <Text category="h9" status="placeholder" center mt={16} onPress={() => setRenameState(null)}>
              {t('common:cancel', {defaultValue: 'Cancel'})}
            </Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- Run: entry-point picker + optional stdin --- */}
      <Modal visible={runPickerVisible} animationType="slide" transparent onRequestClose={() => setRunPickerVisible(false)}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setRunPickerVisible(false)} />
        <View style={[styles.sheet, {backgroundColor: theme['background-basic-color-1']}]}>
          <Text category="h7" bold mb={4}>
            {t('find:coding_project_run_title', {defaultValue: 'Run'})}
          </Text>
          <Text category="h10" status="placeholder" mb={12}>
            {t('find:coding_project_run_reliability_note', {
              defaultValue: 'Reliable for Python/Node/Ruby/PHP across multiple files. Other languages run best-effort.',
            })}
          </Text>
          <Text category="h9" bold status="placeholder" mb={8}>
            {t('find:coding_project_entry_point', {defaultValue: 'Entry point'})}
          </Text>
          <ScrollView style={{maxHeight: 160, marginBottom: 12}}>
            {fileOnlyPaths.map(path => (
              <TouchableOpacity key={path} activeOpacity={0.7} onPress={() => setRunEntry(path)} style={styles.entryRow}>
                <Icon
                  pack="eva"
                  name={runEntry === path ? 'radio-button-on' : 'radio-button-off-outline'}
                  style={[globalStyle.icon16, {tintColor: runEntry === path ? theme['color-primary-500'] : theme['text-hint-color']}]}
                />
                <Text category="h9" ml={8} numberOfLines={1}>
                  {path}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Input
            placeholder={t('find:stdin_placeholder', {defaultValue: 'Anything your program reads from stdin'}).toString()}
            value={runStdin}
            onChangeText={setRunStdin}
            autoCapitalize="none"
            autoCorrect={false}
            style={[globalStyle.inputField, {marginBottom: 16}]}
            textStyle={globalStyle.inputText}
          />
          <CtaButton loading={running} disabled={!runEntry} onPress={onRun}>
            {t('find:coding_project_run_cta', {defaultValue: 'Run {{entry}}', entry: runEntry ?? ''}).toString()}
          </CtaButton>
        </View>
      </Modal>

      {/* --- Run result --- */}
      <Modal visible={runResultVisible} animationType="slide" transparent onRequestClose={() => setRunResultVisible(false)}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setRunResultVisible(false)} />
        <View style={[styles.sheet, {backgroundColor: '#1E1E2E'}]}>
          <Flex justify="space-between" itemsCenter mb={12}>
            <Text category="h7" bold style={{color: '#E4E4F0'}}>
              {t('find:coding_output_label', {defaultValue: 'Output'})}
            </Text>
            <TouchableOpacity onPress={() => setRunResultVisible(false)}>
              <Icon pack="eva" name="close-outline" style={[globalStyle.icon20, {tintColor: '#8B8BA7'}]} />
            </TouchableOpacity>
          </Flex>
          <ScrollView style={{maxHeight: 360}}>
            {runResult ? (
              <>
                {runResult.engine === 'ai' ? (
                  <View style={styles.aiBadge}>
                    <Text category="h10" bold style={{color: '#8B5CF6'}}>
                      {t('find:ai_graded', {defaultValue: 'AI-graded result'})}
                    </Text>
                  </View>
                ) : null}
                <Text category="h10" style={{color: '#8B8BA7', fontFamily: MONO_FONT, marginTop: 8}}>
                  {t('find:coding_project_entry_ran', {defaultValue: 'Entry: {{entry}}', entry: runResult.entryPath})}
                  {!runResult.multiFileForwarded
                    ? t('find:coding_project_single_file_only', {defaultValue: ' (only this file was forwarded)'})
                    : ''}
                </Text>
                <Text
                  category="h9"
                  bold
                  mt={8}
                  mb={8}
                  style={{color: runResult.stderr ? '#FF6B6B' : '#5FE38E', fontFamily: MONO_FONT}}>
                  {runResult.status ?? (runResult.stderr ? t('find:error_status', {defaultValue: 'Error'}) : t('find:success_status', {defaultValue: 'Success'}))}
                </Text>
                {runResult.stdout ? (
                  <Text category="h9-s" style={{color: '#E4E4F0', fontFamily: MONO_FONT}}>
                    {runResult.stdout}
                  </Text>
                ) : null}
                {runResult.stderr ? (
                  <Text category="h9-s" mt={8} style={{color: '#FF6B6B', fontFamily: MONO_FONT}}>
                    {runResult.stderr}
                  </Text>
                ) : null}
                {!runResult.stdout && !runResult.stderr ? (
                  <Text category="h9-s" style={{color: '#8B8BA7', fontFamily: MONO_FONT}}>
                    {t('find:no_output', {defaultValue: '(no output)'})}
                  </Text>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      {/* --- Web preview --- */}
      <Modal visible={previewVisible} animationType="slide" onRequestClose={() => setPreviewVisible(false)}>
        <Container style={styles.container}>
          <TopNavigation
            title={t('find:coding_project_preview_title', {defaultValue: 'Preview'})}
            accessoryLeft={() => (
              <TouchableOpacity onPress={() => setPreviewVisible(false)} style={{padding: 8}}>
                <Icon pack="eva" name="close-outline" style={[globalStyle.icon24, {tintColor: theme['text-basic-color']}]} />
              </TouchableOpacity>
            )}
          />
          {previewHtml ? (
            <WebView originWhitelist={['*']} source={{html: previewHtml}} style={globalStyle.flexOne} />
          ) : (
            <EmptyState
              title={t('find:coding_project_no_preview_title', {defaultValue: 'Nothing to preview yet'}).toString()}
              body={t('find:coding_project_no_preview_body', {defaultValue: 'Add a root-level index.html file to preview this project.'}).toString()}
            />
          )}
        </Container>
      </Modal>
    </Container>
  );
});

export default CodingProjectEditor;

const themedStyles = StyleService.create({
  container: {flex: 1},
  fileSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#26263B',
  },
  dirtyDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  analyzeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'color-primary-500',
    backgroundColor: 'color-primary-transparent-100',
  },
  editorArea: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
  },
  noFileOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  treeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 12,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    borderRadius: 20,
    padding: 20,
  },
  aiBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
});
