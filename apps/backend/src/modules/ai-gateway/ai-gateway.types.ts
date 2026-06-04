export type TranscriptionResult = {
  text: string;
  model: string;
  durationSeconds?: number;
};

export type TranscriptionClient = {
  transcribeFile(filePath: string, model: string): Promise<TranscriptionResult>;
};
