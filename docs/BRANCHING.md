# Git branching strategy

- `main` is the shared integration branch. Do not push feature work directly to it.
- Create a short-lived branch for each focused change: `codex/feature/<short-name>`, `codex/fix/<short-name>`, or `codex/chore/<short-name>`.
- Open a pull request against `main`, reference the related GitHub issue, and wait for review before merging.
- Keep pull requests focused and merge them only after the relevant checks pass.
- Milestones are delivered in order. Do not begin work in the next milestone until the current milestone's local completion checks pass and it is closed.
- Branch protection and required CI checks are configured in milestone M8.
