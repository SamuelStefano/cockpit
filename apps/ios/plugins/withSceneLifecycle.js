// Config plugin: the UIScene life cycle for the store build (crash of builds 2610081419,
// 2610082157 and 2610090220 on iOS 27, 2026-10-08).
//
// An app built with the iOS 27 SDK (Xcode 27) must adopt the scene-based life cycle: UIKit
// stops it at launch otherwise (`_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`,
// EXC_BREAKPOINT before any app code runs). The prebuild template of Expo SDK 57 still creates
// the window in the app delegate. The classes that the SDK 58 template uses are already in
// expo 57.0.26 (`ExpoAppSceneDelegate`, `ExpoReactNativeFactoryProvider`), so this plugin writes
// what that template writes:
//   - Info.plist `UIApplicationSceneManifest`, one configuration, class `SceneDelegate`;
//   - `SceneDelegate.swift`, a subclass of `ExpoAppSceneDelegate`, in the app target;
//   - `AppDelegate.swift`: it provides the React Native factory and no longer creates the window.
//
// It fails the prebuild when the template text is not the one it knows. Remove it on SDK 58.
const fs = require('node:fs');
const path = require('node:path');
const { IOSConfig, withAppDelegate, withDangerousMod, withInfoPlist, withXcodeProject } = require('expo/config-plugins');

const SCENE_DELEGATE_FILE = 'SceneDelegate.swift';

const SCENE_DELEGATE_SWIFT = `internal import Expo

@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
}
`;

const SCENE_MANIFEST = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [
      { UISceneConfigurationName: 'Default Configuration', UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate' },
    ],
  },
};

const CLASS_LINE = /class AppDelegate: ExpoAppDelegate \{/;
const PROVIDER_CLASS_LINE = 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {';
// The block of the SDK 57 template that creates the window and starts React Native in it.
const WINDOW_BLOCK = /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\(\n\s*withModuleName: "main",\n\s*in: window,\n\s*launchOptions: launchOptions\)\n#endif\n/;

/** The AppDelegate.swift of the scene life cycle. Throws when the template is not the known one. */
function patchAppDelegate(source) {
  const adopted = source.includes('ExpoReactNativeFactoryProvider') && !source.includes('UIWindow(frame:');
  if (adopted) return source;
  if (!CLASS_LINE.test(source)) throw new Error('withSceneLifecycle: AppDelegate.swift has no "class AppDelegate: ExpoAppDelegate {" (the prebuild template changed)');
  if (!WINDOW_BLOCK.test(source)) throw new Error('withSceneLifecycle: AppDelegate.swift has no window block of the SDK 57 template (the prebuild template changed)');
  return source.replace(CLASS_LINE, PROVIDER_CLASS_LINE).replace(WINDOW_BLOCK, '');
}

function withSceneLifecycle(config) {
  config = withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = SCENE_MANIFEST;
    return c;
  });
  config = withAppDelegate(config, (c) => {
    if (c.modResults.language !== 'swift') throw new Error('withSceneLifecycle: AppDelegate is not Swift');
    c.modResults.contents = patchAppDelegate(c.modResults.contents);
    return c;
  });
  config = withDangerousMod(config, [
    'ios',
    (c) => {
      const dir = path.join(c.modRequest.platformProjectRoot, c.modRequest.projectName);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, SCENE_DELEGATE_FILE), SCENE_DELEGATE_SWIFT);
      return c;
    },
  ]);
  return withXcodeProject(config, (c) => {
    const filepath = `${c.modRequest.projectName}/${SCENE_DELEGATE_FILE}`;
    if (!c.modResults.hasFile(filepath)) {
      c.modResults = IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath, groupName: c.modRequest.projectName, project: c.modResults });
    }
    return c;
  });
}

module.exports = withSceneLifecycle;
module.exports.patchAppDelegate = patchAppDelegate;
module.exports.SCENE_DELEGATE_SWIFT = SCENE_DELEGATE_SWIFT;
module.exports.SCENE_MANIFEST = SCENE_MANIFEST;
