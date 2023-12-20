import fs from "fs/promises";
import path from "path";
import { XMLParser } from "fast-xml-parser";
import { Game, Platform, ScraperStatus } from "./types";
import {
  fileExists,
  getSkyscraperModuleArgs,
  mergeSkyscraperFlags,
  spawn,
  wait,
} from "./utils";

let mountPromise: Promise<{ success: boolean; error?: string }> | null = null;

const xmlParser = new XMLParser();
const libraryDir = "/mnt/library";

const scrapers = (process.env.SCRAPERS || "thegamesdb")
  .split(",")
  .map((it) => it.split(":"));

const extraSkyscraperFlags = process.env.SKYSCRAPER_FLAGS || "";

const skyscraperScrapingFlags = mergeSkyscraperFlags(
  "nohints",
  "unattendskip",
  "onlymissing",
  extraSkyscraperFlags
);

const skyscraperGamelistFlags = mergeSkyscraperFlags(
  "nohints",
  "unattendskip",
  "relative",
  extraSkyscraperFlags
);

// prettier-ignore
const skyscraperPlatforms = [
  '3do', '3ds', 'actionmax', 'ags',
  'amiga', 'amstradcpc', 'apple2', 'arcade',
  'arcadia', 'astrocade', 'atari2600', 'atari5200',
  'atari7800', 'atari800', 'atarijaguar',
  'atarijaguarcd', 'atarilynx', 'atarist',
  'atomiswave', 'c128', 'c64', 'cd32', 'cdi',
  'cdtv', 'channelf', 'coco', 'coleco', 'crvision',
  'daphne', 'dragon32', 'dreamcast', 'easyrpg',
  'fba', 'fds', 'fm7', 'gameandwatch', 'gamegear',
  'gb', 'gba', 'gbc', 'gc', 'intellivision',
  'love', 'macintosh', 'mame', 'mame-advmame',
  'mame-libretro', 'mame-mame4all', 'mastersystem',
  'megadrive', 'moto', 'msx', 'msx2', 'n64',
  'naomi', 'naomi2', 'nds', 'neogeo', 'neogeocd',
  'nes', 'ngp', 'ngpc', 'openbor', 'oric', 'pc',
  'pc88', 'pc98', 'pcengine', 'pcenginecd', 'pcfx',
  'pico8', 'plus4', 'pokemini', 'ports', 'ps2',
  'ps3', 'ps4', 'ps5', 'psp', 'psx', 'samcoupe',
  'saturn', 'scummvm', 'sega32x', 'segacd',
  'sg-1000', 'snes', 'solarus', 'steam',
  'stratagus', 'switch', 'ti99', 'tic80', 'trs-80',
  'vectrex', 'vic20', 'videopac', 'virtualboy',
  'wii', 'wiiu', 'wonderswan', 'wonderswancolor',
  'x1', 'x68000', 'xbox', 'xbox360', 'zmachine',
  'zx81', 'zxspectrum'
];

export function isMounted() {
  return Promise.race(
    [
      scraperStatus === "idle" ? wait(1_000).then(() => "timeout") : undefined,
      fs.access(path.join(libraryDir, "bios"), fs.constants.F_OK).then(
        () => "mounted",
        () => "unmounted"
      ),
    ].filter(Boolean)
  ).then((result) => result === "mounted");
}

export async function mount() {
  if (await isMounted()) {
    return { success: true };
  }

  if (!mountPromise) {
    mountPromise = spawn("/scripts/mount.sh").then(
      () => ({ success: true }),
      (err: any) => ({ success: false, error: err?.message })
    );

    mountPromise.finally(() => {
      mountPromise = null;
    });
  }

  return mountPromise;
}

export async function getPlatforms() {
  if (!(await isMounted())) {
    throw new Error("Library not mounted");
  }

  const platforms: Platform[] = [];

  const subdirs = await fs.readdir(libraryDir);

  for (const subdir of subdirs) {
    const fullPath = path.join(libraryDir, subdir);
    const stats = await fs.stat(fullPath);

    if (stats.isDirectory() && skyscraperPlatforms.includes(subdir)) {
      const filesInDirectory = await fs
        .readdir(path.join(fullPath, "roms"))
        .catch(() => []);

      platforms.push({
        name: subdir,
        enabled: filesInDirectory.length > 0,
      });
    }
  }

  return platforms;
}

export async function getGames(platform: string): Promise<Game[]> {
  if (!(await isMounted())) {
    return [];
  }

  const gamelist = await fs.readFile(
    path.join(libraryDir, platform, "gamelist.xml"),
    "utf-8"
  );

  const games = [].concat(
    xmlParser.parse(gamelist)?.gameList?.game || []
  ) as Game[];

  const existingGames = await Promise.all(
    games.map(async (game) => {
      const gamePath = path.join(libraryDir, platform, game.path);
      const exists = await fileExists(gamePath);
      return { game, exists };
    })
  );

  return existingGames
    .filter((it) => it.exists)
    .map((it) => ({ ...it.game, platform }));
}

let scraperStatus: ScraperStatus = "idle";

export function getScraperStatus() {
  return scraperStatus;
}

export async function scrapeAll(platforms?: string[]) {
  if (!(await isMounted())) {
    throw new Error("Library not mounted");
  }

  if (scraperStatus === "scraping-game") {
    throw new Error("Scraper busy");
  }

  if (scraperStatus === "scraping-all") {
    return;
  }

  const doScrapeAll = async () => {
    scraperStatus = "scraping-all";

    const platformsToScrape = Array.isArray(platforms)
      ? platforms
      : await getPlatforms().then((platforms) =>
          platforms.filter((it) => it.enabled).map((it) => it.name)
        );

    console.log("Scraping platforms started", platformsToScrape);

    for (const platform of platformsToScrape) {
      const inputDir = path.join(libraryDir, platform);

      for (const scraper of scrapers) {
        await spawn("Skyscraper", [
          "-i",
          inputDir,
          "-p",
          platform,
          ...getSkyscraperModuleArgs(scraper),
          "--flags",
          skyscraperScrapingFlags,
        ]);
      }

      await spawn("Skyscraper", [
        "-i",
        inputDir,
        "-p",
        platform,
        "--flags",
        skyscraperGamelistFlags,
      ]);
    }

    console.log("Scraping platforms ended", platformsToScrape);

    scraperStatus = "idle";
  };

  doScrapeAll().catch(console.error);

  return;
}

export async function scrapeGame(platform: string, filePath: string) {
  if (!(await isMounted())) {
    throw new Error("Library not mounted");
  }

  if (scraperStatus !== "idle") {
    throw new Error("Scraper busy");
  }

  scraperStatus = "scraping-game";

  console.log("Scraping file started", filePath);

  const inputDir = path.join(libraryDir, platform);

  for (const scraper of scrapers) {
    await spawn("Skyscraper", [
      "-i",
      inputDir,
      "-p",
      platform,
      ...getSkyscraperModuleArgs(scraper),
      filePath,
      "--flags",
      skyscraperScrapingFlags,
    ]);
  }

  await spawn("Skyscraper", [
    "-i",
    inputDir,
    "-p",
    platform,
    "--flags",
    skyscraperGamelistFlags,
  ]);

  const games = await getGames(platform);

  if (
    !games.some((it) => {
      const itBasePath = it.path.slice(6);
      const fileBasePath = filePath.slice(
        path.join(libraryDir, platform, "roms").length
      );

      return itBasePath === fileBasePath;
    })
  ) {
    throw new Error("Game not added");
  }

  console.log("Scraping file ended", filePath);

  scraperStatus = "idle";
}

export function getMediaFullPath(platform: string, filePath: string) {
  const fullPath = path.resolve(path.join(libraryDir, platform, filePath));

  if (
    fullPath.startsWith(path.resolve(path.join(libraryDir, platform, "media")))
  ) {
    return fullPath;
  }

  throw new Error("Invalid media file path");
}
