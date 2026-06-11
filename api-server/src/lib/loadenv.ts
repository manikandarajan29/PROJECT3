import path from "node:path";
import fs from "node:fs";

try {
  const dirname = typeof import.meta !== "undefined" && import.meta.dirname
    ? import.meta.dirname
    : (typeof __dirname !== "undefined" ? __dirname : ".");

  const possiblePaths = [
    path.resolve(dirname, "../../../.env"), // relative to dist/src/lib
    path.resolve(dirname, "../../.env"),     // relative to src/lib
    path.resolve(process.cwd(), ".env"),                // local cwd
    path.resolve(process.cwd(), "../.env"),             // root relative to cwd
  ];

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      process.loadEnvFile(envPath);
      break;
    }
  }
} catch (e: any) {
  console.warn("Failed to load environment variables from .env file:", e.message || e);
}
