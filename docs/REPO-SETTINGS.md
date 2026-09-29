# Repository protection settings

## Manual owner action

The current environment does not have the GitHub CLI (`gh`), so branch protection could not be queried or changed with `gh api`. In GitHub, open **CipherChi/hotel-business-manager → Settings → Rules → Rulesets** (or **Branches → Add branch protection rule**) and target `main`. Require pull requests before merging and one approving review. Require the status check named **CI passed**. Disable force pushes. Save the rule and confirm it applies to `main`.

Do not treat the rule as verified until the owner confirms it in repository settings. The local `.github/workflows/ci.yml` defines the `CI passed` aggregate, but no PR run is available from this task.
