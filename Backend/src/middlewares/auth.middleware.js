import "dotenv/config.js";
import jwt from "jsonwebtoken";
import { blackListModel } from "../models/blacklisted.model.js";

export const authUser = async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    const isTokenBlackListed = await blackListModel.findOne({
      token,
    });

    if (isTokenBlackListed) {
      return res.status(401).json({ message: "Invalid password" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Authentication required." });
    }
    next(error);
  }
};
