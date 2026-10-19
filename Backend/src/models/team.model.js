import mongoose from "mongoose";

const teamSchema = new mongoose.Schema(
  { name: { type: String, required: true, unique: true, trim: true } },
  { timestamps: true },
);

export const teamModel = mongoose.model("Team", teamSchema)