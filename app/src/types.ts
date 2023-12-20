export type ScraperStatus = "idle" | "scraping-game" | "scraping-all";

export interface Platform {
  name: string;
  enabled: boolean;
}

export interface Status {
  mounted: boolean;
  platforms: Platform[];
  scraperStatus: ScraperStatus;
}

export interface Game {
  name: string;
  path: string;
}
