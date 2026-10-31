# PostgreSQL backup and restore

This is an operational procedure template. It has **not** been tested against a production or restored database. Adapt paths, encryption, offsite storage, monitoring, and retention to the operator's platform, then perform and record a restore drill before launch.

## Backup schedule and retention

Use PostgreSQL custom-format dumps so restores can select objects and validate archive readability. A practical starting schedule is one nightly full logical dump, retained for 30 days locally and copied to encrypted off-host/object storage with a separate retention policy. If the recovery point objective requires less than one day, add more frequent dumps or PostgreSQL WAL archiving/point-in-time recovery; daily dumps alone cannot meet a shorter RPO.

For the example Compose database, run this from the repository root in Bash on the backup host:

```sh
mkdir -p backups
stamp=$(date -u +%Y%m%dT%H%M%SZ)
docker compose -f infra/docker-compose.prod.example.yml exec -T postgres \
  pg_dump -U hotel_manager -Fc hotel_manager > "backups/hotel_manager-${stamp}.dump"
test -s "backups/hotel_manager-${stamp}.dump"
sha256sum "backups/hotel_manager-${stamp}.dump" > "backups/hotel_manager-${stamp}.dump.sha256"
```

Schedule the commands using the host's cron/systemd timer or managed backup scheduler. Alert on command failure, missing/empty output, or missed schedules. Encrypt dumps before off-host transfer and restrict access. Example local cleanup for a 30-day retention window:

```sh
find backups -type f -name 'hotel_manager-*.dump*' -mtime +30 -delete
```

Keep local dumps on encrypted storage; the Compose PostgreSQL volume is not a backup. Protect the checksum and dump together. Test archive readability periodically with `pg_restore --list`.

## Restore procedure

Restoring replaces the selected database contents. Confirm the Compose project and target database before running destructive commands. Put the application in maintenance mode and stop API/web writers first.

1. Select the intended dump and verify its checksum:

   ```sh
   sha256sum -c backups/hotel_manager-YYYYMMDDTHHMMSSZ.dump.sha256
   docker compose -f infra/docker-compose.prod.example.yml exec -T postgres \
     pg_restore --list < backups/hotel_manager-YYYYMMDDTHHMMSSZ.dump
   ```

2. Stop services that write to the database:

   ```sh
   docker compose -f infra/docker-compose.prod.example.yml stop api web
   ```

3. Terminate database sessions and recreate the target database:

   ```sh
   docker compose -f infra/docker-compose.prod.example.yml exec -T postgres \
     psql -U hotel_manager -d postgres -c \
     "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'hotel_manager' AND pid <> pg_backend_pid();"
   docker compose -f infra/docker-compose.prod.example.yml exec -T postgres \
     dropdb -U hotel_manager --if-exists hotel_manager
   docker compose -f infra/docker-compose.prod.example.yml exec -T postgres \
     createdb -U hotel_manager -O hotel_manager hotel_manager
   ```

4. Restore the selected custom-format archive:

   ```sh
   docker compose -f infra/docker-compose.prod.example.yml exec -T postgres \
     pg_restore -U hotel_manager -d hotel_manager --no-owner --role=hotel_manager \
     < backups/hotel_manager-YYYYMMDDTHHMMSSZ.dump
   ```

5. Check migration status and schema, run smoke checks, then resume services:

   ```sh
   corepack pnpm --filter api exec prisma migrate status
   docker compose -f infra/docker-compose.prod.example.yml start api web
   docker compose -f infra/docker-compose.prod.example.yml ps
   ```

For a managed PostgreSQL service, use its equivalent maintenance, termination, database recreation, and restore commands. Do not restore a dump from an unknown source into production.

## Restore drill checklist

- [ ] Restore a recent encrypted dump into an isolated database/project.
- [ ] Record dump timestamp, source, checksum, restore start/end, and operator.
- [ ] Verify PostgreSQL version compatibility and `pg_restore --list` output.
- [ ] Run Prisma migration status and compare schema expectations.
- [ ] Verify user, business, booking, invoice/payment, inventory, and sales records with read-only checks.
- [ ] Run API health checks and representative authenticated tenant-scoped requests against the isolated restore.
- [ ] Verify no unexpected cross-business records are visible.
- [ ] Record elapsed recovery time (RTO), data age (RPO), failures, and corrective actions.
- [ ] Confirm the restored environment is isolated and securely delete it after review.

No restore drill has been performed as part of this documentation change.
