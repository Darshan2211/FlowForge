import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkItem",
      required: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "created",
        "claimed",
        "status_changed",
        "priority_changed",
        "reassigned",
      ],
      required: true,
    },
    from: { type: mongoose.Schema.Types.Mixed, default: null },
    to: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activitySchema.index({ itemId: 1, createdAt: -1 });
activitySchema.index({ teamId: 1, createdAt: -1 });

export const activityModel = mongoose.model("Activity", activitySchema);
