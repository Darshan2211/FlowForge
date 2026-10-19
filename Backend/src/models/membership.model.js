import mongoose from "mongoose";

const membershipSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },
    role: { type: String, enum: ["member", "approver", "admin"], required: true },
  },
  { timestamps: true },
);

membershipSchema.index({ userId: 1, teamId: 1 }, { unique: true });
membershipSchema.index({ teamId: 1 });

export const membershipModel = mongoose.model("Membership", membershipSchema);
