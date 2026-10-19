# Engineering Decisions

Five decisions that shaped this system, with the trade-offs I accepted.

## 1. MongoDB, with roles in a separate `memberships` collection

**Decision.** I used MongoDB (Mongoose). Users, teams, memberships, work items, activities, comments and idempotency keys are separate collections. A role lives in `memberships { userId, teamId, role }`, not on the user.

**Why.** The brief says a user can belong to several teams with different responsibilities. A role on the user cannot express "approver in Payments, member in Support". I also knew MongoDB well, so the day went to correctness, not to learning a new stack. The critical operations (claim, version-checked update) each change one document, and single-document updates are atomic in MongoDB.

**Trade-off.** There are no foreign keys, so integrity (for example "this membership's team exists") is enforced in application code. Multi-document consistency needs transactions. At larger scale, or with more cross-entity rules, PostgreSQL would be a better fit, and I would move there.

## 2. Concurrency: conditional updates, not read-then-write

**Decision.** The rule is part of the update query itself.
- **Claim:** `findOneAndUpdate({ _id, ownerId: null, status: { $ne: 'closed' } }, { ownerId: me, $inc: { version: 1 } })`. If it returns nothing, the item was taken, and the API answers 409. If the current owner is the caller, it returns success, so a retry is safe.
- **Edits, status and priority changes:** the client sends the `version` it saw, and the filter includes `{ version }` (and the old status or priority). A stale request matches nothing and returns 409.

**Why.** A "read, check, write" sequence in code leaves a gap in which two requests both pass the check. Putting the condition in the query makes the database the referee, so exactly one concurrent request wins.

**Trade-off.** A conflict makes the user reload and retry instead of merging automatically. I judged that acceptable for this kind of work, and the UI explains it with a banner and refetches the latest version.

## 3. Idempotency key on create

**Decision.** `POST /items` requires an `Idempotency-Key` header. The key is stored with the user id under a unique index. The first request inserts the key, runs, and stores its response. A repeat returns the stored response. A duplicate that arrives while the first is still running gets 409. Keys expire after 24 hours (TTL index).

**Why.** Create is the one operation that is not naturally safe to repeat: every call inserts a new document. Double clicks and retries after a lost response would make duplicates. Claim does not need a key, because its own condition already makes a repeat harmless.

**Trade-off.** The client must generate and reuse a key per submission, and a request that crashes midway can leave a key in the "processing" state until it expires. The unique index, not application code, blocks the duplicate.

## 4. Authorization: per-team roles checked on the server, per resource

**Decision.** Permissions are defined in one map (`member`, `approver`, `admin` to a list of permissions such as `item:approve`). A `requirePermission(permission)` middleware loads the item, finds the caller's membership **for that item's team**, and checks the permission. No membership returns 404, and a missing permission returns 403. The list endpoint always adds `teamId: { $in: myTeamIds }` to its query, search included. The JWT carries only the user id; roles are read from the database on each request.

**Why.** The brief requires enforcement by the system, not by hidden buttons. Checking against the specific item means the same user can approve in one team and be refused in another. 404 for non-members avoids revealing that an item exists. Reading roles from the database means removing someone from a team takes effect immediately, not when a token expires. Extra rules (no self-approval, only the owner or an admin moves an item) separate doing the work from approving it.

**Trade-off.** One extra database lookup per request. Changing what a role may do means editing code and deploying, not changing data.

## 5. Cursor pagination and indexes, with async work deliberately left out

**Decision.** Lists are paginated with a cursor on `(updatedAt, _id)` and fetch `limit + 1` rows to know whether another page exists. Indexes cover the team-scoped list, the status filter, "assigned to me", and text search. The timeline is paginated the same way, so a growing history never loads at once.

**Why.** Offsets get slower on deep pages and skip or repeat rows when data changes underneath. A cursor stays fast and stable. The browser never holds the full dataset.

**What I chose not to build.** Asynchronous processing (a queue or outbox for notifications), real-time push, and a transaction around "update item plus write history". I preferred a smaller system with correct claim, versioning, idempotency and authorization over a larger one with half-finished features.

**Trade-off and next step.** Users see other people's changes after a refresh or an action, although stale writes are still rejected. A history row can be missing if the process crashes between the two writes. With more time I would wrap those two writes in a transaction, add an outbox for notifications with idempotent consumers, and push updates over server-sent events.
