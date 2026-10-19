import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkItem",
      required: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

commentSchema.index({ itemid: 1, createdAt: -1 });

export const commentModel = mongoose.model("Comment", commentSchema);
