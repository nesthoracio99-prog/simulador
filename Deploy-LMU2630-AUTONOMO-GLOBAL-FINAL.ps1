#Requires -Version 5.1
<# RUNEFORGE GLOBAL FINAL - AUTONOMO + TAILSCALE KILLER #>
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"
$sb = New-Object System.Text.StringBuilder
function W($m){ [void]$sb.AppendLine($m); Write-Host $m -ForegroundColor Green }

$StandardDir = "C:\Users\nesth\Desktop\LMU2630_PWA_App"
$SelfPath = $PSCommandPath
if(-not $SelfPath){ $SelfPath = $MyInvocation.MyCommand.Path }
$SelfName = "Deploy-LMU2630-AUTONOMO-GLOBAL-FINAL.ps1"
$TargetPath = Join-Path $StandardDir $SelfName

# AUTO-CREACIÓN Y AUTO-GUARDADO
try {
  if(!(Test-Path $StandardDir)){ New-Item -ItemType Directory -Path $StandardDir -Force | Out-Null }
  foreach($d in @($StandardDir,"C:\RUNEFORGE_V2_CORE","C:\RUNE","C:\TGL-LAB")){
    if(!(Test-Path $d)){ New-Item -ItemType Directory -Path $d -Force | Out-Null }
    $dest = Join-Path $d $SelfName
    if($SelfPath -and (Test-Path $SelfPath) -and $SelfPath -ne $dest){
      Copy-Item -Path $SelfPath -Destination $dest -Force -ErrorAction SilentlyContinue
    }
  }
  Set-Location $StandardDir
} catch {}

W "--- RUNEFORGE REPORT ---"
W "--- RUNEFORGE V2.6.2 STATUS REPORT ---"
W "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
W "------------------------------"

$repoUrl = "https://github.com/nesthoracio99-prog/simulador.git"
$pagesUrl = "https://nesthoracio99-prog.github.io/simulador/"
$uploadUrl = "https://github.com/nesthoracio99-prog/simulador/upload/main"
$settingsUrl = "https://github.com/nesthoracio99-prog/simulador/settings/pages"

# DETECTA TAILSCALE
$tsService = Get-Service -Name Tailscale -ErrorAction SilentlyContinue
$tsProc = Get-Process -Name "tailscale","tailscaled","tailscale-ipn" -ErrorAction SilentlyContinue
if($tsService){ W "Tailscale Service: $($tsService.Status)" }
if($tsProc){ W "Tailscale Procesos activos: $($tsProc.Name -join ', ')" }

# FIX DNS AUTOMATICO
W ""
W "> Limpiando DNS y proxies..."
git config --global --unset http.proxy 2>$null
git config --global --unset https.proxy 2>$null
ipconfig /flushdns 2>&1 | ForEach-Object { W $_ }

# SI TAILSCALE BLOQUEA, LO MATA TEMPORALMENTE
$wasRunning = $false
if($tsService -and $tsService.Status -eq 'Running'){
  $wasRunning = $true
  W "> Tailscale bloquea getaddrinfo - Deteniendo 15s para push..."
  try { Stop-Service -Name Tailscale -Force -ErrorAction Stop; W "  - Servicio detenido" } catch { W "  - No se pudo detener servicio: $_" }
  try { Get-Process -Name "tailscale-ipn" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue; W "  - tailscale-ipn detenido" } catch {}
  Start-Sleep -Seconds 3
  ipconfig /flushdns | Out-Null
}

# GIT PUSH
Set-Location $StandardDir
if(!(Test-Path ".git")){
  git init 2>&1 | Out-Null
  git branch -M main 2>&1 | Out-Null
}
git remote remove origin 2>$null
git remote add origin $repoUrl 2>$null
if($LASTEXITCODE -ne 0){ git remote set-url origin $repoUrl 2>$null }

git add . 2>&1 | Out-Null
git commit -m "LMU2630 Sim Pro v4 - RUNEFORGE Lab - $(Get-Date -Format 'yyyy-MM-dd HH:mm')" 2>&1 | ForEach-Object { W $_ }

W ""
W "> git push -u origin main --force (sin Tailscale)..."
$push = git push -u origin main --force 2>&1
$push | ForEach-Object { W $_ }
$ok = $LASTEXITCODE -eq 0

# REACTIVAR TAILSCALE
if($wasRunning){
  W ""
  W "> Reactivando Tailscale..."
  try { Start-Service -Name Tailscale -ErrorAction SilentlyContinue; W "  - Servicio reactivado" } catch {}
  Start-Sleep -Seconds 2
}

W ""
W "============================================"
if($ok){
  W "[OK] DEPLOY EXITOSO - GIT PUSH OK"
  W "Pages URL: $pagesUrl"
  W "Settings: $settingsUrl"
  W "Acción: Ve a Settings -> Pages -> main / root -> Save si no está activo"
} else {
  W "[FALLÓ PUSH aún con Tailscale detenido]"
  W "Usa upload web directo:"
  W "  $uploadUrl"
  W "  Arrastra 8 archivos de $StandardDir"
  W "  $settingsUrl"
  W "Final: $pagesUrl"
}
W ""
W "LOCAL: http://127.0.0.1:8080 y http://192.168.100.11:8080"
W "[OK] Reporte copiado automáticamente al portapapeles (Ctrl+V)"
W "============================================"

$final = $sb.ToString()
try { Set-Clipboard -Value $final -Force } catch { try { $final | clip } catch {} }
$final
