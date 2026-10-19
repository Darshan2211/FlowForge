import mongoose from "mongoose";
import { userModel } from "../models/user.model.js";
import { workItemModel } from "../models/workItem.model.js";
import { activityModel } from "../models/activity.model.js";
import { membershipModel } from "../models/membership.model.js";
import { PRIORITIES } from "../models/workItem.model.js";
import {PERMISSIONS}  from "../permission.js";
import { TRANSITIONS } from "../services/worflow.js";
import { STATUSES } from "../models/workItem.model.js";

import {allowedTransitions}  from "../services/worflow.js";

const nextAction = (item) => {
  if (item.status === "closed") return "No action needed. This item is closed.";
  if (!item.ownerId) return "Unclaimed. It needs an owner.";
  if (item.status === "pending_approval") return "Waiting for approval from an approver.";
  if (item.status === "approved") return "Approved. The owner can mark it resolved.";
  if (item.status === "rejected") return "Rejected. The owner should revise and resubmit.";
  if (item.dueAt && new Date(item.dueAt) < new Date()) return "Overdue. Needs immediate attention.";
  return "In progress. Waiting on the owner.";
};

const encodeCursor = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const decodeCursor = (c) => {
  try { return JSON.parse(Buffer.from(c, "base64url").toString()); } catch { return null; }
};

export const listItems = async (req, res, next) => {
  try {
    const userId = req.user?.id ?? req.userId;
    if (!userId) return res.status(401).json({ error: "Not logged in" });

    const { teamId, status, priority, owner, q, cursor } = req.query;

    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);

    
    const memberships = await membershipModel.find({ userId }).lean();
    const myTeamIds = memberships.map((m) => String(m.teamId));
    if (myTeamIds.length === 0) return res.json({ items: [], nextCursor: null });

    const and = [{ teamId: { $in: myTeamIds } }];

   
    if (teamId) {
      if (!myTeamIds.includes(String(teamId))) return res.status(403).json({ error: "Not allowed" });
      and.push({ teamId });
    }
    if (status) {
      if (!STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status" });
      and.push({ status });
    }
    if (priority) {
      if (!PRIORITIES.includes(priority)) return res.status(400).json({ error: "Invalid priority" });
      and.push({ priority });
    }
    if (owner === "me") and.push({ ownerId: userId });
    else if (owner === "unassigned") and.push({ ownerId: null });
    else if (owner) {
      if (!mongoose.isValidObjectId(owner)) return res.status(400).json({ error: "Invalid owner" });
      and.push({ ownerId: owner });
    }

    if (q && q.trim()) and.push({ $text: { $search: q.trim().slice(0, 100) } });

    if (cursor) {
      const c = decodeCursor(cursor);
      if (!c || !mongoose.isValidObjectId(c.i) || isNaN(Date.parse(c.u)))
        return res.status(400).json({ error: "Invalid cursor" });
      const u = new Date(c.u);
      and.push({ $or: [{ updatedAt: { $lt: u } }, { updatedAt: u, _id: { $lt: c.i } }] });
    }

    const rows = await workItemModel
      .find({ $and: and })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(limit + 1)
      .select("title priority status teamId ownerId dueAt updatedAt createdAt")
      .lean();

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const ownerIds = [...new Set(page.map((r) => r.ownerId).filter(Boolean).map(String))];
    const owners = ownerIds.length
      ? await userModel.find({ _id: { $in: ownerIds } }).select("username").lean()
      : [];
    const nameOf = Object.fromEntries(owners.map((u) => [String(u._id), u.username]));

    const last = page[page.length - 1];
    res.json({
      items: page.map((r) => ({ ...r, ownerName: r.ownerId ? nameOf[String(r.ownerId)] || null : null })),
      nextCursor: hasMore ? encodeCursor({ u: last.updatedAt.toISOString(), i: String(last._id) }) : null,
    });
  } catch (err) {
    next(err);
  }
};


export const summary = async (req, res, next) => {
  try {
    const userId = req.user?.id ?? req.userId;
    if (!userId) return res.status(401).json({ error: "Not logged in" });

    const memberships = await membershipModel.find({ userId }).lean();
    const teamIds = memberships.map((m) => m.teamId);
    const approverTeamIds = memberships.filter((m) => m.role !== "member").map((m) => m.teamId);

    const active = { teamId: { $in: teamIds }, status: { $nin: ["closed", "resolved"] } };

    const [assignedToMe, urgent, unclaimed, awaitingMyApproval] = await Promise.all([
      workItemModel.countDocuments({ ...active, ownerId: userId }),

      workItemModel.countDocuments({ ...active, priority: "urgent" }),

      workItemModel.countDocuments({ ...active, ownerId: null }),
      approverTeamIds.length

        ? workItemModel.countDocuments({
            teamId: { $in: approverTeamIds },
            status: "pending_approval",

            ownerId: { $ne: userId },
          })
        : 0,
    ]);

    res.json({ assignedToMe, urgent, unclaimed, awaitingMyApproval });
  } catch (err) {
    next(err);
  }
};

export const getItem = async (req, res, next) => {
  try {
    const item = req.item;
    const perms = PERMISSIONS[req.role] || [];

    const ids = [item.ownerId, item.createdBy, item.approvedBy].filter(Boolean);

    const users = await userModel.find({ _id: { $in: ids } }).select("username").lean();
    const nameOf = Object.fromEntries(users.map((u) => [String(u._id), u.username]));

    const person = (id) => (id ? { id, name: nameOf[String(id)] || "Unknown" } : null);

    res.json({
      _id: item._id,
      id: item._id,
      title: item.title,
      description: item.description,
      teamId: item.teamId,
      status: item.status,
      priority: item.priority,
      owner: person(item.ownerId),
      createdBy: person(item.createdBy),
      approvedBy: person(item.approvedBy),
      dueAt: item.dueAt,
      version: item.version, 
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,

     
      myRole: req.role,
      nextStatuses: allowedTransitions(item.status, req.role),
      canClaim: !item.ownerId && item.status !== "closed" && perms.includes("item:claim"),
      canComment: perms.includes("item:comment"),
      canSetPriority: perms.includes("item:setPriority"),
      canReassign: perms.includes("item:reassign"),
      canApprove:
        item.status === "pending_approval" &&
        perms.includes("item:approve") &&
        String(item.ownerId) !== String(req.user.id),
      nextAction: nextAction(item),
    });
  } catch (err) {
    next(err);
  }
};

export const itemController = async (req, res, next) => {
  try {
    const {
      title,
      description,
      teamId,
      priority = "medium",
      dueAt = null,
    } = req.body;

    if (!title?.trim() || !description?.trim())
      return res
        .status(400)
        .json({ error: "Title and description are required" });
    if (!mongoose.isValidObjectId(teamId))
      return res.status(400).json({ error: "Valid teamId is required" });
    if (!PRIORITIES.includes(priority))
      return res.status(400).json({ error: "Invalid priority" });

    const membership = await membershipModel
      .findOne({ userId: req.user.id, teamId })
      .lean();
    if (!membership) return res.status(404).json({ error: "Team not found" });

    if (!PERMISSIONS[membership.role].includes("item:create"))
      return res.status(403).json({ error: "Not Allowed" });

    const item = await workItemModel.create({
      title,
      description,
      teamId,
      priority,
      dueAt,
      status: "open",
      ownerId: null,
      createdBy: req.user.id,
      version: 1,
    });

    await activityModel.create({
      itemId: item._id,
      teamId,
      actorId: req.user.id,
      type: "created",
      from: null,
      to: { title: item.title, priority: item.priority },
    });
    res
      .status(201)
      .json({ id: item._id, version: item.version, status: item.status });
  } catch (error) {
    next(error);
  }
};

const staleResponse = async (id, res) => {
  const current = await workItemModel.findById(id).lean();
  return res.status(409).json({
    error: "This item was changed. Reload page",
    currentVersion: current?.version,
  });
};

export const updateItemController = async (req, res, next) => {
  try {
    const { title, description, dueAt, version } = req.body;

    if (!Number.isInteger(version))
      return res.status().json({ error: "version is required" });

    const set = {};
    if (title !== undefined) {
      if (!String(title).trim())
        return res.status(400).json({ error: "Title cannot be empty" });
      set.title = String(title).trim();
    }
    if (description !== undefined) {
      if (!String(description).trim())
        return res.status(400).json({ error: "Description cannot be empty" });
      set.description = String(description).trim();
    }
    if (dueAt !== undefined) set.dueAt = dueAt ? new Date(dueAt) : null;
    if (!Object.keys(set).length)
      return res.status(400).json({ error: "Nothing to update" });

    const updated = await workItemModel
      .findOneAndUpdate(
        { _id: req.item_id, version },
        { $set: set, $inc: { version: 1 } },
        { new: true },
      )
      .lean();

    if (!updated) return staleResponse(req.item._id, res);

    await activityModel.create({
      itemId: updated._id,
      teamId: updated._id,
      actorId: req.userId,
      type: "updated",
      from: Object.fromEntries(Object.keys(set).map((k) => [k, req.item[k]])),
      to: set,
    });

    res.json({ id: updated._id, version: updated.version });
  } catch (error) {
    next(err);
  }
};

export const claimItemController = async (req, res, next) => {
  try {
    const userId = req.user.id
    const updated = await workItemModel
      .findOneAndUpdate(
        {
          _id: req.item._id,
          ownerId: null,
          status: { $ne: "closed" },
        },
        { $set: { ownerId: userId }, $inc: { version: 1 } },
        { new: true },
      )
      .lean();

    if (!updated) {
      const current = await 
      workItemModel.findById(req.item._id).lean();
      if (current && String(current.ownerId) === String(req.user.id))
        return res.json({
          id: current._id,
          version: current.version,
          alreadyYours: true,
        });
      return res.status(409).json({ error: "Already claimed by someone else" });
    }

    await activityModel.create({
      itemId: updated._id,
      teamId: updated.teamId,
      actorId: req.user.id,
      type: "claimed",
      from: null,
      to: String(req.user.id),
    });
    res.json({
      id: updated._id,
      version: updated.version,
      ownerId: updated.ownerId,
    });
  } catch (error) {
    next(error);
  }
};

export const changeStatusController = async (req, res, next) => {
  try {
    const { status: next_, version } = req.body;
    if (!Number.isInteger(version))
      return res.status(400).json({ error: "version is required" });

    const item = req.item;

   
    const rule = (TRANSITIONS[item.status] || []).find((t) => t.to === next_);
    if (!rule)
      return res
        .status(400)
        .json({ error: `Cannot move from ${item.status} to ${next_}` });

    
    if (rule.needs && !PERMISSIONS[req.role].includes(rule.needs))
      return res.status(403).json({ error: "Not allowed" });

    
    if (
      rule.needs === "item:approve" &&
      String(item.ownerId) === String(req.user.id)
    )
      return res
        .status(403)
        .json({ error: "You cannot approve your own item" });

    if (!rule.needs) {
      if (!item.ownerId)
        return res
          .status(400)
          .json({ error: "Claim the item before changing its status" });
      if (String(item.ownerId) !== String(req.user.id) && req.role !== "admin")
        return res
          .status(403)
          .json({ error: "Only the owner or an admin can change the status" });
    }

    const set = { status: next_ };
    if (rule.needs === "item:approve")
      set.approvedBy = next_ === "approved" ? req.user.id : null;

    
    const updated = await workItemModel.findOneAndUpdate(
      { _id: item._id, version, status: item.status },
      { $set: set, $inc: { version: 1 } },
      { new: true },
    ).lean();

    if (!updated) return staleResponse(item._id, res);

    await activityModel.create({
      itemId: updated._id,
      teamId: updated.teamId,
      actorId: req.user.id,
      type: "status_changed",
      from: item.status,
      to: next_,
    });

    res.json({
      id: updated._id,
      status: updated.status,
      version: updated.version,
    });
  } catch (err) {
    next(err);
  }
};

export const changePriorityController = async (req, res, next) => {
  try {
    const { priority, version } = req.body;

    if (!PRIORITIES.includes(priority))
      return res.status(400).json({ error: "Invalid priority" });
    if (!Number.isInteger(version))
      return res.status(400).json({ error: "version is required" });

    const item = req.item;

    if (item.status === "closed")
      return res
        .status(400)
        .json({ error: "Cannot change priority of a closed item" });

    if (item.priority === priority)
      return res.json({
        id: item._id,
        priority,
        version: item.version,
        unchanged: true,
      });

    const updated = await WorkItem.findOneAndUpdate(
      { _id: item._id, version, priority: item.priority },
      { $set: { priority }, $inc: { version: 1 } },
      { new: true },
    ).lean();

    if (!updated) return staleResponse(item._id, res);

    await activityModel.create({
      itemId: updated._id,
      teamId: updated.teamId,
      actorId: req.userId,
      type: "priority_changed",
      from: item.priority,
      to: priority,
    });

    res.json({
      id: updated._id,
      priority: updated.priority,
      version: updated.version,
    });
  } catch (err) {
    next(err);
  }
};
