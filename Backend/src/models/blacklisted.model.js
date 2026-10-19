
import mongoose from "mongoose";

const blacklistTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: [true, "Token is required to be added to the blacklist"],
  },
});

export const blackListModel = mongoose.model(
  "Blacklist",
  blacklistTokenSchema
);
