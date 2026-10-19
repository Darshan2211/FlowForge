import mongoose from "mongoose";

import {workItemModel} from "../models/workItem.model.js";
import {membershipModel} from "../models/membership.model.js";
import {PERMISSIONS} from "../permission.js";

const requirePermission = (permission) => async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not logged in" });

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid id" });

    const item = await workItemModel.findById(id).lean();
    if (!item) return res.status(404).json({ error: "Not found" });


    const membership = await membershipModel.findOne({ userId, teamId: item.teamId }).lean();
    if (!membership) return res.status(404).json({ error: "Not found" }); 

    if (!PERMISSIONS[membership.role]?.includes(permission))
      return res.status(403).json({ error: "Not allowed" });

    req.item = item;
    req.role = membership.role;
    req.user.id = userId;
    next();
  } catch (err) {
    next(err);
  }
};

export default requirePermission;