import { config as loadDotenv } from "dotenv";
import { ConfigError } from "../domain/errors.js";
import { startRuntime } from "./app.js";

loadDotenv();

async function main(): Promise<void> {
  try {
    const { config } = await startRuntime(process.env);
    process.stdout.write(
      `${JSON.stringify({ operation: "runtime.start", outcome: "success", port: config.port })}\n`,
    );
  } catch (error) {
    const message = error instanceof ConfigError ? error.message : "Failed to start runtime";
    const code = error instanceof ConfigError ? error.code : "RUNTIME_START_FAILED";
    process.stderr.write(`${JSON.stringify({ operation: "runtime.start", outcome: "failure", errorCode: code, message })}\n`);
    process.exitCode = 1;
  }
}

void main();
