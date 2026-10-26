---
description: Review the pending changes with the code-reviewer agent (required before committing)
---

Use the `code-reviewer` agent to review the current changes of this repository (`git diff HEAD` plus untracked files).

Pass it any context that helps: what the change is for, and anything you are unsure about. $ARGUMENTS

Then:

- If the verdict is `APPROVE`, summarise the review in two lines.
- If the verdict is `CHANGES_REQUESTED`, fix every blocking finding and every "should fix" that is reasonable, then run the reviewer again. Repeat until it approves; do not argue with a finding without a concrete reason, and say so to the user when you disagree.
- Do not commit: the user decides when to commit.
