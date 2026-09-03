$ErrorActionPreference="Continue"
$sb=New-Object Text.StringBuilder; function W($m){[void]$sb.AppendLine($m);Write-Host $m -F Green}
W "--- RUNEFORGE V2.6.2 WINSOCK FIX ---"
ipconfig /flushdns | Out-Null
try{ Get-NetAdapter |?{$_.InterfaceDescription -like "*Tailscale*"} | Disable-NetAdapter -Confirm:$false -ErrorAction SilentlyContinue; W "TUN Tailscale OFF" }catch{}
try{ Stop-Service Tailscale -Force -ErrorAction SilentlyContinue; Get-Process "tailscale*","ipn*" -EA SilentlyContinue | Stop-Process -Force }catch{}
try{ netsh winsock reset | Out-Null; netsh int ip reset | Out-Null; Restart-Service Dnscache -Force -EA SilentlyContinue; W "Winsock reset OK - REINICIO REQUERIDO DESPUES" }catch{}
Set-Location $dir
git config --global --unset http.proxy 2>$null; git config --global --unset https.proxy 2>$null
git add. 2>$null; git commit -m "LMU2630 $(Get-Date -Format 'HH:mm')" 2>$null
W "> git push --ipv4"
$env:GIT_CONFIG_COUNT=1; $env:GIT_CONFIG_KEY_0="http.version"; $env:GIT_CONFIG_VALUE_0="HTTP/1.1"
$out=git push -u origin main --force --ipv4 2>&1; $out |%{W $_}
if($LASTEXITCODE -eq 0){ W "OK PUSH EXITOSO https://nesthoracio99-prog.github.io/simulador/" } else {
  W "FALLO GIT - Creando ZIP y abriendo upload web"
  $zip=Join-Path $dir "LMU2630_FINAL.zip"; if(Test-Path $zip){Remove-Item $zip -Force}
  Compress-Archive -Path "$dir\index.html","$dir\manifest.json","$dir\sw.js","$dir\icon-*.png","$dir\apple-touch-icon.png" -DestinationPath $zip -Force -EA SilentlyContinue
  Start-Process "https://github.com/nesthoracio99-prog/simulador/upload/main"
  W "ZIP: $zip -> Arrastra a GitHub"
}
try{ Enable-NetAdapter -Name "*Tailscale*" -Confirm:$false -EA SilentlyContinue; Start-Service Tailscale -EA SilentlyContinue }catch{}
$final=$sb.ToString(); Set-Clipboard $final -Force; $final
