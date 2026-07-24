// Documento autossuficiente do iframe de preview. Roda DENTRO de
// `sandbox="allow-scripts"` (origem opaca: o código renderizado não alcança o
// app pai, cookies nem storage — sem allow-same-origin de propósito). Carrega
// React UMD vendorado + Tailwind Play CDN (ambos assets same-origin em
// `public/vendor/`, zero fetch externo em runtime), e renderiza o componente
// transpilado a cada mensagem `deck:code`, ou HTML cru a cada `deck:html`.
//
// Protocolo:
//   pai → iframe  { type: 'deck:code', code }   componente React transpilado
//   pai → iframe  { type: 'deck:html', html }   HTML cru
//   iframe → pai  { type: 'deck:ready' }
//   iframe → pai  { type: 'deck:error', message }
//   iframe → pai  { type: 'deck:height', height } altura do conteúdo (auto-resize)
//   iframe → pai  { type: 'deck:log', level, text } console.* capturado
export const IFRAME_HTML = [
  '<!doctype html><html><head><meta charset="utf-8" />',
  '<script src="/vendor/react.production.min.js"></script>',
  '<script src="/vendor/react-dom.production.min.js"></script>',
  '<script src="/vendor/tailwind-play-cdn.js"></script>',
  '<style>html,body{margin:0;padding:12px;background:#fff;font-family:ui-sans-serif,system-ui,sans-serif}',
  '#err{color:#dc2626;font-family:ui-monospace,monospace;font-size:13px;white-space:pre-wrap}</style>',
  '</head><body>',
  '<div id="root"></div><div id="err"></div>',
  '<script>',
  'var mountEl=document.getElementById("root");',
  'var errEl=document.getElementById("err");',
  'var root=null;',
  'function post(m){window.parent.postMessage(m,"*");}',
  'function msgOf(e){return String(e&&e.message?e.message:e);}',
  'function showErr(m){errEl.textContent=m;post({type:"deck:error",message:m});}',
  // Captura console.* pra o painel de log do pai (devtools sem devtools). Preserva
  // o console real e serializa cada argumento de forma tolerante a ciclos.
  'function fmtArg(v){if(typeof v==="string")return v;if(v instanceof Error)return v.message;try{var s=JSON.stringify(v);return s===undefined?String(v):s;}catch(e){return String(v);}}',
  '["log","info","warn","error","debug"].forEach(function(level){var orig=console[level];console[level]=function(){var a=[];for(var i=0;i<arguments.length;i++)a.push(fmtArg(arguments[i]));post({type:"deck:log",level:level==="debug"?"log":level,text:a.join(" ")});if(orig)orig.apply(console,arguments);};});',
  'function reqShim(name){if(name==="react")return React;if(name==="react-dom")return ReactDOM;throw new Error("módulo indisponível: "+name);}',
  // Erro durante o render do React 18 sobe assíncrono ao handler global — sem
  // isto o usuário só veria um preview em branco sem explicação.
  'window.addEventListener("error",function(e){showErr(msgOf(e.error||e.message));});',
  'function reportHeight(){var h=document.documentElement.scrollHeight;post({type:"deck:height",height:h});}',
  'function evalCode(code){',
  '  var exports={};var module={exports:exports};',
  '  var fn=new Function("React","useState","useEffect","useRef","useMemo","useCallback","require","exports","module",code);',
  '  fn(React,React.useState,React.useEffect,React.useRef,React.useMemo,React.useCallback,reqShim,exports,module);',
  '  var C=module.exports&&module.exports.default?module.exports.default:module.exports;',
  '  if(typeof C!=="function")throw new Error("O código precisa de um export default (função componente).");',
  '  return C;',
  '}',
  'function renderCode(code){',
  '  errEl.textContent="";',
  '  var C=evalCode(code);',
  '  if(root){root.unmount();root=null;}',
  '  mountEl.innerHTML="";',
  '  root=ReactDOM.createRoot(mountEl);',
  '  root.render(React.createElement(C));',
  '  requestAnimationFrame(function(){setTimeout(reportHeight,0);});',
  '}',
  'function renderHtml(html){',
  '  errEl.textContent="";',
  '  if(root){root.unmount();root=null;}',
  '  mountEl.innerHTML=html;',
  '  requestAnimationFrame(function(){setTimeout(reportHeight,0);});',
  '}',
  'window.addEventListener("message",function(e){',
  '  if(!e.data)return;',
  '  try{',
  '    if(e.data.type==="deck:code")renderCode(e.data.code);',
  '    else if(e.data.type==="deck:html")renderHtml(e.data.html);',
  '  }catch(err){showErr(msgOf(err));}',
  '});',
  'post({type:"deck:ready"});',
  '</script></body></html>',
].join('');
