tre-editor-shell
---

 A wrapper around editors
- watches revroot under edit
- warns if editor content is outdated (potential fork)
- list json diff between editor content and each new revision
- says who did the change and how long ago
- button to apply changes.
  - editor revisionBranch then changes to latest edit
- supplies save button
  - warn about knowingly creating a fork

See
- JSON-Patch
- json8-merge-patch

TODO:
- hide revisionRoot/revisionBranch TODOs
- apply these automatically when rebasing.


License: AGPLv3 - Copyright 2019 Jan Boelsche
