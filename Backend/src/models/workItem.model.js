import mongoose, { mongo } from "mongoose";

export const STATUSES = [
  "open",
  "in_progress",
  "pending_approval",
  "approved",
  "rejected",
  "resolved",
  "closed",
];
export const PRIORITIES = ["low", "medium", "high", "urgent"];

const workItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },
    status: { type: String, enum: STATUSES, default: "open" },
    priority: { type: String, enum: PRIORITIES, default: "medium" },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    version: { type: Number, default: 1 },
    dueAt: { type: Date, default: null },
  },
  { timestamps: true },
);

workItemSchema.index({ teamId: 1, status: 1, priority: 1, updatedAt: -1 });
workItemSchema.index({ ownerId: 1, status: 1, updatedAt: -1 });
workItemSchema.index({ teamId: 1, ownerId: 1 });
workItemSchema.index({ title: "text", description: "text" });

export const workItemModel = mongoose.model("WorkItem", workItemSchema);
