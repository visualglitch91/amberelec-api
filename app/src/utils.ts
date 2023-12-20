import { spawn as _spawn } from "child_process";
import fs from "fs/promises";
import multer from "multer";

async function createFolderIfNotExists(folderPath: string): Promise<void> {
  try {
    try {
      await fs.stat(folderPath);
    } catch (err) {
      await fs.mkdir(folderPath, { recursive: true });
    }
  } catch (error) {
    throw error;
  }
}

const storage = multer.diskStorage({
  destination: (req, __, cb) => {
    const dir = `/mnt/library/${req.params.platform}/roms/${req.body.name}/`;

    createFolderIfNotExists(dir).then(
      () => cb(null, dir),
      (err) => cb(err, "")
    );
  },
  filename: (_, file, cb) => {
    cb(null, file.originalname);
  },
});

export const upload = multer({ storage: storage });

export async function deleteEmptyDirectory(directoryPath: string) {
  const dirItems = await fs.readdir(directoryPath);

  if (dirItems.length === 0) {
    await fs.rmdir(directoryPath);
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

export function spawn(
  command: string,
  args: string[] = [],
  onOutput?: (data: string) => void
) {
  return new Promise<void>((resolve, reject) => {
    console.log(`Running ${command}`, args);

    const process = _spawn(command, args);

    process.stdout?.on("data", (data) => {
      console.log(data.toString());
      onOutput?.(data);
    });

    process.stderr?.on("data", (data) => {
      console.error(data.toString());
      onOutput?.(data);
    });

    process.on("close", (code) => {
      code === 0 ? resolve() : reject();
    });
  });
}

export function mergeSkyscraperFlags(
  ...flags: (string | undefined | null | false)[]
): string {
  const uniqueFlagsSet: Set<string> = new Set();

  flags.forEach((flag) => {
    if (typeof flag === "string" && flag !== "") {
      const individualFlags = flag.split(",");
      individualFlags.forEach((individualFlag) => {
        if (individualFlag.trim() !== "") {
          uniqueFlagsSet.add(individualFlag.trim());
        }
      });
    }
  });

  return Array.from(uniqueFlagsSet).join(",");
}

export function getSkyscraperModuleArgs(args: string[]) {
  if (args.length === 1) {
    return ["-s", args[0]];
  }

  if (args.length === 3) {
    return ["-s", args[0], "-u", `${args[1]}:${args[2]}`];
  }

  throw new Error("Bad scraper config");
}
