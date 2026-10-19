import express from "express";
import * as authController from "../controllers/auth.controller.js";
import * as authMiddleware from "../middlewares/auth.middleware.js";
export const authRouter = express.Router();
/**
 * @route /api/auth/login
 * @description Login a new user
 * @abstract Public
 */
authRouter.post(
  "/login",

  authController.loginUserController,
);
authRouter.post(
  "/register",

  authController.registerUserController,
);

authRouter.get("/me", authMiddleware.authUser, authController.getMeController);
authRouter.post("/logout", authMiddleware.authUser, authController.logoutUserController);
