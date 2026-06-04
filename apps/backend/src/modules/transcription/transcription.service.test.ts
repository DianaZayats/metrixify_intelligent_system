import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transcribeVoiceEntry } from './transcription.service.js';

const markSuccess = vi.fn();
const markFailed = vi.fn();
const aiRunCreate = vi.fn();

vi.mock('../entries/entry.repository.js', () => ({
  markEntryTranscriptionSuccess: (...args: unknown[]) => markSuccess(...args),
  markEntryTranscriptionFailed: (...args: unknown[]) => markFailed(...args),
}));

vi.mock('../../shared/db/prisma.js', () => ({
  prisma: {
    aiRun: {
      create: (...args: unknown[]) => aiRunCreate(...args),
    },
  },
}));

describe('transcribeVoiceEntry', () => {
  beforeEach(() => {
    markSuccess.mockReset();
    markFailed.mockReset();
    aiRunCreate.mockReset();
  });

  it('stores transcript and logs ai_run on success', async () => {
    const downloadVoice = vi.fn().mockResolvedValue('/tmp/voice.ogg');
    const removeVoice = vi.fn().mockResolvedValue(undefined);
    const transcribe = {
      transcribeFile: vi.fn().mockResolvedValue({
        text: 'Morning run felt great',
        model: 'whisper-1',
        durationSeconds: 2,
      }),
    };

    const result = await transcribeVoiceEntry(
      {
        entryId: 'entry-1',
        userId: 'user-1',
        fileId: 'file-abc',
        durationSeconds: 12,
      },
      { downloadVoice, removeVoice, transcribe },
    );

    expect(result.transcript).toBe('Morning run felt great');
    expect(markSuccess).toHaveBeenCalledWith('entry-1', 'Morning run felt great');
    expect(markFailed).not.toHaveBeenCalled();
    expect(aiRunCreate).toHaveBeenCalledOnce();
    expect(removeVoice).toHaveBeenCalledWith('/tmp/voice.ogg');
  });

  it('marks entry failed and logs ai_run on error', async () => {
    const downloadVoice = vi.fn().mockResolvedValue('/tmp/voice.ogg');
    const removeVoice = vi.fn().mockResolvedValue(undefined);
    const transcribe = {
      transcribeFile: vi.fn().mockRejectedValue(new Error('Whisper unavailable')),
    };

    await expect(
      transcribeVoiceEntry(
        {
          entryId: 'entry-2',
          userId: 'user-1',
          fileId: 'file-xyz',
          durationSeconds: 5,
        },
        { downloadVoice, removeVoice, transcribe },
      ),
    ).rejects.toThrow('Whisper unavailable');

    expect(markFailed).toHaveBeenCalledWith('entry-2', 'Whisper unavailable');
    expect(aiRunCreate).toHaveBeenCalledOnce();
    expect(removeVoice).toHaveBeenCalledWith('/tmp/voice.ogg');
  });
});
