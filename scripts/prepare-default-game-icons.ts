import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  defaultGameIconDirectory,
  defaultGameIconKeys,
  readDefaultGameIcon,
} from "../src/lib/default-game-icons";

const directory = defaultGameIconDirectory();
await mkdir(directory, { recursive: true });
await Promise.all(
  defaultGameIconKeys.map(async (key) => {
    const image = await readDefaultGameIcon(key);
    if (!image) throw new Error(`缺少默认图标 ${key}`);
    await writeFile(join(directory, `${key}.png`), image);
    console.log(`已准备 ${key}`);
  }),
);
