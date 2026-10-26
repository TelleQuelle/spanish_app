'use strict';
/* ============================================================
   РЕЖИМ «ДИАЛОГИ» — данные и логика
   Подключается после app.js и использует его утилиты:
   el, esc, shuffle, normalizeKey, toast, speak, uid, todayStr,
   tgConfirm, hapticLight, hapticSuccess, hapticError,
   showScreen, saveDB, db, SPEAK_ICON.
   Три режима: «Читать», «Прослушать», «Тренировать».
   Плюс создание своих диалогов, импорт JSON и промт для ИИ.
   ============================================================ */

// ============================================================
// СТАРТОВЫЕ ДИАЛОГИ
// who: "me" — реплики пользователя, "other" — реплики собеседника.
// tr — приблизительное чтение кириллицей.
// ============================================================

const DIALOG_SET = [
  {
    id: 'd1',
    title: 'Знакомство',
    situation: 'Ты знакомишься с Пабло: имена, откуда ты, чем занимаешься, что любишь.',
    role: 'Пабло',
    lines: [
      { who: 'other', es: '¡Hola! Soy Pablo. ¿Y tú?', ru: 'Привет! Я Пабло. А ты?', tr: 'ола! сои пабло. и ту?' },
      { who: 'me', es: 'Hola, Pablo. Me llamo Anna.', ru: 'Привет, Пабло. Меня зовут Анна.', tr: 'ола, пабло. мэ йамо анна' },
      { who: 'other', es: '¡Encantado, Anna! ¿De dónde eres?', ru: 'Очень приятно, Анна! Откуда ты?', tr: 'энкантадо, анна! дэ дондэ эрэс?' },
      { who: 'me', es: 'Soy de Rusia, de Moscú.', ru: 'Я из России, из Москвы.', tr: 'сой дэ русиа, дэ моску' },
      { who: 'other', es: '¡Qué bien! ¿Trabajas o estudias?', ru: 'Как здорово! Ты работаешь или учишься?', tr: 'кэ бьен! трабахас о эстудиас?' },
      { who: 'me', es: 'Estudio español y trabajo en una oficina.', ru: 'Учусь испанскому и работаю в офисе.', tr: 'эстудио эспаньоль и трабахо эн уна офисина' },
      { who: 'other', es: '¿Y qué te gusta hacer en tu tiempo libre?', ru: 'А что ты любишь делать в свободное время?', tr: 'и кэ тэ густа асэр эн ту тьэмпо либрэ?' },
      { who: 'me', es: 'Me gusta leer y escuchar música.', ru: 'Люблю читать и слушать музыку.', tr: 'мэ густа лээр и эскучар мусика' },
      { who: 'other', es: '¡A mí también! ¿Tomamos un café?', ru: 'И мне! Выпьем кофе?', tr: 'а ми тамбьен! томамос ун кафэ?' },
      { who: 'me', es: 'Sí, ¡vamos!', ru: 'Да, пойдём!', tr: 'си, вамос!' }
    ]
  },
  {
    id: 'd2',
    title: 'В кафе',
    situation: 'Ты заходишь в кафе: заказываешь кофе, круассан и воду и платишь.',
    role: 'Официант',
    lines: [
      { who: 'other', es: 'Buenas tardes, ¿qué le pongo?', ru: 'Добрый день, что вам?', tr: 'буэнас тардэс, кэ лэ понго?' },
      { who: 'me', es: 'Buenas tardes. Un café con leche, por favor.', ru: 'Добрый день. Кофе с молоком, пожалуйста.', tr: 'буэнас тардэс. ун кафэ кон лэчэ, пор фавор' },
      { who: 'other', es: '¿Algo para comer?', ru: 'Что-нибудь поесть?', tr: 'альго пара комэр?' },
      { who: 'me', es: 'Sí, un croissant. ¿Cuánto cuesta?', ru: 'Да, круассан. Сколько стоит?', tr: 'си, ун круасан. куанто куэста?' },
      { who: 'other', es: 'Dos euros con cincuenta.', ru: 'Два евро пятьдесят.', tr: 'дос эурос кон синкуэнта' },
      { who: 'me', es: 'Vale. Y un vaso de agua también.', ru: 'Ладно. И стакан воды тоже.', tr: 'вале. и ун басо дэ агуа тамбьен' },
      { who: 'other', es: '¿Algo más?', ru: 'Что-нибудь ещё?', tr: 'альго мас?' },
      { who: 'me', es: 'No, eso es todo. ¿Cuánto es en total?', ru: 'Нет, это всё. Сколько всего?', tr: 'но, эсо эс тодо. куанто эс эн тоталь?' },
      { who: 'other', es: 'Cuatro euros.', ru: 'Четыре евро.', tr: 'куатро эурос' },
      { who: 'me', es: 'Aquí tiene. ¡Gracias!', ru: 'Вот, возьмите. Спасибо!', tr: 'аки тьэнэ. грасиас!' },
      { who: 'other', es: '¡Gracias a usted! ¡Hasta luego!', ru: 'Спасибо вам! До встречи!', tr: 'грасиас а устэд! аста луэго!' }
    ]
  },
  {
    id: 'd3',
    title: 'В магазине одежды',
    situation: 'Ты выбираешь рубашку: размер, примерка, покупка.',
    role: 'Продавщица',
    lines: [
      { who: 'other', es: 'Buenas, ¿puedo ayudarte?', ru: 'Здравствуйте, могу тебе помочь?', tr: 'буэнас, пуэдо айудартэ?' },
      { who: 'me', es: 'Sí, busco una camisa blanca. Talla M.', ru: 'Да, ищу белую рубашку. Размер M.', tr: 'си, буско уна камиса бланка. тайа эмэ' },
      { who: 'other', es: '¿Cómo esta?', ru: 'Как эта?', tr: 'комо эста?' },
      { who: 'me', es: '¿Puedo probármela?', ru: 'Можно примерить?', tr: 'пуэдо пробармэла?' },
      { who: 'other', es: 'Claro, el probador está allí.', ru: 'Конечно, примерочная вон там.', tr: 'кларо, эль пробадор эста айи' },
      { who: 'me', es: 'Está un poco grande. ¿Tiene la talla S?', ru: 'Она немного велика. Есть размер S?', tr: 'эста ун поко грандэ. тьэнэ ла тайа эсэ?' },
      { who: 'other', es: 'Sí, aquí tienes.', ru: 'Да, вот, держи.', tr: 'си, аки тьэнэс' },
      { who: 'me', es: '¡Me queda bien! ¿Cuánto cuesta?', ru: 'Мне как раз! Сколько стоит?', tr: 'мэ кэда бьен! куанто куэста?' },
      { who: 'other', es: 'Veinte euros.', ru: 'Двадцать евро.', tr: 'вьэнтэ эурос' },
      { who: 'me', es: 'Me la llevo. Aquí tiene.', ru: 'Я её возьму. Вот, возьмите.', tr: 'мэ ла йэво. аки тьэнэ' }
    ]
  },
  {
    id: 'd4',
    title: 'Как пройти к вокзалу',
    situation: 'Ты спрашиваешь у прохожего дорогу: автобус, билет, время в пути.',
    role: 'Прохожий',
    lines: [
      { who: 'me', es: 'Perdón, ¿dónde está la estación de tren?', ru: 'Извините, где находится вокзал?', tr: 'пэрдон, дондэ эста ла эстасьон дэ трэн?' },
      { who: 'other', es: 'Está lejos. Mejor toma el autobús.', ru: 'Далеко. Лучше поезжай на автобусе.', tr: 'эста лэхос. мэхор тома эль аутобус' },
      { who: 'me', es: '¿Qué autobús me sirve?', ru: 'Какой автобус мне подойдёт?', tr: 'кэ аутобус мэ сирвэ?' },
      { who: 'other', es: 'El siete. La parada está en esa esquina.', ru: 'Седьмой. Остановка на вон том углу.', tr: 'эль сьэтэ. ла парада эста эн эса эскина' },
      { who: 'me', es: '¿Cuánto tarda el trayecto?', ru: 'Сколько займёт дорога?', tr: 'куанто тарда эль трайэкто?' },
      { who: 'other', es: 'Unos diez minutos.', ru: 'Минут десять.', tr: 'унос дьэс минутоc' },
      { who: 'me', es: '¡Muchas gracias! ¿Y dónde compro el billete?', ru: 'Большое спасибо! А где купить билет?', tr: 'мучас грасиас! и дондэ компро эль бийетэ?' },
      { who: 'other', es: 'En la misma parada, hay una máquina.', ru: 'На той же остановке, там есть автомат.', tr: 'эн ла мисма парада, ай уна макина' },
      { who: 'me', es: 'Entendido. ¡Gracias por su ayuda!', ru: 'Понятно. Спасибо за помощь!', tr: 'энтэндидо. грасиас пор су айуда!' },
      { who: 'other', es: '¡De nada! ¡Buen viaje!', ru: 'Не за что! Хорошей поездки!', tr: 'дэ нада! буэн вьяхэ!' }
    ]
  },
  {
    id: 'd5',
    title: 'В отеле',
    situation: 'Ты заселяешься в отель: бронь, завтрак, выезд, вай-фай.',
    role: 'Администратор',
    lines: [
      { who: 'other', es: 'Buenas noches, ¿tiene una reserva?', ru: 'Добрый вечер, у вас есть бронь?', tr: 'буэнас ночэс, тьэнэ уна рэсэрва?' },
      { who: 'me', es: 'Sí, a nombre de Ivanov. Dos noches.', ru: 'Да, на фамилию Иванов. Две ночи.', tr: 'си, а номбрэ дэ иванов. дос ночэс' },
      { who: 'other', es: 'Un momento... Sí, aquí está. Habitación doble, tercer piso.', ru: 'Минуту... Да, вот. Двухместный номер, третий этаж.', tr: 'ун момэнто... си, аки эста. абитасьон доблэ, тэрсэр писо' },
      { who: 'me', es: '¿El desayuno está incluido?', ru: 'Завтрак включён?', tr: 'эль дэсайуно эста инклуидо?' },
      { who: 'other', es: 'Sí, de siete a diez, en la planta baja.', ru: 'Да, с семи до десяти, на первом этаже.', tr: 'си, дэ сьэтэ а дьэс, эн ла планта баха' },
      { who: 'me', es: '¿A qué hora es la salida?', ru: 'Во сколько выезд?', tr: 'а кэ ора эс ла салида?' },
      { who: 'other', es: 'A las doce del mediodía.', ru: 'В двенадцать дня.', tr: 'а лос досэ дэль мэдиодиа' },
      { who: 'me', es: 'Perfecto. ¿Hay wi-fi en la habitación?', ru: 'Отлично. В номере есть вай-фай?', tr: 'пэрфэкто. ай уай-фай эн ла абитасьон?' },
      { who: 'other', es: 'Sí, la clave está en esta tarjeta.', ru: 'Да, пароль на этой карточке.', tr: 'си, ла клавэ эста эн эста тархэта' },
      { who: 'me', es: 'Muchas gracias. Buenas noches.', ru: 'Большое спасибо. Доброй ночи.', tr: 'мучас грасиас. буэнас ночэс' }
    ]
  },
  {
    id: 'd6',
    title: 'Такси',
    situation: 'Ты едешь на такси в аэропорт: маршрут, время в пути, оплата.',
    role: 'Водитель',
    lines: [
      { who: 'other', es: 'Buenas, ¿adónde vamos?', ru: 'Здравствуйте, куда едем?', tr: 'буэнас, адондэ вамос?' },
      { who: 'me', es: 'Al aeropuerto, por favor.', ru: 'В аэропорт, пожалуйста.', tr: 'аль аэропуэрто, пор фавор' },
      { who: 'other', es: '¿Por la autopista o por el centro?', ru: 'По трассе или через центр?', tr: 'пор ла аутописта о пор эль сэнтро?' },
      { who: 'me', es: 'Por donde sea más rápido, tengo prisa.', ru: 'Где быстрее, я спешу.', tr: 'пор дондэ сэа мас рапидо, тэнго приса' },
      { who: 'other', es: 'Vale, por la autopista entonces.', ru: 'Ладно, тогда по трассе.', tr: 'вале, пор ла аутописта энтонсэс' },
      { who: 'me', es: '¿Cuánto tardaremos?', ru: 'Сколько будем ехать?', tr: 'куанто тардарэмос?' },
      { who: 'other', es: 'Unos veinte minutos, si no hay tráfico.', ru: 'Минут двадцать, если нет пробок.', tr: 'унос вьэнтэ минутоc, си но ай трафико' },
      { who: 'me', es: 'Bien. ¿Puede ir un poco más despacio?', ru: 'Хорошо. Можете ехать немного медленнее?', tr: 'бьен. пуэдэ ир ун поко мас дэспасио?' },
      { who: 'other', es: 'Tranquilo, sin problema.', ru: 'Спокойно, без проблем.', tr: 'транкило, син проблема' },
      { who: 'me', es: 'Ya estamos. ¿Cuánto es?', ru: 'Мы на месте. Сколько с меня?', tr: 'йа эстамос. куанто эс?' },
      { who: 'other', es: 'Veintiocho euros.', ru: 'Двадцать восемь евро.', tr: 'вьэнтиочо эурос' },
      { who: 'me', es: 'Aquí tiene. ¡Gracias por el viaje!', ru: 'Вот, возьмите. Спасибо за поездку!', tr: 'аки тьэнэ. грасиас пор эль вьяхэ!' }
    ]
  }
];

// Промт-шаблон для создания диалогов через любой ИИ-чат
const PROMPT_DIALOG_TEMPLATE = [
  'Ты — методист по испанскому языку и редактор учебных диалогов для приложения изучения испанского. Ниже я дам ТЕМУ диалога (например, «в аптеке») или готовый сырой текст диалога/сценарий в любом виде.',
  '',
  'Твоя задача — сделать из этого JSON-массив учебных диалогов.',
  '',
  'Формат каждого диалога:',
  '{"title":"Название по-русски","situation":"Кто, с кем и о чём говорит, по-русски, одно предложение","role":"Кто такой собеседник, по-русски, одно-два слова (Официант, Прохожий, Администратор...)","lines":[{"who":"other","es":"...","ru":"...","tr":"кириллицей"},{"who":"me","es":"...","ru":"...","tr":"кириллицей"}]}',
  '',
  'Правила:',
  '1. "who": "me" — реплики пользователя (то, что он учится говорить сам), "other" — реплики собеседника.',
  '2. В каждом диалоге 8–12 реплик, они чередуются; уровень языка A1–A2, простые бытовые фразы.',
  '3. Реплик "me" в каждом диалоге не меньше 4 — именно их пользователь будет тренировать.',
  '4. "es" — реплика на испанском; "ru" — дословный перевод на русский; "tr" — примерное чтение кириллицей по правилам испанского произношения.',
  '5. Если я дал готовый текст — сохрани его смысл и реплики, исправь ошибки, добавь недостающие реплики с обеих сторон, чтобы диалог звучал естественно.',
  '6. Если дал одну тему — сделай ОДИН диалог по ней. Если дал список тем — по одному диалогу на каждую тему.',
  '7. Ответ должен быть ТОЛЬКО JSON-массивом. Первый символ ответа — [, последний — ]. Никакого текста до или после, никаких пояснений, никаких markdown-обёрток.',
  '8. Поля id, own НЕ добавляй — приложение проставит их само.',
  '9. Если по теме невозможно составить диалог, ответь ровно одной строкой: НЕ ПОНЯЛ ТЕМУ',
  '',
  'Моя тема или текст:'
].join('\n');

// ---------- Состояние режима ----------
let dialogView = null;   // открытый диалог: { dialog, mode, idx, playing, queue, ... }
let draftLines = [];     // черновик создаваемого диалога
let draftWho = 'other';  // чья реплика добавляется в черновик

// Гарантия полей диалогов в базе (для баз, созданных до этого режима)
function ensureDialogState() {
  if (!db) return;
  if (!Array.isArray(db.dialogs)) db.dialogs = [];
  if (!db.progress.dialogs || typeof db.progress.dialogs !== 'object') db.progress.dialogs = {};
}

// Все диалоги: стартовые + созданные пользователем
function allDialogs() {
  return DIALOG_SET.concat(db.dialogs || []);
}

// Прогресс по диалогу: { plays, trains, best }
function dialogProgress(id) {
  return (db.progress.dialogs && db.progress.dialogs[id]) || { plays: 0, trains: 0, best: -1 };
}

// ---------- Список диалогов ----------
function renderDialogsList() {
  const list = el('dialogs-list');
  if (!list) return;
  ensureDialogState();
  const dialogs = allDialogs();
  let html = '';
  dialogs.forEach(function (d) {
    const lines = Array.isArray(d.lines) ? d.lines : [];
    const pr = dialogProgress(d.id);
    const meCount = lines.filter(function (l) { return l.who === 'me'; }).length;
    const best = pr.best >= 0 ? pr.best + '%' : '–';
    html += '<div class="dialog-card">' +
      '<div class="dlg-top"><div class="dlg-title">' + esc(d.title) + '</div>' +
      '<span class="dlg-badge">' + esc(d.role || 'диалог') + '</span></div>' +
      (d.situation ? '<div class="dlg-situation">' + esc(d.situation) + '</div>' : '') +
      '<div class="dlg-meta">' + lines.length + ' реплик · твоих: ' + meCount +
      ' · тренировок: ' + pr.trains + ' · лучший результат: ' + best + '</div>' +
      '<div class="dlg-best"><div class="dlg-best-fill" style="width:' + (pr.best >= 0 ? pr.best : 0) + '%"></div></div>' +
      '<div class="dlg-actions">' +
      '<button class="dlg-btn-read" data-id="' + esc(d.id) + '" data-mode="read">Читать</button>' +
      '<button class="dlg-btn-play" data-id="' + esc(d.id) + '" data-mode="play">Прослушать</button>' +
      '<button class="dlg-btn-train" data-id="' + esc(d.id) + '" data-mode="train">Тренировать</button>' +
      (d.own ? '<button class="dlg-del" data-del="' + esc(d.id) + '" aria-label="Удалить">×</button>' : '') +
      '</div></div>';
  });
  list.innerHTML = html;
  list.querySelectorAll('button[data-mode]').forEach(function (b) {
    b.addEventListener('click', function () { openDialogView(b.dataset.id, b.dataset.mode); });
  });
  list.querySelectorAll('button[data-del]').forEach(function (b) {
    b.addEventListener('click', function () { deleteOwnDialog(b.dataset.del); });
  });
}

// ---------- Открытие диалога ----------
function openDialogView(id, mode) {
  const d = allDialogs().find(function (x) { return x.id === id; });
  if (!d || !Array.isArray(d.lines) || d.lines.length < 2) {
    toast('Диалог пуст или повреждён');
    return;
  }
  stopPlay();
  dialogView = {
    dialog: d, mode: mode, idx: 0, playing: false,
    queue: [], answered: 0, correct: 0, total: 0
  };
  el('dlg-view-title').textContent = d.title;
  showScreen('dialog-view');
  if (mode === 'read') startRead();
  else if (mode === 'play') startPlay();
  else startTrain();
}

// ---------- Общие элементы чата ----------
function scrollFeed() {
  try { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }
  catch (e) { window.scrollTo(0, document.body.scrollHeight); }
}

function appendRoleLabel(role) {
  const feed = el('chat-feed');
  if (!feed) return;
  const lab = document.createElement('div');
  lab.className = 'role-label';
  lab.textContent = role || 'Собеседник';
  feed.appendChild(lab);
}

// HTML пузыря. opts.tr === false — без транскрипции, opts.ru === false — без перевода,
// opts.fix + opts.fixText — пометка об ошибке
function bubbleHTML(line, opts) {
  opts = opts || {};
  const me = line.who === 'me';
  let html = '<div class="bubble ' + (me ? 'me' : 'other') + (opts.fix ? ' fix' : '') + '">' +
    '<div class="b-es">' + esc(line.es) + '</div>';
  if (opts.tr !== false && line.tr) html += '<div class="b-tr">' + esc(line.tr) + '</div>';
  if (opts.ru !== false) html += '<div class="b-ru">' + esc(line.ru) + '</div>';
  if (opts.fix && opts.fixText) html += '<div class="b-note">' + esc(opts.fixText) + '</div>';
  html += '<button class="b-speak" aria-label="Озвучить">' + SPEAK_ICON + '</button></div>';
  return html;
}

function appendBubble(line, opts) {
  const feed = el('chat-feed');
  if (!feed) return null;
  const wrap = document.createElement('div');
  wrap.innerHTML = bubbleHTML(line, opts);
  const node = wrap.firstChild;
  const sp = node.querySelector('.b-speak');
  if (sp) sp.addEventListener('click', function () { speak(line.es); });
  feed.appendChild(node);
  scrollFeed();
  return node;
}

// ---------- РЕЖИМ «ЧИТАТЬ» ----------
function startRead() {
  const area = el('dialog-view-area');
  area.innerHTML =
    '<div class="chat-progress">Режим чтения: реплики появляются по одной. Тапай динамик в пузыре, чтобы услышать.</div>' +
    '<div id="chat-feed" class="chat-feed"></div>' +
    '<div class="chat-bar">' +
    '<button id="chat-next" class="btn-primary">Дальше</button>' +
    '<button id="chat-all" class="btn-secondary">Показать всё сразу</button></div>';
  dialogView.idx = 0;
  appendReadBubble();
  el('chat-next').addEventListener('click', function () {
    if (dialogView.idx < dialogView.dialog.lines.length) appendReadBubble();
  });
  el('chat-all').addEventListener('click', function () {
    while (dialogView.idx < dialogView.dialog.lines.length) appendReadBubble();
  });
}

function appendReadBubble() {
  const d = dialogView.dialog;
  if (dialogView.idx >= d.lines.length) return;
  const line = d.lines[dialogView.idx];
  if (line.who === 'other') appendRoleLabel(d.role);
  appendBubble(line, {});
  dialogView.idx++;
  if (dialogView.idx >= d.lines.length) {
    // Диалог дочитан: меняем панель на финальные действия
    el('chat-next').classList.add('hidden');
    el('chat-all').classList.add('hidden');
    const bar = el('chat-bar');
    bar.innerHTML =
      '<button id="chat-train2" class="btn-primary">Тренировать этот диалог</button>' +
      '<button id="chat-home2" class="btn-secondary">К списку</button>';
    el('chat-train2').addEventListener('click', function () {
      openDialogView(dialogView.dialog.id, 'train');
    });
    el('chat-home2').addEventListener('click', function () { showScreen('dialogs'); });
  }
}

// ---------- РЕЖИМ «ПРОСЛУШАТЬ» ----------
function startPlay() {
  const area = el('dialog-view-area');
  area.innerHTML =
    '<div class="chat-progress">Режим прослушивания: диалог проигрывается сам, реплика за репликой.</div>' +
    '<div id="chat-feed" class="chat-feed"></div>' +
    '<div class="chat-bar"><button id="chat-stop" class="btn-danger">Остановить</button></div>';
  dialogView.idx = 0;
  dialogView.playing = true;
  el('chat-stop').addEventListener('click', function () {
    stopPlay();
    showScreen('dialogs');
  });
  playStep();
}

// Полная остановка воспроизведения (вызывается и при смене экрана)
function stopPlay() {
  if (dialogView) dialogView.playing = false;
  try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) {}
}

function playStep() {
  if (!dialogView || !dialogView.playing || dialogView.mode !== 'play') return;
  const d = dialogView.dialog;
  if (dialogView.idx >= d.lines.length) { finishPlay(); return; }
  const line = d.lines[dialogView.idx];

  // Сначала показываем индикатор «печатает…», потом пузырь
  const typing = document.createElement('div');
  typing.className = 'typing';
  typing.innerHTML = '<span></span><span></span><span></span>';
  el('chat-feed').appendChild(typing);
  scrollFeed();

  setTimeout(function () {
    if (!dialogView || !dialogView.playing) return;
    typing.remove();
    if (line.who === 'other') appendRoleLabel(d.role);
    appendBubble(line, {});
    dialogView.idx++;
    speakLine(line.es, function () { setTimeout(playStep, 350); });
  }, 600);
}

function finishPlay() {
  dialogView.playing = false;
  // Прослушанный до конца диалог — в статистику
  const pr = db.progress.dialogs[dialogView.dialog.id] || { plays: 0, trains: 0, best: -1 };
  pr.plays++;
  db.progress.dialogs[dialogView.dialog.id] = pr;
  saveDB();

  const bar = el('chat-bar');
  if (!bar) return;
  bar.innerHTML =
    '<button id="chat-again" class="btn-primary">Слушать ещё раз</button>' +
    '<div class="chat-bar-row">' +
    '<button id="chat-train" class="btn-secondary">Тренировать</button>' +
    '<button id="chat-home" class="btn-secondary">К списку</button></div>';
  el('chat-again').addEventListener('click', function () { startPlay(); });
  el('chat-train').addEventListener('click', function () {
    openDialogView(dialogView.dialog.id, 'train');
  });
  el('chat-home').addEventListener('click', function () { showScreen('dialogs'); });
}

// Озвучка реплики с уведомлением о завершении.
// onend в некоторых браузерах не срабатывает — страхуемся таймером.
function speakLine(text, onDone) {
  let finished = false;
  function done() {
    if (finished) return;
    finished = true;
    if (onDone) onDone();
  }
  const fallbackMs = Math.max(2000, text.length * 110);
  try {
    if (!('speechSynthesis' in window)) { setTimeout(done, fallbackMs); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES';
    u.rate = 0.95;
    const voices = window.speechSynthesis.getVoices();
    for (let i = 0; i < voices.length; i++) {
      if (voices[i].lang && voices[i].lang.toLowerCase().indexOf('es') === 0) { u.voice = voices[i]; break; }
    }
    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.speak(u);
    setTimeout(done, fallbackMs + 1200);
  } catch (e) {
    setTimeout(done, fallbackMs);
  }
}

// ---------- РЕЖИМ «ТРЕНИРОВАТЬ» ----------
function startTrain() {
  const d = dialogView.dialog;
  const meIdx = [];
  d.lines.forEach(function (l, i) { if (l.who === 'me') meIdx.push(i); });
  if (!meIdx.length) {
    toast('В этом диалоге нет твоих реплик');
    showScreen('dialogs');
    return;
  }
  dialogView.queue = shuffle(meIdx).map(function (i) { return { i: i, tries: 0 }; });
  dialogView.answered = 0;
  dialogView.correct = 0;
  dialogView.total = meIdx.length;

  const area = el('dialog-view-area');
  area.innerHTML =
    '<div class="chat-progress" id="chat-progress"></div>' +
    '<div id="chat-feed" class="chat-feed"></div>' +
    '<div id="chat-action"></div>';
  trainStep();
}

function updateTrainProgress() {
  const p = el('chat-progress');
  if (p) {
    p.textContent = 'Осталось реплик: ' + dialogView.queue.length +
      ' · верных ответов: ' + dialogView.correct;
  }
}

// Варианты для твоей реплики: правильная + 3 похожие по длине из других диалогов.
// Если подходящих меньше трёх — тренировка пойдёт в формате самопроверки.
function buildDialogOptions(line) {
  const correctKey = normalizeKey(line.es);
  const seen = {};
  const uniq = [];
  allDialogs().forEach(function (d) {
    (d.lines || []).forEach(function (l) {
      if (l.who !== 'me') return;
      const k = normalizeKey(l.es);
      if (k === correctKey || seen[k]) return;
      seen[k] = true;
      uniq.push(l.es);
    });
  });
  if (uniq.length < 3) return [];
  const scored = uniq.map(function (es) {
    return { v: es, s: Math.random() * 0.9 + (Math.abs(es.length - line.es.length) <= 20 ? 1 : 0) };
  });
  scored.sort(function (a, b) { return b.s - a.s; });
  return shuffle([line.es].concat(scored.slice(0, 3).map(function (x) { return x.v; })));
}

function trainStep() {
  if (!dialogView.queue.length) { finishDialogTrain(); return; }
  updateTrainProgress();
  const d = dialogView.dialog;
  const item = dialogView.queue[0];
  const line = d.lines[item.i];
  const feed = el('chat-feed');
  const action = el('chat-action');
  action.innerHTML = '';

  // Контекст: реплика собеседника, предшествующая твоей
  const prev = d.lines[item.i - 1];
  if (prev && prev.who === 'other') {
    appendRoleLabel(d.role);
    appendBubble(prev, { tr: false });
  }

  // Задание: твоя реплика по-русски
  const task = document.createElement('div');
  task.className = 'chat-task pop';
  task.innerHTML =
    '<div class="word-mode">твой ход</div>' +
    '<div class="word-front" style="font-size:20px">' + esc(line.ru) + '</div>';
  feed.appendChild(task);

  const options = buildDialogOptions(line);
  if (options.length >= 4) {
    // Выбор из четырёх вариантов
    const opts = document.createElement('div');
    opts.className = 'options';
    options.forEach(function (opt) {
      const b = document.createElement('button');
      b.className = 'option';
      b.textContent = opt;
      b.addEventListener('click', function () {
        const ok = normalizeKey(opt) === normalizeKey(line.es);
        opts.querySelectorAll('.option').forEach(function (x) {
          x.disabled = true;
          if (normalizeKey(x.textContent) === normalizeKey(line.es)) x.style.borderColor = 'var(--ok)';
          else if (x.textContent === opt && !ok) x.style.borderColor = 'var(--err)';
        });
        settleTrain(item, opt, ok);
      });
      opts.appendChild(b);
    });
    action.appendChild(opts);
  } else {
    // Самопроверка: вспомни вслух, покажи реплику, оцени себя честно
    const box = document.createElement('div');
    box.className = 'options';
    const show = document.createElement('button');
    show.className = 'btn-secondary';
    show.textContent = 'Показать испанскую реплику';
    show.addEventListener('click', function () {
      show.classList.add('hidden');
      const ans = document.createElement('div');
      ans.className = 'chat-task pop';
      ans.innerHTML =
        '<div class="word-mode">проверка</div>' +
        '<div class="word-front" style="font-size:20px">' + esc(line.es) + '</div>' +
        (line.tr ? '<div class="word-tr">' + esc(line.tr) + '</div>' : '');
      feed.appendChild(ans);
      scrollFeed();
      const known = document.createElement('button');
      known.className = 'option';
      known.textContent = 'Вспомнил';
      known.addEventListener('click', function () { settleTrain(item, '', true); });
      const unknown = document.createElement('button');
      unknown.className = 'option';
      unknown.textContent = 'Не вспомнил';
      unknown.addEventListener('click', function () { settleTrain(item, '', false); });
      box.appendChild(known);
      box.appendChild(unknown);
    });
    box.appendChild(show);
    action.appendChild(box);
  }
  scrollFeed();
}

// Результат хода: пузырь твоей реплики появляется в чате,
// при ошибке реплика возвращается в конец очереди (не больше 2 кругов)
function settleTrain(item, chosenEs, ok) {
  const line = dialogView.dialog.lines[item.i];
  dialogView.answered++;
  if (ok) dialogView.correct++;
  if (ok) hapticSuccess(); else hapticError();

  appendBubble(line, {});
  if (!ok) {
    item.tries++;
    if (item.tries < 2) dialogView.queue.push(item);
    const feed = el('chat-feed');
    const note = document.createElement('div');
    note.className = 'fix-note';
    note.textContent = 'Ошибка. Правильная реплика — в пузыре выше' +
      (chosenEs ? ': ты выбрал «' + chosenEs + '»' : '') + '.';
    feed.appendChild(note);
  }
  dialogView.queue.shift();

  const action = el('chat-action');
  action.innerHTML = '<button id="chat-next" class="btn-primary">Дальше</button>';
  el('chat-next').addEventListener('click', trainStep);
  scrollFeed();
}

function finishDialogTrain() {
  const d = dialogView.dialog;
  const answered = dialogView.answered;
  const correct = dialogView.correct;
  const pct = answered ? Math.round(correct / answered * 100) : 0;

  const pr = db.progress.dialogs[d.id] || { plays: 0, trains: 0, best: -1 };
  pr.trains++;
  if (pct > pr.best) pr.best = pct;
  db.progress.dialogs[d.id] = pr;
  saveDB();
  hapticSuccess();

  const feed = el('chat-feed');
  const fin = document.createElement('div');
  fin.className = 'word-card pop';
  fin.innerHTML =
    '<h3 style="margin-bottom:8px">Диалог пройден</h3>' +
    '<p class="hint">Ответов: ' + answered + ' · верных: ' + correct + ' (' + pct + '%)</p>' +
    '<button class="btn-primary" id="fin-again" style="margin-top:14px">Ещё раз</button>' +
    '<button class="btn-secondary" id="fin-home" style="margin-top:10px">К списку</button>';
  feed.appendChild(fin);
  el('chat-action').innerHTML = '';
  el('fin-again').addEventListener('click', function () { startTrain(); });
  el('fin-home').addEventListener('click', function () { showScreen('dialogs'); });
  scrollFeed();
}

// ---------- СОЗДАНИЕ СВОЕГО ДИАЛОГА ----------
function addLineToDraft() {
  const msg = el('dlg-new-msg');
  msg.className = 'form-msg';
  const es = el('dlg-new-es').value.trim();
  const ru = el('dlg-new-ru').value.trim();
  if (!es || !ru) {
    msg.classList.add('err');
    msg.textContent = 'У реплики должны быть испанский текст и перевод.';
    return;
  }
  draftLines.push({
    who: draftWho, es: es, ru: ru,
    tr: el('dlg-new-tr').value.trim()
  });
  el('dlg-new-es').value = '';
  el('dlg-new-ru').value = '';
  el('dlg-new-tr').value = '';
  msg.textContent = 'Реплика добавлена. Всего в черновике: ' + draftLines.length + '.';
  renderDraft();
  hapticLight();
}

function renderDraft() {
  const box = el('dlg-draft-list');
  if (!box) return;
  if (!draftLines.length) {
    box.innerHTML = '<p class="hint">Черновик пуст. Добавь первую реплику.</p>';
    return;
  }
  let html = '';
  draftLines.forEach(function (l, i) {
    html += '<div class="draft-line">' +
      '<span class="draft-who">' + (l.who === 'me' ? 'ТЫ' : 'СОБЕСЕДНИК') + '</span>' +
      '<span style="flex:1;min-width:0">' + esc(l.es) + ' — ' + esc(l.ru) + '</span>' +
      '<button class="draft-del" data-i="' + i + '" aria-label="Убрать">×</button></div>';
  });
  box.innerHTML = html;
  box.querySelectorAll('.draft-del').forEach(function (b) {
    b.addEventListener('click', function () {
      draftLines.splice(parseInt(b.dataset.i, 10), 1);
      renderDraft();
    });
  });
}

function saveDraftDialog() {
  const msg = el('dlg-new-msg');
  msg.className = 'form-msg';
  const title = el('dlg-new-title').value.trim();
  if (!title) {
    msg.classList.add('err');
    msg.textContent = 'Впиши название диалога.';
    return;
  }
  if (draftLines.length < 2) {
    msg.classList.add('err');
    msg.textContent = 'Нужно минимум две реплики.';
    return;
  }
  const key = normalizeKey(title);
  if (allDialogs().some(function (d) { return normalizeKey(d.title) === key; })) {
    msg.classList.add('err');
    msg.textContent = 'Диалог с таким названием уже есть.';
    return;
  }
  ensureDialogState();
  db.dialogs.push({
    id: uid(), own: true, title: title,
    situation: el('dlg-new-situation').value.trim(),
    role: el('dlg-new-role').value.trim() || 'Собеседник',
    lines: draftLines.slice()
  });
  saveDB();
  draftLines = [];
  ['dlg-new-title', 'dlg-new-situation', 'dlg-new-role'].forEach(function (id) { el(id).value = ''; });
  renderDraft();
  msg.classList.add('ok');
  msg.textContent = 'Диалог сохранён! Он появился в списке выше.';
  renderDialogsList();
  hapticSuccess();
}

// ---------- ИМПОРТ ДИАЛОГОВ ----------
function importDialogs(text) {
  const report = el('dlg-import-report');
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
  const list = Array.isArray(data) ? data : (data && Array.isArray(data.dialogs) ? data.dialogs : null);
  if (!list) {
    report.classList.add('err');
    report.textContent = 'Нужен массив диалогов вида [{"title":"...","lines":[...]}].';
    return;
  }
  ensureDialogState();
  const existing = {};
  allDialogs().forEach(function (d) { existing[normalizeKey(d.title)] = true; });
  let added = 0, skipped = 0;

  list.forEach(function (item) {
    if (!item || typeof item !== 'object') { skipped++; return; }
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const lines = Array.isArray(item.lines) ? item.lines : null;
    if (!title || !lines || lines.length < 2) { skipped++; return; }
    const clean = [];
    let bad = false;
    lines.forEach(function (l) {
      if (!l || typeof l !== 'object') { bad = true; return; }
      const who = (l.who === 'me' || l.who === 'other') ? l.who : '';
      const es = typeof l.es === 'string' ? l.es.trim() : '';
      const ru = typeof l.ru === 'string' ? l.ru.trim() : '';
      if (!who || !es || !ru) { bad = true; return; }
      clean.push({
        who: who, es: es, ru: ru,
        tr: typeof l.tr === 'string' ? l.tr.trim() : ''
      });
    });
    if (bad || clean.length < 2) { skipped++; return; }
    const key = normalizeKey(title);
    if (existing[key]) { skipped++; return; }
    existing[key] = true;
    db.dialogs.push({
      id: uid(), own: true, title: title,
      situation: typeof item.situation === 'string' ? item.situation.trim() : '',
      role: typeof item.role === 'string' ? item.role.trim() : 'Собеседник',
      lines: clean
    });
    added++;
  });

  saveDB();
  if (added) el('dlg-import-json').value = '';
  report.classList.add(added ? 'ok' : 'err');
  report.textContent = 'Добавлено диалогов: ' + added + '. Пропущено: ' + skipped + ' (дубликаты и битые записи).';
  if (added) {
    renderDialogsList();
    toast('Добавлено диалогов: ' + added);
  }
}

// ---------- ПРОМТ ДЛЯ ИИ ----------
function copyDialogPrompt() {
  const msg = el('dlg-import-report');
  const done = function (ok) {
    msg.className = 'form-msg ' + (ok ? 'ok' : 'err');
    msg.textContent = ok
      ? 'Промт скопирован. Вставь его в ИИ-чат, а сразу после него — тему или свой текст диалога.'
      : 'Автокопирование не сработало — скопируй промт вручную из инструкции.';
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(PROMPT_DIALOG_TEMPLATE)
      .then(function () { done(true); }, function () { done(fallbackCopyDialog()); });
  } else {
    done(fallbackCopyDialog());
  }
}

function fallbackCopyDialog() {
  try {
    const ta = document.createElement('textarea');
    ta.value = PROMPT_DIALOG_TEMPLATE;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}

// ---------- УДАЛЕНИЕ СВОЕГО ДИАЛОГА ----------
function deleteOwnDialog(id) {
  const d = (db.dialogs || []).find(function (x) { return x.id === id; });
  if (!d) return;
  tgConfirm('Удалить диалог «' + d.title + '»?', function () {
    db.dialogs = db.dialogs.filter(function (x) { return x.id !== id; });
    delete db.progress.dialogs[id];
    saveDB();
    renderDialogsList();
    toast('Диалог удалён');
  });
}

// ---------- Привязка кнопок и старт ----------
function bindDialogs() {
  const back = el('btn-dlg-back');
  if (back) back.addEventListener('click', function () { stopPlay(); showScreen('dialogs'); });
  const addBtn = el('btn-dlg-add-line');
  if (addBtn) addBtn.addEventListener('click', addLineToDraft);
  const saveBtn = el('btn-dlg-save');
  if (saveBtn) saveBtn.addEventListener('click', saveDraftDialog);
  const impBtn = el('btn-dlg-import');
  if (impBtn) impBtn.addEventListener('click', function () { importDialogs(el('dlg-import-json').value); });
  const prBtn = el('btn-dlg-copy-prompt');
  if (prBtn) prBtn.addEventListener('click', copyDialogPrompt);

  // Переключатель «чья реплика» в форме создания
  document.querySelectorAll('#dlg-who-switch button').forEach(function (b) {
    b.addEventListener('click', function () {
      draftWho = b.dataset.who;
      document.querySelectorAll('#dlg-who-switch button').forEach(function (x) {
        x.classList.toggle('active', x === b);
      });
    });
  });

  renderDraft();
}

// app.js инициализируется раньше (его скрипт подключён выше),
// поэтому к этому моменту база уже загружена.
document.addEventListener('DOMContentLoaded', function () {
  ensureDialogState();
  bindDialogs();
});
