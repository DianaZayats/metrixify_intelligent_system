import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { InputFile } from 'grammy';

/** Telegram sendPhoto limit is 10 MB; source PNG in brandbook is ~10.5 MB. */
const INTRO_IMAGE_PATH = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../assets/intro-start.jpg',
);

/** Brand intro image for /start; undefined if the file is missing (e.g. partial checkout). */
export function getIntroImageInputFile(): InputFile | undefined {
  if (!existsSync(INTRO_IMAGE_PATH)) {
    return undefined;
  }
  return new InputFile(INTRO_IMAGE_PATH);
}

export { INTRO_IMAGE_PATH };
