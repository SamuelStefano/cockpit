#!/usr/bin/env node
// Assert the BUILT native config of apps/ios (ported from the Lesson Studio shell).
//
// Why: a config plugin can drop a purpose string between app.json and the
// Info.plist that Xcode compiles (expo/expo#35016). App Store Connect then
// rejects the build, or asks for an Apple session, AFTER a build slot is spent.
// `expo prebuild` writes the same Info.plist and privacy manifest that EAS
// builds, so this check runs before the build and fails CI at no cost.
//
// It runs `expo prebuild --platform ios --no-install` in a COPY-FREE way: it
// generates ./ios (gitignored) and removes it at the end. It reads no secret.
//
// Asserts on ios/<App>/Info.plist:
//   - every key of REQUIRED_PURPOSE_STRINGS is declared in app.json, exists, and equals the declared wording
//   - ITSAppUsesNonExemptEncryption is present
// and on ios/<App>/PrivacyInfo.xcprivacy:
//   - the file exists and declares at least one NSPrivacyAccessedAPIType
//   - NSPrivacyTracking is false, the required-reason reasons of REQUIRED_ACCESSED_APIS are present,
//     and the collected data types of REQUIRED_COLLECTED_TYPES are declared 
// and on the scene life cycle (plugins/withSceneLifecycle.js; iOS 27 stops an app without it at launch):
//   - Info.plist names a scene delegate class, SceneDelegate.swift exists and is in the Xcode project,
//     and AppDelegate.swift provides the factory and creates no window
//
// Usage (from apps/ios):  node scripts/assert-native-config.mjs [--keep]
// Exit: 0 ok, 1 an assertion failed, 2 prebuild failed.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// Microphone and speech recognition: voice input in the chat (the web page dictates through the
// WebView). Nothing else: a camera or photo string here would be a permission the app does not use.
// Add a key when a native module needs a new purpose string.
export const REQUIRED_PURPOSE_STRINGS = ['NSMicrophoneUsageDescription', 'NSSpeechRecognitionUsageDescription'];
export const FORBIDDEN_PURPOSE_STRINGS = ['NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSPhotoLibraryAddUsageDescription', 'NSFaceIDUsageDescription', 'NSLocationWhenInUseUsageDescription'];

/** Map of top-level key -> raw value tag/text of a plist (enough for these checks). */
export function plistTopLevel(xml) {
  const out = {};
  const re = /<key>([^<]+)<\/key>\s*(<string>([\s\S]*?)<\/string>|<string\/>|<(true|false)\/>|<(array|dict)>|<(array|dict)\/>)/g;
  let m;
  while ((m = re.exec(xml))) {
    const key = m[1];
    if (m[3] !== undefined) out[key] = m[3];
    else if (m[2] === '<string/>') out[key] = '';
    else if (m[4]) out[key] = m[4] === 'true';
    else out[key] = { container: true };
  }
  return out;
}

/**
 * `declared` is expo.ios.infoPlist of app.json: the wording WE wrote. Autolinked
 * plugins (expo-camera, expo-audio) fill a missing key with a generic default
 * ("Allow $(PRODUCT_NAME) to access your camera"), so presence in the built
 * plist is not enough: the key must be declared in app.json AND the built value
 * must equal it (a plugin that overwrites it is caught too).
 */
export function checkInfoPlist(xml, declared) {
  const top = plistTopLevel(xml);
  const errs = [];
  for (const k of REQUIRED_PURPOSE_STRINGS) {
    if (!declared || typeof declared[k] !== 'string' || declared[k].trim() === '') {
      errs.push(`app.json expo.ios.infoPlist has no ${k} (a plugin default would be shipped)`);
    }
    if (!(k in top)) errs.push(`Info.plist has no ${k}`);
    else if (typeof top[k] !== 'string' || top[k].trim() === '') errs.push(`Info.plist ${k} is empty`);
    else if (declared && typeof declared[k] === 'string' && top[k] !== declared[k]) {
      errs.push(`Info.plist ${k} differs from app.json (a plugin changed it)`);
    }
  }
  for (const k of FORBIDDEN_PURPOSE_STRINGS) if (k in top) errs.push(`Info.plist has ${k}: Deck does not use that permission (remove the plugin that adds it)`);
  if (!('ITSAppUsesNonExemptEncryption' in top)) errs.push('Info.plist has no ITSAppUsesNonExemptEncryption');
  return errs;
}

/**
 * L1-SIGN: no background audio. `UIBackgroundModes` must not list `audio` (or `voip`, which also
 * keeps a microphone session alive in the background). A take stops when the app leaves the
 * foreground (core CaptureMachine `onBackground`) and the camera session, with its microphone, is
 * released. App Review 2.5.4: background audio is for apps that need it, and a capture app must
 * make recording visible. `xml` is the BUILT Info.plist; `declared` is expo.ios.infoPlist of app.json.
 */
export const FORBIDDEN_BACKGROUND_MODES = ['audio', 'voip'];

/** The strings of the array under a top-level key of a plist (empty when absent). */
export function plistArrayStrings(xml, key) {
  const at = xml.indexOf(`<key>${key}</key>`);
  if (at < 0) return [];
  const rest = xml.slice(at + `<key>${key}</key>`.length);
  const m = /^\s*<array>([\s\S]*?)<\/array>/.exec(rest);
  return m ? [...m[1].matchAll(/<string>([^<]*)<\/string>/g)].map((x) => x[1].trim()) : [];
}

export function checkNoBackgroundAudio(xml, declared) {
  const errs = [];
  const built = xml ? plistArrayStrings(xml, 'UIBackgroundModes') : [];
  const fromConfig = Array.isArray(declared?.UIBackgroundModes) ? declared.UIBackgroundModes.map(String) : [];
  for (const mode of FORBIDDEN_BACKGROUND_MODES) {
    if (built.includes(mode)) errs.push(`Info.plist UIBackgroundModes lists "${mode}": no background audio (App Review 2.5.4)`);
    if (fromConfig.includes(mode)) errs.push(`app.json expo.ios.infoPlist.UIBackgroundModes lists "${mode}": no background audio (App Review 2.5.4)`);
  }
  return errs;
}

export function checkPrivacyManifest(xml) {
  if (xml == null) return ['PrivacyInfo.xcprivacy is missing'];
  const n = (xml.match(/<key>NSPrivacyAccessedAPIType<\/key>/g) || []).length;
  return n > 0 ? [] : ['PrivacyInfo.xcprivacy declares no NSPrivacyAccessedAPIType'];
}

// The App Review floor of the
// privacy manifest: what OUR code and the modules we ship use, and what the app collects.
// Reason codes: https://developer.apple.com/documentation/bundleresources/privacy-manifest-files/describing-use-of-required-reason-api
// Add a row here when a native module uses a new required-reason API (see APP_REVIEW.md).
export const REQUIRED_ACCESSED_APIS = {
  NSPrivacyAccessedAPICategoryFileTimestamp: ['C617.1'], // React Native, expo-file-system-free: expo-updates and RN read file timestamps
  NSPrivacyAccessedAPICategoryDiskSpace: ['E174.1', '85F4.1'], // React Native / expo-updates disk space check
  NSPrivacyAccessedAPICategoryUserDefaults: ['CA92.1'], // expo-updates, expo-constants, expo-notifications
  NSPrivacyAccessedAPICategorySystemBootTime: ['35F9.1'], // React Native
};
export const REQUIRED_COLLECTED_TYPES = [
  'NSPrivacyCollectedDataTypeEmailAddress',
  'NSPrivacyCollectedDataTypeUserID',
  'NSPrivacyCollectedDataTypeOtherUserContent',
];

/** The reasons declared for one required-reason category (empty when the category is absent). */
export function reasonsOf(xml, category) {
  const at = xml.indexOf(`<string>${category}</string>`);
  if (at < 0) return [];
  const open = xml.indexOf('<array>', at);
  const close = xml.indexOf('</array>', open);
  if (open < 0 || close < 0) return [];
  return [...xml.slice(open, close).matchAll(/<string>([^<]+)<\/string>/g)].map((m) => m[1]);
}

export function checkPrivacyDeclarations(xml) {
  if (xml == null) return ['PrivacyInfo.xcprivacy is missing'];
  const errs = [];
  if (!/<key>NSPrivacyTracking<\/key>\s*<false\/>/.test(xml)) errs.push('PrivacyInfo.xcprivacy must declare NSPrivacyTracking false');
  for (const [cat, reasons] of Object.entries(REQUIRED_ACCESSED_APIS)) {
    const have = reasonsOf(xml, cat);
    for (const r of reasons) if (!have.includes(r)) errs.push(`PrivacyInfo.xcprivacy ${cat} lacks reason ${r}`);
  }
  for (const t of REQUIRED_COLLECTED_TYPES) {
    if (!xml.includes(`<string>${t}</string>`)) errs.push(`PrivacyInfo.xcprivacy does not declare collected data ${t}`);
  }
  return errs;
}

/**
 * The scene life cycle of the built project. An app built with the iOS 27 SDK that still creates
 * its window in the app delegate is stopped by UIKit at launch (builds 2610081419 to 2610090220).
 */
export function checkSceneLifecycle({ infoPlist, appDelegate, sceneDelegate, pbxproj }) {
  const errs = [];
  if (!infoPlist || !/<key>UIApplicationSceneManifest<\/key>\s*<dict>/.test(infoPlist)) errs.push('Info.plist has no UIApplicationSceneManifest (iOS 27 stops the app at launch)');
  else if (!/<key>UISceneDelegateClassName<\/key>\s*<string>\$\(PRODUCT_MODULE_NAME\)\.SceneDelegate<\/string>/.test(infoPlist)) errs.push('Info.plist UIApplicationSceneManifest names no SceneDelegate class');
  if (sceneDelegate == null) errs.push('SceneDelegate.swift is missing');
  else if (!/class SceneDelegate: ExpoAppSceneDelegate/.test(sceneDelegate)) errs.push('SceneDelegate.swift does not subclass ExpoAppSceneDelegate');
  if (!pbxproj || !/SceneDelegate\.swift in Sources/.test(pbxproj)) errs.push('SceneDelegate.swift is not in the Sources of the Xcode project');
  if (appDelegate == null) errs.push('AppDelegate.swift is missing');
  else {
    if (!/class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider/.test(appDelegate)) errs.push('AppDelegate.swift does not conform to ExpoReactNativeFactoryProvider');
    if (/UIWindow\(frame:/.test(appDelegate) || /startReactNative\(/.test(appDelegate)) errs.push('AppDelegate.swift still creates the window (the scene delegate must)');
  }
  return errs;
}

function main() {
  const keep = process.argv.includes('--keep');
  const iosDir = join(process.cwd(), 'ios');
  rmSync(iosDir, { recursive: true, force: true });
  try {
    execFileSync('npx', ['expo', 'prebuild', '--platform', 'ios', '--no-install'], {
      stdio: ['ignore', 'inherit', 'inherit'],
      env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' },
    });
  } catch (e) {
    console.error('assert-native-config: expo prebuild failed');
    process.exit(2);
  }
  const app = readdirSync(iosDir).find((d) => existsSync(join(iosDir, d, 'Info.plist')));
  if (!app) {
    console.error('assert-native-config: no Info.plist under ios/');
    process.exit(1);
  }
  const read = (f) => (existsSync(join(iosDir, app, f)) ? readFileSync(join(iosDir, app, f), 'utf8') : null);
  const declared = JSON.parse(readFileSync(join(process.cwd(), 'app.json'), 'utf8')).expo?.ios?.infoPlist;
  const proj = readdirSync(iosDir).find((d) => d.endsWith('.xcodeproj'));
  const pbxproj = proj && existsSync(join(iosDir, proj, 'project.pbxproj')) ? readFileSync(join(iosDir, proj, 'project.pbxproj'), 'utf8') : null;
  const scene = checkSceneLifecycle({ infoPlist: read('Info.plist'), appDelegate: read('AppDelegate.swift'), sceneDelegate: read('SceneDelegate.swift'), pbxproj });
  const errs = [...scene, ...checkInfoPlist(read('Info.plist'), declared), ...checkNoBackgroundAudio(read('Info.plist'), declared), ...checkPrivacyManifest(read('PrivacyInfo.xcprivacy')), ...checkPrivacyDeclarations(read('PrivacyInfo.xcprivacy'))];
  if (!keep) rmSync(iosDir, { recursive: true, force: true });
  if (errs.length) {
    for (const e of errs) console.error(`::error::assert-native-config: ${e}`);
    process.exit(1);
  }
  console.log(`assert-native-config: OK (${REQUIRED_PURPOSE_STRINGS.join(', ')}, ITSAppUsesNonExemptEncryption, no background audio, privacy manifest, scene life cycle)`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
