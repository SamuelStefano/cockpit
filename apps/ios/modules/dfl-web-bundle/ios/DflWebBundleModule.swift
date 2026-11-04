// The Expo module of the bundle origin (task L4-SCHEME, parent ADR-3 v9).
//
// react-native-webview 13.16.1 (and 16.0.0, the newest release on 2026-10-03) has no API to
// register a WKURLSchemeHandler. The handler must be on the WKWebViewConfiguration BEFORE the
// WKWebView is created, and RNCWebViewImpl builds that configuration in its private method
// `-setUpWkWebViewConfig`, called once from `-didMoveToWindow`. This module wraps that one method:
// it calls the original, then adds the handler for the configured scheme. Nothing else in the
// WebView changes (the bridge, `onShouldStartLoadWithRequest`, `grantIfSameHostElseDeny`,
// downloads), so the security rules of T28 and #719 apply unchanged.
//
// It is inert unless Info.plist has `DflWebBundleScheme` (app.config.js sets it in the bundle
// variant only). If the method is not there (another react-native-webview), nothing is wrapped,
// `status().installed` is false, and the shell keeps the https origin (src/origin.ts).
import ExpoModulesCore
import ObjectiveC
import WebKit

enum WebBundleInstaller {
  private static let lock = NSLock()
  private static var done = false
  private(set) static var installed = false
  private(set) static var detail = "not attempted"
  private(set) static var handler: WebBundleSchemeHandler?
  /// The last WebView configuration got THIS handler (set when a WebView is created).
  private(set) static var attached = false

  /// The scheme from Info.plist, or nil when it is absent or not a usable scheme name.
  static var configuredScheme: String? {
    guard let raw = Bundle.main.object(forInfoDictionaryKey: "DflWebBundleScheme") as? String else { return nil }
    let s = raw.trimmingCharacters(in: .whitespaces)
    let reserved: Set<String> = ["http", "https", "file", "about", "blob", "data", "javascript", "ws", "wss", "ftp"]
    guard s.range(of: "^[a-z][a-z0-9+.-]*$", options: .regularExpression) != nil, !reserved.contains(s) else { return nil }
    return s
  }

  static var webRoot: URL? { Bundle.main.resourceURL?.appendingPathComponent("web", isDirectory: true) }

  static var bundlePresent: Bool {
    guard let root = webRoot else { return false }
    return FileManager.default.fileExists(atPath: root.appendingPathComponent("index.html").path)
  }

  /// Wrap `-[RNCWebViewImpl setUpWkWebViewConfig]` once. Idempotent and thread safe.
  static func installIfConfigured() {
    lock.lock()
    defer { lock.unlock() }
    if done { return }
    done = true
    guard let scheme = configuredScheme else { detail = "DflWebBundleScheme not set"; return }
    guard !WKWebView.handlesURLScheme(scheme) else { detail = "WebKit handles \(scheme) itself"; return }
    guard let root = webRoot, bundlePresent else { detail = "web/index.html not in the app bundle"; return }
    guard let cls = NSClassFromString("RNCWebViewImpl") else { detail = "RNCWebViewImpl not found"; return }
    let sel = NSSelectorFromString("setUpWkWebViewConfig")
    guard let method = class_getInstanceMethod(cls, sel) else { detail = "-setUpWkWebViewConfig not found"; return }
    // The method takes no argument (self + _cmd only) and returns an object: "@16@0:8" on
    // arm64 and x86_64. Any other shape (a newer react-native-webview) is not wrapped, because
    // the cast below would call it with the wrong ABI.
    let ret = method_copyReturnType(method)
    let returnsObject = String(cString: ret) == "@"
    free(ret)
    guard method_getNumberOfArguments(method) == 2, returnsObject else {
      detail = "-setUpWkWebViewConfig has another signature"
      return
    }
    let h = WebBundleSchemeHandler(scheme: scheme, root: root)
    typealias Original = @convention(c) (AnyObject, Selector) -> AnyObject?
    let original = unsafeBitCast(method_getImplementation(method), to: Original.self)
    let wrapped: @convention(block) (AnyObject) -> AnyObject? = { obj in
      let result = original(obj, sel)
      guard let config = result as? WKWebViewConfiguration else {
        NSLog("[DflWebBundle] -setUpWkWebViewConfig returned no WKWebViewConfiguration")
        return result
      }
      if let other = config.urlSchemeHandler(forURLScheme: scheme), other !== h {
        // Another handler owns the scheme: do not replace it, and say so.
        NSLog("[DflWebBundle] another handler owns %@; the bundle is not served", scheme)
      } else if config.urlSchemeHandler(forURLScheme: scheme) == nil {
        config.setURLSchemeHandler(h, forURLScheme: scheme)
      }
      attached = config.urlSchemeHandler(forURLScheme: scheme) === h
      return result
    }
    method_setImplementation(method, imp_implementationWithBlock(wrapped))
    handler = h
    installed = true
    detail = "installed for \(scheme)://\(WebBundleSchemeHandler.host)"
    NSLog("[DflWebBundle] %@", detail)
  }
}

public final class DflWebBundleModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DflWebBundle")

    // Before the first WebView: the shell reads `status()` at module load of its route, and the
    // WebView builds its configuration only when it moves to a window.
    OnCreate {
      WebBundleInstaller.installIfConfigured()
    }

    Function("status") { () -> [String: Any] in
      WebBundleInstaller.installIfConfigured()
      return [
        "scheme": WebBundleInstaller.configuredScheme.map { $0 as Any } ?? NSNull(),
        "installed": WebBundleInstaller.installed,
        "bundlePresent": WebBundleInstaller.bundlePresent,
        "detail": WebBundleInstaller.detail,
        "attached": WebBundleInstaller.attached,
      ]
    }
  }
}
