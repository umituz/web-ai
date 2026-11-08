import { describe, expect, it } from 'vitest';
import { buildImageRequest, IMAGE_WIZARD_STEPS } from '../../../src/wizard/image.wizard';
import { buildVideoRequest, VIDEO_WIZARD_STEPS } from '../../../src/wizard/video.wizard';
import { buildContentRequest, CONTENT_WIZARD_STEPS } from '../../../src/wizard/content.wizard';

describe('wizard step definitions', () => {
  it('image, video, and content wizards all define ordered steps with labels', () => {
    for (const steps of [IMAGE_WIZARD_STEPS, VIDEO_WIZARD_STEPS, CONTENT_WIZARD_STEPS]) {
      expect(steps.length).toBeGreaterThan(1);
      for (const step of steps) {
        expect(step.id).toBeTruthy();
        expect(step.label).toBeTruthy();
      }
    }
  });
});

describe('buildImageRequest', () => {
  it('maps wizard data onto an image generation request', () => {
    const request = buildImageRequest({
      prompt: 'a lighthouse at dusk',
      style: 'realistic',
      format: 'square',
      quality: 'high',
    });
    expect(request.type).toBe('image');
    expect(request.prompt).toBe('a lighthouse at dusk');
  });

  it('defaults the prompt when data is incomplete', () => {
    const request = buildImageRequest({});
    expect(request.prompt).toBe('');
  });
});

describe('buildVideoRequest', () => {
  it('builds a text-to-video request', () => {
    const request = buildVideoRequest({
      generationType: 'text-to-video',
      prompt: 'drone flight over mountains',
      duration: 5,
    });
    expect(request.type).toBe('video');
  });

  it('builds an image-to-video request carrying the source image', () => {
    const request = buildVideoRequest({
      generationType: 'image-to-video',
      prompt: 'animate this',
      imageUrl: 'https://cdn.example.com/src.png',
    });
    expect(request.type).toBe('video');
    expect(request).toMatchObject({ imageUrl: 'https://cdn.example.com/src.png', prompt: 'animate this' });
  });

  it('rejects unsupported generation types', () => {
    expect(() =>
      buildVideoRequest({ generationType: 'unknown' as never, prompt: 'x' }),
    ).toThrow(/Unsupported/);
  });
});

describe('buildContentRequest', () => {
  it('builds a blog request with defaults for missing fields', () => {
    const request = buildContentRequest({ contentType: 'blog', topic: 'AI in 2026' });
    expect(request).toMatchObject({ topic: 'AI in 2026' });
  });

  it('builds a social request', () => {
    const request = buildContentRequest({ contentType: 'social', topic: 'launch day' });
    expect(request).toMatchObject({ topic: 'launch day' });
  });

  it('throws for content types the wizard cannot build', () => {
    expect(() =>
      buildContentRequest({ contentType: 'ebook' as never, topic: 'x' }),
    ).toThrow(/Unsupported/);
  });
});
