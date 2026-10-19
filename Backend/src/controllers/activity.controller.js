import mongoose from "mongoose";
import { activityModel } from "../models/activity.model.js";
import { commentModel } from "../models/comment.model.js";
import { userModel } from "../models/user.model.js";

const encodeCursor = (createdAt, id) =>
  Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id: String(id) })).toString("base64url");

const decodeCursor = (cursor) => {
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString());
    if (
      !value ||
      typeof value.createdAt !== "string" ||
      Number.isNaN(Date.parse(value.createdAt)) ||
      !mongoose.isValidObjectId(value.id)
    ) return null;
    return { createdAt: new Date(value.createdAt), id: value.id };
  } catch {
    return null;
  }
};

const olderThanCursor = ({ createdAt, id }) => ({
  $or: [
    { createdAt: { $lt: createdAt } },
    { createdAt, _id: { $lt: id } },
  ],
});

export const getItemTimeline = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    let cursorFilter = null;

    if (req.query.cursor) {
      cursorFilter = decodeCursor(req.query.cursor);
      if (!cursorFilter) return res.status(400).json({ error: "Invalid cursor" });
    }

    const itemFilter = { itemId: req.item._id };
    const filter = cursorFilter
      ? { $and: [itemFilter, olderThanCursor(cursorFilter)] }
      : itemFilter;

    const [activities, comments] = await Promise.all([
      activityModel.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean(),
      commentModel.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean(),
    ]);

    const rows = [
      ...activities.map((entry) => ({ ...entry, kind: "activity" })),
      ...comments.map((entry) => ({ ...entry, kind: "comment" })),
    ].sort((a, b) =>
      b.createdAt.getTime() - a.createdAt.getTime() ||
      String(b._id).localeCompare(String(a._id)),
    );

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const userIds = [...new Set(page.map((entry) =>
      String(entry.actorId || entry.authorId),
    ))];
    const users = userIds.length
      ? await userModel.find({ _id: { $in: userIds } }).select("username").lean()
      : [];
    const usernameById = Object.fromEntries(
      users.map((user) => [String(user._id), user.username]),
    );

    const items = page.map((entry) => {
      const personName = usernameById[String(entry.actorId || entry.authorId)] || "Unknown";
      return entry.kind === "comment"
        ? {
            _id: entry._id,
            kind: entry.kind,
            authorName: personName,
            text: entry.text,
            createdAt: entry.createdAt,
          }
        : {
            _id: entry._id,
            kind: entry.kind,
            type: entry.type,
            actorName: personName,
            from: entry.from,
            to: entry.to,
            createdAt: entry.createdAt,
          };
    });

    const last = page[page.length - 1];
    res.json({
      items,
      nextCursor: hasMore ? encodeCursor(last.createdAt, last._id) : null,
    });
  } catch (err) {
    next(err);
  }
};
