import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getTelegramBotToken } from '@metrixify/config';

type TelegramGetFileResponse = {
  ok: boolean;
  result?: { file_path?: string };
  description?: string;
};

export async function downloadTelegramVoiceFile(fileId: string): Promise<string> {
  const token = getTelegramBotToken();
  const getFileUrl = `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`;
  const getFileRes = await fetch(getFileUrl);

  if (!getFileRes.ok) {
    throw new Error(`Telegram getFile failed (${getFileRes.status})`);
  }

  const getFileJson = (await getFileRes.json()) as TelegramGetFileResponse;
  if (!getFileJson.ok || !getFileJson.result?.file_path) {
    throw new Error(getFileJson.description ?? 'Telegram getFile returned no file_path');
  }

  const downloadUrl = `https://api.telegram.org/file/bot${token}/${getFileJson.result.file_path}`;
  const audioRes = await fetch(downloadUrl);
  if (!audioRes.ok) {
    throw new Error(`Telegram file download failed (${audioRes.status})`);
  }

  const dir = join(tmpdir(), 'metrixify-voice');
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${randomUUID()}.ogg`);
  const buffer = Buffer.from(await audioRes.arrayBuffer());
  await writeFile(filePath, buffer);
  return filePath;
}

export async function removeTempAudioFile(filePath: string): Promise<void> {
  await rm(filePath, { force: true });
}
