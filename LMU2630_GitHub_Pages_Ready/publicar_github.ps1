#Requires -Version 5.1
# LMU-2630 PWA - Publicar a GitHub Pages en 1 click
# Uso: click derecho -> Ejecutar con PowerShell, o .\publicar_github.ps1

$ErrorActionPreference = "Stop"
$appDir = $PSScriptRoot
Set-Location $appDir

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  LMU-2630 Sim Pro - Deploy a GitHub Pages" -ForegroundColor Cyan
Write-Host "  RUNEFORGE Lab" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Verificar archivos PWA
$required = @("index.html","manifest.json","sw.js","icon-192.png","icon-512.png")
foreach($f in $required){
  if(!(Test-Path $f)){ Write-Host "FALTA $f" -ForegroundColor Red; pause; exit 1 }
}
Write-Host "[OK] Archivos PWA encontrados" -ForegroundColor Green

# Verificar git
try{ git --version | Out-Null }catch{ Write-Host "Instala git: https://git-scm.com" -ForegroundColor Red; pause; exit 1 }

# Verificar gh CLI (opcional)
$hasGh = $null -ne (Get-Command gh -ErrorAction SilentlyContinue)

# Pedir nombre repo
$defaultRepo = "LMU2630-PWA"
$repoName = Read-Host "Nombre del repo en GitHub [$defaultRepo]"
if([string]::IsNullOrWhiteSpace($repoName)){ $repoName = $defaultRepo }

$githubUser = Read-Host "Tu usuario de GitHub (ej: nesthor_99)"
if([string]::IsNullOrWhiteSpace($githubUser)){ Write-Host "Usuario requerido" -ForegroundColor Red; pause; exit 1 }

# Inicializar git si no existe
if(!(Test-Path ".git")){
  Write-Host "Inicializando git..." -ForegroundColor Yellow
  git init
  git branch -M main
} else {
  Write-Host "[OK] Repo git ya existe" -ForegroundColor Green
  git branch -M main
}

# Crear .gitignore
@"
.DS_Store
Thumbs.db
*.log
"@ | Set-Content -Path ".gitignore" -Encoding UTF8

# Commit
Write-Host "Agregando archivos..." -ForegroundColor Yellow
git add .
git config --global --get user.email | Out-Null
if($LASTEXITCODE -ne 0){
  $email = Read-Host "Tu email de GitHub"
  $name = Read-Host "Tu nombre"
  git config --global user.email $email
  git config --global user.name $name
}
git commit -m "LMU-2630 Sim Pro v4 PWA - RUNEFORGE Lab - $(Get-Date -Format 'yyyy-MM-dd HH:mm')" 2>$null
if($LASTEXITCODE -ne 0){ Write-Host "Sin cambios nuevos, continuando..." -ForegroundColor DarkGray }

# Crear repo remoto
$remoteUrl = "https://github.com/$githubUser/$repoName.git"
$existingRemote = git remote get-url origin 2>$null
if($LASTEXITCODE -ne 0){
  if($hasGh){
    Write-Host "Creando repo en GitHub con gh CLI..." -ForegroundColor Yellow
    gh repo create "$githubUser/$repoName" --public --source=. --remote=origin --push
    if($LASTEXITCODE -eq 0){
      Write-Host "[OK] Repo creado y pushed" -ForegroundColor Green
    } else {
      Write-Host "gh falló, usando remote manual..." -ForegroundColor Yellow
      git remote add origin $remoteUrl
    }
  } else {
    Write-Host ""
    Write-Host "1. Ve a https://github.com/new y crea repo vacio llamado: $repoName (NO marques README)" -ForegroundColor Cyan
    Write-Host "2. Luego presiona Enter aqui para continuar" -ForegroundColor Cyan
    Read-Host "Presiona Enter cuando hayas creado el repo vacio"
    git remote add origin $remoteUrl 2>$null
    if($LASTEXITCODE -ne 0){ git remote set-url origin $remoteUrl }
  }
} else {
  Write-Host "[OK] Remote origin ya existe: $existingRemote" -ForegroundColor Green
  git remote set-url origin $remoteUrl
}

# Push
Write-Host "Subiendo a GitHub..." -ForegroundColor Yellow
git push -u origin main --force

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  ¡SUBIDO!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "Ahora activa GitHub Pages:"
Write-Host "1. Ve a https://github.com/$githubUser/$repoName/settings/pages" -ForegroundColor Cyan
Write-Host "2. Source: Deploy from a branch -> main -> / (root) -> Save" -ForegroundColor Cyan
Write-Host "3. En 1 minuto tu App estara en:" -ForegroundColor Yellow
Write-Host "   https://$githubUser.github.io/$repoName/" -ForegroundColor White -BackgroundColor DarkBlue
Write-Host ""
Write-Host "Esa URL ya es instalable en iPhone/Android como App real" -ForegroundColor Green
Write-Host ""
pause
