import { locale, t } from '../../src/i18n';

describe('device locale translations', () => {
  it('uses Russian as the Jarvis product language', () => {
    expect(locale).toBe('ru');
  });

  it('returns a translated image generator title', () => {
    expect(t('image.title').length).toBeGreaterThan(0);
  });

  it('interpolates model inventory counts', () => {
    const value = t('models.counts', { text: 1, image: 2, whisper: 3 });
    expect(value).toContain('1');
    expect(value).toContain('2');
    expect(value).toContain('3');
  });
});
