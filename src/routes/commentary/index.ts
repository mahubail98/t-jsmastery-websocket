import { Router } from "express";

import { createCommentary } from "./create.js";
import { listCommentary } from "./list.js";

// mergeParams so :id from the parent matches route is visible here.
export const commentaryRouter = Router({ mergeParams: true });

commentaryRouter.get("/", listCommentary);
commentaryRouter.post("/", createCommentary);
