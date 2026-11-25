/**
 * Offline Russian-to-English visual prompt bridge for Stable Diffusion / Wan video.
 * Pure TypeScript module with zero React Native, store, or native dependencies.
 */

const CYRILLIC_RE = /[а-яёА-ЯЁ]/;
const TOKEN_BOUNDARY = String.raw`(?:^|[\s,.:;!?()"'«»—–-])`;
const TOKEN_END = String.raw`(?=$|[\s,.:;!?()"'«»—–-])`;

const LEADING_MEDIA_PREFIX_RE = new RegExp(
  String.raw`^\s*(?:(?:пожалуйста|пж|можешь|сможешь|сумеешь|джарвис|jarvis|эй|слушай|привет|просто|давай|нужно|надо|хочу)[\s,!.:;-]*)+`,
  'iu',
);

const MEDIA_VERB_OBJECT_RE = new RegExp(
  String.raw`^\s*(?:нарисуй|рисуй|нарисовать|сгенерируй|сгенерировать|генерируй|создай|создать|сделай|сделать|изобрази|изобразить|визуализируй|визуализировать|отрендери|покажи|выдай|анимируй|оживи|сними)(?:\s+(?:мне|нам|пожалуйста|красивую|красивый|красивое|реалистичную|реалистичный|небольшое|короткое))*\s+(?:(?:картинку|картину|изображение|рисунок|фотографию|фото|фотку|арт|иллюстрацию|портрет|пейзаж|обои|аватар|аватарку|логотип|постер|баннер|эскиз|набросок|видео|ролик|клип|анимацию|фильм|гифку|таймлапс)(?:\s+(?:с|на\s+тему|про|где|как|в\s+виде|из|о|об))?\s+)?`,
  'iu',
);

const BARE_MEDIA_VERB_RE = new RegExp(
  String.raw`^\s*(?:нарисуй|рисуй|нарисовать|сгенерируй|сгенерировать|изобрази|визуализируй|отрендери|анимируй|оживи)(?:\s+(?:мне|нам))?\s+`,
  'iu',
);

const PHRASE_MAP: ReadonlyArray<readonly [RegExp, string]> = [
  [/в\s+стиле\s+аниме/giu, 'anime style'],
  [/в\s+стиле\s+киберпанк/giu, 'cyberpunk style'],
  [/в\s+стиле\s+фэнтези/giu, 'fantasy art style'],
  [/в\s+стиле\s+реализма/giu, 'photorealistic'],
  [/фотореалистичн[а-яё]*/giu, 'photorealistic, ultra detailed'],
  [/высокодетализирован[а-яё]*/giu, 'highly detailed'],
  [/высок[а-яё]*\s+качеств[а-яё]*/giu, 'high quality, masterpiece'],
  [/высок[а-яё]*\s+детализац[а-яё]*/giu, 'highly detailed, 8k'],
  [/крупн[а-яё]*\s+план[а-яё]*/giu, 'close-up portrait'],
  [/вид\s+сверху/giu, 'aerial bird eye view'],
  [/вид\s+спереди/giu, 'front view'],
  [/вид\s+сбоку/giu, 'side profile view'],
  [/полн[а-яё]*\s+рост/giu, 'full body'],
  [/ночн[а-яё]*\s+город[а-яё]*/giu, 'night city'],
  [/неонов[а-яё]*\s+огн[а-яё]*/giu, 'neon lights'],
  [/закат[а-яё]*\s+над\s+мор[а-яё]*/giu, 'sunset over the sea'],
  [/звездн[а-яё]*\s+неб[а-яё]*/giu, 'starry night sky'],
  [/звёздн[а-яё]*\s+неб[а-яё]*/giu, 'starry night sky'],
  [/открыт[а-яё]*\s+космос[а-яё]*/giu, 'deep outer space'],
  [/зимн[а-яё]*\s+лес[а-яё]*/giu, 'winter snowy forest'],
  [/осенн[а-яё]*\s+лес[а-яё]*/giu, 'autumn golden forest'],
  [/древн[а-яё]*\s+замок[а-яё]*/giu, 'ancient medieval castle'],
  [/масл[а-яё]*\s+на\s+холст[а-яё]*/giu, 'oil painting on canvas'],
  [/карандашн[а-яё]*\s+рисун[а-яё]*/giu, 'pencil sketch drawing'],
  [/цифров[а-яё]*\s+арт[а-яё]*/giu, 'digital art'],
  [/трехмерн[а-яё]*\s+рендер[а-яё]*/giu, '3d render'],
  [/трёхмерн[а-яё]*\s+рендер[а-яё]*/giu, '3d render'],
  [/мягк[а-яё]*\s+свет[а-яё]*/giu, 'soft lighting'],
  [/кинематографич[а-яё]*\s+свет[а-яё]*/giu, 'cinematic lighting'],
  [/драматич[а-яё]*\s+освещен[а-яё]*/giu, 'dramatic lighting'],
  [/на\s+фоне/giu, 'with background of'],
  [/под\s+дождем|под\s+дождём/giu, 'in the rain'],
  [/в\s+тумане/giu, 'in misty fog'],
  [/в\s+космосе/giu, 'in outer space'],
  [/на\s+пляже/giu, 'on the beach'],
  [/в\s+горах/giu, 'in the mountains'],
  [/в\s+лесу/giu, 'in the forest'],
  [/в\s+городе/giu, 'in the city'],
  [/под\s+водой/giu, 'underwater'],
];

const STEM_GLOSSARY: ReadonlyArray<readonly [string, string]> = [
  ['кот', 'cat'],
  ['кошк', 'cat'],
  ['котен', 'kitten'],
  ['котён', 'kitten'],
  ['собак', 'dog'],
  ['щен', 'puppy'],
  ['пёс', 'dog'],
  ['пес', 'dog'],
  ['волк', 'wolf'],
  ['лис', 'fox'],
  ['медвед', 'bear'],
  ['лев', 'lion'],
  ['тигр', 'tiger'],
  ['пантер', 'black panther'],
  ['лошад', 'horse'],
  ['конь', 'horse'],
  ['кон', 'horse'],
  ['орёл', 'eagle'],
  ['орел', 'eagle'],
  ['птиц', 'bird'],
  ['сов', 'owl'],
  ['ворон', 'raven'],
  ['дракон', 'dragon'],
  ['единорог', 'unicorn'],
  ['феникс', 'phoenix'],
  ['монстр', 'monster'],
  ['демон', 'demon'],
  ['ангел', 'angel'],
  ['робот', 'robot'],
  ['киборг', 'cyborg'],
  ['андроид', 'android'],
  ['астронавт', 'astronaut'],
  ['космонавт', 'astronaut'],
  ['девушк', 'young woman'],
  ['женщин', 'woman'],
  ['мужчин', 'man'],
  ['парен', 'young man'],
  ['парн', 'young man'],
  ['мальчик', 'boy'],
  ['девочк', 'girl'],
  ['ребен', 'child'],
  ['ребён', 'child'],
  ['человек', 'person'],
  ['люд', 'people'],
  ['воин', 'warrior'],
  ['рыцар', 'knight'],
  ['самура', 'samurai'],
  ['ниндз', 'ninja'],
  ['маг', 'wizard'],
  ['волшебн', 'magical wizard'],
  ['ведьм', 'witch'],
  ['корол', 'king'],
  ['королев', 'queen'],
  ['принц', 'prince'],
  ['принцесс', 'princess'],
  ['пират', 'pirate'],
  ['солдат', 'soldier'],
  ['пилот', 'pilot'],
  ['портрет', 'portrait'],
  ['лиц', 'face'],
  ['глаз', 'eyes'],
  ['волос', 'hair'],
  ['улыбк', 'smile'],
  ['город', 'city'],
  ['улиц', 'street'],
  ['мегаполис', 'futuristic metropolis'],
  ['деревн', 'village'],
  ['дом', 'house'],
  ['здани', 'building'],
  ['небоскреб', 'skyscraper'],
  ['небоскрёб', 'skyscraper'],
  ['замок', 'castle'],
  ['дворец', 'palace'],
  ['башн', 'tower'],
  ['храм', 'temple'],
  ['руин', 'ancient ruins'],
  ['мост', 'bridge'],
  ['дорог', 'road'],
  ['окн', 'window'],
  ['комнат', 'room'],
  ['лес', 'forest'],
  ['дерев', 'trees'],
  ['гор', 'mountains'],
  ['скал', 'cliffs'],
  ['вулкан', 'volcano'],
  ['мор', 'sea'],
  ['океан', 'ocean'],
  ['волн', 'ocean waves'],
  ['рек', 'river'],
  ['озер', 'lake'],
  ['озёр', 'lake'],
  ['водопад', 'waterfall'],
  ['пляж', 'beach'],
  ['остров', 'island'],
  ['пустын', 'desert'],
  ['пол', 'field'],
  ['цвет', 'flowers'],
  ['роза', 'rose'],
  ['розы', 'roses'],
  ['сакур', 'cherry blossom'],
  ['неб', 'sky'],
  ['облак', 'clouds'],
  ['солнц', 'sun'],
  ['лун', 'moon'],
  ['звезд', 'stars'],
  ['звёзд', 'stars'],
  ['галактик', 'galaxy'],
  ['туманност', 'nebula'],
  ['планет', 'planet'],
  ['космос', 'outer space'],
  ['рассвет', 'sunrise'],
  ['закат', 'sunset'],
  ['утро', 'morning'],
  ['утр', 'morning'],
  ['день', 'daylight'],
  ['ноч', 'night'],
  ['вечер', 'evening'],
  ['сумерк', 'twilight'],
  ['дожд', 'rain'],
  ['гроз', 'thunderstorm'],
  ['молни', 'lightning'],
  ['снег', 'snow'],
  ['лед', 'ice'],
  ['лёд', 'ice'],
  ['туман', 'fog'],
  ['огон', 'fire'],
  ['плам', 'flames'],
  ['дым', 'smoke'],
  ['машин', 'car'],
  ['автомоб', 'sports car'],
  ['спорткар', 'supercar'],
  ['мотоцикл', 'motorcycle'],
  ['поезд', 'train'],
  ['самолет', 'airplane'],
  ['самолёт', 'airplane'],
  ['вертолет', 'helicopter'],
  ['корабл', 'ship'],
  ['яхт', 'yacht'],
  ['лодк', 'boat'],
  ['ракет', 'rocket'],
  ['звездолет', 'spaceship'],
  ['звездолёт', 'spaceship'],
  ['космическ', 'sci-fi space'],
  ['танк', 'tank'],
  ['меч', 'sword'],
  ['щит', 'shield'],
  ['доспех', 'armor'],
  ['брон', 'armor'],
  ['крыл', 'wings'],
  ['корон', 'crown'],
  ['книг', 'book'],
  ['компьютер', 'computer'],
  ['экран', 'screen'],
  ['телефон', 'phone'],
  ['кофе', 'coffee'],
  ['чашк', 'cup'],
  ['стол', 'table'],
  ['стул', 'chair'],
  ['ламп', 'lamp'],
  ['фонар', 'lantern'],
  ['свеч', 'candle'],
  ['часы', 'clock'],
  ['гитар', 'guitar'],
  ['пианин', 'piano'],
  ['скрипк', 'violin'],
  ['красн', 'red'],
  ['алый', 'crimson red'],
  ['оранжев', 'orange'],
  ['рыж', 'ginger orange'],
  ['желт', 'yellow'],
  ['жёлт', 'yellow'],
  ['золот', 'golden'],
  ['зелен', 'green'],
  ['зелён', 'green'],
  ['изумруд', 'emerald green'],
  ['голуб', 'light blue'],
  ['син', 'deep blue'],
  ['фиолет', 'purple'],
  ['сирен', 'lilac'],
  ['розов', 'pink'],
  ['черн', 'black'],
  ['чёрн', 'black'],
  ['темн', 'dark'],
  ['тёмн', 'dark'],
  ['бел', 'white'],
  ['сер', 'silver gray'],
  ['серебр', 'silver'],
  ['прозрач', 'transparent translucent'],
  ['светл', 'bright light'],
  ['ярк', 'vibrant bright'],
  ['неон', 'neon glowing'],
  ['светящ', 'glowing bioluminescent'],
  ['блестящ', 'shiny glossy'],
  ['красив', 'beautiful'],
  ['прекрасн', 'gorgeous'],
  ['мил', 'cute'],
  ['эпич', 'epic'],
  ['величеств', 'majestic'],
  ['мрачн', 'moody dark gothic'],
  ['таинствен', 'mysterious'],
  ['фантастич', 'sci-fi fantastic'],
  ['фэнтез', 'fantasy'],
  ['футурист', 'futuristic'],
  ['средневеков', 'medieval'],
  ['киберпанк', 'cyberpunk'],
  ['стимпанк', 'steampunk'],
  ['ретро', 'retro vintage'],
  ['винтаж', 'vintage'],
  ['минимал', 'minimalist'],
  ['абстракт', 'abstract'],
  ['сюрреал', 'surreal'],
  ['готик', 'gothic'],
  ['постмодерн', 'postmodern'],
  ['постапокалип', 'post-apocalyptic'],
  ['аниме', 'anime'],
  ['манга', 'manga'],
  ['мульт', '3d cartoon animation'],
  ['пиксар', 'pixar 3d animation style'],
  ['акварел', 'watercolor painting'],
  ['масл', 'oil painting'],
  ['эскиз', 'pencil sketch'],
  ['наброс', 'sketch'],
  ['карандаш', 'pencil drawing'],
  ['граффити', 'graffiti street art'],
  ['комикс', 'comic book art'],
  ['пиксел', 'pixel art'],
  ['полигон', 'low poly 3d'],
  ['реализ', 'realistic'],
  ['реалист', 'photorealistic'],
  ['фотограф', 'photograph'],
  ['фото', 'photo'],
  ['снимок', 'photograph'],
  ['портрет', 'portrait'],
  ['пейзаж', 'landscape'],
  ['натюрморт', 'still life'],
  ['интерьер', 'interior design'],
  ['архитектур', 'architecture'],
  ['логотип', 'minimalist logo design'],
  ['иконк', 'app icon'],
  ['аватар', 'profile avatar portrait'],
  ['обои', 'wallpaper background'],
  ['постер', 'poster art'],
  ['баннер', 'banner'],
  ['макро', 'macro photography'],
  ['боке', 'shallow depth of field bokeh'],
  ['кинематограф', 'cinematic film shot'],
  ['кино', 'cinematic movie still'],
  ['детализ', 'intricate details'],
  ['четк', 'sharp focus'],
  ['чётк', 'sharp focus'],
  ['огромн', 'massive colossal'],
  ['больш', 'large'],
  ['маленьк', 'small tiny'],
  ['молод', 'young'],
  ['стар', 'ancient old'],
  ['бег', 'running'],
  ['бежит', 'running'],
  ['летит', 'flying'],
  ['сидит', 'sitting'],
  ['стоит', 'standing'],
  ['спит', 'sleeping'],
  ['идет', 'walking'],
  ['идёт', 'walking'],
  ['танцу', 'dancing'],
  ['смотрит', 'looking at camera'],
  ['сража', 'fighting in battle'],
  ['горит', 'burning in flames'],
  ['сия', 'glowing shining'],
  ['отраж', 'reflection'],
  ['зим', 'winter'],
  ['летн', 'summer'],
  ['осен', 'autumn'],
  ['весен', 'spring'],
];

const STOPWORDS = new Set([
  'и', 'в', 'во', 'на', 'с', 'со', 'к', 'ко', 'по', 'за', 'от', 'до', 'из',
  'под', 'над', 'перед', 'при', 'про', 'об', 'обо', 'о', 'у', 'для', 'без',
  'или', 'либо', 'но', 'а', 'же', 'ли', 'бы', 'мне', 'нам', 'тебе', 'вам',
  'мой', 'моя', 'мое', 'моё', 'мои', 'свой', 'своя', 'этот', 'эта', 'это',
  'тот', 'очень', 'самый', 'один', 'одна', 'одно', 'как', 'будто', 'словно',
  'где', 'там', 'тут', 'который', 'которая', 'которое', 'чтобы', 'пожалуйста',
]);

const PREPOSITION_GLOSSARY: Readonly<Record<string, string>> = {
  в: 'in',
  во: 'in',
  на: 'on',
  с: 'with',
  со: 'with',
  под: 'under',
  над: 'above',
  возле: 'near',
  рядом: 'beside',
  среди: 'among',
  без: 'without',
  для: 'for',
  через: 'through',
  после: 'after',
  вокруг: 'around',
};

const TRANSLIT_MAP: Readonly<Record<string, string>> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

export function hasCyrillic(text: string): boolean {
  return CYRILLIC_RE.test(text);
}

export function stripRussianMediaCommand(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  let stripped = trimmed;
  stripped = stripped.replace(LEADING_MEDIA_PREFIX_RE, '');
  const afterObject = stripped.replace(MEDIA_VERB_OBJECT_RE, '');
  if (afterObject !== stripped && afterObject.trim().length > 0) {
    return afterObject.trim();
  }
  const afterVerb = stripped.replace(BARE_MEDIA_VERB_RE, '');
  if (afterVerb !== stripped && afterVerb.trim().length > 0) {
    return afterVerb.trim();
  }
  return stripped.trim() || trimmed;
}

function transliterateWord(word: string): string {
  let out = '';
  for (const ch of word.toLowerCase()) {
    out += TRANSLIT_MAP[ch] ?? ch;
  }
  return out;
}

function lookupStem(lowerWord: string): string | null {
  for (const [stem, eng] of STEM_GLOSSARY) {
    if (lowerWord.startsWith(stem)) {
      return eng;
    }
  }
  if (lowerWord in PREPOSITION_GLOSSARY) {
    return PREPOSITION_GLOSSARY[lowerWord];
  }
  if (STOPWORDS.has(lowerWord)) {
    return '';
  }
  return null;
}

/**
 * Translates a Russian visual description into clean ASCII English keywords
 * suitable for SD 1.5 / SDXL CLIP and Wan video prompts without network calls.
 */
export function translateRussianVisualPromptFallback(text: string): string {
  let work = stripRussianMediaCommand(text);
  if (!work) return '';

  // Replace quality tokens like "4к" / "8к" first.
  work = work
    .replace(new RegExp(`${TOKEN_BOUNDARY}4к${TOKEN_END}`, 'giu'), ' 4k')
    .replace(new RegExp(`${TOKEN_BOUNDARY}8к${TOKEN_END}`, 'giu'), ' 8k')
    .replace(new RegExp(`${TOKEN_BOUNDARY}3д${TOKEN_END}`, 'giu'), ' 3d');

  for (const [pattern, replacement] of PHRASE_MAP) {
    work = work.replace(pattern, ` ${replacement} `);
  }

  // Translate remaining Cyrillic tokens word by word while keeping punctuation & Latin tokens intact.
  const tokens = work.split(/(\s+|[,.;:!?/()[\]"'«»]+)/);
  const mapped: string[] = [];
  for (const token of tokens) {
    if (!token) continue;
    if (!hasCyrillic(token)) {
      mapped.push(token);
      continue;
    }
    const lower = token.toLowerCase();
    const hit = lookupStem(lower);
    if (hit !== null) {
      if (hit) mapped.push(hit);
    } else {
      const latin = transliterateWord(lower);
      if (latin) mapped.push(latin);
    }
  }

  const joined = mapped
    .join('')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/,\s*,+/g, ',')
    .replace(/^\s*[,.;:!?]+\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return joined || transliterateWord(work).replace(/\s+/g, ' ').trim();
}

/**
 * Resolves the prompt passed into native image/video engines:
 * prefers LLM-translated non-Cyrillic output when available, otherwise falls
 * back to offline Russian-to-English visual translation when Cyrillic is present.
 */
export function prepareMediaPromptForEngine(
  rawPrompt: string,
  llmTranslated?: string | null,
): string {
  const cleanedRaw = rawPrompt.trim();
  const translated = llmTranslated?.trim();
  if (translated && !hasCyrillic(translated)) {
    return translated;
  }
  if (hasCyrillic(cleanedRaw)) {
    const fallback = translateRussianVisualPromptFallback(cleanedRaw);
    if (fallback) return fallback;
  }
  return cleanedRaw;
}
