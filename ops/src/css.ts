export const CSS = `
:root{color-scheme:dark;--bg:#101013;--panel:#18181c;--line:#2a2a31;--fg:#e7e7ea;--dim:#9a9aa3;--accent:#f97316;--bad:#f87171;--ok:#4ade80}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 ui-sans-serif,system-ui,sans-serif}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
header{display:flex;flex-wrap:wrap;gap:16px;align-items:center;padding:10px 16px;border-bottom:1px solid var(--line);background:var(--panel)}
header nav{display:flex;gap:14px}
header .health{margin-left:auto;color:var(--dim)}
header form{margin:0}
main{padding:16px;max-width:1400px}
h1{font-size:18px;margin:0 0 12px}h2{font-size:15px;margin:20px 0 8px}
table{border-collapse:collapse;width:100%}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--dim);font-weight:500}
td.wrap{max-width:520px;overflow-wrap:anywhere}
.scroll{overflow-x:auto}
.dim{color:var(--dim)}.bad{color:var(--bad)}.ok{color:var(--ok)}
form.filters{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
input,select,button{background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:6px 8px;font:inherit}
button{cursor:pointer}button.primary{background:var(--accent);border-color:var(--accent);color:#111}
pre{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:12px;overflow:auto;max-height:70vh;white-space:pre-wrap;overflow-wrap:anywhere}
dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px}dt{color:var(--dim)}dd{margin:0;overflow-wrap:anywhere}
.login{max-width:340px;margin:12vh auto;display:flex;flex-direction:column;gap:10px}
.err{color:var(--bad)}
`;
