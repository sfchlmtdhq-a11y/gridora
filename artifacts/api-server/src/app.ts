import express, { type Express } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { clerkMiddleware } from "@clerk/express";
import fs from "node:fs";
import path from "node:path";

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
const corsOrigins = process.env.CORS_ORIGIN?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({ credentials: true, origin: corsOrigins?.length ? corsOrigins : false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Reads CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY from the environment.
app.use(clerkMiddleware());

app.use("/api", router);

// Serve the built website from this same server, so the site and the API
// share one address (needed for login cookies).
const staticDir =
  process.env.STATIC_DIR ??
  path.resolve(process.cwd(), "artifacts/gridora/dist/public");

if (fs.existsSync(path.join(staticDir, "index.html"))) {
  app.use(express.static(staticDir));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

export default app;
