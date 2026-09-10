# Stop the portable Postgres server.
$devtools = "C:\Users\BradleySpies\devtools"
& "$devtools\pgsql\bin\pg_ctl.exe" -D "$devtools\pgdata" stop
