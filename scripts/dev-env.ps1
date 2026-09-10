# Dot-source this to put the portable Node + PostgreSQL on PATH for the session:
#   . .\scripts\dev-env.ps1
# Then `node`, `npm`, `npx`, `psql`, `pg_ctl` all work — no admin, no global install.

$devtools = "C:\Users\BradleySpies\devtools"
$env:Path = "$devtools\node;$devtools\pgsql\bin;$env:Path"

# Portable Postgres settings used by the db scripts.
$env:PGDATA = "$devtools\pgdata"
$env:PGPORT = "5433"
$env:PGUSER = "gco"
$env:PGPASSWORD = "gco"

Write-Host "Dev env ready:" -ForegroundColor Green
Write-Host ("  node " + (& node -v))
Write-Host ("  npm  " + (& npm -v))
Write-Host ("  postgres data dir: $env:PGDATA (port $env:PGPORT)")
