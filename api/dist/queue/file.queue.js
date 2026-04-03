"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileQueue = void 0;
const bullmq_1 = require("bullmq");
const connection_js_1 = require("./connection.js");
exports.fileQueue = new bullmq_1.Queue("file-queue", {
    connection: connection_js_1.redisConnection,
});
