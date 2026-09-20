# flake-patterns

A DevDigest skill: rules for spotting test constructions that fail
intermittently.

This archive is the import fixture for L02. It exists to be uploaded through
**Skills → Add → Import from file**, so the whole import path gets walked:
parse → preview → confirm.

## Contents

| File | What DevDigest does with it |
|---|---|
| `SKILL.md` | extracted as the skill body — the only file that is read |
| `README.md` | listed in the preview, not read |
| `install.sh` | listed in the preview as **not processed**, never read or run |

`install.sh` is here on purpose. A real skill archive found on the internet may
carry anything; the product's claim is that it extracts the markdown core and
leaves the rest alone. The import preview's file table is where you can see that
claim being kept.
