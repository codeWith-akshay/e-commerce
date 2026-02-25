# reset-pg-password.ps1
# Run this script as Administrator (right-click PowerShell > Run as Administrator)
#
# What it does:
#   1. Switches pg_hba.conf to trust auth (no password required)
#   2. Restarts PostgreSQL
#   3. Sets the postgres user password to the value you choose
#   4. Restores scram-sha-256 auth
#   5. Restarts PostgreSQL again

$pgData    = "C:\Program Files\PostgreSQL\17\data"
$pgBin     = "C:\Program Files\PostgreSQL\17\bin"
$service   = "postgresql-x64-17"
$hbaFile   = "$pgData\pg_hba.conf"
$hbaBackup = "$pgData\pg_hba.conf.bak"

# ── New password — change this to whatever you want ─────────────────────────
$newPassword = "postgres123"
# ────────────────────────────────────────────────────────────────────────────

Write-Host "==> Backing up pg_hba.conf..."
Copy-Item $hbaFile $hbaBackup -Force

Write-Host "==> Switching to trust auth..."
(Get-Content $hbaFile) -replace 'scram-sha-256', 'trust' |
  Set-Content $hbaFile

Write-Host "==> Restarting PostgreSQL (trust mode)..."
Restart-Service $service
Start-Sleep -Seconds 2

Write-Host "==> Setting new password for 'postgres' user..."
& "$pgBin\psql.exe" -U postgres -c "ALTER USER postgres WITH PASSWORD '$newPassword';"

Write-Host "==> Restoring scram-sha-256 auth..."
Copy-Item $hbaBackup $hbaFile -Force

Write-Host "==> Restarting PostgreSQL (secure mode)..."
Restart-Service $service
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Done! Your new DATABASE_URL is:"
Write-Host "postgresql://postgres:$newPassword@localhost:5432/ecommerce?schema=public"
Write-Host ""
Write-Host "This has already been set in your .env file."
