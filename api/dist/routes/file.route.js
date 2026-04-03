"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileRouter = void 0;
const express_1 = __importDefault(require("express"));
const file_queue_1 = require("../queue/file.queue");
const prisma_1 = require("../lib/prisma");
exports.fileRouter = express_1.default.Router();
exports.fileRouter.post("/process", async (req, res) => {
    const { fileId } = req.body;
    const file = await prisma_1.prisma.document.findUnique({
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
        await file_queue_1.fileQueue.add("process-file-job", {
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
