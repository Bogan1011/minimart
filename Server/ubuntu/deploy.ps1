# Copy the latest builds from a Windows dev PC to the Ubuntu server (uses Windows' built-in OpenSSH).
# Usage (PowerShell, from the Unity project folder):   .\Server\ubuntu\deploy.ps1 user@server-ip
param([Parameter(Mandatory = $true)][string]$Target)
$ErrorActionPreference = "Stop"
if (Test-Path Builds\Web) {
    Write-Host "== Web build"
    ssh $Target "rm -rf /opt/minimart/web/*"
    scp -r Builds\Web\* "${Target}:/opt/minimart/web/"
}
if (Test-Path Builds\Server) {
    Write-Host "== Server build"
    ssh $Target "rm -rf /opt/minimart/server/*"
    scp -r Builds\Server\* "${Target}:/opt/minimart/server/"
    ssh -t $Target "chmod +x /opt/minimart/server/MiniMartServer.x86_64 && sudo systemctl enable minimart-server && sudo systemctl restart minimart-server"
}
$ip = $Target.Split("@")[-1]
Write-Host "Done: http://$ip/"
