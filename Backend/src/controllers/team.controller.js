import { membershipModel } from "../models/membership.model.js";
import { PERMISSIONS } from "../permission.js";
import {teamModel} from "../models/team.model.js"



export const getMyTeams = async (req, res, next) => {
  try {
    const userId = req.user?.id; 

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const memberships = await membershipModel.find({ userId }).lean();

    const teams = await teamModel
      .find({ _id: { $in: memberships.map((m) => m.teamId) } })
      .lean();

    const nameById = Object.fromEntries(teams.map((t) => [String(t._id), t.name]));

    return res.status(200).json({
      teams: memberships
        .filter((m) => nameById[String(m.teamId)])
        .map((m) => ({
          teamId: m.teamId,
          teamName: nameById[String(m.teamId)],
          role: m.role,
        })),
    });
  } catch (err) {
    next(err);
  }
};


export const getTeamMembers = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ error: "Invalid id" });

    const mine = await membershipModel.findOne({
      userId: req.userId,
      teamId: id,
    }).lean();
    if (!mine) return res.status(404).json({ error: "Not found" });

    if (!PERMISSIONS[mine.role].includes("item:reassign"))
      return res.status(403).json({ error: "Not allowed" });

    const rows = await membershipModel.find({ teamId: id })
      .populate("userId", "name")
      .lean();

    res.json({
      members: rows
        .filter((r) => r.userId)
        .map((r) => ({
          userId: r.userId._id,
          name: r.userId.name,
          role: r.role,
        })),
    });
  } catch (err) {
    next(err);
  }
};
