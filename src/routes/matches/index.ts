import { Router } from "express";

import { createMatch } from "./create.js";
import { listMatches } from "./list.js";

export const matchesRouter = Router();

matchesRouter.get("/", listMatches);
matchesRouter.post("/", createMatch);
