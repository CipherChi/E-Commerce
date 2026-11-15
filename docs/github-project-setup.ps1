$ErrorActionPreference = 'Stop'

# Run from the repository root after installing gh and running `gh auth login`.
# This creates the M9, M8.5, and M10–M14 project board, labels, milestones, and checklist issues.
$repo = (gh repo view --json nameWithOwner --jq .nameWithOwner).Trim()
if (-not $repo) { throw 'Could not determine GitHub repository. Run this from a GitHub checkout.' }
$owner = ($repo -split '/')[0]

$labels = @(
  'priority:critical','priority:high','priority:medium','priority:low',
  'type:feature','type:bug','type:refactor','type:documentation',
  'area:frontend','area:backend','area:database','area:auth','area:payments','area:pwa','area:offline'
)
foreach ($label in $labels) {
  gh label create $label --repo $repo --force | Out-Null
}

$milestones = @{}
foreach ($title in @('M9', 'M8.5 — Money to kobo', 'M10', 'M11', 'M12', 'M13', 'M14')) {
  $found = gh api "repos/$repo/milestones?state=all" --jq ".[] | select(.title == `"$title`") | .number"
  if ($found) { $milestones[$title] = [int]$found.Trim() }
  else { $milestones[$title] = [int](gh api "repos/$repo/milestones" -f title=$title --jq .number) }
}

$project = gh project create --owner $owner --title 'E Commerce Site M8.5–M14' --format json | ConvertFrom-Json
$projectNumber = $project.number
$projectId = gh project view $projectNumber --owner $owner --format json --jq .id
$projectFields = gh project field-list $projectNumber --owner $owner --format json | ConvertFrom-Json
$statusField = $projectFields | Where-Object { $_.name -eq 'Status' } | Select-Object -First 1
if (-not $statusField) { throw 'The project has no Status field.' }
$statusFieldId = $statusField.id
$statusOptionsQuery = 'mutation($fieldId: ID!) { updateProjectV2Field(input: { fieldId: $fieldId, singleSelectOptions: [{name: "Backlog"}, {name: "Ready"}, {name: "In Progress"}, {name: "Review"}, {name: "Testing"}, {name: "Done"}] }) { projectV2Field { ... on ProjectV2SingleSelectField { id name options { id name } } } } }'
gh api graphql -F fieldId=$statusFieldId -f query=$statusOptionsQuery | Out-Null
$projectFields = gh project field-list $projectNumber --owner $owner --format json | ConvertFrom-Json
$statusField = $projectFields | Where-Object { $_.name -eq 'Status' } | Select-Object -First 1
$backlog = $statusField.options | Where-Object { $_.name -eq 'Backlog' } | Select-Object -First 1
$ready = $statusField.options | Where-Object { $_.name -eq 'Ready' } | Select-Object -First 1
if (-not $statusField -or -not $backlog -or -not $ready) { throw 'Project Status field does not include Backlog and Ready values.' }

$items = @(
  @{m='M9'; t='Generate race-safe, per-business receipt numbers'; labels='priority:high,type:feature,area:backend,area:database'; body="Acceptance criteria:`n- Sequential RCT-YYYY-NNNNNN numbers are unique within a business.`n- Concurrent sale completion cannot issue duplicate numbers.`n- Re-reading/regenerating a receipt preserves its number."},
  @{m='M9'; t='Render receipt with business, customer, sale, cashier, and payment details'; labels='priority:high,type:feature,area:backend'; body="Acceptance criteria:`n- Receipt shows business contact/logo, customer, line items, totals, date/time, cashier, and paid/partial/unpaid status.`n- Every lookup is scoped to the authenticated business."},
  @{m='M9'; t='Generate server-side receipt PDFs'; labels='priority:medium,type:feature,area:backend'; body="Acceptance criteria:`n- Completed sale receipt can be downloaded as a PDF.`n- PDF content matches the stored sale and receipt details."},
  @{m='M9'; t='Add print-friendly receipt layout with thermal widths'; labels='priority:medium,type:feature,area:frontend'; body="Acceptance criteria:`n- Receipt prints cleanly on standard paper.`n- User can select 58mm or 80mm thermal layout."},
  @{m='M9'; t='Add receipt download and secure share links'; labels='priority:high,type:feature,area:backend,area:frontend'; body="Acceptance criteria:`n- Download button retrieves the PDF.`n- Unguessable public URL exposes only the intended receipt.`n- WhatsApp share URL and native share/copy link work."},
  @{m='M9'; t='Create receipt automatically on sale completion'; labels='priority:high,type:feature,area:backend,area:database'; body="Acceptance criteria:`n- Completed sale has a receipt without a separate manual creation step.`n- Sale requests require a tenant-scoped idempotency key.`n- Repeated receipt generation preserves its number."},
  @{m='M8.5 — Money to kobo'; t='Migrate monetary storage from decimal naira to integer kobo'; labels='priority:high,type:refactor,area:database'; body="Plan and acceptance criteria:`n1. Expand: add parallel kobo integer columns while retaining decimal columns; dual-write new changes.`n2. Backfill: convert historical decimal naira amounts to kobo in bounded, restartable batches.`n3. Verify: reconcile row counts, nulls, and totals per tenant and module; block switch on any mismatch.`n4. Switch: read kobo columns and stop decimal writes behind a reversible feature flag.`n5. Contract: after a monitored release, remove legacy decimal columns in a later migration.`n- Each stage has an operator runbook and rollback checkpoint."},
  @{m='M10'; t='Add common payment provider interface and Paystack initialization'; labels='priority:medium,type:feature,area:payments,area:backend'; body="Acceptance criteria:`n- Paystack keys come from environment configuration.`n- Initialization returns a unique reference and payment link."},
  @{m='M10'; t='Verify Paystack webhook signatures and payment status'; labels='priority:high,type:feature,area:payments,area:backend'; body="Acceptance criteria:`n- Verify x-paystack-signature and provider status server-side.`n- Amount, NGN currency, and reference match before crediting."},
  @{m='M10'; t='Add Flutterwave initialization and verified webhook'; labels='priority:medium,type:feature,area:payments,area:backend'; body="Acceptance criteria:`n- Flutterwave uses environment configuration and unique references.`n- verif-hash and server-side verification are checked.`n- Amount, currency, and reference must match."},
  @{m='M10'; t='Make payment webhooks idempotent and auditable'; labels='priority:high,type:feature,area:payments,area:database'; body="Acceptance criteria:`n- Duplicate events cannot double-credit or create duplicate receipts.`n- Webhook events are retained in an audit table.`n- Redirect/callback alone never marks payment paid."},
  @{m='M11'; t='Make web app installable with manifest, icons, and loading screen'; labels='priority:medium,type:feature,area:pwa,area:frontend'; body="Acceptance criteria:`n- Android Chrome can install the app.`n- Manifest includes 192/512 and maskable icons.`n- Loading/splash state is present."},
  @{m='M11'; t='Add app-shell service worker and responsive mobile navigation'; labels='priority:medium,type:feature,area:pwa,area:frontend'; body="Acceptance criteria:`n- Service worker caches app shell only.`n- Dashboard and navigation work at mobile widths.`n- Offline indicator is visible; no offline data features are added."},
  @{m='M12'; t='Set up IndexedDB for offline transactions'; labels='priority:medium,type:feature,area:offline,area:frontend'; body="Acceptance criteria:`n- IndexedDB schema and versioning are documented.`n- Start only after online tests pass and critical bugs are resolved."},
  @{m='M12'; t='Create local transactions and an offline sync queue'; labels='priority:medium,type:feature,area:offline,area:frontend'; body="Acceptance criteria:`n- Local transaction creation and queued state survive reloads.`n- Queue entries include client UUID and idempotency key."},
  @{m='M12'; t='Synchronize queued transactions with retries and conflict strategy'; labels='priority:high,type:feature,area:offline,area:backend,area:database'; body="Acceptance criteria:`n- Server sync records pending/syncing/synced/failed and retries with backoff.`n- Conflict strategy is documented before implementation.`n- Tenant scope and idempotency are enforced."},
  @{m='M13'; t='Add notification service abstraction and per-business channel settings'; labels='priority:low,type:feature,area:backend'; body="Acceptance criteria:`n- Queue supports WhatsApp and Termii SMS events.`n- Business can enable/disable channels and events.`n- SMS is OFF by default except critical alerts."},
  @{m='M13'; t='Send receipt, booking, payment, and low-stock notifications'; labels='priority:low,type:feature,area:backend'; body="Acceptance criteria:`n- WhatsApp supports receipt, booking confirmation, payment confirmation.`n- Termii supports payment, booking, critical, and low-stock alerts."},
  @{m='M14'; t='Add FREE and PAID subscription plans with configurable pricing'; labels='priority:low,type:feature,area:backend,area:database'; body="Acceptance criteria:`n- Plan prices are config/DB-driven, never hard-coded.`n- Trial and subscription status are persisted."},
  @{m='M14'; t='Enforce subscription limits and lifecycle'; labels='priority:low,type:feature,area:backend'; body="Acceptance criteria:`n- Feature limits are enforced server-side.`n- Upgrade, downgrade, expiry, and billing history are supported.`n- Payment reuses the M10 provider layer."}
)

foreach ($item in $items) {
  $milestone = $milestones[$item.m]
  $issueUrl = gh issue create --repo $repo --title $item.t --body $item.body --milestone $milestone --label $item.labels
  $issue = gh project item-add $projectNumber --owner $owner --url $issueUrl --format json | ConvertFrom-Json
  $option = if ($item.m -eq 'M9') { $ready } else { $backlog }
  gh project item-edit --project-id $projectId --id $issue.id --field-id $statusField.id --single-select-option-id $option.id | Out-Null
}

Write-Host "Created project #$projectNumber and milestone issues for $repo. M9 is Ready; M8.5 and M10–M14 are Backlog."



