'use strict';
/* ============================================================
   ОСНОВНАЯ ЛОГИКА «Испанский каждый день» — версия 2.1
   Правки против 2.0:
   - графики рисуются в контейнерах с фиксированной высотой
     (chart-box) — исправлен бесконечный рост страницы;
   - в Telegram добавляется отступ сверху (класс in-telegram),
     чтобы контент не уходил под системную шапку;
   - убран мёртвый вспомогательный код.
   ============================================================ */

// ---------- Telegram WebApp: безопасная обёртка ----------
const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;

function tgInit() {
  if (!tg) return;
  try { tg.ready(); tg.expand(); } catch (e) { /* в браузере не нужно */ }
}
function hapticLight() { try { if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light'); } catch (e) {} }
function hapticSuccess() { try { if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success'); } catch (e) {} }
function hapticError() { try { if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error'); } catch (e) {} }

function tgConfirm(question, onYes) {
  if (tg && typeof tg.showConfirm === 'function') {
    try { tg.showConfirm(question, function (ok) { if (ok) onYes(); }); return; } catch (e) {}
  }
  if (window.confirm(question)) onYes();
}

let mainBtnCb = null;
function tgMainButtonShow(text, cb) {
  if (!tg || !tg.MainButton) return false;
  try {
    mainBtnCb = cb;
    if (!tg._mbBound) {
      tg.MainButton.onClick(function () { if (mainBtnCb) mainBtnCb(); });
      tg._mbBound = true;
    }
    tg.MainButton.setText(text);
    tg.MainButton.show();
    return true;
  } catch (e) { return false; }
}
function tgMainButtonHide() {
  if (tg && tg.MainButton) { try { tg.MainButton.hide(); } catch (e) {} }
  mainBtnCb = null;
}

// ---------- Константы ----------
const DAY_MS = 86400000;
const STORAGE_KEY = 'spanishApp.v1';
const INTERVALS = [1, 3, 7, 16, 35];   // лестница интервалов, дней (interval = индекс ступени)
const MAINTENANCE_DAYS = 75;           // период обслуживания выученных
const SESSION_SIZE = 10;               // максимум базовых карточек в сессии
const NEW_LIMIT_DEFAULT = 5;

const TYPES = ['word', 'verb', 'phrase', 'rule'];
const TYPE_LABELS = { word: 'Слова', verb: 'Глаголы', phrase: 'Выражения', rule: 'Правила' };

// Разрешённые форматы по типам записей
const FORMATS_BY_TYPE = {
  word: ['choice_es_ru', 'choice_ru_es', 'type_translation', 'recall', 'build_phrase', 'fill_gap'],
  verb: ['choice_es_ru', 'choice_ru_es', 'type_translation', 'recall', 'build_phrase', 'fill_gap', 'conjugation'],
  phrase: ['choice_es_ru', 'recall', 'build_phrase', 'fill_gap'],
  rule: ['rule_theory', 'rule_choice']
};
const EASY_FORMATS = ['choice_es_ru', 'recall'];
const HARD_FORMATS = ['type_translation', 'build_phrase', 'fill_gap', 'conjugation'];

const FORMAT_LABELS = {
  choice_es_ru: 'исп → рус (выбор)',
  choice_ru_es: 'рус → исп (выбор)',
  type_translation: 'впиши перевод',
  recall: 'вспомни сам',
  build_phrase: 'собери фразу',
  fill_gap: 'впиши пропущенное',
  conjugation: 'спряжение',
  rule_theory: 'теория правила',
  rule_choice: 'вопрос по правилу'
};

const FORM_KEYS = ['yo', 'tu', 'el', 'nosotros', 'vosotros', 'ellos'];
const PRONOUN_LABELS = { yo: 'yo', tu: 'tú', el: 'él', nosotros: 'nosotros', vosotros: 'vosotros', ellos: 'ellos' };

const SPEAK_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor"/><path d="M16.5 8.5a4.5 4.5 0 0 1 0 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

// Промт-шаблон для импорта через ИИ-чат (кнопка «Скопировать промт для ИИ»)
const PROMPT_TEMPLATE = [
  'Ты — редактор словаря для приложения изучения испанского. Ниже я дам сырой список испанских слов, глаголов, выражений и правил в произвольном формате (из учебника, статьи, таблицы или просто списком).',
  '',
  'Твоя задача — превратить его в JSON-массив для моего приложения.',
  '',
  'ШАГ 1. Определи ТИП каждой записи по критериям:',
  '- "verb" — спрягаемое действие или состояние в инфинитиве (hablar, ir, tener, ser);',
  '- "phrase" — устойчивое сочетание из 2+ слов, смысл которого не выводится из компонентов, или бытовой оборот (tener hambre, ¿qué tal?, echar de menos);',
  '- "rule" — формулировка грамматического правила (ser vs estar, согласование прилагательных, времена);',
  '- "word" — всё остальное (отдельные существительные, прилагательные, наречия).',
  '',
  'ШАГ 2. Для КАЖДОЙ записи заполни поля:',
  '- "es" — слово/выражение/глагол в инфинитиве/название правила на испанском, как в моём списке;',
  '- "ru" — перевод на русский; если перевода в списке нет — подбери самый частотный сам;',
  '- "tr" — примерное чтение кириллицей по правилам испанского произношения;',
  '- "ex" — короткий пример употребления на испанском: простое предложение уровня A1–A2, ОБЯЗАТЕЛЬНО содержащее "es" целиком (для правила — два коротких примера через точку);',
  '- "type" — тип из шага 1;',
  '- "priority" — число от 1 до 10 по частотности: самые частотные — 9-10, средние — 5-7, редкие — 1-4.',
  '',
  'ШАГ 3. Для записей с type "verb" добавь поле "forms" — объект с формами presente для шести лиц, с учётом неправильных форм, без сокращений:',
  '"forms": { "yo": "...", "tu": "...", "el": "...", "nosotros": "...", "vosotros": "...", "ellos": "..." }',
  'Пример для tener: { "yo": "tengo", "tu": "tienes", "el": "tiene", "nosotros": "tenemos", "vosotros": "tenéis", "ellos": "tienen" }.',
  'Для записей других типов поле forms НЕ добавляй.',
  '',
  'ШАГ 4. Для записей с type "rule" добавь:',
  '- "ruleText" — формулировка правила простыми словами, 2–4 предложения, с примерами;',
  '- "ruleQuestions" — массив из 2–3 объектов: { "q": "вопрос по правилу", "options": ["верный вариант", "дистрактор", "дистрактор", "дистрактор"], "correct": 0 }',
  'В каждом вопросе ровно 4 варианта, ровно один верный (correct — его ИНДЕКС в options, 0–3; верный не обязан быть первым — расставляй варианты вразброс). Дистракторы — правдоподобные типичные ошибки.',
  'Для записей других типов эти поля НЕ добавляй.',
  '',
  'ШАГ 5. Ответ должен быть ТОЛЬКО JSON-массивом. Первый символ ответа — [, последний — ].',
  'Никакого текста до или после, никаких пояснений, никаких markdown-обёрток, никаких фраз вроде «вот ваш JSON».',
  'Не пропускай записи из моего списка и не добавляй слова от себя. Мусор (номера страниц, пометки, повторы заголовков) игнорируй.',
  'Если список пуст или по нему невозможно составить записи, ответь ровно одной строкой: НЕ ПОНЯЛ СПИСОК',
  '',
  'Образец формата (поля id, status, interval, nextShow, errors, correct НЕ добавляй — приложение проставит их само):',
  '[{"es":"casa","ru":"дом","tr":"коса","ex":"Mi casa es pequeña.","type":"word","priority":9},{"es":"tener","ru":"иметь","tr":"тэнэр","ex":"Tengo un perro.","type":"verb","priority":10,"forms":{"yo":"tengo","tu":"tienes","el":"tiene","nosotros":"tenemos","vosotros":"tenéis","ellos":"tienen"}},{"es":"Ser vs Estar","ru":"Различие ser и estar","tr":"сэр versus эстар","ex":"Soy estudiante. Estoy en casa.","type":"rule","priority":9,"ruleText":"Ser — для постоянных признаков, estar — для состояний и мест.","ruleQuestions":[{"q":"Как сказать «Я дома»?","options":["Estoy en casa","Soy en casa","Estoy a casa","Soy casa"],"correct":0}]}]',
  '',
  'Мой список:'
].join('\n');

// ---------- Состояние ----------
let db = null;
let session = null;
let charts = { activity: null, status: null };
let currentPeriod = 'week';
let addType = 'word'; // выбранный тип при ручном добавлении

// ---------- Мелкие утилиты ----------
function el(id) { return document.getElementById(id); }

function todayStr(date) {
  const d = date ? new Date(date) : new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function yesterdayStr() { return todayStr(Date.now() - DAY_MS); }

function uid() { return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// nextShow хранится как ISO-строка; пустая строка = не запланировано
function isoNow(offsetDays) {
  const d = new Date(Date.now() + (offsetDays || 0) * DAY_MS);
  return d.toISOString();
}
function nextShowTime(w) {
  if (!w.nextShow) return Infinity;
  const t = Date.parse(w.nextShow);
  return isNaN(t) ? Infinity : t;
}
function isDue(w) {
  const t = nextShowTime(w);
  return t !== Infinity && t <= Date.now();
}

function normalizeKey(s) { return String(s).toLowerCase().replace(/\s+/g, ' ').trim(); }

// Прощающее сравнение: регистр, «ё»=«е», пунктуация, ударения
function normalizeAnswer(s) {
  return String(s).toLowerCase()
    .replace(/[áà]/g, 'a').replace(/[éè]/g, 'e').replace(/[íì]/g, 'i')
    .replace(/[óò]/g, 'o').replace(/[úùü]/g, 'u')
    .replace(/ё/g, 'е')
    .replace(/[.,!?;:"«»¿¡()\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Разбиение примера на плитки (токены)
function phraseTokens(ex) {
  return String(ex).trim().split(/\s+/).filter(Boolean);
}
// Нормализация токена для сравнения порядка (регистр и пунктуация не важны)
function normToken(t) { return normalizeAnswer(t); }

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function randomOf(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ---------- Тост ----------
let toastTimer = null;
function toast(msg) {
  const t = el('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2800);
}

// ---------- Хранилище ----------
const FORMAT_KEYS_ALL = Object.keys(FORMAT_LABELS);

function emptyCounter(keys) {
  const o = {};
  keys.forEach(function (k) { o[k] = { t: 0, c: 0 }; });
  return o;
}

function defaultProgress() {
  return {
    streak: 0,
    lastStudyDay: '',
    learnedToday: { date: todayStr(), n: 0 },
    history: {},
    formats: emptyCounter(FORMAT_KEYS_ALL),
    types: emptyCounter(TYPES),
    settings: { appsScriptUrl: '', chatId: '', newLimit: NEW_LIMIT_DEFAULT, lastExport: 0, bannerHiddenDay: '', typeFilter: 'all' }
  };
}

// Запись в формате v2 из стартового объекта
function toAppRecord(src) {
  return {
    id: src.id,
    es: src.es, ru: src.ru,
    tr: src.tr || '', ex: src.ex || '',
    type: TYPES.indexOf(src.type) !== -1 ? src.type : 'word',
    status: 'new',
    interval: 0,          // индекс ступени лестницы
    nextShow: '',         // ISO-строка; '' = не запланировано
    priority: clampPriority(src.priority),
    errors: 0, correct: 0,
    streakC: 0,           // внутренний счётчик верных подряд (для −1 приоритета)
    forms: src.forms || null,
    ruleText: src.ruleText || '',
    ruleQuestions: Array.isArray(src.ruleQuestions) ? src.ruleQuestions : []
  };
}
function clampPriority(p) {
  const n = parseInt(p, 10);
  if (isNaN(n)) return 5;
  return Math.max(1, Math.min(10, n));
}

function createStarterDB() {
  return {
    words: STARTER_SET.map(toAppRecord),
    progress: defaultProgress(),
    v: 2
  };
}

function loadDB() {
  let raw = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { console.warn('localStorage недоступен', e); }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const first = parsed && Array.isArray(parsed.words) && parsed.words[0];
      // Совместимость: старый формат не имеет поля type — сознательный сброс
      if (first && typeof first === 'object' && !('type' in first)) {
        try { localStorage.removeItem(STORAGE_KEY); } catch (e2) {}
        db = createStarterDB();
        saveDB();
        toast('Механика обновлена, прогресс и база сброшены');
        return;
      }
      if (parsed && Array.isArray(parsed.words)) {
        db = {
          words: parsed.words.map(sanitizeRecord),
          progress: sanitizeProgress(parsed.progress),
          v: 2
        };
        return;
      }
    } catch (e) {
      console.error('Битые данные в localStorage, начинаю с чистой базы', e);
    }
  }
  db = createStarterDB();
  saveDB();
  toast('Привет! Загружен стартовый набор: 235 записей.');
}

// Гарантия всех полей у записи (защита от бэкапов с пропусками)
function sanitizeRecord(w) {
  const rec = toAppRecord(w);
  rec.status = ['new', 'learning', 'learned'].indexOf(w.status) !== -1 ? w.status : 'new';
  rec.interval = (typeof w.interval === 'number' && w.interval >= 0 && w.interval < INTERVALS.length) ? w.interval : 0;
  rec.nextShow = typeof w.nextShow === 'string' && w.nextShow ? w.nextShow
    : (typeof w.nextShow === 'number' && w.nextShow ? new Date(w.nextShow).toISOString() : '');
  rec.errors = typeof w.errors === 'number' ? w.errors : 0;
  rec.correct = typeof w.correct === 'number' ? w.correct : 0;
  rec.streakC = typeof w.streakC === 'number' ? w.streakC : 0;
  if (rec.type === 'verb' && w.forms) {
    const f = {};
    FORM_KEYS.forEach(function (k) { f[k] = typeof w.forms[k] === 'string' ? w.forms[k] : ''; });
    rec.forms = f;
  }
  if (rec.type === 'rule') {
    rec.ruleText = typeof w.ruleText === 'string' ? w.ruleText : '';
    rec.ruleQuestions = sanitizeQuestions(w.ruleQuestions);
  }
  return rec;
}

// Валидация вопросов правила: q — строка, options — ровно 4 строки, correct — 0..3
function sanitizeQuestions(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  list.forEach(function (q) {
    if (!q || typeof q.q !== 'string' || !q.q.trim()) return;
    if (!Array.isArray(q.options) || q.options.length !== 4) return;
    if (!q.options.every(function (o) { return typeof o === 'string' && o.trim(); })) return;
    const c = parseInt(q.correct, 10);
    if (isNaN(c) || c < 0 || c > 3) return;
    out.push({ q: q.q, options: q.options.slice(), correct: c });
  });
  return out;
}

function sanitizeProgress(p) {
  const base = defaultProgress();
  if (!p || typeof p !== 'object') return base;
  const merged = Object.assign(base, p);
  merged.settings = Object.assign({}, base.settings, p.settings || {});
  merged.formats = Object.assign(emptyCounter(FORMAT_KEYS_ALL), p.formats || {});
  merged.types = Object.assign(emptyCounter(TYPES), p.types || {});
  merged.history = (p.history && typeof p.history === 'object') ? p.history : {};
  return merged;
}

function saveDB() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }
  catch (e) { toast('Не удалось сохранить данные: хранилище недоступно'); }
}

// ---------- Навигация ----------
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(function (s) { s.classList.add('hidden'); });
  const scr = el('screen-' + name);
  if (scr) scr.classList.remove('hidden');
  document.querySelectorAll('.tab').forEach(function (t) {
    t.classList.toggle('active', t.dataset.screen === name);
  });
  tgMainButtonHide();
  if (name === 'settings') { renderSettings(); tgMainButtonShow('Сохранить', saveSettings); }
  if (name === 'home') renderHome();
  if (name === 'stats') renderStats();
  if (name === 'words') renderWords();
  window.scrollTo(0, 0);
}

function bindNav() {
  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      const name = t.dataset.screen;
      if (name === 'train') { startStudy(); return; } // вкладка «Учить» сразу начинает тренировку
      showScreen(name);
    });
  });
}

// ---------- Главный экран ----------
function renderHome() {
  const learned = db.words.filter(function (w) { return w.status === 'learned'; }).length;
  el('home-learned').textContent = learned;
  el('home-queue').textContent = countQueueNow();
  el('home-streak').textContent = db.progress.streak || 0;

  let t = 0, c = 0;
  for (let i = 0; i < 7; i++) {
    const h = db.progress.history[todayStr(Date.now() - i * DAY_MS)];
    if (h) { t += h.a; c += h.c; }
  }
  el('home-accuracy').textContent = t ? Math.round(c / t * 100) + '%' : '–';

  const filter = db.progress.settings.typeFilter || 'all';
  const pool = filter === 'all' ? db.words : db.words.filter(function (w) { return w.type === filter; });
  el('home-session-hint').textContent = countDueIn(pool)
    ? 'Готово к показу: ' + countDueIn(pool) + ' записей'
    : 'Расписание пусто — добавь новые записи';
  el('home-empty').style.display = db.words.length ? 'none' : 'block';

  maybeShowExportBanner();
}

// Сколько записей пула готовы к показу (просроченные + доступные новые)
function countDueIn(pool) {
  return pool.filter(function (w) {
    return (w.status === 'new') || (w.status !== 'new' && isDue(w));
  }).length;
}

function countQueueNow() {
  return countDueIn(db.words);
}

function countLearnedToday() {
  const lt = db.progress.learnedToday;
  return (lt && lt.date === todayStr()) ? lt.n : 0;
}

// ---------- Баннер «делай бэкап раз в неделю» ----------
function maybeShowExportBanner() {
  const need = db.words.length > 0 &&
    Date.now() - (db.progress.settings.lastExport || 0) > 7 * DAY_MS &&
    db.progress.settings.bannerHiddenDay !== todayStr();
  el('export-banner').classList.toggle('hidden', !need);
}

// ---------- Приоритет ----------
// Ошибка +1 (макс 10); каждые 3 верных подряд −1 (мин 1). Подсказка не влияет.
function bumpPriority(word, correct, hinted) {
  if (hinted) return;
  if (!correct) {
    word.priority = Math.min(10, word.priority + 1);
    word.streakC = 0;
    return;
  }
  word.streakC++;
  if (word.streakC % 3 === 0) word.priority = Math.max(1, word.priority - 1);
}

// ---------- Сборка сессии ----------
// Фильтр типа: 'all' или один из TYPES
function typePool() {
  const f = db.progress.settings.typeFilter || 'all';
  if (f === 'all') return db.words;
  return db.words.filter(function (w) { return w.type === f; });
}

// Основная сборка: просроченные (learning + обслуживание learned) + новые по приоритету
function buildRegularSession() {
  const pool = typePool();
  const due = pool.filter(function (w) {
    return w.status === 'learning' && isDue(w);
  });
  const maintenance = pool.filter(function (w) {
    return w.status === 'learned' && isDue(w);
  });
  const scheduled = due.concat(maintenance);
  // Приоритет: выше — первее; при равенстве — у кого раньше nextShow
  scheduled.sort(function (a, b) {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return nextShowTime(a) - nextShowTime(b);
  });
  const chosen = scheduled.slice(0, SESSION_SIZE);

  // Новые: до лимита, в остаток от 10, по убыванию priority
  const newLimit = db.progress.settings.newLimit || NEW_LIMIT_DEFAULT;
  const slots = Math.min(newLimit, SESSION_SIZE - chosen.length);
  if (slots > 0) {
    const fresh = pool.filter(function (w) { return w.status === 'new'; });
    fresh.sort(function (a, b) { return b.priority - a.priority; });
    for (let i = 0; i < fresh.length && chosen.length < SESSION_SIZE && i < slots; i++) chosen.push(fresh[i]);
  }
  if (!chosen.length) return null;
  return assembleSession(chosen, false);
}

// Сессия из готового списка (худшие записи, досрочный повтор)
function buildListSession(list, premature) {
  if (!list || !list.length) return null;
  return assembleSession(list.slice(0, 20), premature);
}

// Досрочный повтор: случайные выученные
function buildPrematureSession() {
  const learned = db.words.filter(function (w) { return w.status === 'learned'; });
  if (!learned.length) return null;
  return buildListSession(shuffle(learned), true);
}

// Назначение форматов и перемешивание
function assembleSession(records, premature) {
  const items = records.map(function (w) {
    return { word: w, mode: pickFormatFor(w), forced: '', hardMode: '' };
  });
  session = {
    items: shuffle(items),
    idx: 0, answered: 0, correct: 0, learnedCount: 0,
    premature: !!premature
  };
  return session;
}

// Формат для записи при сборке сессии:
// первый показ (new) — всегда лёгкий; для правил — rule_theory; иначе случайный разрешённый
function pickFormatFor(word) {
  if (word.type === 'rule') {
    if (word.status === 'new') return 'rule_theory';
    return hasValidQuestions(word) ? 'rule_choice' : 'rule_theory';
  }
  if (word.status === 'new') return randomOf(EASY_FORMATS);
  return randomOf(allowedFormats(word));
}

// Разрешённые форматы с учётом наличия данных (смягчение, не поломка)
function allowedFormats(word) {
  if (word.type === 'rule') {
    return hasValidQuestions(word) ? ['rule_choice'] : ['rule_theory'];
  }
  let list = (FORMATS_BY_TYPE[word.type] || FORMATS_BY_TYPE.word).filter(function (f) {
    return formatAvailable(word, f);
  });
  if (!list.length) list = ['recall'];
  return list;
}

function formatAvailable(word, f) {
  switch (f) {
    case 'build_phrase': {
      if (!word.ex) return false;
      const n = phraseTokens(word.ex).length;
      return n >= 2 && n <= 8;
    }
    case 'fill_gap':
      return !!word.ex && !!word.es &&
        word.ex.toLowerCase().indexOf(word.es.toLowerCase()) !== -1;
    case 'conjugation':
      return word.type === 'verb' && !!word.forms &&
        FORM_KEYS.every(function (k) { return word.forms[k]; });
    case 'type_translation':
    case 'choice_es_ru':
    case 'choice_ru_es':
      return !!word.ru && !!word.es;
    default:
      return true;
  }
}

function hasValidQuestions(word) {
  return sanitizeQuestions(word.ruleQuestions).length > 0;
}

// ---------- Старт тренировки ----------
function startStudy() {
  showScreen('train');
  if (session) { renderCard(); return; } // сессия уже идёт
  const s = buildRegularSession();
  if (!s) {
    renderNothingToTrain();
    return;
  }
  renderCard();
}

function renderNothingToTrain() {
  el('train-progress').textContent = '';
  el('train-bar-fill').style.width = '0%';
  el('train-area').innerHTML =
    '<div class="card"><h3>Тренировать нечего</h3>' +
    '<p class="hint">Все записи выучены, ждут своего дня или база пуста. Новые слова — во вкладках «Слова» и «Импорт».</p>' +
    '<button class="btn-secondary" id="btn-premature" style="margin-top:12px">Повторить выученные досрочно</button></div>';
  const b = el('btn-premature');
  if (b) {
    b.addEventListener('click', function () {
      const s = buildPrematureSession();
      if (s) renderCard();
      else toast('Выученных записей пока нет');
    });
  }
}

// ---------- Рендер карточки ----------
function renderCard() {
  const item = session.items[session.idx];
  el('train-progress').textContent =
    'Карточка ' + (session.idx + 1) + ' из ' + session.items.length + ' · ' + FORMAT_LABELS[item.mode];
  el('train-bar-fill').style.width = Math.round(session.idx / session.items.length * 100) + '%';

  const area = el('train-area');
  area.innerHTML = '';
  if (item.mode === 'choice_es_ru' || item.mode === 'choice_ru_es') renderChoiceCard(area, item);
  else if (item.mode === 'type_translation') renderTypeCard(area, item);
  else if (item.mode === 'recall') renderRecallCard(area, item);
  else if (item.mode === 'build_phrase') renderBuildCard(area, item);
  else if (item.mode === 'fill_gap') renderGapCard(area, item);
  else if (item.mode === 'conjugation') renderConjCard(area, item);
  else if (item.mode === 'rule_theory') renderRuleTheoryCard(area, item);
  else if (item.mode === 'rule_choice') renderRuleChoiceCard(area, item);
  else renderRecallCard(area, item);
}

// Карточка выбора из 4 вариантов (исп→рус или рус→исп)
function renderChoiceCard(area, item) {
  const w = item.word;
  const field = item.mode === 'choice_es_ru' ? 'ru' : 'es';
  const front = item.mode === 'choice_es_ru' ? w.es : w.ru;
  const options = buildOptions(w, field);
  if (options.length < 2) { item.mode = 'recall'; renderRecallCard(area, item); return; }

  const card = document.createElement('div');
  card.className = 'word-card pop';
  let html = '<div class="word-mode">' + FORMAT_LABELS[item.mode] + '</div>';
  html += '<div class="word-front">' + esc(front) + '</div>';
  if (item.mode === 'choice_es_ru' && w.tr) html += '<div class="word-tr">' + esc(w.tr) + '</div>';
  if (item.mode === 'choice_es_ru') html += '<button class="speak-btn" id="speak" aria-label="Озвучить">' + SPEAK_ICON + '</button>';
  card.innerHTML = html;
  area.appendChild(card);

  const opts = document.createElement('div');
  opts.className = 'options';
  options.forEach(function (opt) {
    const b = document.createElement('button');
    b.className = 'option';
    b.textContent = opt;
    b.addEventListener('click', function () { submitChoice(item, opt); });
    opts.appendChild(b);
  });
  area.appendChild(opts);
  const sp = el('speak');
  if (sp) sp.addEventListener('click', function () { speak(w.es); });
}

function submitChoice(item, chosen) {
  const correct = item.mode === 'choice_es_ru' ? item.word.ru : item.word.es;
  const ok = normalizeKey(chosen) === normalizeKey(correct);
  document.querySelectorAll('.option').forEach(function (b) {
    b.disabled = true;
    if (normalizeKey(b.textContent) === normalizeKey(correct)) b.style.borderColor = 'var(--ok)';
    else if (b.textContent === chosen && !ok) b.style.borderColor = 'var(--err)';
  });
  finishAnswer(item, ok, { hinted: false });
}

// Умные дистракторы: по убыванию похожести
function buildOptions(word, field) {
  const correct = word[field];
  const correctKey = normalizeKey(correct);
  // Пул: сначала того же типа; если мало — все записи (смягчение критерия)
  let pool = db.words.filter(function (w) {
    return w.id !== word.id && w[field] &&
      w.type === word.type && normalizeKey(w[field]) !== correctKey;
  });
  if (pool.length < 3) {
    pool = db.words.filter(function (w) {
      return w.id !== word.id && w[field] && normalizeKey(w[field]) !== correctKey;
    });
  }
  // Скоринг: ошибочные > похожие > тот же тип > случай
  const scored = pool.map(function (w) {
    let s = Math.random() * 0.9; // база случайности
    if (w.errors > 0) s += 4;                             // 1. записи с ошибками
    s += similarity(w[field], correct);                    // 2. похожесть
    if (w.type === word.type) s += 1.5;                    // 3. тот же тип
    return { v: w[field], s: s };
  });
  scored.sort(function (a, b) { return b.s - a.s; });
  const out = [];
  const seen = {};
  seen[correctKey] = true;
  for (let i = 0; i < scored.length && out.length < 3; i++) {
    const k = normalizeKey(scored[i].v);
    if (seen[k]) continue;
    seen[k] = true;
    out.push(scored[i].v);
  }
  return shuffle([correct].concat(out));
}

// Похожесть: первая буква, окончание, близкая длина
function similarity(a, b) {
  const A = normalizeKey(a), B = normalizeKey(b);
  if (!A || !B) return 0;
  let s = 0;
  if (A[0] === B[0]) s += 2;
  if (A.length >= 2 && B.length >= 2 && A.slice(-2) === B.slice(-2)) s += 2;
  if (Math.abs(A.length - B.length) <= 2) s += 1;
  return s;
}

// Карточка «впиши перевод»
function renderTypeCard(area, item) {
  const w = item.word;
  const card = document.createElement('div');
  card.className = 'word-card pop';
  card.innerHTML =
    '<div class="word-mode">' + FORMAT_LABELS.type_translation + '</div>' +
    '<div class="word-front">' + esc(w.ru) + '</div>';
  area.appendChild(card);
  renderInputBlock(area, item, w.es, 'Впиши перевод на испанском');
}

// Карточка «впиши пропущенное слово»
function renderGapCard(area, item) {
  const w = item.word;
  const re = new RegExp(w.es.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const masked = w.ex.replace(re, '___');
  const card = document.createElement('div');
  card.className = 'word-card pop';
  card.innerHTML =
    '<div class="word-mode">' + FORMAT_LABELS.fill_gap + '</div>' +
    '<div class="word-front" style="font-size:20px">' + esc(masked) + '</div>' +
    '<div class="word-sub">Пропущено: «' + esc(w.ru) + '»</div>';
  area.appendChild(card);
  renderInputBlock(area, item, w.es, 'Впиши пропущенное слово');
}

// Карточка спряжения
function renderConjCard(area, item) {
  const w = item.word;
  const person = randomOf(FORM_KEYS);
  item.person = person; // фиксируем форму на показ карточки
  const card = document.createElement('div');
  card.className = 'word-card pop';
  card.innerHTML =
    '<div class="word-mode">' + FORMAT_LABELS.conjugation + '</div>' +
    '<div class="word-front">' + esc(w.es) + '</div>' +
    '<div class="word-sub">местоимение: <b>' + esc(PRONOUN_LABELS[person]) + '</b></div>';
  area.appendChild(card);
  renderInputBlock(area, item, w.forms[person], 'Впиши форму presente');
}

// Общий блок ручного ввода: поле, «Ответить», «Открыть букву»
function renderInputBlock(area, item, answer, placeholder) {
  const form = document.createElement('div');
  form.id = 'input-form';

  const hintLine = document.createElement('div');
  hintLine.className = 'hint-line';
  hintLine.textContent = '​'; // невидимый символ, чтобы блок имел высоту
  form.appendChild(hintLine);

  const inp = document.createElement('input');
  inp.id = 'input-answer';
  inp.placeholder = placeholder;
  inp.autocomplete = 'off';
  form.appendChild(inp);

  let hintLen = 0;
  const hintBtn = document.createElement('button');
  hintBtn.className = 'btn-secondary';
  hintBtn.textContent = 'Открыть букву';
  hintBtn.addEventListener('click', function () {
    if (hintLen < answer.length) {
      hintLen++;
      hintLine.textContent = answer.slice(0, hintLen) + '•'.repeat(answer.length - hintLen);
      item.hinted = true;
      hapticLight();
    }
  });
  form.appendChild(hintBtn);

  const btn = document.createElement('button');
  btn.className = 'btn-primary';
  btn.textContent = 'Ответить';
  form.appendChild(btn);

  area.appendChild(form);

  inp.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); submitInput(item); }
  });
  btn.addEventListener('click', function () { submitInput(item); });
  try { inp.focus(); } catch (e) {}
}

function submitInput(item) {
  const val = el('input-answer').value;
  if (!val.trim()) { toast('Сначала впиши ответ'); return; }
  const answer = item.mode === 'conjugation' ? item.word.forms[item.person] : item.word.es;
  const ok = answersMatch(val, answer);
  finishAnswer(item, ok, { hinted: !!item.hinted && ok });
}

// Прощающее сравнение: варианты через запятую/точку с запятой засчитываются по отдельности
function answersMatch(input, es) {
  const a = normalizeAnswer(input);
  if (!a) return false;
  const variants = String(es).split(/[,;/]/).map(normalizeAnswer);
  return variants.indexOf(a) !== -1;
}

// Карточка «показал → вспомнил / не вспомнил»
function renderRecallCard(area, item) {
  const w = item.word;
  const card = document.createElement('div');
  card.className = 'word-card pop';
  card.innerHTML =
    '<div class="word-mode">' + FORMAT_LABELS.recall + '</div>' +
    '<div class="word-front">' + esc(w.es) + '</div>' +
    (w.tr ? '<div class="word-tr">' + esc(w.tr) + '</div>' : '') +
    '<div id="self-answer" class="hidden"><div class="fb-answer" style="margin-top:14px">' + esc(w.ru) + '</div></div>' +
    '<div><button class="speak-btn" aria-label="Озвучить">' + SPEAK_ICON + '</button></div>';
  area.appendChild(card);
  card.querySelector('.speak-btn').addEventListener('click', function () { speak(w.es); });

  const btns = document.createElement('div');
  btns.className = 'options';
  const show = document.createElement('button');
  show.className = 'btn-secondary';
  show.textContent = 'Показать перевод';
  show.addEventListener('click', function () {
    const ans = el('self-answer');
    if (ans) ans.classList.remove('hidden');
    show.classList.add('hidden');
    const known = document.createElement('button');
    known.className = 'option';
    known.textContent = 'Вспомнил';
    known.addEventListener('click', function () { finishAnswer(item, true, { hinted: false }); });
    const unknown = document.createElement('button');
    unknown.className = 'option';
    unknown.textContent = 'Не вспомнил';
    unknown.addEventListener('click', function () { finishAnswer(item, false, { hinted: false }); });
    btns.appendChild(known); btns.appendChild(unknown);
  });
  btns.appendChild(show);
  area.appendChild(btns);
}

// Карточка «собери фразу» из перемешанных плиток
function renderBuildCard(area, item) {
  const w = item.word;
  const tokens = phraseTokens(w.ex);
  const order = shuffle(tokens.map(function (t, i) { return { t: t, i: i }; }));

  const card = document.createElement('div');
  card.className = 'word-card pop';
  card.innerHTML =
    '<div class="word-mode">' + FORMAT_LABELS.build_phrase + '</div>' +
    '<div class="word-sub" style="margin-top:0">Перевод: «' + esc(w.ru) + '»</div>' +
    '<div class="build-slots" id="build-slots"><span class="slot-empty">Нажимай слова в правильном порядке</span></div>' +
    '<div class="build-tokens" id="build-tokens"></div>' +
    '<button class="btn-ghost" id="build-reset" style="margin-top:10px">Сбросить</button>';
  area.appendChild(card);

  const slots = el('build-slots');
  const tokensBox = el('build-tokens');
  const chosen = [];

  function refresh() {
    slots.innerHTML = '';
    if (!chosen.length) {
      slots.innerHTML = '<span class="slot-empty">Нажимай слова в правильном порядке</span>';
    } else {
      chosen.forEach(function (c) {
        const s = document.createElement('span');
        s.className = 'tile-in-slot';
        s.textContent = c.t;
        slots.appendChild(s);
      });
    }
    order.forEach(function (o) {
      const tile = document.getElementById('tile-' + o.i);
      if (tile) tile.classList.toggle('used', chosen.some(function (c) { return c.i === o.i; }));
    });
    if (chosen.length === order.length) {
      // Автопроверка: сравниваем нормализованные последовательности
      const built = chosen.map(function (c) { return normToken(c.t); }).join(' ');
      const right = tokens.map(normToken).join(' ');
      finishAnswer(item, built === right, { hinted: false, builtOrder: tokens });
    }
  }

  order.forEach(function (o) {
    const b = document.createElement('button');
    b.className = 'tile';
    b.id = 'tile-' + o.i;
    b.textContent = o.t;
    b.addEventListener('click', function () {
      if (chosen.length === order.length) return;
      chosen.push(o);
      refresh();
    });
    tokensBox.appendChild(b);
  });

  el('build-reset').addEventListener('click', function () {
    chosen.length = 0;
    refresh();
  });
}

// Карточка теории правила (первый показ)
function renderRuleTheoryCard(area, item) {
  const w = item.word;
  const card = document.createElement('div');
  card.className = 'word-card pop';
  card.innerHTML =
    '<div class="word-mode">' + FORMAT_LABELS.rule_theory + '</div>' +
    '<div class="word-front" style="font-size:22px">' + esc(w.es) + '</div>' +
    '<div class="rule-text">' + esc(w.ruleText || 'Правило без описания.') + '</div>' +
    (w.ex ? '<div class="fb-ex" style="margin-top:10px">' + esc(w.ex) + '</div>' : '') +
    '<button class="btn-primary" id="rule-ok" style="margin-top:16px">Понятно</button>';
  area.appendChild(card);
  el('rule-ok').addEventListener('click', function () {
    finishAnswer(item, true, { hinted: false });
  });
}

// Карточка вопроса по правилу
function renderRuleChoiceCard(area, item) {
  const w = item.word;
  const qs = sanitizeQuestions(w.ruleQuestions);
  if (!qs.length) { item.mode = 'rule_theory'; renderRuleTheoryCard(area, item); return; }
  const q = randomOf(qs);

  const card = document.createElement('div');
  card.className = 'word-card pop';
  card.innerHTML =
    '<div class="word-mode">' + FORMAT_LABELS.rule_choice + '</div>' +
    '<div class="word-front" style="font-size:20px">' + esc(q.q) + '</div>' +
    '<div class="rule-text">' + esc(w.ruleText || '') + '</div>';
  area.appendChild(card);

  const opts = document.createElement('div');
  opts.className = 'options';
  q.options.forEach(function (opt, i) {
    const b = document.createElement('button');
    b.className = 'option';
    b.textContent = opt;
    b.addEventListener('click', function () {
      const ok = i === q.correct;
      document.querySelectorAll('.option').forEach(function (x) { x.disabled = true; });
      finishAnswer(item, ok, { hinted: false, ruleQ: q });
    });
    opts.appendChild(b);
  });
  area.appendChild(opts);
}

// ---------- Общая точка: применяем результат и показываем фидбек ----------
function finishAnswer(item, ok, extra) {
  extra = extra || {};
  session.answered++;
  if (ok) session.correct++;
  applyAnswer(item.word, item.mode, ok, extra);
  if (ok) hapticSuccess(); else hapticError();
  showFeedback(item, ok, extra);
}

// Обновление записи и статистики после ответа
function applyAnswer(word, format, correct, extra) {
  const p = db.progress;
  const today = todayStr();
  const hinted = !!extra.hinted;

  // Стрик: дни подряд
  if (p.lastStudyDay !== today) {
    p.streak = (p.lastStudyDay === yesterdayStr()) ? (p.streak || 0) + 1 : 1;
    p.lastStudyDay = today;
  }

  // История по дням: активность, точность, по форматам и типам
  const h = p.history[today] || (p.history[today] = { a: 0, c: 0, f: {}, tp: {} });
  h.a++;
  if (correct) h.c++;
  const hf = h.f[format] || (h.f[format] = { t: 0, c: 0 });
  hf.t++; if (correct) hf.c++;
  const ht = h.tp[word.type] || (h.tp[word.type] = { t: 0, c: 0 });
  ht.t++; if (correct) ht.c++;

  // Агрегаты за всё время
  const pf = p.formats[format] || (p.formats[format] = { t: 0, c: 0 });
  pf.t++; if (correct) pf.c++;
  const pt = p.types[word.type] || (p.types[word.type] = { t: 0, c: 0 });
  pt.t++; if (correct) pt.c++;

  // Личная статистика записи
  word.errors += correct ? 0 : 1;
  word.correct += correct ? 1 : 0;

  // Приоритет: ошибка +1, три верных подряд −1 (подсказка не влияет)
  bumpPriority(word, correct, hinted);

  if (session.premature) {
    // Досрочный повтор выученных: верный ответ ничего не меняет,
    // ошибка возвращает запись на лестницу
    if (correct) {
      scheduleReturn(word, format, true);
      return;
    }
    word.status = 'learning';
    word.interval = 0;
    word.nextShow = isoNow(0);
    scheduleReturn(word, format, false);
    saveDB();
    return;
  }

  if (correct) {
    if (hinted) {
      // Подсказанный ответ: лестница не двигается, следующий показ — завтра
      word.nextShow = isoNow(1);
      scheduleReturn(word, format, true);
      saveDB();
      return;
    }
    if (word.status === 'learned') {
      // Обслуживание: верно — следующий показ через 75 дней
      word.nextShow = isoNow(MAINTENANCE_DAYS);
      scheduleReturn(word, format, true);
      saveDB();
      return;
    }
    // Подъём по лестнице интервалов
    if (word.interval >= INTERVALS.length - 1) {
      // Верный ответ на последней ступени — выучено
      word.status = 'learned';
      word.nextShow = isoNow(MAINTENANCE_DAYS);
      const lt = p.learnedToday;
      p.learnedToday = (lt && lt.date === today) ? lt : { date: today, n: 0 };
      p.learnedToday.n++;
      session.learnedCount++;
    } else {
      word.interval++;
      word.status = 'learning';
      word.nextShow = isoNow(INTERVALS[word.interval]);
    }
    scheduleReturn(word, format, true);
    saveDB();
    return;
  }

  // Ошибка: сброс на старт лестницы + возврат в сессию (fading)
  word.interval = 0;
  word.status = 'learning';
  word.nextShow = isoNow(0);
  scheduleReturn(word, format, false);
  saveDB();
}

// Вставка возврата в сессию через одну карточку.
// fading: верно в лёгком-возврате после ошибки в сложном — снова сложный формат;
// ошибка — возврат в лёгком; верно без fade-истории — запись уходит.
function scheduleReturn(word, format, wasCorrect) {
  const item = session.items[session.idx];
  if (!item || item.word.id !== word.id) return; // защита от рассинхрона

  if (!wasCorrect) {
    // Ошибка (в любом формате) → возврат в лёгком формате.
    // Если ошибка была в сложном — запоминаем его для fade-возврата.
    const hard = HARD_FORMATS.indexOf(format) !== -1 ? format : (item.hardMode || '');
    session.items.splice(session.idx + 1, 0, {
      word: word,
      mode: randomOf(EASY_FORMATS),
      forced: 'easy',
      hardMode: hard
    });
    return;
  }

  // Верный ответ
  if (item.forced === 'easy' && item.hardMode) {
    // Возврат после ошибки в сложном: верно в лёгком → снова сложный формат
    session.items.splice(session.idx + 1, 0, {
      word: word,
      mode: item.hardMode,
      forced: 'hard',
      hardMode: ''
    });
  }
  // В остальных случаях верный ответ уводит запись (nextShow в будущем) — без вставки
}

// ---------- Фидбек ----------
function showFeedback(item, ok, extra) {
  extra = extra || {};
  const w = item.word;
  const area = el('train-area');
  const old = el('feedback-panel');
  if (old) old.remove();

  const fb = document.createElement('div');
  fb.className = 'feedback pop ' + (ok ? 'ok' : 'err');
  fb.id = 'feedback-panel';
  let html = '<div class="fb-title">' + (ok ? 'Верно!' : 'Неверно') + '</div>';
  if (extra.hinted) html += '<div class="fb-hinted">ответ с подсказкой — ступень не изменилась, повтор завтра</div>';

  if (item.mode === 'conjugation') {
    html += '<div class="fb-answer">' + esc(PRONOUN_LABELS[item.person]) + ': ' + esc(w.forms[item.person]) + '</div>';
    if (!ok) {
      // Таблица всех шести форм при ошибке
      html += '<div class="forms-table">';
      FORM_KEYS.forEach(function (k) {
        html += '<div class="forms-cell"><b>' + esc(PRONOUN_LABELS[k]) + '</b>' + esc(w.forms[k]) + '</div>';
      });
      html += '</div>';
    }
  } else if (item.mode === 'rule_theory') {
    html += '<div class="fb-answer">' + esc(w.es) + '</div>';
  } else if (item.mode === 'rule_choice') {
    const q = extra.ruleQ;
    if (q) html += '<div class="fb-answer">' + esc(q.options[q.correct]) + '</div>';
    if (w.ruleText) html += '<div class="rule-text">' + esc(w.ruleText) + '</div>';
  } else if (item.mode === 'build_phrase') {
    html += '<div class="fb-answer">' + esc(w.ex) + '</div>';
    if (!ok && extra.builtOrder) {
      html += '<div class="fb-order">Правильный порядок: ' + esc(extra.builtOrder.join(' ')) + '</div>';
    }
    html += '<div class="fb-tr">' + esc(w.ru) + '</div>';
  } else {
    html += '<div class="fb-answer">' + esc(w.es) + ' — ' + esc(w.ru) + '</div>';
    if (w.tr) html += '<div class="fb-tr">' + esc(w.tr) + '</div>';
  }
  if (w.ex && item.mode !== 'build_phrase') html += '<div class="fb-ex">' + esc(w.ex) + '</div>';
  html += '<button class="btn-primary" id="btn-next">Дальше</button>';
  fb.innerHTML = html;

  const sp = document.createElement('button');
  sp.className = 'speak-btn';
  sp.setAttribute('aria-label', 'Озвучить');
  sp.innerHTML = SPEAK_ICON;
  sp.addEventListener('click', function () { speak(w.es); });
  fb.insertBefore(sp, fb.querySelector('#btn-next'));

  area.appendChild(fb);
  fb.querySelector('#btn-next').addEventListener('click', nextCard);
  fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function nextCard() {
  session.idx++;
  if (session.idx >= session.items.length) endSession();
  else renderCard();
}

// Завершение сессии: итоги + отправка сводки боту
function endSession() {
  const answered = session.answered;
  const correct = session.correct;
  const learnedCount = session.learnedCount;
  const acc = answered ? Math.round(correct / answered * 100) : 0;
  session = null;

  // Fire-and-forget: ошибки сети здесь не критичны
  sendSummaryToBot(countLearnedToday(), countQueueNow());

  el('train-progress').textContent = 'Готово';
  el('train-bar-fill').style.width = '100%';
  el('train-area').innerHTML =
    '<div class="word-card pop"><h3 style="margin-bottom:8px">Сессия завершена</h3>' +
    '<p class="hint">Ответов: ' + answered + ' · верных: ' + correct + ' (' + acc + '%)' +
    (learnedCount ? '<br>Новых выученных записей: ' + learnedCount : '') + '</p>' +
    '<button class="btn-primary" id="btn-again" style="margin-top:14px">Ещё раз</button>' +
    '<button class="btn-secondary" id="btn-tohome" style="margin-top:10px">На главную</button></div>';
  el('btn-again').addEventListener('click', function () { session = null; startStudy(); });
  el('btn-tohome').addEventListener('click', function () { session = null; showScreen('home'); });
  hapticSuccess();
}

// GET-запрос на Apps Script со сводкой (не ждём ответа)
function sendSummaryToBot(learned, queue) {
  const s = db.progress.settings;
  if (!s.appsScriptUrl || !s.chatId) return;
  try {
    const url = s.appsScriptUrl +
      (s.appsScriptUrl.indexOf('?') === -1 ? '?' : '&') +
      'chat_id=' + encodeURIComponent(s.chatId) +
      '&learned=' + encodeURIComponent(learned) +
      '&queue=' + encodeURIComponent(queue);
    fetch(url).catch(function () { /* сводка не критична */ });
  } catch (e) { /* игнорируем */ }
}

// ---------- Статистика ----------
function renderStats() {
  renderActivityChart();
  renderStatusChart();
  renderTypeCards();
  renderFormatsAccuracy();
  renderWorstWords();
}

function periodDays() { return currentPeriod === 'week' ? 7 : currentPeriod === 'month' ? 30 : 0; }

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// Точность за период: из истории по дням; «всё время» — из агрегатов
function periodCounter(kind, key) {
  const days = periodDays();
  if (!days) {
    const agg = kind === 'formats' ? db.progress.formats[key] : db.progress.types[key];
    return Object.assign({ t: 0, c: 0 }, agg || { t: 0, c: 0 });
  }
  let t = 0, c = 0;
  for (let i = 0; i < days; i++) {
    const h = db.progress.history[todayStr(Date.now() - i * DAY_MS)];
    if (!h) continue;
    const bucket = kind === 'formats' ? h.f : h.tp;
    const v = bucket && bucket[key];
    if (v) { t += v.t; c += v.c; }
  }
  return { t: t, c: c };
}

// График активности по дням.
// Рисуется в chart-box с фиксированной высотой — без этого Chart.js
// растягивает canvas под высоту карточки, а карточка под canvas:
// страница уходит вниз бесконечно. Контейнер разрывает эту петлю.
function renderActivityChart() {
  const canvas = el('chart-activity');
  const box = el('chart-activity-box');
  const empty = el('activity-empty');
  let labels = [], values = [];
  const days = periodDays();

  if (days) {
    for (let i = days - 1; i >= 0; i--) {
      const key = todayStr(Date.now() - i * DAY_MS);
      const h = db.progress.history[key];
      labels.push(key.slice(5)); // «10-20» вместо полной даты
      values.push(h ? h.a : 0);
    }
  } else {
    Object.keys(db.progress.history).sort().forEach(function (k) {
      labels.push(k.slice(5));
      values.push(db.progress.history[k].a);
    });
  }

  const total = values.reduce(function (s, v) { return s + v; }, 0);
  if (charts.activity) { charts.activity.destroy(); charts.activity = null; }
  if (!total) {
    empty.classList.remove('hidden');
    box.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  box.classList.remove('hidden');

  charts.activity = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{ label: 'Ответов', data: values, backgroundColor: cssVar('--accent', '#8A7CFF'), borderRadius: 6 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: cssVar('--muted', '#8C93AD'), maxRotation: 0, autoSkip: true }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: cssVar('--muted', '#8C93AD'), precision: 0 }, grid: { color: 'rgba(128,128,128,0.15)' } }
      }
    }
  });
}

// Кольцевая диаграмма статусов — тоже в фиксированном контейнере
function renderStatusChart() {
  const canvas = el('chart-status');
  const box = el('chart-status-box');
  if (charts.status) { charts.status.destroy(); charts.status = null; }
  const learned = db.words.filter(function (w) { return w.status === 'learned'; }).length;
  const learning = db.words.filter(function (w) { return w.status === 'learning'; }).length;
  const fresh = db.words.filter(function (w) { return w.status === 'new'; }).length;
  if (!learned && !learning && !fresh) {
    box.classList.add('hidden');
    return;
  }
  box.classList.remove('hidden');

  charts.status = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Выучено', 'Изучается', 'Новые'],
      datasets: [{
        data: [learned, learning, fresh],
        backgroundColor: ['#4ADE80', cssVar('--accent', '#8A7CFF'), '#3A4358'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: { legend: { position: 'bottom', labels: { color: cssVar('--muted', '#8C93AD'), boxWidth: 14 } } }
    }
  });
}

// Карточки по типам: выучено / в процессе / новых / точность за период
function renderTypeCards() {
  const box = el('types-grid');
  let html = '';
  TYPES.forEach(function (t) {
    const list = db.words.filter(function (w) { return w.type === t; });
    const learned = list.filter(function (w) { return w.status === 'learned'; }).length;
    const learning = list.filter(function (w) { return w.status === 'learning'; }).length;
    const fresh = list.filter(function (w) { return w.status === 'new'; }).length;
    const acc = periodCounter('types', t);
    const pct = acc.t ? Math.round(acc.c / acc.t * 100) + '%' : '–';
    html += '<div class="type-card">' +
      '<div class="type-card-title">' + TYPE_LABELS[t] + '</div>' +
      '<div class="type-card-line"><span>выучено</span><span>' + learned + '</span></div>' +
      '<div class="type-card-line"><span>в процессе</span><span>' + learning + '</span></div>' +
      '<div class="type-card-line"><span>новых</span><span>' + fresh + '</span></div>' +
      '<div class="type-card-acc">точность: ' + pct + ' · ' + acc.t + ' отв.</div>' +
      '</div>';
  });
  box.innerHTML = html;
}

// Точность по всем 9 форматам за период
function renderFormatsAccuracy() {
  const box = el('formats-accuracy');
  let html = '';
  FORMAT_KEYS_ALL.forEach(function (f) {
    const a = periodCounter('formats', f);
    const pct = a.t ? Math.round(a.c / a.t * 100) : null;
    html += '<div class="fmt-row">' +
      '<div class="fmt-row-top"><span>' + FORMAT_LABELS[f] + '</span><span>' +
      (pct === null ? 'нет данных' : pct + '% · ' + a.t + ' отв.') + '</span></div>' +
      '<div class="fmt-bar"><div class="fmt-bar-fill" style="width:' + (pct || 0) + '%"></div></div></div>';
  });
  box.innerHTML = html;
}

// Худшие записи: топ-8 по числу ошибок
function renderWorstWords() {
  const box = el('worst-words');
  const btn = el('btn-train-worst');
  const list = db.words.filter(function (w) { return w.errors > 0; })
    .sort(function (a, b) { return b.errors - a.errors || a.correct - b.correct; })
    .slice(0, 8);

  if (!list.length) {
    box.innerHTML = '<p class="hint">Ошибок пока не зафиксировано.</p>';
    btn.classList.add('hidden');
    return;
  }
  let html = '';
  list.forEach(function (w) {
    html += '<div class="worst-row"><div>' +
      '<div class="worst-es">' + esc(w.es) + '</div>' +
      '<div class="worst-ru">' + esc(w.ru) + ' · ' + esc(TYPE_LABELS[w.type] || w.type) + '</div></div>' +
      '<div class="worst-num">' + w.errors + ' из ' + (w.errors + w.correct) + '</div></div>';
  });
  box.innerHTML = html;
  btn.classList.remove('hidden');
  btn.onclick = function () {
    buildListSession(list, false);
    if (session) { showScreen('train'); renderCard(); }
  };
}

// ---------- Слова ----------
function renderWords() {
  const q = normalizeKey(el('word-search').value || '');
  const list = el('words-list');
  const sorted = db.words.slice().sort(function (a, b) { return (a.added || 0) - (b.added || 0); });
  let shown = 0;
  let html = '';
  sorted.forEach(function (w) {
    if (q && normalizeKey(w.es).indexOf(q) === -1 && normalizeKey(w.ru).indexOf(q) === -1) return;
    shown++;
    const badge = w.status === 'learned'
      ? '<span class="badge learned">выучено</span>'
      : w.status === 'learning'
        ? '<span class="badge learning">изучается</span>'
        : '<span class="badge">новое</span>';
    const typeBadge = '<span class="badge type">' + esc(TYPE_LABELS[w.type] || w.type) + '</span>';
    html += '<div class="word-row">' +
      '<div class="word-row-main"><div class="word-row-es">' + esc(w.es) + '</div>' +
      '<div class="word-row-ru">' + esc(w.ru) + (w.tr ? ' · ' + esc(w.tr) : '') + '</div></div>' +
      typeBadge + badge +
      '<button class="word-del" data-id="' + esc(w.id) + '" aria-label="Удалить">×</button></div>';
  });
  list.innerHTML = html;
  el('words-count').textContent = 'Всего записей: ' + db.words.length + ' · показано: ' + shown;
  list.querySelectorAll('.word-del').forEach(function (b) {
    b.addEventListener('click', function () { deleteWord(b.dataset.id); });
  });
}

function deleteWord(id) {
  const w = db.words.find(function (x) { return x.id === id; });
  if (!w) return;
  tgConfirm('Удалить «' + w.es + '»?', function () {
    db.words = db.words.filter(function (x) { return x.id !== id; });
    saveDB();
    renderWords();
    toast('Запись удалена');
  });
}

function addWord() {
  const msg = el('add-msg');
  msg.className = 'form-msg';
  const es = el('add-es').value.trim();
  const ru = el('add-ru').value.trim();
  if (!es || !ru) {
    msg.classList.add('err');
    msg.textContent = 'Заполни хотя бы слово и перевод.';
    return;
  }
  const key = normalizeKey(es);
  if (db.words.some(function (w) { return normalizeKey(w.es) === key; })) {
    msg.classList.add('err');
    msg.textContent = 'Такая запись уже есть в базе.';
    return;
  }
  const rec = toAppRecord({
    id: uid(), es: es, ru: ru,
    tr: el('add-tr').value.trim(), ex: el('add-ex').value.trim(),
    type: addType, priority: 5
  });
  db.words.push(rec);
  saveDB();
  el('add-es').value = ''; el('add-ru').value = ''; el('add-tr').value = ''; el('add-ex').value = '';
  msg.classList.add('ok');
  msg.textContent = 'Добавлено: «' + es + '» (' + TYPE_LABELS[addType].toLowerCase() + ', приоритет 5).';
  renderWords();
  hapticSuccess();
}

// ---------- Импорт и бэкап ----------
// Импорт JSON: массив записей или объект { words: [...] }
function importWords(text) {
  const report = el('import-report');
  report.className = 'form-msg';
  if (!text.trim()) {
    report.classList.add('err');
    report.textContent = 'Вставь JSON в поле выше.';
    return;
  }
  let data;
  try { data = JSON.parse(text); }
  catch (e) {
    report.classList.add('err');
    report.textContent = 'Это не цельный JSON. Проверь, что скопирован весь массив, от [ до ].';
    return;
  }
  const list = Array.isArray(data) ? data : (data && Array.isArray(data.words) ? data.words : null);
  if (!list) {
    report.classList.add('err');
    report.textContent = 'Нужен массив записей вида [{"es":"...","ru":"...","type":"word"}].';
    return;
  }

  const existing = {};
  db.words.forEach(function (w) { existing[normalizeKey(w.es)] = true; });
  let added = 0, skipped = 0;

  list.forEach(function (item) {
    if (!item || typeof item !== 'object') { skipped++; return; }
    const es = typeof item.es === 'string' ? item.es.trim() : '';
    const ru = typeof item.ru === 'string' ? item.ru.trim() : '';
    const type = TYPES.indexOf(item.type) !== -1 ? item.type : null;
    if (!es || !ru || !type) { skipped++; return; } // битая запись: нет es/ru/type
    if (type === 'rule' && !(typeof item.ruleText === 'string' && item.ruleText.trim())) { skipped++; return; }
    const key = normalizeKey(es);
    if (existing[key]) { skipped++; return; } // дубликат по es

    const rec = toAppRecord({
      id: uid(), es: es, ru: ru,
      tr: typeof item.tr === 'string' ? item.tr.trim() : '',
      ex: typeof item.ex === 'string' ? item.ex.trim() : '',
      type: type,
      priority: item.priority
    });
    if (type === 'rule') {
      rec.ruleText = item.ruleText.trim();
      rec.ruleQuestions = sanitizeQuestions(item.ruleQuestions);
    }
    db.words.push(rec);
    existing[key] = true;
    added++;
  });

  saveDB();
  if (added) el('import-json').value = '';
  report.classList.add(added ? 'ok' : 'err');
  report.textContent = 'Добавлено: ' + added + '. Пропущено: ' + skipped + ' (дубликаты, битые записи, правила без текста).';
  if (added) toast('Добавлено записей: ' + added);
}

// Копирование промта: сначала Clipboard API, при отказе — запасной способ
function copyPrompt() {
  const msg = el('import-report');
  const done = function (ok) {
    msg.className = 'form-msg ' + (ok ? 'ok' : 'err');
    msg.textContent = ok
      ? 'Промт скопирован. Открой любой ИИ-чат, вставь его и сразу после него — свой список слов.'
      : 'Автокопирование не сработало — выдели и скопируй текст промта вручную.';
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(PROMPT_TEMPLATE).then(function () { done(true); }, function () { done(fallbackCopy()); });
  } else {
    done(fallbackCopy());
  }
}

function fallbackCopy() {
  try {
    const ta = document.createElement('textarea');
    ta.value = PROMPT_TEMPLATE;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}

// Экспорт всей базы и прогресса в файл
function exportAll() {
  try {
    db.progress.settings.lastExport = Date.now();
    saveDB();
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'spanish-backup-' + todayStr() + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('Файл бэкапа сохранён в загрузки');
    maybeShowExportBanner();
  } catch (e) {
    toast('Не удалось создать файл бэкапа');
  }
}

// Восстановление из файла бэкапа (формат v2)
function restoreBackup() {
  const input = el('import-backup-file');
  const msg = el('restore-msg');
  msg.className = 'form-msg';
  const file = input.files && input.files[0];
  if (!file) {
    msg.classList.add('err');
    msg.textContent = 'Сначала выбери файл бэкапа.';
    return;
  }
  const reader = new FileReader();
  reader.onload = function () {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.words)) throw new Error('нет массива words');
      if (!data.words.length) throw new Error('файл пуст');
      const first = data.words[0];
      if (!first || typeof first !== 'object' || !('type' in first)) {
        throw new Error('это бэкап старого формата — он несовместим');
      }
      tgConfirm('Заменить текущую базу и прогресс содержимым файла?', function () {
        db = {
          words: data.words.map(sanitizeRecord),
          progress: sanitizeProgress(data.progress),
          v: 2
        };
        saveDB();
        renderHome();
        msg.classList.add('ok');
        msg.textContent = 'База восстановлена: ' + db.words.length + ' записей.';
        toast('Бэкап восстановлен');
      });
    } catch (e) {
      msg.classList.add('err');
      msg.textContent = 'Файл не похож на бэкап приложения (' + e.message + ').';
    }
    input.value = '';
  };
  reader.onerror = function () {
    msg.classList.add('err');
    msg.textContent = 'Не удалось прочитать файл.';
  };
  reader.readAsText(file);
}

// ---------- Настройки ----------
function renderSettings() {
  el('set-url').value = db.progress.settings.appsScriptUrl || '';
  el('set-chat').value = db.progress.settings.chatId || '';
  document.querySelectorAll('#newlimit-chips button').forEach(function (b) {
    b.classList.toggle('active', String(db.progress.settings.newLimit) === b.dataset.limit);
  });
}

function saveSettings() {
  const msg = el('settings-msg');
  msg.className = 'form-msg';
  const url = el('set-url').value.trim();
  const chat = el('set-chat').value.trim();
  if (url && url.indexOf('https://') !== 0) {
    msg.classList.add('err');
    msg.textContent = 'URL должен начинаться с https://';
    return;
  }
  if (chat && !/^\d+$/.test(chat)) {
    msg.classList.add('err');
    msg.textContent = 'chat_id — это число, например 123456789.';
    return;
  }
  db.progress.settings.appsScriptUrl = url;
  db.progress.settings.chatId = chat;
  saveDB();
  msg.classList.add('ok');
  msg.textContent = 'Сохранено.';
  toast('Настройки сохранены');
}

// Тест связи: Apps Script пришлёт сообщение в чат с ботом
function testConnection() {
  const msg = el('settings-msg');
  msg.className = 'form-msg';
  const url = db.progress.settings.appsScriptUrl;
  const chat = db.progress.settings.chatId;
  if (!url || !chat) {
    msg.classList.add('err');
    msg.textContent = 'Сначала заполни и сохрани URL и chat_id.';
    return;
  }
  msg.textContent = 'Отправляю запрос...';
  fetch(url + (url.indexOf('?') === -1 ? '?' : '&') + 'chat_id=' + encodeURIComponent(chat) + '&test=1')
    .then(function () {
      msg.classList.add('ok');
      msg.textContent = 'Запрос ушёл. Загляни в чат с ботом — там должно появиться тестовое сообщение.';
    })
    .catch(function () {
      msg.classList.add('err');
      msg.textContent = 'Не получилось связаться. Проверь URL деплоя (он должен заканчиваться на /exec).';
    });
}

// ---------- Озвучка (синтез речи браузера) ----------
function speak(text) {
  try {
    if (!('speechSynthesis' in window)) { toast('Озвучка не поддерживается этим браузером'); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES';
    u.rate = 0.9;
    const voices = window.speechSynthesis.getVoices();
    for (let i = 0; i < voices.length; i++) {
      if (voices[i].lang && voices[i].lang.toLowerCase().indexOf('es') === 0) { u.voice = voices[i]; break; }
    }
    window.speechSynthesis.speak(u);
  } catch (e) { toast('Озвучка не сработала'); }
}

// ---------- Тема Telegram ----------
// Тёмная тема — наша по умолчанию. Светлую системную тему Telegram
// подставляем через CSS-переменные.
function applyTheme() {
  if (!tg || !tg.themeParams) return;
  try {
    if (tg.colorScheme !== 'light') return;
    const p = tg.themeParams;
    const root = document.documentElement.style;
    if (p.bg_color) root.setProperty('--bg', p.bg_color);
    if (p.secondary_bg_color) root.setProperty('--card', p.secondary_bg_color);
    if (p.bg_color) root.setProperty('--card-2', p.bg_color);
    if (p.text_color) root.setProperty('--text', p.text_color);
    if (p.hint_color) root.setProperty('--muted', p.hint_color);
    const sep = p.section_separator_color || p.separator_color;
    if (sep) root.setProperty('--line', sep);
  } catch (e) { /* оставляем тёмную тему */ }
}

// ---------- Привязка всех кнопок ----------
function bindAll() {
  el('btn-start-train').addEventListener('click', function () { session = null; startStudy(); });
  el('btn-exit-train').addEventListener('click', function () { session = null; showScreen('home'); });
  el('btn-add-word').addEventListener('click', addWord);
  el('word-search').addEventListener('input', renderWords);
  el('btn-import').addEventListener('click', function () { importWords(el('import-json').value); });
  el('btn-copy-prompt').addEventListener('click', copyPrompt);
  el('btn-export').addEventListener('click', exportAll);
  el('btn-restore').addEventListener('click', restoreBackup);
  el('btn-save-settings').addEventListener('click', saveSettings);
  el('btn-test').addEventListener('click', testConnection);
  el('banner-export').addEventListener('click', exportAll);
  el('banner-later').addEventListener('click', function () {
    db.progress.settings.bannerHiddenDay = todayStr();
    saveDB();
    el('export-banner').classList.add('hidden');
  });

  // Чипы фильтра типа на главной
  document.querySelectorAll('#type-chips .chip').forEach(function (c) {
    c.addEventListener('click', function () {
      db.progress.settings.typeFilter = c.dataset.type;
      saveDB();
      document.querySelectorAll('#type-chips .chip').forEach(function (x) {
        x.classList.toggle('active', x === c);
      });
      renderHome();
    });
  });

  // Чипы типа при ручном добавлении
  document.querySelectorAll('#add-type-chips .chip').forEach(function (c) {
    c.addEventListener('click', function () {
      addType = c.dataset.type;
      document.querySelectorAll('#add-type-chips .chip').forEach(function (x) {
        x.classList.toggle('active', x === c);
      });
      const hints = {
        word: 'Слово: отдельное существительное, прилагательное или наречие.',
        verb: 'Глагол: вводи в инфинитиве (hablar). Формы спряжения появятся позже через импорт.',
        phrase: 'Выражение: устойчивый оборот из 2+ слов (tener hambre).'
      };
      el('add-type-hint').textContent = hints[addType];
    });
  });

  // Лимит новых слов за сессию
  document.querySelectorAll('#newlimit-chips button').forEach(function (b) {
    b.addEventListener('click', function () {
      db.progress.settings.newLimit = parseInt(b.dataset.limit, 10) || NEW_LIMIT_DEFAULT;
      saveDB();
      document.querySelectorAll('#newlimit-chips button').forEach(function (x) {
        x.classList.toggle('active', x === b);
      });
      toast('Новых за тренировку: ' + db.progress.settings.newLimit);
    });
  });

  // Переключатель периода
  document.querySelectorAll('#period-switch button').forEach(function (b) {
    b.addEventListener('click', function () {
      currentPeriod = b.dataset.period;
      document.querySelectorAll('#period-switch button').forEach(function (x) {
        x.classList.toggle('active', x === b);
      });
      renderActivityChart();
      renderTypeCards();
      renderFormatsAccuracy();
    });
  });
}

// ---------- Старт ----------
function init() {
  tgInit();
  // В Telegram контент уходит под системную шапку — добавляем отступ сверху
  if (tg) {
    try { document.body.classList.add('in-telegram'); } catch (e) {}
  }
  applyTheme();
  if (tg) { try { tg.onEvent('themeChanged', applyTheme); } catch (e) {} }
  loadDB();
  bindNav();
  bindAll();
  renderHome();

  // Восстановление выбранного фильтра типа на чипах
  const savedFilter = db.progress.settings.typeFilter || 'all';
  document.querySelectorAll('#type-chips .chip').forEach(function (x) {
    x.classList.toggle('active', x.dataset.type === savedFilter);
  });

  // Автоподстановка chat_id при открытии из Telegram
  if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id &&
      !db.progress.settings.chatId) {
    db.progress.settings.chatId = String(tg.initDataUnsafe.user.id);
    saveDB();
  }

  // Параметр запуска startapp=train (кнопка «Учить» в боте) — сразу тренировка
  let startParam = '';
  try { startParam = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || ''; } catch (e) {}
  if (startParam === 'train') { session = null; startStudy(); return; }

  showScreen('home');
}

document.addEventListener('DOMContentLoaded', init);
