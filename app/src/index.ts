import fs from "fs/promises";
import path from "path";
import express from "express";
import cors from "cors";
import * as library from "./library";
import { deleteEmptyDirectory, upload, wait } from "./utils";

const app = express();
const PORT = Number(process.env.PORT);

app.use(cors());
app.use(express.json());

library.mount().then(
  () => {},
  () => {}
);

app.post("/api/mount", (_, res) => {
  library.mount().then((result) => {
    res.status(result.success ? 200 : 500).send(result);
  });
});

app.post("/api/scrape-all", async (req, res) => {
  //@ts-expect-error
  library.scrapeAll(req.query.platforms?.split(",")).then(
    () => res.send({ status: "scraping" }),
    (err) => res.status(500).send({ error: err?.message })
  );
});

app.get("/api/status", (_, res) => {
  const scraperStatus = library.getScraperStatus();

  Promise.race(
    [
      library.getPlatforms(),
      scraperStatus === "idle"
        ? wait(4000).then(() => Promise.reject())
        : undefined,
    ].filter(Boolean)
  ).then(
    (platforms) => res.send({ mounted: true, scraperStatus, platforms }),
    () => res.send({ mounted: false, scraperStatus, platforms: [] })
  );
});

app.get("/api/platform/:platform/games", (req, res) => {
  library.getGames(req.params.platform).then(
    (games) => res.send(games),
    (err) => res.status(500).send(err?.message)
  );
});

app.post(
  "/api/platform/:platform/games",
  upload.single("file"),
  async (req, res) => {
    const filePath = req.file?.path;

    if (!filePath) {
      return res.status(400).send("No file uploaded");
    }

    try {
      await library.scrapeGame(req.params.platform, filePath);
      return res.status(200).send({ success: true });
    } catch (err) {
      if (filePath) {
        try {
          await fs.unlink(filePath);
          await deleteEmptyDirectory(path.dirname(filePath));
        } catch (unlinkError) {
          console.error("Error deleting file:", unlinkError);
        }
      }

      return res.status(500).send({ error: "An unexpected error occurred" });
    }
  }
);

app.get("/api/platform/:platform/media", (req, res) => {
  const filePath = req.query.path;

  if (!filePath || typeof filePath !== "string") {
    return res.status(400).send("Path is missing from query or not a string");
  }

  try {
    const fullPath = library.getMediaFullPath(req.params.platform, filePath);
    return res.sendFile(fullPath);
  } catch (err: any) {
    return res.status(500).send({ error: err?.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}...`);
});
