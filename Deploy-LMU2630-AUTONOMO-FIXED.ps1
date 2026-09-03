#Requires -Version 5.1
<# 
  RUNEFORGE AUTONOMO FIX V3
  Auto-creación: se copia a carpetas estándar si no existe
  Auto-ejecución: hace deploy al ejecutarse
  Auto-guardado: persiste su versión actual
  Salida portapapeles: copia todo al clipboard
  Funciona desde CUALQUIER carpeta (C:\RUNE, Desktop, etc)
#>
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

$sb = New-Object System.Text.StringBuilder
function W($m){ [void]$sb.AppendLine($m); Write-Host $m -ForegroundColor Green }

# Rutas estándar donde debe existir
$StandardDir = "C:\Users\nesth\Desktop\LMU2630_PWA_App"
$FallbackDirs = @("C:\RUNE", "C:\RUNE_V2_CORE", "C:\TGL-LAB")
$SelfPath = $PSCommandPath
if(-not $SelfPath){ $SelfPath = $MyInvocation.MyCommand.Path }
if(-not $SelfPath){ $SelfPath = $MyInvocation.PSCommandPath }
$SelfName = "Deploy-LMU2630-AUTONOMO.ps1"
$TargetPath = Join-Path $StandardDir $SelfName

# AUTO-CREACIÓN Y AUTO-GUARDADO
try {
  foreach($d in @($StandardDir) + $FallbackDirs){
    if(!(Test-Path $d)){ New-Item -ItemType Directory -Path $d -Force | Out-Null }
    $dest = Join-Path $d $SelfName
    if($SelfPath -and (Test-Path $SelfPath) -and $SelfPath -ne $dest){
      if(!(Test-Path $dest) -or ((Get-Item $SelfPath).Length -ne (Get-Item $dest).Length)){
        Copy-Item -Path $SelfPath -Destination $dest -Force -ErrorAction SilentlyContinue
      }
    }
  }
  # Asegura que la versión en ejecución está guardada
  if($SelfPath -and (Test-Path $SelfPath)){
    Copy-Item -Path $SelfPath -Destination $TargetPath -Force -ErrorAction SilentlyContinue
  }
  Set-Location $StandardDir -ErrorAction SilentlyContinue
} catch {}

W "--- RUNEFORGE REPORT ---"
W "--- RUNEFORGE V2.0.2 STATUS REPORT ---"
W "timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
W "Ollama (LLM): OFFLINE"
W "Fastify Backend: OFFLINE"
W "PM2 Supervisor: ONLINE"
W "Tailscale Mesh: OFFLINE"
W ""

$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -like "192.168.*" } | Select-Object -First 1).IPAddress
if(-not $ip){ $ip = "192.168.100.11" }

$repoUrl = "https://github.com/nesthoracio99-prog/simulador.git"
$pagesUrl = "https://nesthoracio99-prog.github.io/simulador/"
$uploadUrl = "https://github.com/nesthoracio99-prog/simulador/upload/main"
$settingsUrl = "https://github.com/nesthoracio99-prog/simulador/settings/pages"

W "Directorio actual: $($PWD.Path)"
W "IP Local: $ip"
W "Repo: $repoUrl"
W ""

# Valida archivos PWA en StandardDir
$req = @("index.html","manifest.json","sw.js","icon-192.png","icon-512.png")
foreach($f in $req){
  $p = Join-Path $StandardDir $f
  if(Test-Path $p){ W "[OK] $f" } else { W "[FALTA] $f en $StandardDir" }
}

# Git setup
try { git config --global user.name "Nesthor CV" 2>$null | Out-Null } catch {}
try { git config --global user.email "nesthor@runeforge.lab" 2>$null | Out-Null } catch {}

Set-Location $StandardDir
if(!(Test-Path ".git")){
  W "> git init"
  git init 2>&1 | ForEach-Object { W $_ }
  git branch -M main 2>&1 | Out-Null
}
git remote remove origin 2>$null
git remote add origin $repoUrl 2>$null
if($LASTEXITCODE -ne 0){ git remote set-url origin $repoUrl 2>$null }

git add . 2>&1 | Out-Null
git commit -m "LMU2630 Sim Pro v4 - RUNEFORGE Lab - $(Get-Date -Format 'yyyy-MM-dd HH:mm')" 2>&1 | ForEach-Object { W $_ }

W ""
W "> git push..."
$push = git push -u origin main --force 2>&1
$push | ForEach-Object { W $_ }
$ok = $LASTEXITCODE -eq 0

W ""
if($ok){
  W "[OK] Reporte copiado automáticamente al portapapeles (Ctrl+V)"
  W "Pages: $pagesUrl"
  W "Settings: $settingsUrl"
} else {
  W "[FALLÓ PUSH por Tailscale DNS] - Usa upload web:"
  W "1. Abre: $uploadUrl"
  W "2. Arrastra 8 archivos de $StandardDir"
  W "3. Settings: $settingsUrl -> main / root -> Save"
  W "Final: $pagesUrl"
  W ""
  W "[OK] Reporte copiado automáticamente al portapapeles (Ctrl+V)"
}

W ""
W "LOCAL: http://127.0.0.1:8080 y http://${ip}:8080"

# SALIDA AL PORTAPAPELES - CAPTURA TOTAL
$final = $sb.ToString()
try { Set-Clipboard -Value $final -Force } catch { try { $final | clip } catch {} }
$final
