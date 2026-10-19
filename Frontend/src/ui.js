export const STATUSES = ['open', 'in_progress', 'pending_approval', 'approved', 'rejected', 'resolved', 'closed'];
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export const label = (s) => (s || '').replace(/_/g, ' ');

const PRIORITY_COLOR = { urgent: 'red', high: 'orange', medium: 'yellow', low: 'gray' };
const STATUS_COLOR = {
  open: 'blue', in_progress: 'aqua', pending_approval: 'violet',
  approved: 'green', rejected: 'red', resolved: 'green', closed: 'gray',
};
const EVENT_COLOR = {
  created: 'green', claimed: 'orange', status_changed: 'violet',
  priority_changed: 'red', reassigned: 'aqua', updated: 'blue', comment: 'blue',
};

export const priorityClass = (p) => `t-${PRIORITY_COLOR[p] || 'gray'}`;
export const statusClass = (s) => `t-${STATUS_COLOR[s] || 'gray'}`;
export const eventColor = (ev) => EVENT_COLOR[ev.kind === 'comment' ? 'comment' : ev.type] || 'gray';
export const initials = (name = '?') => name.trim().charAt(0).toUpperCase();
