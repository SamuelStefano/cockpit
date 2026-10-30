# Installs the Deck agent natively on Windows: no WSL, no Docker, no admin rights.
#
#   echo "CODE DEVICE ROLE LABEL"| powershell -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((irm https://raw.githubusercontent.com/SamuelStefano/cockpit/main/scripts/agent-setup.ps1)))"
#
# The same line works in cmd and in PowerShell. The pairing code comes through stdin,
# never on the node or powershell command line. DEVICE is `-` when there is none.
# Like a code pasted in bash, it does land in the shell history; it is single-use.
#
# Optional variables: DECK_RELAY_URL, DECK_DRY_RUN=1 (prints the plan, installs nothing).
# Uninstall: Unregister-ScheduledTask deck-agent; delete ~\.deck-src and ~\.deck-agent

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Repo = 'https://github.com/SamuelStefano/cockpit.git'
$Relay = if ($env:DECK_RELAY_URL) { $env:DECK_RELAY_URL } else { 'wss://deck-relay.devfellowship.com' }
$SrcDir = Join-Path $HOME '.deck-src'
$AgentDir = Join-Path $HOME '.deck-agent'
$NpmDir = Join-Path $HOME '.deck-npm'
$TaskName = 'deck-agent'
$Supervisor = Join-Path $AgentDir 'supervisor.ps1'
$MinNode = 22
# USERDOMAIN can say WORKGROUP, which the task scheduler cannot map to an account.
$Me = [Security.Principal.WindowsIdentity]::GetCurrent().Name

function Say($m) { Write-Host "[deck] $m" }
function Fail($m) { Write-Host "[deck] ERRO: $m" -ForegroundColor Red; exit 1 }
function Refresh-Path {
  $env:Path = "$NpmDir;" + [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Has($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function Node-Major {
  if (-not (Has 'node')) { return 0 }
  $v = (& node -v) -replace '^v', ''
  return [int]($v.Split('.')[0])
}
function Winget-Install($id, $label) {
  if (-not (Has 'winget')) { Fail "falta $label e o winget nao esta disponivel. Instale $label e rode de novo." }
  Say "instalando $label com winget..."
  & winget install --id $id --exact --silent --accept-source-agreements --accept-package-agreements --scope user
  if ($LASTEXITCODE -ne 0) { & winget install --id $id --exact --silent --accept-source-agreements --accept-package-agreements }
  Refresh-Path
}

# A live agent holds .node files open, and npm ci cannot replace them.
function Stop-Agent {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -and ($_.CommandLine -like "*$Supervisor*" -or ($_.Name -eq 'node.exe' -and $_.CommandLine -like "*$SrcDir*"))
  } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 1
}

# Stdin first: anything below may run a child that would inherit and drain it.
$Line = if ([Console]::IsInputRedirected) { ([Console]::In.ReadLine() + '').Trim(' ', '"') } else { '' }
$Parts = $Line -split '\s+', 4
$Code = $Parts[0]
$Device = if ($Parts.Count -gt 1 -and $Parts[1] -ne '-') { $Parts[1] } else { '' }
$Role = if ($Parts.Count -gt 2 -and $Parts[2] -eq 'admin') { 'admin' } else { 'student' }
$Label = if ($Parts.Count -gt 3) { $Parts[3] } else { '' }

if ($env:DECK_DRY_RUN -eq '1') {
  Say 'DECK_DRY_RUN=1: nada sera alterado. Plano:'
  Say "  node >= $MinNode`: $(if ((Node-Major) -ge $MinNode) { 'reaproveita' } else { 'instala via winget' })"
  Say "  git: $(if (Has 'git') { 'reaproveita' } else { 'instala via winget' })"
  Say "  claude: $(if (Has 'claude') { 'reaproveita' } else { "instala em $NpmDir" })"
  Say "  clone em $SrcDir; identidade em $AgentDir; tarefa agendada $TaskName (no seu logon, sem admin)"
  exit 0
}

Refresh-Path
if ((Node-Major) -lt $MinNode) { Winget-Install 'OpenJS.NodeJS.LTS' 'Node.js' }
if ((Node-Major) -lt $MinNode) { Fail "Node $MinNode+ nao encontrado. Feche e abra o terminal e rode de novo." }
if (-not (Has 'git')) { Winget-Install 'Git.Git' 'Git' }
if (-not (Has 'git')) { Fail 'Git nao encontrado. Feche e abra o terminal e rode de novo.' }

if (-not (Has 'claude')) {
  Say "instalando o Claude Code em $NpmDir..."
  & npm install -g --prefix $NpmDir --no-audit --no-fund '@anthropic-ai/claude-code@latest'
  if ($LASTEXITCODE -ne 0) { Fail 'nao consegui instalar o Claude Code com npm.' }
}

New-Item -ItemType Directory -Force -Path $AgentDir | Out-Null
# The identity key lives here: only this user reads it (chmod does nothing on Windows).
& icacls $AgentDir /inheritance:r /grant:r "$($Me):(OI)(CI)F" | Out-Null

if (Test-Path (Join-Path $SrcDir '.git')) {
  Say 'atualizando o codigo...'
  & git -C $SrcDir pull --ff-only
  if ($LASTEXITCODE -ne 0) { Say 'aviso: git pull falhou; seguindo com o codigo atual.' }
} else {
  Say "clonando em $SrcDir..."
  & git clone --depth 1 $Repo $SrcDir
  if ($LASTEXITCODE -ne 0) { Fail 'git clone falhou.' }
}

# From an elevated terminal the clone is owned by Administrators, and the task runs
# without elevation: git would refuse the repo, and self-update with it.
$SafeDir = $SrcDir -replace '\\', '/'
$known = @(& git config --global --get-all safe.directory 2>$null)
if ($known -notcontains $SafeDir) { & git config --global --add safe.directory $SafeDir }

Stop-Agent
Set-Location $SrcDir
Say 'instalando dependencias (npm ci)...'
& npm ci --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Fail 'npm ci falhou (veja o erro acima).' }

$env:DECK_RELAY_URL = $Relay
$env:DECK_AGENT_DIR = $AgentDir
$env:DECK_AGENT_ROLE = $Role
if ($Code) {
  Say 'pareando com a sua conta...'
  $env:DECK_PAIR_CODE = $Code
  if ($Device) { $env:DECK_DEVICE_CODE = $Device }
  if ($Label) { $env:DECK_BOX_LABEL = $Label }
  & npx tsx server/agent.ts --pair
  $rc = $LASTEXITCODE
  Remove-Item Env:DECK_PAIR_CODE
  Remove-Item Env:DECK_DEVICE_CODE -ErrorAction SilentlyContinue
  if ($rc -ne 0) { Fail 'pareamento falhou: o codigo vale 10 minutos e um uso. Gere outro no Deck.' }
} elseif (-not (Test-Path (Join-Path $AgentDir 'identity.json'))) {
  Fail 'sem codigo de pareamento. Copie o comando de novo no Deck.'
}

# Restart loop. The mutex keeps a second copy from fighting for the same agent id.
# Paths go into single-quoted strings below, and a profile dir can hold an apostrophe.
$QSrc = $SrcDir -replace "'", "''"; $QAgent = $AgentDir -replace "'", "''"; $QNpm = $NpmDir -replace "'", "''"; $QRelay = $Relay -replace "'", "''"
@"
`$mutex = New-Object System.Threading.Mutex(`$false, 'Local\deck-agent')
if (-not `$mutex.WaitOne(0)) { exit 0 }
`$env:DECK_RELAY_URL = '$QRelay'
`$env:DECK_AGENT_DIR = '$QAgent'
`$env:DECK_AGENT_ROLE = '$Role'
`$env:DECK_SUPERVISED = '1'
`$env:NPM_CONFIG_PREFIX = '$QNpm'
Set-Location '$QSrc'
`$log = '$QAgent\agent.log'; `$stale = '$QAgent\deps-stale'; `$marker = '$QAgent\self-update.json'; `$bad = '$QAgent\self-update-bad.json'
while (`$true) {
  `$env:Path = '$QNpm;' + [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  # A self-update changed the dependencies. tsx lives in node_modules, so a failed
  # install would stop the agent from booting at all: roll back here, not in it.
  if (Test-Path `$stale) {
    & npm.cmd ci --no-audit --no-fund *>> `$log
    if (`$LASTEXITCODE -ne 0) {
      `$m = Get-Content `$marker -Raw | ConvertFrom-Json
      `$list = @(); if (Test-Path `$bad) { `$list = @(Get-Content `$bad -Raw | ConvertFrom-Json) }
      ConvertTo-Json -Compress -InputObject @(`$list + `$m.to) | Set-Content `$bad -Encoding Ascii
      & git reset -q --hard `$m.from *>> `$log
      & npm.cmd ci --no-audit --no-fund *>> `$log
      Remove-Item `$marker -ErrorAction SilentlyContinue
    }
    Remove-Item `$stale
  }
  & npx.cmd tsx server/agent.ts *>> '$QAgent\agent.log'
  Start-Sleep -Seconds 3
}
"@ | Set-Content -Path $Supervisor -Encoding UTF8

# User task at logon: survives reboot, needs no admin. conhost --headless keeps a
# console from popping up on the desktop.
$psArgs = "--headless powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$Supervisor`""
$action = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument $psArgs
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $Me
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $Me -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 3
if ((Get-ScheduledTask -TaskName $TaskName).State -ne 'Running') { Fail "a tarefa $TaskName nao subiu. Veja $AgentDir\agent.log" }

Say 'pronto: o agente esta rodando e volta sozinho a cada logon.'
Say "log: $AgentDir\agent.log"
$ErrorActionPreference = 'Continue'
& claude auth status *> $null
if ($LASTEXITCODE -ne 0) { Say 'falta logar no Claude: rode  claude  uma vez neste terminal.' }
exit 0
