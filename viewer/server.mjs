// viewer/server.mjs
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const distDir = path.join(__dirname, "dist");
const indexFile = path.join(distDir, "index.html");

// Serve static assets with aggressive caching for hashed files
app.use(
    express.static(distDir, {
        extensions: ["html"],
        maxAge: "1y",
        setHeaders: (res, filePath) => {
            // Cache HTML minimally, cache assets strongly
            if (filePath.endsWith(".html")) {
                res.setHeader("Cache-Control", "public, max-age=60, must-revalidate");
            } else {
                res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            }
        },
    })
);

// SPA fallback (hash or history routing both supported)
app.get("*", (_req, res) => {
    res.sendFile(indexFile);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`[viewer] server running on http://0.0.0.0:${port}`);
});
