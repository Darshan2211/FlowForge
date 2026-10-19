import express from "express"
export const teamRouter = express.Router()
import * as teamController from "../controllers/team.controller.js"
import * as authMiddleware from "../middlewares/auth.middleware.js"

teamRouter.get("/", authMiddleware.authUser, teamController.getMyTeams)
teamRouter.get("/:id/members", teamController.getTeamMembers)