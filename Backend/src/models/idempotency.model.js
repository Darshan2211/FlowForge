import mongoose from "mongoose";

const idempotencySchema = new mongoose.Schema({
  key: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["processing", "done"], default: "processing" },
  responseStatus: { type: Number },
  responseBody: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, expires: 86400 },
});

idempotencySchema.index({ userId: 1, key: 1 }, { unique: true });

export const idempotencyModel = mongoose.model(
  "IdempotencyKey",
  idempotencySchema,
);
