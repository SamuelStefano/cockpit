// Self-contained /ops dashboard. All data is rendered with textContent; no external requests.
export const OPS_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Deck relay ops</title>
<style>
body{margin:0;padding:16px;background:#0b0b0d;color:#e4e4e7;font:14px/1.45 ui-monospace,Menlo,Consolas,monospace}
h1{font-size:16px;margin:0 0 12px}h2{font-size:13px;margin:20px 0 6px;color:#f97316;text-transform:uppercase;letter-spacing:.05em}
input{background:#18181b;border:1px solid #3f3f46;color:inherit;padding:6px 8px;border-radius:4px;font:inherit}
button{background:#f97316;border:0;color:#000;padding:6px 12px;border-radius:4px;font:inherit;cursor:pointer}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:3px 10px 3px 0;border-bottom:1px solid #27272a;vertical-align:top;word-break:break-all}
th{color:#a1a1aa;font-weight:normal}.muted{color:#a1a1aa}.err{color:#f87171}
.cards{display:flex;gap:12px;flex-wrap:wrap}.card{background:#18181b;border:1px solid #27272a;border-radius:6px;padding:8px 14px}
.card b{display:block;font-size:20px}
</style></head><body>
<h1>Deck relay ops</h1>
<div><input id="tok" type="password" placeholder="ops token" autocomplete="off"> <button id="go">Load</button> <span id="msg" class="muted"></span></div>
<h2>Process</h2><div class="cards" id="proc"></div>
<h2>Close codes</h2><table id="codes"></table>
<h2>Client-reported failures</h2><table id="client"></table>
<h2>Recent events</h2><input id="flt" placeholder="filter" style="width:260px"><table id="recent"></table>
<script>
(function(){
var LABELS={1000:'normal',1001:'going away',1006:'abnormal / network',4001:'token expired',4003:'primary box changed',4400:'bad request',4401:'auth refused',4403:'forbidden origin',4408:'auth timeout',4413:'too large',4429:'limit',4500:'server error'};
var $=function(id){return document.getElementById(id)};
var last=null;
function cell(tr,text,tag){var c=document.createElement(tag||'td');c.textContent=String(text);tr.appendChild(c);return c}
function fill(tbl,head,rows){
  tbl.textContent='';
  var h=document.createElement('tr');head.forEach(function(x){cell(h,x,'th')});tbl.appendChild(h);
  rows.forEach(function(r){var tr=document.createElement('tr');r.forEach(function(x){cell(tr,x)});tbl.appendChild(tr)});
}
function fmtUp(s){var d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);return (d?d+'d ':'')+h+'h '+m+'m'}
function render(d){
  var p=$('proc');p.textContent='';
  [['revision',d.revision],['uptime',fmtUp(d.uptimeS)],['browsers',d.live.browsers],['agents',d.live.agents],['boxes online',d.live.boxesOnline]].forEach(function(x){
    var c=document.createElement('div');c.className='card';var b=document.createElement('b');b.textContent=String(x[1]);
    c.appendChild(b);c.appendChild(document.createTextNode(x[0]));p.appendChild(c);
  });
  var rows=[];
  Object.keys(d.counters).forEach(function(k){
    var m=/^(browser_close|agent_close):(\\d+)$/.exec(k);
    if(m)rows.push([m[1],m[2],LABELS[m[2]]||'',d.counters[k]]);
  });
  rows.sort(function(a,b){return b[3]-a[3]});
  fill($('codes'),['socket','code','meaning','count'],rows);
  var agg={};
  d.recent.forEach(function(e){
    if(String(e.ev).indexOf('client_')!==0)return;
    var key=[e.ev,e.code===undefined?'-':e.code,e.ua||'-',e.mobile===undefined?'-':e.mobile].join('|');
    agg[key]=(agg[key]||0)+1;
  });
  var rows2=Object.keys(agg).map(function(k){return k.split('|').concat([agg[k]])});
  fill($('client'),['kind','code','ua','mobile','count (recent)'],rows2);
  last=d;renderRecent();
}
function renderRecent(){
  if(!last)return;
  var f=$('flt').value.toLowerCase();
  var rows=last.recent.slice().reverse().map(function(e){return [e.t,e.ev,JSON.stringify(e)]}).filter(function(r){return !f||r[2].toLowerCase().indexOf(f)>=0}).slice(0,200);
  fill($('recent'),['time','event','fields'],rows);
}
function load(){
  var t=$('tok').value;if(!t)return;
  sessionStorage.setItem('opsToken',t);
  fetch('/ops/stats',{headers:{authorization:'Bearer '+t},cache:'no-store'}).then(function(r){
    if(!r.ok)throw new Error('HTTP '+r.status);return r.json();
  }).then(function(d){$('msg').className='muted';$('msg').textContent='updated '+new Date().toLocaleTimeString();render(d)})
  .catch(function(e){$('msg').className='err';$('msg').textContent=String(e.message||e)});
}
$('tok').value=sessionStorage.getItem('opsToken')||'';
$('go').addEventListener('click',load);
$('flt').addEventListener('input',renderRecent);
load();setInterval(load,10000);
})();
</script></body></html>`;
