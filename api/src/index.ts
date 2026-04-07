import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { fileRouter } from "./routes/file.route.ts";
import { chatRouter } from "./routes/chat.route.ts";
import cors from "cors";
import { rateLimit } from "express-rate-limit";

const app = express();
const PORT = process.env.PORT ?? 3001;
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000").split(",").map(s => s.trim());

app.use(express.json());
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (allowedOrigins.indexOf(origin!) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  keyGenerator: (req) => (req.headers["x-user-id"] as string) || "anonymous",
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded. You can send up to 15 messages per minute." },
});

app.use("/file", fileRouter);
app.use("/chat", chatLimiter, chatRouter);

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
