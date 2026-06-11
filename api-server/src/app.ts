import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === "true";
const ALLOWED_ORIGIN = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security Gate Middleware
app.use("/api", (req, res, next) => {
  if (req.path === "/healthz") {
    return next();
  }

  const authHeader = req.headers.authorization;
  const hasToken = authHeader && authHeader.startsWith("Bearer ");

  if (!hasToken) {
    if (REQUIRE_AUTH) {
      logger.debug({ path: req.path }, "Unauthorized request rejected in production mode.");
      res.status(401).json({ error: "Unauthorized. Authorization Bearer token is required." });
      return;
    } else {
      // Lenient development mode: log a debug message but permit the request
      logger.debug({ path: req.path }, "Security Warning: Unauthenticated API request permitted in development mode.");
    }
  }
  next();
});

app.use("/api", router);

// Global Error Handler Middleware (Production Reliability & Security Redaction)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err, path: req.path }, "Unhandled request error");

  const isDev = process.env.NODE_ENV !== "production";
  const errorMessage = err.message || "An unexpected error occurred";

  // Gracefully handle PostgreSQL connection or missing schema relation errors
  if (
    errorMessage.includes("relation") ||
    errorMessage.includes("connection") ||
    errorMessage.includes("failed query") ||
    err.code === "ECONNREFUSED"
  ) {
    res.status(503).json({
      error: "Database Service Unavailable",
      message: "The database query failed. Please ensure PostgreSQL is running and all database schemas are pushed using 'pnpm run db:push'.",
      details: isDev ? errorMessage : undefined,
    });
    return;
  }

  res.status(err.status || 500).json({
    error: "Internal Server Error",
    message: isDev ? errorMessage : "An unexpected error occurred on the server.",
  });
});

export default app;
