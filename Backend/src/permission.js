const base = [
  'item:view',
  'item:create',
  'item:comment',
  'item:claim',
  'item:update',
];

export const PERMISSIONS = {
  member: base,
  approver: [...base, 'item:approve', 'item:reassign'],
  admin: [...base, 'item:approve', 'item:reassign', 'item:setPriority', 'team:manage'],
};

