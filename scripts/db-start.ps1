# Start the portable Postgres server (data dir + port from dev-env.ps1 defaults).
$devtools = "C:\Users\BradleySpies\devtools"
$bin = "$devtools\pgsql\bin"
$data = "$devtools\pgdata"
& "$bin\pg_ctl.exe" -D $data status 2>$null
if ($LASTEXITCODE -ne 0) {
  & "$bin\pg_ctl.exe" -D $data -o "-p 5433" -l "$devtools\pg.log" start
} else {
  Write-Host "Already running."
}
