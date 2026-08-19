import { Router } from "express";
import { createCommentary } from "./create.js";
import { listCommentary } from "./list.js";

export const commentaryRouter = Router({ mergeParams: true });
export const commentaryCreateRouter = Router();

commentaryRouter.get("/", listCommentary);
commentaryCreateRouter.post("/", createCommentary);
