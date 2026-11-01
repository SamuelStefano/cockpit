// The WKURLSchemeHandler of the store build (task L4-SCHEME, parent ADR-3 v9). It serves the
// bundled web build (`<app>/web`) on `<scheme>://localhost`, so the page has a stable,
// hierarchical origin that no other app can take (S16 rejected a loopback server for that reason).
//
// The rules:
// - Host `localhost` only, no port, no user info. Anything else gets 404.
// - GET and HEAD only.
// - A path never leaves the `web` folder: `..` is refused, and the resolved file must be inside
//   the folder after symlinks are resolved.
// - SPA fallback: a path whose last segment has no `.` serves `index.html` (BrowserRouter routes
//   such as `/auth` or `/editor/1`). A missing file WITH an extension is a 404, so a missing
//   chunk never comes back as HTML with a script MIME type.
// - Each response is complete when `start` returns (synchronous read, mapped), so a `stop` can
//   never race a late `didReceive`.
import Foundation
import WebKit

final class WebBundleSchemeHandler: NSObject, WKURLSchemeHandler {
  static let host = "localhost"

  let scheme: String
  let root: URL
  private let rootPath: String

  init(scheme: String, root: URL) {
    self.scheme = scheme
    self.root = root.standardizedFileURL.resolvingSymlinksInPath()
    self.rootPath = self.root.path.hasSuffix("/") ? self.root.path : self.root.path + "/"
  }

  /// The file for a request URL, or nil (404). Pure: the unit of the path rules.
  func resolve(_ url: URL) -> URL? {
    guard url.scheme?.lowercased() == scheme,
          url.host?.lowercased() == Self.host,
          url.port == nil, url.user == nil, url.password == nil else { return nil }
    let path = url.path // percent-decoded
    if path.contains("\0") { return nil }
    let parts = path.split(separator: "/", omittingEmptySubsequences: true).map(String.init)
    if parts.contains("..") || parts.contains(".") { return nil }
    let index = root.appendingPathComponent("index.html")
    if parts.isEmpty { return index }
    let candidate = parts.reduce(root) { $0.appendingPathComponent($1) }.standardizedFileURL.resolvingSymlinksInPath()
    guard candidate.path.hasPrefix(rootPath) else { return nil }
    var isDir: ObjCBool = false
    if FileManager.default.fileExists(atPath: candidate.path, isDirectory: &isDir), !isDir.boolValue {
      return candidate
    }
    return parts.last!.contains(".") ? nil : index
  }

  func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
    let request = urlSchemeTask.request
    guard let url = request.url else {
      urlSchemeTask.didFailWithError(URLError(.badURL))
      return
    }
    let method = (request.httpMethod ?? "GET").uppercased()
    guard method == "GET" || method == "HEAD" else {
      respond(urlSchemeTask, url: url, status: 405, body: Data(), mime: "text/plain")
      return
    }
    guard let file = resolve(url), let data = try? Data(contentsOf: file, options: .mappedIfSafe) else {
      respond(urlSchemeTask, url: url, status: 404, body: Data("not found".utf8), mime: "text/plain")
      return
    }
    respond(urlSchemeTask, url: url, status: 200, body: method == "HEAD" ? Data() : data,
            mime: Self.mime(file.pathExtension), length: data.count)
  }

  func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
    // Nothing to cancel: `start` finishes each task before it returns.
  }

  private func respond(_ task: WKURLSchemeTask, url: URL, status: Int, body: Data, mime: String, length: Int? = nil) {
    let headers = [
      "Content-Type": mime,
      "Content-Length": String(length ?? body.count),
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    ]
    guard let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers) else {
      task.didFailWithError(URLError(.cannotParseResponse))
      return
    }
    task.didReceive(response)
    if !body.isEmpty { task.didReceive(body) }
    task.didFinish()
  }

  static func mime(_ ext: String) -> String {
    switch ext.lowercased() {
    case "html", "htm": return "text/html; charset=utf-8"
    case "js", "mjs": return "text/javascript; charset=utf-8"
    case "css": return "text/css; charset=utf-8"
    case "json", "map": return "application/json; charset=utf-8"
    case "webmanifest": return "application/manifest+json; charset=utf-8"
    case "txt": return "text/plain; charset=utf-8"
    case "xml": return "application/xml; charset=utf-8"
    case "svg": return "image/svg+xml"
    case "png": return "image/png"
    case "jpg", "jpeg": return "image/jpeg"
    case "gif": return "image/gif"
    case "webp": return "image/webp"
    case "avif": return "image/avif"
    case "ico": return "image/x-icon"
    case "woff": return "font/woff"
    case "woff2": return "font/woff2"
    case "ttf": return "font/ttf"
    case "otf": return "font/otf"
    case "wasm": return "application/wasm"
    case "mp3": return "audio/mpeg"
    case "wav": return "audio/wav"
    case "mp4", "m4v": return "video/mp4"
    case "webm": return "video/webm"
    default: return "application/octet-stream"
    }
  }
}
