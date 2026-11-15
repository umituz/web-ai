import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFalQueue, falQueueConfigured } from '../../src/providers/fal/queue/fal-queue.client';
import { FalQueueError, type FalQueueEnv } from '../../src/providers/fal/queue/fal-queue.entities';
import {
  buildFalAudioInput,
  buildFalAudioLyrics,
  buildFalImageInput,
  buildFalTagPrompt,
  buildFalVideoInput,
  parseFalAudioOutput,
  parseFalImageOutput,
  parseFalVideoOutput,
} from '../../src/providers/fal/queue/fal-wire';

const ENV: FalQueueEnv = { FAL_KEY: 'fal-test-key' };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('falQueueConfigured', () => {
  it('tracks the FAL_KEY secret', () => {
    expect(falQueueConfigured({})).toBe(false);
    expect(falQueueConfigured({ FAL_KEY: '' })).toBe(false);
    expect(falQueueConfigured(ENV)).toBe(true);
  });
});

describe('createFalQueue', () => {
  it('submits with Key auth and returns the absolute queue URLs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        status: 'IN_QUEUE',
        request_id: 'req-1',
        status_url: 'https://queue.fal.run/fal-ai/flux/schnell/requests/req-1/status',
        response_url: 'https://queue.fal.run/fal-ai/flux/schnell/requests/req-1',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const queue = createFalQueue(ENV);
    const submitted = await queue.submit('fal-ai/flux/schnell', { prompt: 'a lighthouse' });

    expect(submitted).toEqual({
      requestId: 'req-1',
      statusUrl: 'https://queue.fal.run/fal-ai/flux/schnell/requests/req-1/status',
      responseUrl: 'https://queue.fal.run/fal-ai/flux/schnell/requests/req-1',
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://queue.fal.run/fal-ai/flux/schnell');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Key fal-test-key');
    expect(JSON.parse(init.body as string)).toEqual({ prompt: 'a lighthouse' });
  });

  it('GETs the STORED status URL verbatim and flattens logs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        status: 'IN_PROGRESS',
        queue_position: 3,
        logs: [{ message: 'warming up', level: 'info' }, { level: 'info' }, { message: '' }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const snapshot = await createFalQueue(ENV).checkStatus(
      'https://queue.fal.run/some/model/requests/req-1/status',
    );
    expect(snapshot).toEqual({ status: 'IN_PROGRESS', queuePosition: 3, logs: ['warming up'] });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://queue.fal.run/some/model/requests/req-1/status');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });

  it('fetches the STORED response URL after COMPLETED', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ images: [{ url: 'https://fal.media/i.png' }] }));
    vi.stubGlobal('fetch', fetchMock);

    const raw = await createFalQueue(ENV).fetchResult('https://queue.fal.run/x/requests/req-1');
    expect(raw).toEqual({ images: [{ url: 'https://fal.media/i.png' }] });
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe('https://queue.fal.run/x/requests/req-1');
  });

  it('retries exactly once on a 5xx, then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('boom', { status: 502 }))
      .mockResolvedValueOnce(jsonResponse({ status: 'IN_QUEUE', request_id: 'r', status_url: 's', response_url: 'v' }));
    vi.stubGlobal('fetch', fetchMock);

    await createFalQueue(ENV).submit('model', { prompt: 'x' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails with status + body slice on a 4xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"error": "bad input"}', { status: 422 })),
    );
    const err = await createFalQueue(ENV).submit('model', { prompt: 'x' }).catch((e) => e);
    expect(err).toBeInstanceOf(FalQueueError);
    expect(err.status).toBe(422);
    expect(err.message).toContain('fal 422');
    expect(err.message).toContain('bad input');
  });

  it('wraps transport failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network gone')));
    await expect(createFalQueue(ENV).submit('model', { prompt: 'x' })).rejects.toThrow('network gone');
  });

  it('refuses to call fal without the key', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(createFalQueue({}).submit('model', { prompt: 'x' })).rejects.toThrow(
      'fal.ai is not configured',
    );
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});

describe('fal wire — image lane', () => {
  it('flux models map aspectRatio onto fal image_size', () => {
    expect(buildFalImageInput('fal-ai/flux/schnell', { prompt: 'p', numImages: 2, aspectRatio: '16:9' })).toEqual({
      prompt: 'p',
      num_images: 2,
      image_size: 'landscape_16_9',
    });
  });

  it('non-flux models take prompt + num_images only', () => {
    expect(buildFalImageInput('fast-sdxl', { prompt: 'p', numImages: 1, aspectRatio: '16:9' })).toEqual({
      prompt: 'p',
      num_images: 1,
    });
  });

  it('parses the flux {images:[]} shape with dimensions and seed', () => {
    expect(
      parseFalImageOutput({
        images: [{ url: 'https://fal.media/a.png', width: 512 }, { url: 'https://fal.media/b.png', height: 768 }],
        seed: 42,
      }),
    ).toEqual({
      imageUrls: ['https://fal.media/a.png', 'https://fal.media/b.png'],
      seed: 42,
      width: 512,
    });
  });

  it('parses the single-image {image:{url}} shape', () => {
    expect(parseFalImageOutput({ image: { url: 'https://fal.media/one.png' } })).toEqual({
      imageUrls: ['https://fal.media/one.png'],
    });
  });

  it('an empty payload parses to an empty (never null) output', () => {
    expect(parseFalImageOutput({})).toEqual({ imageUrls: [] });
    expect(parseFalImageOutput(null)).toEqual({ imageUrls: [] });
  });
});

describe('fal wire — video lane', () => {
  const klingSpec = {
    durations: [5, 10],
    durationFormat: 'plain' as const,
    aspectRatios: ['16:9', '9:16'],
    supportsNegativePrompt: true,
  };
  const veoSpec = {
    durations: [8],
    durationFormat: 's-suffix' as const,
    resolutions: ['720p', '1080p'],
    supportsNegativePrompt: false,
    generateAudio: true,
  };
  const wanSpec = {
    durations: [5],
    durationFormat: 'none' as const,
    supportsNegativePrompt: false,
  };

  it('kling: plain duration string, aspect, negative prompt', () => {
    expect(
      buildFalVideoInput(klingSpec, {
        prompt: 'p',
        durationSeconds: 5,
        aspectRatio: '16:9',
        negativePrompt: 'blurry',
      }),
    ).toEqual({ prompt: 'p', duration: '5', aspect_ratio: '16:9', negative_prompt: 'blurry' });
  });

  it('veo: s-suffixed duration, resolution, generate_audio', () => {
    expect(
      buildFalVideoInput(veoSpec, { prompt: 'p', durationSeconds: 8, resolution: '1080p' }),
    ).toEqual({ prompt: 'p', duration: '8s', resolution: '1080p', generate_audio: true });
  });

  it('wan: no duration key at all; unsupported params stay off the wire', () => {
    expect(
      buildFalVideoInput(wanSpec, {
        prompt: 'p',
        durationSeconds: 5,
        aspectRatio: '16:9',
        negativePrompt: 'x',
      }),
    ).toEqual({ prompt: 'p' });
  });

  it('i2v rides image_url', () => {
    expect(
      buildFalVideoInput(wanSpec, { prompt: 'p', durationSeconds: 5, imageUrl: 'https://x/i.png' }),
    ).toEqual({ prompt: 'p', image_url: 'https://x/i.png' });
  });

  it('parses {video:{url,…}} and returns null without a usable url', () => {
    expect(parseFalVideoOutput({ video: { url: 'https://fal.media/v.mp4', content_type: 'video/mp4', file_size: 9 } })).toEqual({
      videoUrl: 'https://fal.media/v.mp4',
      contentType: 'video/mp4',
      fileSize: 9,
    });
    expect(parseFalVideoOutput({ video: {} })).toBeNull();
    expect(parseFalVideoOutput({})).toBeNull();
  });
});

describe('fal wire — audio lane', () => {
  const aceSpec = { durations: [30], supportsLyrics: true, supportsInstrumental: true };
  const cassetteSpec = { durations: [30], supportsLyrics: false, supportsInstrumental: false };

  it('buildFalTagPrompt collapses prose to ≤5 keywords >3 chars', () => {
    expect(buildFalTagPrompt('Lofi HIPHOP, chill vibes for studying')).toBe('lofi, hiphop, chill, vibes, studying');
    expect(buildFalTagPrompt('lofi, chill')).toBe('lofi, chill');
    expect(buildFalTagPrompt('a an the and now')).toBe('');
  });

  it('buildFalAudioLyrics: instrumental marker, [verse] wrap, verbatim tags', () => {
    expect(buildFalAudioLyrics({ instrumental: true })).toBe('[inst]');
    expect(buildFalAudioLyrics({ lyrics: '  ' })).toBeUndefined();
    expect(buildFalAudioLyrics({ lyrics: 'la la la' })).toBe('[verse]\nla la la\n[/verse]');
    expect(buildFalAudioLyrics({ lyrics: '[verse]\nla\n[/verse]' })).toBe('[verse]\nla\n[/verse]');
  });

  it('ACE-Step takes tags + lyrics + instrumental; CassetteAI takes tags + duration only', () => {
    expect(
      buildFalAudioInput(aceSpec, {
        prompt: 'Lofi Chill Beats',
        durationSeconds: 30,
        lyrics: 'la la',
        instrumental: false,
      }),
    ).toEqual({ prompt: 'lofi, chill, beats', duration: 30, lyrics: '[verse]\nla la\n[/verse]', instrumental: false });
    expect(
      buildFalAudioInput(cassetteSpec, { prompt: 'Lofi Chill', durationSeconds: 15, lyrics: 'dropped' }),
    ).toEqual({ prompt: 'lofi, chill', duration: 15 });
  });

  it('parseFalAudioOutput walks every observed shape and nulls on none', () => {
    expect(parseFalAudioOutput({ audio_url: { url: 'https://a/1.wav' } })).toEqual({ audioUrl: 'https://a/1.wav' });
    expect(parseFalAudioOutput({ audio_file: { url: 'https://a/2.mp3' } })).toEqual({ audioUrl: 'https://a/2.mp3' });
    expect(parseFalAudioOutput({ audio: { url: 'https://a/3.mp3' } })).toEqual({ audioUrl: 'https://a/3.mp3' });
    expect(parseFalAudioOutput({ audio_url: 'https://a/4.mp3' })).toEqual({ audioUrl: 'https://a/4.mp3' });
    expect(parseFalAudioOutput({ audio: 'https://a/5.mp3' })).toEqual({ audioUrl: 'https://a/5.mp3' });
    expect(parseFalAudioOutput({ nada: true })).toBeNull();
  });
});
