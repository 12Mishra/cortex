import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { fileRouter } from "./routes/file.route.ts";
import cors from "cors";

const app = express();
const PORT = process.env.PORT ?? 3001;
const allowedOrigins = ["http://localhost:3000"];

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

app.use("/file", fileRouter);

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
