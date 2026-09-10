# One-time: initialize the portable Postgres cluster, start it, and create the
# gco_platform database. Idempotent — safe to re-run.
#   . .\scripts\dev-env.ps1 ; .\scripts\db-init.ps1

$ErrorActionPreference = "Stop"
$devtools = "C:\Users\BradleySpies\devtools"
$bin = "$devtools\pgsql\bin"
$data = "$devtools\pgdata"
$logFile = "$devtools\pg.log"
$port = 5433

if (-not (Test-Path "$data\PG_VERSION")) {
  Write-Host "Initializing cluster at $data …" -ForegroundColor Cyan
  $pw = "$devtools\pwfile.txt"
  Set-Content -Path $pw -Value "gco" -NoNewline -Encoding ascii
  & "$bin\initdb.exe" -D $data -U gco -A md5 --pwfile=$pw -E UTF8 | Out-Host
  Remove-Item $pw -Force
} else {
  Write-Host "Cluster already initialized." -ForegroundColor DarkGray
}

# Start (if not already running)
$status = & "$bin\pg_ctl.exe" -D $data status 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Starting Postgres on port $port …" -ForegroundColor Cyan
  & "$bin\pg_ctl.exe" -D $data -o "-p $port" -l $logFile start | Out-Host
  Start-Sleep -Seconds 2
} else {
  Write-Host "Postgres already running." -ForegroundColor DarkGray
}

# Create the database if missing
$env:PGPASSWORD = "gco"
$exists = & "$bin\psql.exe" -p $port -U gco -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='gco_platform'" 2>$null
if ($exists -ne "1") {
  Write-Host "Creating database gco_platform …" -ForegroundColor Cyan
  & "$bin\createdb.exe" -p $port -U gco gco_platform | Out-Host
} else {
  Write-Host "Database gco_platform already exists." -ForegroundColor DarkGray
}

Write-Host "Database ready at postgresql://gco:gco@localhost:$port/gco_platform" -ForegroundColor Green
