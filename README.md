# FlowForge: Operations Under Pressure

An internal web app for coordinating operational work (incidents, payments, approvals) with teams, roles, history, and safe behaviour under concurrent use.

**Stack:** MongoDB + Express + React (Vite). Auth uses a JWT in an httpOnly cookie.

## Run it

Requirements: Node 18+, a MongoDB instance (Atlas free tier or local).

### Backend
```bash
cd Backend
npm install
cp .env.example .env      # then fill in the values
npm run dev               # http://localhost:3000
```

`.env`
```
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>/flowforge
JWT_SECRET=<long random string>
PORT=3000
```

### Frontend
```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```
Vite proxies `/api` to `http://localhost:5000` (see `vite.config.js`). Change the port there if your backend uses another one.

### Sample data
Import the JSON files from `sample-data/` into MongoDB (Compass: Add Data, Import JSON), in this order: `users`, `teams`, `memberships`, `workitems`, `activities`, `comments`.

Demo Login Credentials

Use the demo user's name as the email prefix.

Email: username@gmail.com (vijay@gmail.com)

Password: username123 (vijay123)

| Email | Teams | Roles |
|---|---|---|
| vijay | operation, payment | approver, member |
| sameer | operation | member |
| surya | operation, product & design | member, approver |
| hrithik | payment, product & desing | approver, member |
| vishal | payment | member |
| harhsit | product & design | member |

Use accounts with different roles to test permissions (a member cannot approve; a user outside a team cannot see its items).

### Tests
```bash
cd Backend
npm test
```

## Roles (per team)

| Role | Can do |
|---|---|
| member | view, create, comment, claim, update items in their team |
| approver | everything a member can, plus approve/reject and reassign |
| admin | everything above, plus change priority and manage the team |

A user can hold a different role in each team. Roles are stored in `memberships`, not on the user.

## Main behaviours

- **Atomic claim:** only one of several simultaneous claimers wins; the rest get 409.
- **Stale-edit detection:** every change carries the item `version`; an outdated version returns 409.
- **Idempotent create:** the `Idempotency-Key` header makes retries and double clicks create one item.
- **Workflow rules:** status moves follow a server-side transition map; approve/reject need the approve permission; nobody approves their own item.
- **Resource-level authorization:** every item route checks the caller's role in that item's team on the server. Non-members get 404.
- **Scalable list:** team-scoped, filtered, text-searched, cursor-paginated (`updatedAt`, `_id`), backed by indexes.
- **History:** status, priority and ownership changes are recorded in an append-only `activities` collection; comments are separate.

## API (prefix `/api`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | Log in, sets the cookie |
| GET | `/auth/me` | Current user and memberships |
| POST | `/auth/logout` | Clear the cookie |
| GET | `/teams` | My teams with my role |
| GET | `/items` | List with `status`, `priority`, `owner`, `teamId`, `q`, `cursor`, `limit` |
| GET | `/items/summary` | Dashboard counts |
| POST | `/items` | Create (needs `Idempotency-Key` header) |
| GET | `/items/:id` | Item details |
| PATCH | `/items/:id` | Edit (needs `version`) |
| POST | `/items/:id/claim` | Atomic claim |
| POST | `/items/:id/status` | Change status (needs `version`) |
| POST | `/items/:id/priority` | Change priority (admin, needs `version`) |
| GET | `/items/:id/timeline` | History and comments, paginated |
| POST | `/items/:id/comments` | Add a comment |

Error codes: 400 invalid input or invalid status move, 401 not logged in, 403 role not allowed, 404 not found or not in your team, 409 stale version, already claimed, or duplicate in progress.

## Known limitations

- No real-time updates. A user sees changes made by others after a refresh or after their own action (stale writes are still rejected with 409).
- No asynchronous processing. There are no notifications, queue, or outbox.
- The item update and its history entry are two separate writes, not one transaction. A crash between them could leave an item change without a history row.
- Comments cannot be edited or deleted.
- No registration, password reset, or refresh tokens.
- No CSRF token; the cookie uses `sameSite` to reduce the risk.
- Reassign and team-member management endpoints are limited or not built.
- Text search uses a MongoDB text index, which does not match partial words.
- Tests cover the riskiest backend behaviours only; there are no frontend tests.
