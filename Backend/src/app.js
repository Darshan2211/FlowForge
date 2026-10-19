import express from "express";
import { authRouter } from "./routes/auth.route.js";
import { teamRouter } from "./routes/team.route.js";
import { workItemRouter } from "./routes/workItem.route.js";
import cookieParser from "cookie-parser";
import cors from "cors";

const app = express();

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL
        : "http://localhost:5173",
    credentials: true,
  }),
);

app.use("/api/auth", authRouter);
app.use("/api/teams", teamRouter);
app.use("/api/items", workItemRouter);

export default app;
