"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const connection_js_1 = require("../queue/connection.js");
const worker = new bullmq_1.Worker("file-queue", async (f) => {
    const { file } = f.data;
    console.log(file);
}, {
    connection: connection_js_1.redisConnection,
});
worker.on("completed", (f) => {
    console.log(`Job completed: ${f.id}`);
});
worker.on("failed", (f, err) => {
    console.error(`Job failed: ${f?.id}`, err);
});
