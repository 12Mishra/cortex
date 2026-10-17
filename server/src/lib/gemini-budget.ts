import { redisConnection } from "../config/redis";

const MONTHLY_BUDGET_USD = Number(process.env.GEMINI_MONTHLY_BUDGET_USD ?? "0.75");
const INPUT_USD_PER_MILLION = Number(process.env.GEMINI_INPUT_USD_PER_MILLION ?? "2");
const OUTPUT_USD_PER_MILLION = Number(process.env.GEMINI_OUTPUT_USD_PER_MILLION ?? "12");

if (![MONTHLY_BUDGET_USD, INPUT_USD_PER_MILLION, OUTPUT_USD_PER_MILLION].every(Number.isFinite) ||
    MONTHLY_BUDGET_USD <= 0 || INPUT_USD_PER_MILLION < 0 || OUTPUT_USD_PER_MILLION < 0) {
  throw new Error("Gemini budget settings must be finite and the monthly budget must be positive");
}

const reserveScript = `
local used = tonumber(redis.call('GET', KEYS[1]) or '0')
local reserve = tonumber(ARGV[1])
local budget = tonumber(ARGV[2])
if used + reserve > budget then return 0 end
redis.call('INCRBYFLOAT', KEYS[1], reserve)
redis.call('EXPIRE', KEYS[1], 3888000)
return 1
`;

const adjustScript = `
local used = tonumber(redis.call('GET', KEYS[1]) or '0')
local delta = tonumber(ARGV[1])
redis.call('INCRBYFLOAT', KEYS[1], delta)
if used + delta <= 0 then redis.call('DEL', KEYS[1])
else redis.call('EXPIRE', KEYS[1], 3888000) end
return 1
`;

function currentMonthKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `cortex:gemini:spend:${year}-${month}`;
}

export function estimateGeminiCostUsd(inputTokens: number, outputTokens: number) {
  return (inputTokens * INPUT_USD_PER_MILLION + outputTokens * OUTPUT_USD_PER_MILLION) / 1_000_000;
}

export async function reserveGeminiBudget(inputTokens: number, maxOutputTokens: number) {
  const key = currentMonthKey();
  const reserveUsd = estimateGeminiCostUsd(inputTokens, maxOutputTokens);
  const accepted = await redisConnection.eval(
    reserveScript,
    1,
    key,
    reserveUsd.toFixed(8),
    MONTHLY_BUDGET_USD.toString(),
  );
  if (accepted !== 1) return null;

  return {
    key,
    reserveUsd,
    adjust: async (actualUsd: number) => {
      const delta = actualUsd - reserveUsd;
      if (delta !== 0) await redisConnection.eval(adjustScript, 1, key, delta.toFixed(8));
    },
  };
}

export const GEMINI_MONTHLY_BUDGET_USD = MONTHLY_BUDGET_USD;
