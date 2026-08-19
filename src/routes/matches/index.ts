import { Router } from "express";

import { commentaryRouter } from "../commentary/index.js";
import { createMatch } from "./create.js";
import { listMatches } from "./list.js";

export const matchesRouter = Router();

matchesRouter.get("/", listMatches);
matchesRouter.post("/", createMatch);

matchesRouter.use("/:id/commentary", commentaryRouter);
