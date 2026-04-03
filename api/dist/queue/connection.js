"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisConnection = void 0;
const ioredis_1 = require("ioredis");
exports.redisConnection = new ioredis_1.Redis({
    host: "localhost",
    port: 6379,
    maxRetriesPerRequest: null,
});
