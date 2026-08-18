import express, { type Request, type Response } from "express";

const app = express();
const PORT = 8000;

app.use(express.json());

app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Sportz API is running" });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
