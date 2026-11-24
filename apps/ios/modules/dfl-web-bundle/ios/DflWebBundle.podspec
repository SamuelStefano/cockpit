# Local Expo module of the iOS shell: the bundled web build on <scheme>://localhost (task L4-SCHEME).
Pod::Spec.new do |s|
  s.name           = 'DflWebBundle'
  s.version        = '0.1.0'
  s.summary        = 'Deck: a WKURLSchemeHandler that serves the bundled web build on <scheme>://localhost.'
  s.description    = s.summary
  s.license        = 'UNLICENSED'
  s.author         = 'DevFellowship'
  s.homepage       = 'https://github.com/SamuelStefano/cockpit'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/SamuelStefano/cockpit.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WebKit'

  s.source_files = '*.swift'
  # The web build, as a folder: CocoaPods copies it into the app bundle as `web/`, with its
  # tree (`web/index.html`, `web/assets/...`). Absent in a build without the bundle step;
  # the module then reports `bundlePresent: false` and the shell keeps the https origin.
  s.resources = ['web']
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
