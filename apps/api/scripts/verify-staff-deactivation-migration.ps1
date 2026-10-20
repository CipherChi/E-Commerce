param(
  [string]$ContainerName = 'codex-security-pg-test',
  [string]$DatabaseName = 'migration_backfill_test'
)

$databaseHost = 'localhost:55432'
$databaseUrl = "postgresql://postgres:test@$databaseHost/$DatabaseName"
Write-Output "Database host: $databaseHost"
Write-Output "Database name: $DatabaseName"

if ($DatabaseName -notmatch '(?i)(test|dev)') { throw 'Refusing to use a database without test/dev in its name.' }
$image = docker inspect --format '{{.Config.Image}}' $ContainerName 2>$null
if ($LASTEXITCODE -ne 0 -or $image -notlike 'postgres:*') { throw 'Expected the named throwaway PostgreSQL container.' }

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$apiRoot = Join-Path $repoRoot 'apps/api'
$migrationName = '20261020120000_business_member_active_and_login_lockout'
$scratchRoot = Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid().ToString('N'))
$scratchMigrations = Join-Path $scratchRoot 'migrations'
$seedFile = Join-Path $scratchRoot 'seed.sql'
New-Item -ItemType Directory -Path $scratchMigrations -Force | Out-Null

try {
  Push-Location $apiRoot
  docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE `"$DatabaseName`";" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not create the isolated migration test database.' }

  $scratchSchema = Join-Path $scratchRoot 'schema.prisma'
  $schemaText = Get-Content -LiteralPath (Join-Path $apiRoot 'prisma/schema.prisma') -Raw
  $schemaText = $schemaText.Replace('env("DATABASE_URL")', ('"' + $databaseUrl + '"'))
  Set-Content -LiteralPath $scratchSchema -Value $schemaText -Encoding utf8
  Copy-Item -LiteralPath (Join-Path $apiRoot 'prisma/migrations/migration_lock.toml') -Destination $scratchMigrations
  Get-ChildItem -LiteralPath (Join-Path $apiRoot 'prisma/migrations') -Directory |
    Where-Object Name -ne $migrationName |
    ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $scratchMigrations -Recurse }

  $env:DATABASE_URL = $databaseUrl
  corepack pnpm exec prisma migrate deploy --schema (Join-Path $scratchRoot 'schema.prisma')
  if ($LASTEXITCODE -ne 0) { throw 'Prior migrations did not deploy to the scratch database.' }

  @'
INSERT INTO "Business" ("id", "name") VALUES ('biz-a', 'Backfill A'), ('biz-b', 'Backfill B');
INSERT INTO "User" ("id", "email", "passwordHash", "name", "isActive") VALUES
  ('user-active-single', 'active-single@example.test', 'hash', 'Active single', true),
  ('user-inactive-single', 'inactive-single@example.test', 'hash', 'Inactive single', false),
  ('user-inactive-multi', 'inactive-multi@example.test', 'hash', 'Inactive multi', false),
  ('user-active-multi', 'active-multi@example.test', 'hash', 'Active multi', true);
INSERT INTO "BusinessMember" ("id", "businessId", "userId", "role") VALUES
  ('member-as', 'biz-a', 'user-active-single', 'STAFF'),
  ('member-is', 'biz-a', 'user-inactive-single', 'STAFF'),
  ('member-im-a', 'biz-a', 'user-inactive-multi', 'STAFF'),
  ('member-im-b', 'biz-b', 'user-inactive-multi', 'STAFF'),
  ('member-am-a', 'biz-a', 'user-active-multi', 'STAFF'),
  ('member-am-b', 'biz-b', 'user-active-multi', 'STAFF');
'@ | Set-Content -LiteralPath $seedFile -Encoding utf8
  docker cp $seedFile "${ContainerName}:/tmp/staff-backfill-seed.sql" | Out-Null
  docker exec $ContainerName psql -U postgres -d $DatabaseName -v ON_ERROR_STOP=1 -f /tmp/staff-backfill-seed.sql | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not seed pre-migration membership states.' }

  Copy-Item -LiteralPath (Join-Path $apiRoot "prisma/migrations/$migrationName") -Destination $scratchMigrations -Recurse
  corepack pnpm exec prisma migrate deploy --schema $scratchSchema
  if ($LASTEXITCODE -ne 0) { throw 'The new migration did not deploy to the scratch database.' }

  $result = docker exec $ContainerName psql -U postgres -d $DatabaseName -At -c @"
SELECT
  (SELECT bool_and(m."isActive") FROM "BusinessMember" m JOIN "User" u ON u.id=m."userId" WHERE u.email='active-single@example.test') || '|' ||
  (SELECT bool_and(m."isActive") FROM "BusinessMember" m JOIN "User" u ON u.id=m."userId" WHERE u.email='inactive-single@example.test') || '|' ||
  (SELECT bool_and(m."isActive") FROM "BusinessMember" m JOIN "User" u ON u.id=m."userId" WHERE u.email='inactive-multi@example.test') || '|' ||
  (SELECT bool_and(m."isActive") FROM "BusinessMember" m JOIN "User" u ON u.id=m."userId" WHERE u.email='active-multi@example.test');
"@
  if ($LASTEXITCODE -ne 0) { throw 'Could not verify migrated membership states.' }
  if ($result.Trim() -ne 'true|false|false|true') { throw "Unexpected backfill result: $($result.Trim())" }
  Write-Output 'PASS: active single/multi memberships stayed active; inactive single/multi memberships stayed inactive.'
}
finally {
  docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS `"$DatabaseName`" WITH (FORCE);" | Out-Null
  Pop-Location
  Remove-Item -LiteralPath $scratchRoot -Recurse -Force -ErrorAction SilentlyContinue
}
