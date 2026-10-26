// Host document for sandboxed frames (live preview, bench, MCP apps). It is served
// with its own, looser CSP (see vercel.json) and framed with sandbox="allow-scripts"
// (opaque origin), so untrusted HTML with inline scripts can run without relaxing the
// CSP of the app itself. No inline script here.
//
//   frame -> parent  { type: 'deck:host-ready' }
//   parent -> frame  { type: 'deck:sandbox-doc', html }   written once; after that
//                                                         this window belongs to that document
(function () {
  var done = false;

  function fromParent(e) {
    return e.source === window.parent;
  }

  function onDoc(e) {
    if (done || !fromParent(e)) return;
    var d = e.data;
    if (!d || d.type !== 'deck:sandbox-doc' || typeof d.html !== 'string') return;
    done = true;
    // open() drops every listener on this window, including this one. The guard is
    // added right after, so the written document only ever hears the parent (a
    // sibling frame can reach us through window.parent.frames).
    document.open();
    window.addEventListener('message', function (ev) {
      if (!fromParent(ev)) ev.stopImmediatePropagation();
    }, true);
    document.write(d.html);
    document.close();
  }

  window.addEventListener('message', onDoc);
  window.parent.postMessage({ type: 'deck:host-ready' }, '*');
})();
