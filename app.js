'use strict';
/* ============================================================
   ОСНОВНАЯ ЛОГИКА ПРИЛОЖЕНИЯ «Испанский каждый день» — версия 2
   Изменения против версии 1:
   - добавлен режим «Диалоги» (данные и логика — в dialogs.js):
     в базе появились db.dialogs (свои диалоги) и
     db.progress.dialogs (прогресс по диалогам);
   - при восстановлении бэкапа диалоги тоже переносятся;
   - при смене экрана останавливается проигрывание диалога.
   Хранилище — localStorage. Библиотеки — Telegram WebApp, Chart.js.
   ============================================================ */

// ---------- Telegram WebApp: безопасная обёртка ----------
// Переменная tg равна null в обычном браузере — все функции ниже это учитывают.
const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;

function tgInit() {
  if (!tg) return;
  try { tg.ready(); tg.expand(); } catch (e) { /* в браузере не нужно */ }
}
function hapticLight() { try { if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light'); } catch (e) {} }
function hapticSuccess() { try { if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success'); } catch (e) {} }
function hapticError() { try { if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error'); } catch (e) {} }

// Диалог подтверждения: в Telegram — нативный, в браузере — обычный confirm
function tgConfirm(question, onYes) {
  if (tg && typeof tg.showConfirm === 'function') {
    try { tg.showConfirm(question, function (ok) { if (ok) onYes(); }); return; } catch (e) {}
  }
  if (window.confirm(question)) onYes();
}

// Main Button (нижняя кнопка Telegram) — только для экрана настроек
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
const DAY_MS = 86400000;                 // миллисекунд в сутках
const STORAGE_KEY = 'spanishApp.v1';     // ключ в localStorage
const LADDER = [1, 3, 7, 16, 35];        // лестница интервалов, дней
const SESSION_SIZE = 10;                 // карточек в одной сессии
const MODES = ['es-ru', 'ru-es', 'input', 'self'];
const MODE_LABELS = {
  'es-ru': 'испанский → русский',
  'ru-es': 'русский → испанский',
  'input': 'впиши перевод',
  'self': 'вспомни сам'
};

// Иконка динамика (SVG) — одна на всё приложение (используется и в dialogs.js)
const SPEAK_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor"/><path d="M16.5 8.5a4.5 4.5 0 0 1 0 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

// Промт-шаблон для импорта слов через любой ИИ-чат (кнопка «Скопировать промт для ИИ»)
const PROMPT_TEMPLATE = [
  'Ты — редактор словаря для приложения изучения испанского. Ниже я дам сырой список испанских слов и выражений в произвольном формате (из учебника, статьи, таблицы или просто списком).',
  '',
  'Твоя задача — превратить его в JSON-массив для моего приложения.',
  '',
  'Правила:',
  '1. Для каждой записи верни объект ровно с четырьмя полями:',
  '   "es" — слово или выражение на испанском, как в моём списке;',
  '   "ru" — перевод на русский; если перевода в списке нет — подбери самый частотный перевод сам;',
  '   "tr" — примерное чтение кириллицей по правилам испанского произношения;',
  '   "ex" — короткий пример употребления на испанском: простое предложение уровня A1–A2, не более 8 слов.',
  '2. Ответ должен быть ТОЛЬКО JSON-массивом. Первый символ ответа — [, последний — ].',
  '   Никакого текста до или после, никаких пояснений, никаких markdown-обёрток, никаких фраз вроде «вот ваш JSON».',
  '3. Поля id, status, interval, nextShow НЕ добавляй — приложение проставит их само.',
  '4. Не пропускай записи из моего списка и не добавляй слова от себя.',
  '5. Если в списке есть мусор (номера страниц, пометки, повторы заголовков) — игнорируй его, в JSON он не попадает.',
  '6. Если список пуст или по нему невозможно составить записи, ответь ровно одной строкой: НЕ ПОНЯЛ СПИСОК',
  '',
  'Мой список:'
].join('\n');

// ---------- Состояние ----------
let db = null;            // { words, progress, settings, dialogs }
let session = null;       // текущая тренировка словами
let charts = { activity: null, status: null };
let currentPeriod = 'week';

// ---------- Мелкие утилиты ----------
function el(id) { return document.getElementById(id); }

function todayStr(date) {
  const d = date ? new Date(date) : new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function yesterdayStr() { return todayStr(Date.now() - DAY_MS); }

function uid() { return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// Ключ для проверки дубликатов: нижний регистр, схлопнутые пробелы
function normalizeKey(s) { return String(s).toLowerCase().replace(/\s+/g, ' ').trim(); }

// Нормализация ответа для режима «впиши перевод»
function normalizeAnswer(s) {
  return String(s).toLowerCase().replace(/ё/g, 'е').replace(/[.,!?"«»]/g, '').replace(/\s+/g, ' ').trim();
}

// Экранирование пользовательских строк перед вставкой в innerHTML
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

// ---------- Тост ----------
let toastTimer = null;
function toast(msg) {
  const t = el('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
}

// ---------- Хранилище ----------
function defaultProgress() {
  return {
    streak: 0,
    lastStudyDay: '',
    learnedToday: { date: todayStr(), n: 0 },
    history: {},
    modes: { 'es-ru': { t: 0, c: 0 }, 'ru-es': { t: 0, c: 0 }, 'input': { t: 0, c: 0 }, 'self': { t: 0, c: 0 } },
    wordStats: {},
    dialogs: {}   // прогресс по диалогам: { [id]: { plays, trains, best } }
  };
}

function createStarterDB() {
  return {
    words: STARTER_SET.map(function (w) {
      return {
        id: w.id, es: w.es, ru: w.ru,
        tr: w.tr || '', ex: w.ex || '',
        status: 'new', interval: 0, nextShow: 0, added: Date.now()
      };
    }),
    progress: defaultProgress(),
    settings: { appsScriptUrl: '', chatId: '', lastExport: 0, bannerHiddenDay: '' },
    dialogs: []   // созданные пользователем диалоги
  };
}

function loadDB() {
  let raw = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { console.warn('localStorage недоступен', e); }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      db = {
        words: Array.isArray(parsed.words) ? parsed.words : [],
        progress: Object.assign(defaultProgress(), parsed.progress || {}),
        settings: Object.assign(
          { appsScriptUrl: '', chatId: '', lastExport: 0, bannerHiddenDay: '' },
          parsed.settings || {}
        ),
        dialogs: Array.isArray(parsed.dialogs) ? parsed.dialogs : []
      };
      // Гарантируем наличие всех полей у каждой записи (защита от старых версий)
      db.words.forEach(function (w) {
        if (!w.id) w.id = uid();
        if (!w.status) w.status = 'new';
        if (typeof w.interval !== 'number') w.interval = 0;
        if (typeof w.nextShow !== 'number') w.nextShow = 0;
      });
      // Прогресс по диалогам: у баз, созданных до этого режима, поля нет
      if (typeof ensureDialogState === 'function') ensureDialogState();
      return;
    } catch (e) {
      console.error('Битые данные в localStorage, начинаю с чистой базы', e);
    }
  }
  db = createStarterDB();
  saveDB();
  toast('Привет! Загружен стартовый набор из 292 слов и выражений.');
}

function saveDB() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }
  catch (e) { toast('Не удалось сохранить данные: хранилище недоступно'); }
}

// ---------- Навигация ----------
function showScreen(name) {
  // При уходе с экрана диалога останавливаем проигрывание и озвучку
  if (typeof stopPlay === 'function') { try { stopPlay(); } catch (e) {} }
  document.querySelectorAll('.screen').forEach(function (s) { s.classList.add('hidden'); });
  const scr = el('screen-' + name);
  if (scr) scr.classList.remove('hidden');
  // Вкладка «Диалоги» остаётся подсвеченной и на экране просмотра диалога
  const tabName = (name === 'dialog-view') ? 'dialogs' : name;
  document.querySelectorAll('.tab').forEach(function (t) {
    t.classList.toggle('active', t.dataset.screen === tabName);
  });
  tgMainButtonHide();
  if (name === 'settings') { renderSettings(); tgMainButtonShow('Сохранить', saveSettings); }
  if (name === 'home') renderHome();
  if (name === 'stats') renderStats();
  if (name === 'words') renderWords();
  if (name === 'dialogs' && typeof renderDialogsList === 'function') renderDialogsList();
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
  const queue = countQueueNow();
  el('home-learned').textContent = learned;
  el('home-queue').textContent = queue;
  el('home-streak').textContent = db.progress.streak || 0;

  // Точность за последние 7 дней
  let t = 0, c = 0;
  for (let i = 0; i < 7; i++) {
    const h = db.progress.history[todayStr(Date.now() - i * DAY_MS)];
    if (h) { t += h.a; c += h.c; }
  }
  el('home-accuracy').textContent = t ? Math.round(c / t * 100) + '%' : '–';

  el('home-session-hint').textContent = queue
    ? 'Готово к показу: ' + queue + ' слов'
    : 'Расписание пусто — добавь новые слова';
  el('home-empty').style.display = db.words.length ? 'none' : 'block';

  maybeShowExportBanner();
}

function countQueueNow() {
  const now = Date.now();
  return db.words.filter(function (w) {
    return w.status !== 'learned' && (w.nextShow === 0 || w.nextShow <= now);
  }).length;
}

function countLearnedToday() {
  const lt = db.progress.learnedToday;
  return (lt && lt.date === todayStr()) ? lt.n : 0;
}

// ---------- Баннер «делай бэкап раз в неделю» ----------
function maybeShowExportBanner() {
  const need = db.words.length > 0 &&
    Date.now() - (db.settings.lastExport || 0) > 7 * DAY_MS &&
    db.settings.bannerHiddenDay !== todayStr();
  el('export-banner').classList.toggle('hidden', !need);
}

// ---------- Тренировка ----------
function startStudy() {
  showScreen('train');
  if (session) { renderCard(); return; } // сессия уже идёт — показываем текущую карточку
  const s = buildSession(null);
  if (!s) {
    el('train-progress').textContent = '';
    el('train-area').innerHTML =
      '<div class="card"><h3>Тренировать нечего</h3>' +
      '<p class="hint">Все слова выучены или база пуста. Добавь новые слова во вкладках «Слова» или «Импорт».</p></div>';
    return;
  }
  renderCard();
}

// Сбор очереди: слова по расписанию (nextShow наступил) + новые
function buildSession(customList) {
  let items = [];
  if (customList && customList.length) {
    items = customList.slice(0, 20);
  } else {
    const now = Date.now();
    const due = db.words.filter(function (w) {
      return w.status !== 'learned' && w.nextShow > 0 && w.nextShow <= now;
    });
    due.sort(function (a, b) { return a.nextShow - b.nextShow; });
    const chosen = due.slice(0, SESSION_SIZE);
    if (chosen.length < SESSION_SIZE) {
      const fresh = db.words.filter(function (w) { return w.status === 'new' && w.nextShow === 0; });
      for (let i = 0; i < fresh.length && chosen.length < SESSION_SIZE; i++) chosen.push(fresh[i]);
    }
    items = chosen;
  }
  if (!items.length) return null;
  const canChoice = db.words.length >= 4; // для 4 вариантов нужно хотя бы 4 слова в базе
  session = {
    items: items.map(function (w, i) { return { word: w, mode: pickMode(i, canChoice) }; }),
    idx: 0, answered: 0, correct: 0, learnedCount: 0
  };
  return session;
}

// Режимы чередуются по кругу; при маленькой базе выбор вариантов недоступен
function pickMode(i, canChoice) {
  if (!canChoice) return (i % 2 === 0) ? 'input' : 'self';
  return MODES[i % MODES.length];
}

function renderCard() {
  const item = session.items[session.idx];
  el('train-progress').textContent =
    'Карточка ' + (session.idx + 1) + ' из ' + session.items.length + ' · ' + MODE_LABELS[item.mode];
  const area = el('train-area');
  area.innerHTML = '';
  if (item.mode === 'es-ru' || item.mode === 'ru-es') renderChoiceCard(area, item);
  else if (item.mode === 'input') renderInputCard(area, item);
  else renderSelfCard(area, item);
}

// Варианты для выбора: правильный + до 3 случайных других
function buildOptions(word, field) {
  const correct = word[field];
  const pool = db.words.filter(function (w) {
    return w.id !== word.id && w[field] && normalizeKey(w[field]) !== normalizeKey(correct);
  });
  const wrong = shuffle(pool).slice(0, 3).map(function (w) { return w[field]; });
  return shuffle([correct].concat(wrong));
}

// Карточка с выбором из 4 вариантов
function renderChoiceCard(area, item) {
  const w = item.word;
  const field = item.mode === 'es-ru' ? 'ru' : 'es';
  const front = item.mode === 'es-ru' ? w.es : w.ru;
  const options = buildOptions(w, field);
  if (options.length < 2) { item.mode = 'self'; renderSelfCard(area, item); return; }

  const card = document.createElement('div');
  card.className = 'word-card pop';
  let html = '<div class="word-mode">' + MODE_LABELS[item.mode] + '</div>';
  html += '<div class="word-front">' + esc(front) + '</div>';
  if (item.mode === 'es-ru' && w.tr) html += '<div class="word-tr">' + esc(w.tr) + '</div>';
  if (item.mode === 'es-ru') html += '<button class="speak-btn" id="speak" aria-label="Озвучить">' + SPEAK_ICON + '</button>';
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
  bindSpeak(w.es);
}

function submitChoice(item, chosen) {
  const correct = item.mode === 'es-ru' ? item.word.ru : item.word.es;
  const ok = normalizeKey(chosen) === normalizeKey(correct);
  document.querySelectorAll('.option').forEach(function (b) {
    b.disabled = true;
    if (normalizeKey(b.textContent) === normalizeKey(correct)) b.style.borderColor = 'var(--ok)';
    else if (b.textContent === chosen && !ok) b.style.borderColor = 'var(--err)';
  });
  finishAnswer(item, ok);
}

// Карточка «впиши перевод вручную»
function renderInputCard(area, item) {
  const w = item.word;
  const card = document.createElement('div');
  card.className = 'word-card pop';
  card.innerHTML =
    '<div class="word-mode">' + MODE_LABELS.input + '</div>' +
    '<div class="word-front">' + esc(w.ru) + '</div>';
  area.appendChild(card);

  const form = document.createElement('div');
  form.id = 'input-form';
  const inp = document.createElement('input');
  inp.id = 'input-answer';
  inp.placeholder = 'Впиши перевод на испанском';
  inp.autocomplete = 'off';
  const btn = document.createElement('button');
  btn.className = 'btn-primary';
  btn.textContent = 'Ответить';
  form.appendChild(inp); form.appendChild(btn);
  area.appendChild(form);

  inp.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); submitInput(item); }
  });
  btn.addEventListener('click', function () { submitInput(item); });
  try { inp.focus(); } catch (e) {}
}

// Сравнение ввода с переводом: учитываем варианты через запятую/точку с запятой
function answersMatch(input, es) {
  const a = normalizeAnswer(input);
  if (!a) return false;
  const variants = String(es).split(/[,;/]/).map(normalizeAnswer);
  return variants.indexOf(a) !== -1;
}

function submitInput(item) {
  const val = el('input-answer').value;
  if (!val.trim()) { toast('Сначала впиши перевод'); return; }
  finishAnswer(item, answersMatch(val, item.word.es));
}

// Карточка «показал → вспомнил / не вспомнил»
function renderSelfCard(area, item) {
  const w = item.word;
  const card = document.createElement('div');
  card.className = 'word-card pop';
  card.innerHTML =
    '<div class="word-mode">' + MODE_LABELS.self + '</div>' +
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
    known.addEventListener('click', function () { finishAnswer(item, true); });
    const unknown = document.createElement('button');
    unknown.className = 'option';
    unknown.textContent = 'Не вспомнил';
    unknown.addEventListener('click', function () { finishAnswer(item, false); });
    btns.appendChild(known); btns.appendChild(unknown);
  });
  btns.appendChild(show);
  area.appendChild(btns);
}

// Общая точка: применяем результат и показываем фидбек
function finishAnswer(item, ok) {
  session.answered++;
  if (ok) session.correct++;
  applyAnswer(item.word, item.mode, ok);
  if (ok) hapticSuccess(); else hapticError();
  showFeedback(item, ok);
}

// Обновление слова и всей статистики после ответа
function applyAnswer(word, mode, correct) {
  const p = db.progress;
  const today = todayStr();

  // Стрик: дни подряд
  if (p.lastStudyDay !== today) {
    p.streak = (p.lastStudyDay === yesterdayStr()) ? (p.streak || 0) + 1 : 1;
    p.lastStudyDay = today;
  }

  // История по дням (для графика активности и точности за период)
  const h = p.history[today] || (p.history[today] = { a: 0, c: 0, m: {} });
  h.a++;
  if (correct) h.c++;
  const hm = h.m[mode] || (h.m[mode] = { t: 0, c: 0 });
  hm.t++; if (correct) hm.c++;

  // Точность по режимам (за всё время)
  const pm = p.modes[mode] || (p.modes[mode] = { t: 0, c: 0 });
  pm.t++; if (correct) pm.c++;

  // Личная статистика слова (для списка «сложные слова»)
  const ws = p.wordStats[word.id] || (p.wordStats[word.id] = { t: 0, w: 0 });
  ws.t++; if (!correct) ws.w++;

  if (correct) {
    // Подъём по лестнице интервалов 1 → 3 → 7 → 16 → 35
    const li = LADDER.indexOf(word.interval);
    if (word.interval === 0 || li === -1) {
      word.interval = LADDER[0];
    } else if (li < LADDER.length - 1) {
      word.interval = LADDER[li + 1];
    } else if (word.status !== 'learned') {
      // Верный ответ на последней ступени — слово выучено
      word.status = 'learned';
      p.learnedToday = (p.learnedToday && p.learnedToday.date === today)
        ? p.learnedToday : { date: today, n: 0 };
      p.learnedToday.n++;
      session.learnedCount++;
    }
    if (word.status !== 'learned') word.status = 'learning';
    word.nextShow = Date.now() + word.interval * DAY_MS;
  } else {
    // Ошибка: сброс интервала, слово сразу в очередь и повтор в этой сессии
    word.interval = 0;
    word.status = 'learning';
    word.nextShow = Date.now();
    session.items.splice(session.idx + 1, 0, {
      word: word,
      mode: pickMode(session.items.length, db.words.length >= 4)
    });
  }
  saveDB();
}

// Мгновенная обратная связь после ответа
function showFeedback(item, ok) {
  const w = item.word;
  const area = el('train-area');
  const old = el('feedback-panel');
  if (old) old.remove();

  const fb = document.createElement('div');
  fb.className = 'feedback pop ' + (ok ? 'ok' : 'err');
  fb.id = 'feedback-panel';
  let html = '<div class="fb-title">' + (ok ? 'Верно!' : 'Неверно') + '</div>';
  html += '<div class="fb-answer">' + esc(w.es) + ' — ' + esc(w.ru) + '</div>';
  if (w.tr) html += '<div class="fb-tr">' + esc(w.tr) + '</div>';
  if (w.ex) html += '<div class="fb-ex">' + esc(w.ex) + '</div>';
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
  el('train-area').innerHTML =
    '<div class="word-card pop"><h3 style="margin-bottom:8px">Сессия завершена</h3>' +
    '<p class="hint">Ответов: ' + answered + ' · верных: ' + correct + ' (' + acc + '%)' +
    (learnedCount ? '<br>Новых выученных слов: ' + learnedCount : '') + '</p>' +
    '<button class="btn-primary" id="btn-again" style="margin-top:14px">Ещё раз</button>' +
    '<button class="btn-secondary" id="btn-tohome" style="margin-top:10px">На главную</button></div>';
  el('btn-again').addEventListener('click', function () { session = null; startStudy(); });
  el('btn-tohome').addEventListener('click', function () { showScreen('home'); });
  hapticSuccess();
}

// GET-запрос на Apps Script со сводкой (не ждём ответа)
function sendSummaryToBot(learned, queue) {
  const s = db.settings;
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
  renderModesAccuracy();
  renderWorstWords();
}

function periodDays() { return currentPeriod === 'week' ? 7 : currentPeriod === 'month' ? 30 : 0; }

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// График активности по дням
function renderActivityChart() {
  const canvas = el('chart-activity');
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
    canvas.style.display = 'none';
    return;
  }
  empty.classList.add('hidden');
  canvas.style.display = 'block';
  canvas.style.height = '220px';

  charts.activity = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{ label: 'Ответов', data: values, backgroundColor: cssVar('--accent', '#A3E635'), borderRadius: 6 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: cssVar('--muted', '#8B96A6'), maxRotation: 0, autoSkip: true }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: cssVar('--muted', '#8B96A6'), precision: 0 }, grid: { color: 'rgba(128,128,128,0.15)' } }
      }
    }
  });
}

// Кольцевая диаграмма «выучено / изучается / новые»
function renderStatusChart() {
  const canvas = el('chart-status');
  if (charts.status) { charts.status.destroy(); charts.status = null; }
  const learned = db.words.filter(function (w) { return w.status === 'learned'; }).length;
  const learning = db.words.filter(function (w) { return w.status === 'learning'; }).length;
  const fresh = db.words.filter(function (w) { return w.status === 'new'; }).length;
  if (!learned && !learning && !fresh) return;
  canvas.style.height = '220px';

  charts.status = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Выучено', 'Изучается', 'Новые'],
      datasets: [{
        data: [learned, learning, fresh],
        backgroundColor: ['#4ADE80', cssVar('--accent', '#A3E635'), '#3A4656'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: { legend: { position: 'bottom', labels: { color: cssVar('--muted', '#8B96A6'), boxWidth: 14 } } }
    }
  });
}

// Точность по режимам за выбранный период
function renderModesAccuracy() {
  const box = el('modes-accuracy');
  const days = periodDays();
  const agg = {};
  MODES.forEach(function (m) { agg[m] = { t: 0, c: 0 }; });

  if (days) {
    for (let i = 0; i < days; i++) {
      const h = db.progress.history[todayStr(Date.now() - i * DAY_MS)];
      if (!h || !h.m) continue;
      MODES.forEach(function (m) {
        const hm = h.m[m];
        if (hm) { agg[m].t += hm.t; agg[m].c += hm.c; }
      });
    }
  } else {
    MODES.forEach(function (m) { agg[m] = Object.assign({}, db.progress.modes[m] || { t: 0, c: 0 }); });
  }

  let html = '';
  MODES.forEach(function (m) {
    const a = agg[m];
    const pct = a.t ? Math.round(a.c / a.t * 100) : null;
    html += '<div class="mode-row">' +
      '<div class="mode-row-top"><span>' + MODE_LABELS[m] + '</span><span>' +
      (pct === null ? 'нет данных' : pct + '% · ' + a.t + ' отв.') + '</span></div>' +
      '<div class="mode-bar"><div class="mode-bar-fill" style="width:' + (pct || 0) + '%"></div></div></div>';
  });
  box.innerHTML = html;
}

// Сложные слова: где больше всего ошибок (за всё время)
function renderWorstWords() {
  const box = el('worst-words');
  const btn = el('btn-train-worst');
  const list = db.words.filter(function (w) {
    const s = db.progress.wordStats[w.id];
    return s && s.w > 0;
  }).map(function (w) {
    const s = db.progress.wordStats[w.id];
    return { w: w, t: s.t, err: s.w };
  }).sort(function (a, b) { return b.err - a.err || b.t - a.t; }).slice(0, 8);

  if (!list.length) {
    box.innerHTML = '<p class="hint">Ошибок пока не зафиксировано.</p>';
    btn.classList.add('hidden');
    return;
  }
  let html = '';
  list.forEach(function (it) {
    html += '<div class="worst-row"><div>' +
      '<div class="worst-es">' + esc(it.w.es) + '</div>' +
      '<div class="worst-ru">' + esc(it.w.ru) + '</div></div>' +
      '<div class="worst-num">' + it.err + ' из ' + it.t + '</div></div>';
  });
  box.innerHTML = html;
  btn.classList.remove('hidden');
  btn.onclick = function () {
    session = null;
    buildSession(list.map(function (it) { return it.w; }));
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
    html += '<div class="word-row">' +
      '<div class="word-row-main"><div class="word-row-es">' + esc(w.es) + '</div>' +
      '<div class="word-row-ru">' + esc(w.ru) + (w.tr ? ' · ' + esc(w.tr) : '') + '</div></div>' +
      badge +
      '<button class="word-del" data-id="' + esc(w.id) + '" aria-label="Удалить">×</button></div>';
  });
  list.innerHTML = html;
  el('words-count').textContent = 'Всего слов: ' + db.words.length + ' · показано: ' + shown;
  list.querySelectorAll('.word-del').forEach(function (b) {
    b.addEventListener('click', function () { deleteWord(b.dataset.id); });
  });
}

function deleteWord(id) {
  const w = db.words.find(function (x) { return x.id === id; });
  if (!w) return;
  tgConfirm('Удалить «' + w.es + '»?', function () {
    db.words = db.words.filter(function (x) { return x.id !== id; });
    delete db.progress.wordStats[id];
    saveDB();
    renderWords();
    toast('Слово удалено');
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
    msg.textContent = 'Такое слово уже есть в базе.';
    return;
  }
  db.words.push({
    id: uid(), es: es, ru: ru,
    tr: el('add-tr').value.trim(), ex: el('add-ex').value.trim(),
    status: 'new', interval: 0, nextShow: 0, added: Date.now()
  });
  saveDB();
  el('add-es').value = ''; el('add-ru').value = ''; el('add-tr').value = ''; el('add-ex').value = '';
  msg.classList.add('ok');
  msg.textContent = 'Слово добавлено!';
  renderWords();
  hapticSuccess();
}

// ---------- Импорт и бэкап ----------
// Импорт JSON: принимаем массив записей или объект { words: [...] }
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
    report.textContent = 'Нужен массив записей вида [{"es":"...","ru":"..."}].';
    return;
  }

  const existing = {};
  db.words.forEach(function (w) { existing[normalizeKey(w.es)] = true; });
  let added = 0, skipped = 0;

  list.forEach(function (item) {
    if (!item || typeof item !== 'object') { skipped++; return; }
    const es = typeof item.es === 'string' ? item.es.trim() : '';
    const ru = typeof item.ru === 'string' ? item.ru.trim() : '';
    if (!es || !ru) { skipped++; return; }                 // битая запись
    const key = normalizeKey(es);
    if (existing[key]) { skipped++; return; }              // дубликат
    db.words.push({
      id: uid(), es: es, ru: ru,
      tr: typeof item.tr === 'string' ? item.tr.trim() : '',
      ex: typeof item.ex === 'string' ? item.ex.trim() : '',
      status: 'new', interval: 0, nextShow: 0, added: Date.now()
    });
    existing[key] = true;
    added++;
  });

  saveDB();
  if (added) el('import-json').value = '';
  report.classList.add(added ? 'ok' : 'err');
  report.textContent = 'Добавлено: ' + added + '. Пропущено: ' + skipped + ' (дубликаты и битые записи).';
  if (added) toast('Добавлено слов: ' + added);
}

// Копирование промта: сначала Clipboard API, при отказе — запасной способ
function copyPrompt() {
  const msg = el('import-report');
  const done = function (ok) {
    msg.className = 'form-msg ' + (ok ? 'ok' : 'err');
    msg.textContent = ok
      ? 'Промт скопирован. Открой любой ИИ-чат, вставь его и сразу после него — свой список слов. Пришли в чат и получи в ответ JSON.'
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

// Экспорт всей базы и прогресса в файл (включая диалоги)
function exportAll() {
  try {
    db.settings.lastExport = Date.now();
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

// Восстановление из файла бэкапа (диалоги переносятся тоже)
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
      data.words.forEach(function (w) {
        if (!w || typeof w.es !== 'string' || typeof w.ru !== 'string') throw new Error('в файле битые записи');
      });
      tgConfirm('Заменить текущую базу и прогресс содержимым файла?', function () {
        db = {
          words: data.words.map(function (w) {
            return {
              id: w.id || uid(), es: w.es, ru: w.ru,
              tr: typeof w.tr === 'string' ? w.tr : '',
              ex: typeof w.ex === 'string' ? w.ex : '',
              status: ['new', 'learning', 'learned'].indexOf(w.status) !== -1 ? w.status : 'new',
              interval: typeof w.interval === 'number' ? w.interval : 0,
              nextShow: typeof w.nextShow === 'number' ? w.nextShow : 0,
              added: w.added || Date.now()
            };
          }),
          progress: Object.assign(defaultProgress(), data.progress || {}),
          settings: Object.assign(
            { appsScriptUrl: '', chatId: '', lastExport: 0, bannerHiddenDay: '' },
            data.settings || {}
          ),
          dialogs: Array.isArray(data.dialogs) ? data.dialogs : []
        };
        if (typeof ensureDialogState === 'function') ensureDialogState();
        saveDB();
        renderHome();
        msg.classList.add('ok');
        msg.textContent = 'База восстановлена: ' + db.words.length + ' слов, диалогов: ' + db.dialogs.length + '.';
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
  el('set-url').value = db.settings.appsScriptUrl || '';
  el('set-chat').value = db.settings.chatId || '';
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
  db.settings.appsScriptUrl = url;
  db.settings.chatId = chat;
  saveDB();
  msg.classList.add('ok');
  msg.textContent = 'Сохранено.';
  toast('Настройки сохранены');
}

// Тест связи: Apps Script пришлёт сообщение в чат с ботом
function testConnection() {
  const msg = el('settings-msg');
  msg.className = 'form-msg';
  const url = db.settings.appsScriptUrl;
  const chat = db.settings.chatId;
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

function bindSpeak(es) {
  const b = el('speak');
  if (b) b.addEventListener('click', function () { speak(es); });
}

// ---------- Тема Telegram ----------
// Тёмная тема — наша по умолчанию. Если Telegram сообщает светлую схему,
// подставляем цвета системной темы через CSS-переменные.
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
    db.settings.bannerHiddenDay = todayStr();
    saveDB();
    el('export-banner').classList.add('hidden');
  });
  document.querySelectorAll('#period-switch button').forEach(function (b) {
    b.addEventListener('click', function () {
      currentPeriod = b.dataset.period;
      document.querySelectorAll('#period-switch button').forEach(function (x) {
        x.classList.toggle('active', x === b);
      });
      renderActivityChart();
      renderModesAccuracy();
    });
  });
}

// ---------- Старт ----------
function init() {
  tgInit();
  applyTheme();
  if (tg) { try { tg.onEvent('themeChanged', applyTheme); } catch (e) {} }
  loadDB();
  bindNav();
  bindAll();
  renderHome();

  // Автоподстановка chat_id при открытии из Telegram
  if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id && !db.settings.chatId) {
    db.settings.chatId = String(tg.initDataUnsafe.user.id);
    saveDB();
  }

  // Параметр запуска startapp=train (кнопка «Учить» в боте) — сразу тренировка
  let startParam = '';
  try { startParam = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || ''; } catch (e) {}
  if (startParam === 'train') { session = null; startStudy(); return; }

  showScreen('home');
}

document.addEventListener('DOMContentLoaded', init);
