import express from "express";
import { fileQueue } from "../queue/file.queue";
import { prisma } from "../lib/prisma";

export const fileRouter = express.Router();

fileRouter.post("/process", async (req, res) => {
  const { fileId } = req.body;

  const file = await prisma.document.findUnique({
    where: {
      id: fileId,
    },
  });

  if (!file) {
    return res.status(404).json({
      message: "Cannot retrieve user file from the database",
      success: false,
      data: [],
    });
  }

  if (file) {
    console.log("--- control reached here 1 ---");
    await fileQueue.add("process-file-job", {
      file,
    });
    console.log("--- control reached here 2---");
    // return res.status(200).json({
    //     success:true,
    //     message:"File started"
    // })
  }

  res.json({ message: "Email job queued!" });
});
