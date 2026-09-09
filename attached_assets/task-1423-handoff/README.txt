Task #1423 portable Git handoff

Base commit:
00580124c8c0a8ebdb2150550499541df9d989b1

Implementation commit:
ef640fbfbe8889f089a5a87e01909559d52fbcbf

Preferred import from the bundle:
  git bundle verify task-1423.bundle
  git fetch task-1423.bundle task-1423-portable-handoff:refs/remotes/handoff/task-1423
  git show --stat refs/remotes/handoff/task-1423

If the checkout is exactly at the base commit, attach by fast-forward:
  git merge --ff-only refs/remotes/handoff/task-1423

Alternative patch import:
  git am --3way task-1423.patch

Verify checksums:
  sha256sum -c SHA256SUMS
