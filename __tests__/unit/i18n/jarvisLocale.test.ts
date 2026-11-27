import {
  isJarvisStandaloneRuntime,
  locale,
  resolveRuntimeLocale,
  t,
  tForLocale,
} from '../../../src/i18n';

const en = require('../../../src/i18n/en.json') as Record<string, string>;
const ru = require('../../../src/i18n/ru.json') as Record<string, string>;

describe('Jarvis Ai i18n and runtime locale', () => {
  it('forces Russian locale for standalone app builds and detects OS locale in tests', () => {
    expect(isJarvisStandaloneRuntime).toBe(false);
    expect(resolveRuntimeLocale(false)).toBe('ru');
    expect(['en', 'ru']).toContain(resolveRuntimeLocale(true));
    expect(['en', 'ru']).toContain(locale);
  });

  it('resolves Russian translations and interpolates variables without Off Grid branding', () => {
    expect(tForLocale('ru', 'app.name')).toBe('Jarvis Ai');
    expect(tForLocale('ru', 'app.proName')).toBe('Jarvis Ai Pro');
    expect(tForLocale('ru', 'nav.home')).toBe('Главная');
    expect(tForLocale('ru', 'nav.models')).toBe('Модели');
    expect(tForLocale('ru', 'gallery.imagesTab', { count: 7 })).toBe('Картинки (7)');
    expect(tForLocale('en', 'app.name')).toBe('Off Grid AI');
    expect(t('nav.home')).toBe('Home');
  });

  it('falls back to key string when key does not exist', () => {
    expect(tForLocale('ru', 'non.existent.key')).toBe('non.existent.key');
  });

  it('maintains complete key parity and clean Russian branding between en and ru JSONs', () => {
    const enKeys = Object.keys(en).sort();
    const ruKeys = Object.keys(ru).sort();
    expect(ruKeys).toEqual(enKeys);
    for (const key of enKeys) {
      expect(ru[key].trim().length).toBeGreaterThan(0);
      expect(/off\s*grid\s*ai|offgridmobile\.ai|getoffgridai\.co/i.test(ru[key])).toBe(
        false,
      );
    }
  });
});
