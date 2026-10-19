import {PERMISSIONS} from "../permission.js";


export const TRANSITIONS = {
  open: [{ to: "in_progress" }],
  in_progress: [{ to: "pending_approval" }, { to: "resolved" }],
  pending_approval: [
    { to: "approved", needs: "item:approve" },
    { to: "rejected", needs: "item:approve" },
  ],
  approved: [{ to: "resolved" }],
  rejected: [{ to: "in_progress" }],
  resolved: [{ to: "closed" }, { to: "in_progress" }],
  closed: [],
};

export const allowedTransitions = (status, role) =>
  (TRANSITIONS[status] || [])
    .filter((t) => !t.needs || PERMISSIONS[role]?.includes(t.needs))
    .map((t) => t.to);