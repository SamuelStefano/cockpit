// Documento do iframe do BENCH. Diferente do preview comum: aqui não há React
// UMD nem Tailwind Play — o bundle que chega do servidor já traz o React do repo
// alvo e o CSS já vem compilado com o tema daquele repo.
//
// Protocolo:
//   iframe → pai  { type: 'deck:ready' } + uma porta de MessageChannel
//   pai → porta   { js, css }
//   iframe → pai  { type: 'deck:error' | 'deck:height' | 'deck:log' }
//   (nomes de saída iguais aos do preview comum, pra reusar console e resize)
export const IFRAME_HTML_BENCH = [
  '<!doctype html><html><head><meta charset="utf-8" />',
  // O bundle é código de OUTRO repositório — potencialmente de uma branch de PR
  // que não é minha. Sem rede ele não consegue mandar pra fora nada que tenha
  // sido inlinado no build (fixture com PII, .json de configuração).
  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' \'unsafe-eval\'; style-src \'unsafe-inline\'; img-src data: blob:; font-src data:; connect-src \'none\'" />',
  '<style>html,body{margin:0;padding:0;background:#fff;font-family:ui-sans-serif,system-ui,sans-serif}',
  '#err{color:#dc2626;font-family:ui-monospace,monospace;font-size:13px;white-space:pre-wrap;padding:12px}</style>',
  '<style id="theme"></style>',
  '</head><body>',
  '<div id="root"></div><div id="err"></div>',
  '<script>',
  // Origem opaca não tem storage: QUALQUER acesso a localStorage lança
  // SecurityError. Apps reais (supabase-js, i18n, tema) tocam nisso na
  // construção e morreriam antes do primeiro render. Shim em memória resolve —
  // e de quebra o bench nunca escreve nada que sobreviva ao reload.
  'try{window.localStorage.getItem("x");}catch(e){',
  '  var mem={};var shim={getItem:function(k){return k in mem?mem[k]:null;},setItem:function(k,v){mem[k]=String(v);},removeItem:function(k){delete mem[k];},clear:function(){mem={};},key:function(i){return Object.keys(mem)[i]||null;}};',
  '  Object.defineProperty(shim,"length",{get:function(){return Object.keys(mem).length;}});',
  '  try{Object.defineProperty(window,"localStorage",{value:shim,configurable:true});}catch(e2){}',
  '  try{Object.defineProperty(window,"sessionStorage",{value:shim,configurable:true});}catch(e3){}',
  '}',
  'var errEl=document.getElementById("err");',
  'function post(m){window.parent.postMessage(m,"*");}',
  'function msgOf(e){return String(e&&e.message?e.message:e);}',
  'function showErr(m){errEl.textContent=m;post({type:"deck:error",message:m});}',
  'function fmtArg(v){if(typeof v==="string")return v;if(v instanceof Error)return v.message;try{var s=JSON.stringify(v);return s===undefined?String(v):s;}catch(e){return String(v);}}',
  '["log","info","warn","error","debug"].forEach(function(level){var orig=console[level];console[level]=function(){var a=[];for(var i=0;i<arguments.length;i++)a.push(fmtArg(arguments[i]));post({type:"deck:log",level:level==="debug"?"log":level,text:a.join(" ")});if(orig)orig.apply(console,arguments);};});',
  'window.addEventListener("error",function(e){showErr(msgOf(e.error||e.message));});',
  'window.addEventListener("unhandledrejection",function(e){showErr(msgOf(e.reason));});',
  'function reportHeight(){post({type:"deck:height",height:document.documentElement.scrollHeight});}',
  // Bundle novo = documento novo na prática: o IIFE anterior já montou um root do
  // React na árvore, e remontar por cima vazaria efeitos/timers do build velho.
  'function mount(js,css){',
  '  errEl.textContent="";',
  '  document.getElementById("theme").textContent=css||"";',
  '  var old=document.getElementById("root");',
  '  var fresh=document.createElement("div");fresh.id="root";',
  '  old.parentNode.replaceChild(fresh,old);',
  '  var s=document.createElement("script");s.textContent=js;',
  '  document.body.appendChild(s);',
  '  requestAnimationFrame(function(){setTimeout(reportHeight,0);});',
  '}',
  // O bundle chega por uma porta dedicada, não por window.postMessage. A porta
  // morre junto com ESTE documento: se o bundle navegar o iframe pra fora (o
  // sandbox permite navegar a si mesmo), o build seguinte não é entregue ao
  // documento intruso. De quebra, um preview vizinho não alcança esta porta.
  'var ch=new MessageChannel();',
  'ch.port1.onmessage=function(e){try{mount(e.data.js,e.data.css);}catch(err){showErr(msgOf(err));}};',
  'window.parent.postMessage({type:"deck:ready"},"*",[ch.port2]);',
  '</script></body></html>',
].join('');
