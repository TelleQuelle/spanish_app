'use strict';
/* ============================================================
   РЕЖИМ «ДИАЛОГИ» — версия 3 (микс-формат тренировки)
   Полностью автономен: app.js и words.js не меняются.
   Свои диалоги и статистика хранятся в ОТДЕЛЬНОМ ключе
   localStorage (spanishDialogs.v1), поэтому сброс прогресса
   и бэкап приложения на них не влияют.
   Использует из app.js: el, esc, shuffle, normalizeKey,
   normalizeAnswer, toast, speak, uid, todayStr, tgConfirm,
   hapticLight, hapticSuccess, hapticError, showScreen,
   SPEAK_ICON, db.
   Форматы тренировки (чередуются по кругу):
   choice  — выбери реплику (близкие дистракторы),
   build   — собери реплику из плиток,
   input   — впиши реплику,
   gap     — дополни реплику (пропуск слова),
   recall  — самопроверка (запасной формат).
   ============================================================ */

// ============================================================
// СТАРТОВЫЕ ДИАЛОГИ (20 штук)
// Лексика — из словаря приложения (words.js / diccionario).
// who: "me" — реплики пользователя, "other" — реплики собеседника.
// tr — приблизительное чтение кириллицей.
// ============================================================

const DIALOG_SET = [
  {
    id: 'd1',
    title: 'Знакомство',
    situation: 'Ты знакомишься с Пабло: имена, откуда вы, чем занимаетесь.',
    role: 'Пабло',
    lines: [
      { who: 'other', es: '¡Hola! Soy Pablo. ¿Y tú?', ru: 'Привет! Я Пабло. А ты?', tr: 'ола! сои пабло. и ту?' },
      { who: 'me', es: 'Hola, Pablo. Me llamo Anna.', ru: 'Привет, Пабло. Меня зовут Аня.', tr: 'ола, пабло. мэ йамо анна' },
      { who: 'other', es: 'Mucho gusto, Anna. ¿De dónde eres?', ru: 'Очень приятно, Аня. Откуда ты?', tr: 'мучо густо, анна. дэ дондэ эрэс?' },
      { who: 'me', es: 'Soy de Rusia, de Moscú.', ru: 'Я из России, из Москвы.', tr: 'сой дэ русиа, дэ моску' },
      { who: 'other', es: 'Encantado. Yo soy de aquí.', ru: 'Очень приятно. А я здешний.', tr: 'энкантадо. йо сой дэ аки' },
      { who: 'me', es: '¿Y a qué te dedicas, Pablo?', ru: 'А чем ты занимаешься, Пабло?', tr: 'и а кэ тэ дэдикас, пабло?' },
      { who: 'other', es: 'Soy camarero. Es un trabajo difícil.', ru: 'Я официант. Это трудная работа.', tr: 'сой камарэро. эс ун трабахо дифисиль' },
      { who: 'me', es: 'Yo soy estudiante. Estudio español.', ru: 'Я студентка. Учусь испанскому.', tr: 'йо сой эстудьантэ. эстудио эспаньоль' },
      { who: 'other', es: '¡El español es divertido! ¿Verdad?', ru: 'Испанский — весёлый! Не так ли?', tr: 'эль эспаньоль эс дивэртидо! вэрдад?' },
      { who: 'me', es: 'Sí, y es difícil también.', ru: 'Да, и он сложный тоже.', tr: 'си, и эс дифисиль тамбьен' },
      { who: 'other', es: 'Bueno, ¡hasta luego, Anna!', ru: 'Ну, до скорого, Аня!', tr: 'буэно, аста луэго, анна!' },
      { who: 'me', es: '¡Hasta pronto, Pablo!', ru: 'До скорого, Пабло!', tr: 'аста пронто, пабло!' }
    ]
  },
  {
    id: 'd2',
    title: 'Как дела?',
    situation: 'Встреча с Марией: как дела, работа, планы на выходной.',
    role: 'Мария',
    lines: [
      { who: 'other', es: '¡Hola, Anna! ¿Qué tal?', ru: 'Привет, Аня! Как дела?', tr: 'ола, анна! кэ таль?' },
      { who: 'me', es: 'Muy bien, gracias. ¿Y tú?', ru: 'Очень хорошо, спасибо. А ты?', tr: 'муй бьэн, грасиас. и ту?' },
      { who: 'other', es: 'Más o menos. Es que trabajo mucho.', ru: 'Так себе. Дело в том, что я много работаю.', tr: 'мас о мэнос. эс кэ трабахо мучо' },
      { who: 'me', es: '¿Trabajas hoy?', ru: 'Ты сегодня работаешь?', tr: 'трабахас ой?' },
      { who: 'other', es: 'Sí, hoy estoy muy ocupada.', ru: 'Да, сегодня я очень занята.', tr: 'си, ой эстой муй окапада' },
      { who: 'me', es: '¿Descansas el domingo?', ru: 'Отдыхаешь в воскресенье?', tr: 'дэскансас эль доминго?' },
      { who: 'other', es: 'Sí, el domingo descanso en casa.', ru: 'Да, в воскресенье я отдыхаю дома.', tr: 'си, эль доминго дэскансо эн коса' },
      { who: 'me', es: 'Bueno, ¡nos vemos el domingo!', ru: 'Ну, увидимся в воскресенье!', tr: 'буэно, нос вэмос эль доминго!' },
      { who: 'other', es: '¡Está bien! ¡Hasta luego!', ru: 'Хорошо! До скорого!', tr: 'эста бьэн! аста луэго!' }
    ]
  },
  {
    id: 'd3',
    title: 'В кафе',
    situation: 'Ты заказываешь кофе в кафе и платишь.',
    role: 'Официант',
    lines: [
      { who: 'other', es: 'Buenas tardes, señora.', ru: 'Добрый день, госпожа.', tr: 'буэнас тардэс, сеньора' },
      { who: 'me', es: 'Buenas tardes. Un café, por favor.', ru: 'Добрый день. Кофе, пожалуйста.', tr: 'буэнас тардэс. ун кафэ, пор фавор' },
      { who: 'other', es: '¿Y para comer?', ru: 'А поесть?', tr: 'и пара комэр?' },
      { who: 'me', es: 'No, gracias. Solo un café.', ru: 'Нет, спасибо. Только кофе.', tr: 'но, грасиас. соло ун кафэ' },
      { who: 'other', es: 'Un café para la señora.', ru: 'Кофе для вас.', tr: 'ун кафэ пара ла сеньора' },
      { who: 'me', es: 'Gracias. ¿Cuánto es?', ru: 'Спасибо. Сколько с меня?', tr: 'грасиас. куанто эс?' },
      { who: 'other', es: 'Dos euros.', ru: 'Два евро.', tr: 'дос эурос' },
      { who: 'me', es: 'Aquí tiene. ¡Gracias!', ru: 'Вот, возьмите. Спасибо!', tr: 'аки тьэнэ. грасиас!' },
      { who: 'other', es: '¡Gracias a usted! ¡Hasta luego!', ru: 'Спасибо вам! До скорого!', tr: 'грасиас а устэд! аста луэго!' },
      { who: 'me', es: '¡Hasta la vista!', ru: 'До встречи!', tr: 'аста ла виста!' }
    ]
  },
  {
    id: 'd4',
    title: 'В магазине',
    situation: 'Ты покупаешь карандаши: цвет, цена, множественное число.',
    role: 'Продавщица',
    lines: [
      { who: 'other', es: 'Buenas tardes, joven.', ru: 'Добрый день, молодой человек.', tr: 'буэнас тардэс, ховэн' },
      { who: 'me', es: 'Buenas tardes. Un lápiz azul, por favor.', ru: 'Добрый день. Синий карандаш, пожалуйста.', tr: 'буэнас тардэс. ун лапис асуль, пор фавор' },
      { who: 'other', es: 'Un lápiz azul... Ahora, un momento.', ru: 'Синий карандаш... Сейчас, минуту.', tr: 'ун лапис асуль... аора, ун момэнто' },
      { who: 'other', es: 'Aquí tiene. Es nuevo.', ru: 'Вот, возьмите. Он новый.', tr: 'аки тьэнэ. эс нуэво' },
      { who: 'me', es: '¿Es bonito? ¿Cuánto cuesta?', ru: 'Он красивый? Сколько стоит?', tr: 'эс бонито? куанто куэста?' },
      { who: 'other', es: 'Es bonito y barato: un euro.', ru: 'Он красивый и дешёвый: один евро.', tr: 'эс бонито и барато: ун эуро' },
      { who: 'me', es: 'Es barato. Compro dos.', ru: 'Это дёшево. Беру два.', tr: 'эс барато. компро дос' },
      { who: 'other', es: '¿Dos lápices?', ru: 'Два карандаша?', tr: 'дос лаписэс?' },
      { who: 'me', es: 'Sí, dos lápices azules.', ru: 'Да, два синих карандаша.', tr: 'си, дос лаписэс асулэс' },
      { who: 'other', es: 'Muy bien. Son dos euros.', ru: 'Очень хорошо. Это два евро.', tr: 'муй бьэн. сон дос эурос' },
      { who: 'me', es: 'Aquí tiene. ¡Gracias!', ru: 'Вот, возьмите. Спасибо!', tr: 'аки тьэнэ. грасиас!' }
    ]
  },
  {
    id: 'd5',
    title: 'В университете',
    situation: 'Разговор с преподавателем перед уроком испанского.',
    role: 'Профессор',
    lines: [
      { who: 'other', es: 'Buenos días, Anna. ¿Cómo estás?', ru: 'Добрый день, Аня. Как ты?', tr: 'буэнос диас, анна. комо эстас?' },
      { who: 'me', es: 'Bien, gracias, profesor. ¿Y usted?', ru: 'Хорошо, спасибо, профессор. А Вы?', tr: 'бьэн, грасиас, профэсор. и устэд?' },
      { who: 'other', es: 'Muy bien. La clase es a las nueve.', ru: 'Очень хорошо. Урок в девять.', tr: 'муй бьэн. ла класэ эс а лас нуэвэ' },
      { who: 'me', es: '¿La clase de español?', ru: 'Урок испанского?', tr: 'ла класэ дэ эспаньоль?' },
      { who: 'other', es: 'Sí. Hoy estudiamos el idioma.', ru: 'Да. Сегодня мы изучаем язык.', tr: 'си. ой эстудиамос эль идиома' },
      { who: 'me', es: '¿Es difícil el idioma?', ru: 'Язык сложный?', tr: 'эс дифисиль эль идиома?' },
      { who: 'other', es: 'Un poco. Y muy interesante.', ru: 'Немного. И очень интересный.', tr: 'ун поко. и муй интэрэсантэ' },
      { who: 'me', es: 'Leo un libro en español ahora.', ru: 'Я сейчас читаю книгу на испанском.', tr: 'лэо ун либро эн эспаньоль аора' },
      { who: 'other', es: '¡Muy bien! ¿Es interesante?', ru: 'Очень хорошо! Она интересная?', tr: 'муй бьэн! эс интэрэсантэ?' },
      { who: 'me', es: 'Sí, es un libro bueno.', ru: 'Да, это хорошая книга.', tr: 'си, эс ун либро буэно' },
      { who: 'other', es: 'Nos vemos en la clase.', ru: 'Увидимся на уроке.', tr: 'нос вэмос эн ла класэ' },
      { who: 'me', es: '¡Hasta luego, profesor!', ru: 'До скорого, профессор!', tr: 'аста луэго, профэсор!' }
    ]
  },
  {
    id: 'd6',
    title: 'Моя семья',
    situation: 'Кристина расспрашивает тебя о семье: кто кем работает.',
    role: 'Кристина',
    lines: [
      { who: 'other', es: 'Anna, ¿es grande tu familia?', ru: 'Аня, твоя семья большая?', tr: 'анна, эс грандэ ту фамилиа?' },
      { who: 'me', es: 'Sí, mi familia es grande.', ru: 'Да, моя семья большая.', tr: 'си, ми фамилиа эс грандэ' },
      { who: 'other', es: '¿Quién trabaja?', ru: 'Кто работает?', tr: 'кьен трабаха?' },
      { who: 'me', es: 'Mi padre y mi madre. Mi padre es abogado.', ru: 'Папа и мама. Папа адвокат.', tr: 'ми падрэ и ми мадрэ. ми падрэ эс абогадо' },
      { who: 'other', es: '¿Y tu madre?', ru: 'А мама?', tr: 'и ту мадрэ?' },
      { who: 'me', es: 'Es maestra. Trabaja en una escuela.', ru: 'Она учительница. Работает в школе.', tr: 'эс маэстра. трабаха эн уна эскуэла' },
      { who: 'other', es: '¿Y tu novio?', ru: 'А твой парень?', tr: 'и ту новьо?' },
      { who: 'me', es: 'Sí, es ingeniero. Es joven y muy inteligente.', ru: 'Да, он инженер. Он молодой и очень умный.', tr: 'си, эс инхэньеро. эс ховэн и муй интэлихэнтэ' },
      { who: 'other', es: '¿Y tu abuelo?', ru: 'А дедушка?', tr: 'и ту абвэло?' },
      { who: 'me', es: 'Mi abuelo tiene ochenta años.', ru: 'Моему дедушке восемьдесят лет.', tr: 'ми абвэло тьэнэ очэнта аньос' },
      { who: 'other', es: 'Ochenta años... ¡Es joven también!', ru: 'Восемьдесят... Он тоже молодой!', tr: 'очэнта аньос... эс ховэн тамбьэн!' }
    ]
  },
  {
    id: 'd7',
    title: 'Выходной',
    situation: 'Пабло рассказывает, чем занимается в субботу и воскресенье.',
    role: 'Пабло',
    lines: [
      { who: 'other', es: 'Pablo, ¿qué haces el sábado?', ru: 'Пабло, что ты делаешь в субботу?', tr: 'пабло, кэ асэс эль сабадо?' },
      { who: 'me', es: 'El sábado descanso. Estoy libre.', ru: 'В субботу я отдыхаю. Я свободен.', tr: 'эль сабадо дэскансо. эстой либрэ' },
      { who: 'other', es: '¿Descansas en casa?', ru: 'Отдыхаешь дома?', tr: 'дэскансас эн коса?' },
      { who: 'me', es: 'No, escucho música y bailo salsa.', ru: 'Нет, я слушаю музыку и танцую сальсу.', tr: 'но, эскучо мусика и байло сальса' },
      { who: 'other', es: '¡Bailas muy bien!', ru: 'Ты очень хорошо танцуешь!', tr: 'байлас муй бьэн!' },
      { who: 'me', es: 'Gracias. ¿Y tú, qué haces el sábado?', ru: 'Спасибо. А ты что делаешь в субботу?', tr: 'грасиас. и ту, кэ асэс эль сабадо?' },
      { who: 'other', es: 'Leo un libro en el parque. El parque es bonito.', ru: 'Читаю книгу в парке. Парк красивый.', tr: 'лэо ун либро эн эль паркэ. эль паркэ эс бонито' },
      { who: 'me', es: '¿Y el domingo?', ru: 'А в воскресенье?', tr: 'и эль доминго?' },
      { who: 'other', es: 'El domingo estoy en casa con la radio.', ru: 'В воскресенье я дома с радио.', tr: 'эль доминго эстой эн коса кон ла радьо' },
      { who: 'me', es: 'Está bien. Bueno, ¡nos vemos!', ru: 'Хорошо. Ну, увидимся!', tr: 'эста бьэн. буэно, нос вэмос!' },
      { who: 'other', es: '¡Hasta luego!', ru: 'До скорого!', tr: 'аста луэго!' }
    ]
  },
  {
    id: 'd8',
    title: 'Кто это?',
    situation: 'Мария спрашивает, кто эти люди на фотографии.',
    role: 'Мария',
    lines: [
      { who: 'other', es: '¡Hola, Anna! ¿Quién es él?', ru: 'Привет, Аня! Кто он?', tr: 'ола, анна! кьен эс эль?' },
      { who: 'me', es: 'Es Pedro. Es mi novio.', ru: 'Это Педро. Мой парень.', tr: 'эс пэдро. эс ми новьо' },
      { who: 'other', es: '¿Cómo se llama ella?', ru: 'А как её зовут?', tr: 'комо сэ йама эйя?' },
      { who: 'me', es: 'Se llama María. Es mi amiga.', ru: 'Её зовут Мария. Она моя подруга.', tr: 'сэ йама мария. эс ми амига' },
      { who: 'other', es: '¿Es española?', ru: 'Она испанка?', tr: 'эс эспаньола?' },
      { who: 'me', es: 'No, es rusa. De Moscú.', ru: 'Нет, она русская. Из Москвы.', tr: 'но, эс руса. дэ моску' },
      { who: 'other', es: '¿Y Pedro? ¿Es ruso también?', ru: 'А Педро? Он тоже русский?', tr: 'и пэдро? эс русо тамбьэн?' },
      { who: 'me', es: 'No, él es español.', ru: 'Нет, он испанец.', tr: 'но, эль эс эспаньоль' },
      { who: 'other', es: 'Bueno, ¡hasta pronto!', ru: 'Ну, до скорого!', tr: 'буэно, аста пронто!' },
      { who: 'me', es: '¡Nos vemos!', ru: 'Увидимся!', tr: 'нос вэмос!' }
    ]
  },
  {
    id: 'd9',
    title: 'У врача',
    situation: 'Приём у врача: голова, усталость, отдых.',
    role: 'Врач',
    lines: [
      { who: 'other', es: 'Buenos días. ¿Cómo está usted?', ru: 'Добрый день. Как вы поживаете?', tr: 'буэнос диас. комо эста устэд?' },
      { who: 'me', es: 'Mal, médico. Estoy enfermo.', ru: 'Плохо, доктор. Я болен.', tr: 'маль, мэдико. эстой энфэрмо' },
      { who: 'other', es: '¿Qué tal la cabeza?', ru: 'Как голова?', tr: 'кэ таль ла кабэса?' },
      { who: 'me', es: 'Tengo dolor de cabeza.', ru: 'У меня болит голова.', tr: 'тэнго долор дэ кабэса' },
      { who: 'other', es: 'Un momento... Está cansado también, ¿verdad?', ru: 'Минуту... Вы и устали, не так ли?', tr: 'ун момэнто... эста кансадо тамбьэн, вэрдад?' },
      { who: 'me', es: 'Sí, estoy muy cansado. Trabajo mucho.', ru: 'Да, я очень устал. Я много работаю.', tr: 'си, эстой муй кансадо. трабахо мучо' },
      { who: 'other', es: 'Es que usted trabaja mucho.', ru: 'Дело в том, что вы много работаете.', tr: 'эс кэ устэд трабаха мучо' },
      { who: 'me', es: 'Sí, es verdad.', ru: 'Да, это правда.', tr: 'си, эс вэрдад' },
      { who: 'other', es: 'Ahora usted descansa en casa.', ru: 'Сейчас вы отдыхаете дома.', tr: 'аора устэд дэсканса эн коса' },
      { who: 'me', es: 'Está bien, médico. ¡Gracias!', ru: 'Хорошо, доктор. Спасибо!', tr: 'эста бьэн, мэдико. грасиас!' },
      { who: 'other', es: 'Hasta pronto. Y no fuma, ¿verdad?', ru: 'До скорого. И не курите, не так ли?', tr: 'аста пронто. и но фума, вэрдад?' },
      { who: 'me', es: 'No, no fumo.', ru: 'Нет, не курю.', tr: 'но, но фумо' }
    ]
  },
  {
    id: 'd10',
    title: 'Фотография',
    situation: 'Хуан рассматривает твою фотографию и расспрашивает о людях на ней.',
    role: 'Хуан',
    lines: [
      { who: 'other', es: '¿Qué es esto?', ru: 'Что это?', tr: 'кэ эс эсто?' },
      { who: 'me', es: 'Es una foto.', ru: 'Это фотография.', tr: 'эс уна фото' },
      { who: 'other', es: '¿Quién es ella?', ru: 'Кто она?', tr: 'кьен эс эйя?' },
      { who: 'me', es: 'Es mi amiga. Es médica.', ru: 'Это моя подруга. Она врач.', tr: 'эс ми амига. эс мэдика' },
      { who: 'other', es: '¿Es alegre?', ru: 'Она весёлая?', tr: 'эс алэгрэ?' },
      { who: 'me', es: 'Sí, es muy alegre y joven.', ru: 'Да, она очень весёлая и молодая.', tr: 'си, эс муй алэгрэ и ховэн' },
      { who: 'other', es: '¿Y quién es él?', ru: 'А кто он?', tr: 'и кьен эс эль?' },
      { who: 'me', es: 'Es el novio de María.', ru: 'Это парень Марии.', tr: 'эс эль новьо дэ мария' },
      { who: 'other', es: '¿Es pintor?', ru: 'Он художник?', tr: 'эс пинтор?' },
      { who: 'me', es: 'No, es pianista.', ru: 'Нет, он пианист.', tr: 'но, эс пианиста' },
      { who: 'other', es: 'La foto es bonita.', ru: 'Фотография красивая.', tr: 'ла фото эс бонита' },
      { who: 'me', es: 'Sí, y la chica es hermosa.', ru: 'Да, и девушка прекрасная.', tr: 'си, и ла чика эс эрмоса' }
    ]
  },
  {
    id: 'd11',
    title: 'Книга',
    situation: 'Ты покупаешь книгу на испанском в магазине.',
    role: 'Продавец',
    lines: [
      { who: 'other', es: 'Buenas tardes.', ru: 'Добрый день.', tr: 'буэнас тардэс' },
      { who: 'me', es: 'Buenas tardes. Un libro, por favor.', ru: 'Добрый день. Книгу, пожалуйста.', tr: 'буэнас тардэс. ун либро, пор фавор' },
      { who: 'other', es: '¿Un libro en español?', ru: 'Книгу на испанском?', tr: 'ун либро эн эспаньоль?' },
      { who: 'me', es: 'Sí, un libro fácil.', ru: 'Да, лёгкую книгу.', tr: 'си, ун либро фасиль' },
      { who: 'other', es: 'Es un libro fácil y interesante.', ru: 'Это лёгкая и интересная книга.', tr: 'эс ун либро фасиль и интэрэсантэ' },
      { who: 'me', es: '¿Cuánto cuesta?', ru: 'Сколько стоит?', tr: 'куанто куэста?' },
      { who: 'other', es: 'Diez euros.', ru: 'Десять евро.', tr: 'дьес эурос' },
      { who: 'me', es: 'Es barato. Aquí tiene.', ru: 'Дёшево. Вот, возьмите.', tr: 'эс барато. аки тьэнэ' },
      { who: 'other', es: '¡Gracias! Ahora lee y habla español.', ru: 'Спасибо! Теперь читай и говори по-испански.', tr: 'грасиас! аора лээ и абла эспаньоль' },
      { who: 'me', es: '¡Sí! ¡Hasta luego!', ru: 'Да! До скорого!', tr: 'си! аста луэго!' }
    ]
  },
  {
    id: 'd12',
    title: 'В парке',
    situation: 'Прогулка с Пабло: где вы живёте, какие у вас дома.',
    role: 'Пабло',
    lines: [
      { who: 'other', es: '¡Hola, Anna! El parque es bonito, ¿verdad?', ru: 'Привет, Аня! Парк красивый, правда?', tr: 'ола, анна! эль паркэ эс бонито, вэрдад?' },
      { who: 'me', es: 'Sí, es muy bonito. ¿Dónde vives, Pablo?', ru: 'Да, очень красивый. Где ты живёшь, Пабло?', tr: 'си, эс муй бонито. дондэ вивэс, пабло?' },
      { who: 'other', es: 'Vivo en la ciudad. Mi casa es pequeña.', ru: 'Я живу в городе. Мой дом маленький.', tr: 'виво эн ла сьюдад. ми коса эс пэкэньо' },
      { who: 'me', es: '¿Está tu casa cerca?', ru: 'Твой дом рядом?', tr: 'эста ту коса сэрка?' },
      { who: 'other', es: 'Sí, muy cerca.', ru: 'Да, очень близко.', tr: 'си, муй сэрка' },
      { who: 'me', es: 'Y mi casa es grande. Está en Moscú.', ru: 'А мой дом большой. Он в Москве.', tr: 'и ми коса эс грандэ. эста эн моску' },
      { who: 'other', es: '¿Es una casa hermosa?', ru: 'Это красивый дом?', tr: 'эс уна коса эрмоса?' },
      { who: 'me', es: 'Sí, hermosa y vieja.', ru: 'Да, красивый и старый.', tr: 'си, эрмоса и вьэха' },
      { who: 'other', es: 'Viejo y hermoso — es bueno.', ru: 'Старый и красивый — это хорошо.', tr: 'вьэхо и эрмосо — эс буэно' },
      { who: 'me', es: 'Claro. Bueno, ¡hasta luego!', ru: 'Конечно. Ну, до скорого!', tr: 'кларо. буэно, аста луэго!' }
    ]
  },
  {
    id: 'd13',
    title: 'Тоже и тоже не',
    situation: 'Разговор о языках: también, tampoco и какой ты полиглот.',
    role: 'Мария',
    lines: [
      { who: 'other', es: 'Anna, ¿hablas francés?', ru: 'Аня, ты говоришь по-французски?', tr: 'анна, аблас франсэс?' },
      { who: 'me', es: 'No, no hablo francés.', ru: 'Нет, я не говорю по-французски.', tr: 'но, но абло франсэс' },
      { who: 'other', es: 'Yo tampoco. Hablo español y ruso.', ru: 'Я тоже нет. Говорю по-испански и по-русски.', tr: 'йо тампочко. абло эспаньоль и русо' },
      { who: 'me', es: 'Yo también hablo ruso. Es mi idioma.', ru: 'Я тоже говорю по-русски. Это мой язык.', tr: 'йо тамбьэн абло русо. эс ми идиома' },
      { who: 'other', es: '¿Y el español?', ru: 'А испанский?', tr: 'и эль эспаньоль?' },
      { who: 'me', es: 'Hablo un poco. Es difícil.', ru: 'Говорю немного. Он сложный.', tr: 'абло ун поко. эс дифисиль' },
      { who: 'other', es: 'Es difícil. Y es divertido también.', ru: 'Он сложный. И он тоже весёлый.', tr: 'эс дифисиль. и эс дивэртидо тамбьэн' },
      { who: 'me', es: 'Creo que sí.', ru: 'Думаю, что да.', tr: 'крэо кэ си' },
      { who: 'other', es: 'Ahora estudiamos español.', ru: 'Теперь мы учим испанский.', tr: 'аора эстудиамос эспаньоль' },
      { who: 'me', es: 'Sí, ¡vamos!', ru: 'Да, пойдём!', tr: 'си, вамос!' }
    ]
  },
  {
    id: 'd14',
    title: 'Вечером',
    situation: 'Мария расспрашивает, что ты делаешь вечером.',
    role: 'Мария',
    lines: [
      { who: 'other', es: '¿Qué haces por la noche, Anna?', ru: 'Что ты делаешь вечером, Аня?', tr: 'кэ асэс пор ла ночэ, анна?' },
      { who: 'me', es: 'Leo un libro o escucho la radio.', ru: 'Читаю книгу или слушаю радио.', tr: 'лэо ун либро о эскучо ла радьо' },
      { who: 'other', es: '¿En español?', ru: 'На испанском?', tr: 'эн эспаньоль?' },
      { who: 'me', es: 'Sí, en español. Es un poco difícil.', ru: 'Да, на испанском. Немного сложно.', tr: 'си, эн эспаньоль. эс ун поко дифисиль' },
      { who: 'other', es: '¿Y bebes café por la noche?', ru: 'А пьёшь кофе вечером?', tr: 'и бэбэс кафэ пор ла ночэ?' },
      { who: 'me', es: 'Sí, bebo mucho café.', ru: 'Да, я пью много кофе.', tr: 'си, бэбо мучо кафэ' },
      { who: 'other', es: 'El café por la noche... Está mal, ¿no?', ru: 'Кофе вечером... Плохо, не так ли?', tr: 'эль кафэ пор ла ночэ... эста маль, но?' },
      { who: 'me', es: '¿Está mal? ¿Por qué?', ru: 'Плохо? Почему?', tr: 'эста маль? пор кэ?' },
      { who: 'other', es: 'La noche es para descansar.', ru: 'Вечер — для отдыха.', tr: 'ла ночэ эс пара дэскансар' },
      { who: 'me', es: 'Es verdad. Bueno, ¡hasta mañana!', ru: 'Это правда. Ну, до завтра!', tr: 'эс вэрдад. буэно, аста маньяна!' },
      { who: 'other', es: '¡Hasta mañana, Anna!', ru: 'До завтра, Аня!', tr: 'аста маньяна, анна!' }
    ]
  },
  {
    id: 'd15',
    title: 'Музыка',
    situation: 'Разговор о музыке, пении и танцах, договорённость о субботе.',
    role: 'Пабло',
    lines: [
      { who: 'other', es: '¿Escuchas música, Anna?', ru: 'Ты слушаешь музыку, Аня?', tr: 'эскучас мусика, анна?' },
      { who: 'me', es: 'Sí, escucho música ahora.', ru: 'Да, я слушаю музыку сейчас.', tr: 'си, эскучо мусика аора' },
      { who: 'other', es: '¿Y cantas?', ru: 'А поёшь?', tr: 'и кантас?' },
      { who: 'me', es: 'Cantar... no, canto mal.', ru: 'Петь... нет, я пою плохо.', tr: 'кантар... но, канто маль' },
      { who: 'other', es: 'Yo también canto mal. ¡Fatal!', ru: 'Я тоже пою плохо. Ужасно!', tr: 'йо тамбьэн канто маль. фаталь!' },
      { who: 'me', es: '¡No pasa nada! Es divertido.', ru: 'Ничего страшного! Это весело.', tr: 'но паса нада! эс дивэртидо' },
      { who: 'other', es: '¿Bailas salsa?', ru: 'Танцуешь сальсу?', tr: 'байлас сальса?' },
      { who: 'me', es: 'Sí, bailo salsa los sábados.', ru: 'Да, я танцую сальсу по субботам.', tr: 'си, байло сальса лос сабадос' },
      { who: 'other', es: '¡Yo también! ¿Vamos el sábado?', ru: 'Я тоже! Пойдём в субботу?', tr: 'йо тамбьэн! вамос эль сабадо?' },
      { who: 'me', es: 'Sí, ¡está bien!', ru: 'Да, хорошо!', tr: 'си, эста бьэн!' }
    ]
  },
  {
    id: 'd16',
    title: 'Жизнь в Испании',
    situation: 'Хуан расспрашивает о твоей жизни в Испании: город, климат, работа.',
    role: 'Хуан',
    lines: [
      { who: 'other', es: '¿Dónde vives ahora, Anna?', ru: 'Где ты теперь живёшь, Аня?', tr: 'дондэ вивэс аора, анна?' },
      { who: 'me', es: 'Ahora vivo en España.', ru: 'Теперь я живу в Испании.', tr: 'аора виво эн эспанья' },
      { who: 'other', es: '¿En una ciudad grande?', ru: 'В большом городе?', tr: 'эн уна сьюдад грандэ?' },
      { who: 'me', es: 'No, en una ciudad pequeña. Es hermosa.', ru: 'Нет, в маленьком городе. Он прекрасный.', tr: 'но, эн уна сьюдад пэкэнья. эс эрмоса' },
      { who: 'other', es: '¿Y el clima?', ru: 'А климат?', tr: 'и эль клима?' },
      { who: 'me', es: 'El clima es agradable.', ru: 'Климат приятный.', tr: 'эль клима эс аградаблэ' },
      { who: 'other', es: '¿Trabajas en España?', ru: 'Работаешь в Испании?', tr: 'трабахас эн эспанья?' },
      { who: 'me', es: 'Sí, soy intérprete.', ru: 'Да, я переводчица.', tr: 'си, сой интерпрэтэ' },
      { who: 'other', es: '¡Muy bien! ¿Es un trabajo interesante?', ru: 'Очень хорошо! Это интересная работа?', tr: 'муй бьэн! эс ун трабахо интэрэсантэ?' },
      { who: 'me', es: 'Sí, es muy interesante.', ru: 'Да, очень интересная.', tr: 'си, эс муй интэрэсантэ' },
      { who: 'other', es: '¿Y la vida en España?', ru: 'А жизнь в Испании?', tr: 'и ла вида эн эспанья?' },
      { who: 'me', es: 'La vida es bella.', ru: 'Жизнь прекрасна.', tr: 'ла вида эс бэйа' }
    ]
  },
  {
    id: 'd17',
    title: 'Прощание',
    situation: 'Вечерний разговор с Пабло: усталость и договорённость на завтра.',
    role: 'Пабло',
    lines: [
      { who: 'other', es: 'Buenas noches, Anna.', ru: 'Добрый вечер, Аня.', tr: 'буэнас ночэс, анна' },
      { who: 'me', es: 'Buenas noches, Pablo. ¿Qué tal?', ru: 'Добрый вечер, Пабло. Как дела?', tr: 'буэнас ночэс, пабло. кэ таль?' },
      { who: 'other', es: 'Vamos tirando. ¿Y tú?', ru: 'Потихоньку. А ты?', tr: 'вамос тирандо. и ту?' },
      { who: 'me', es: 'Regular. Estoy muy cansada.', ru: 'Так себе. Я очень устала.', tr: 'рэгулар. эстой муй кансада' },
      { who: 'other', es: 'Es tarde, ¿no?', ru: 'Уже поздно, не так ли?', tr: 'эс тардэ, но?' },
      { who: 'me', es: 'Sí, es tarde. Yo estoy en casa ahora.', ru: 'Да, поздно. Я сейчас дома.', tr: 'си, эс тардэ. йо эстой эн коса аора' },
      { who: 'other', es: 'Bueno. ¿Nos vemos mañana?', ru: 'Ну. Увидимся завтра?', tr: 'буэно. нос вэмос маньяна?' },
      { who: 'me', es: '¿A las nueve?', ru: 'В девять?', tr: 'а лас нуэвэ?' },
      { who: 'other', es: 'Sí, a las nueve. ¡Hasta la vista!', ru: 'Да, в девять. До встречи!', tr: 'си, а лас нуэвэ. аста ла виста!' },
      { who: 'me', es: '¡Hasta pronto, Pablo!', ru: 'До скорого, Пабло!', tr: 'аста пронто, пабло!' }
    ]
  },
  {
    id: 'd18',
    title: 'Профессии',
    situation: 'Хуан расспрашивает, кем работают ты и твоя семья.',
    role: 'Хуан',
    lines: [
      { who: 'other', es: '¿A qué te dedicas, Anna?', ru: 'Чем ты занимаешься, Аня?', tr: 'а кэ тэ дэдикас, анна?' },
      { who: 'me', es: 'Soy periodista. Escribo historias.', ru: 'Я журналистка. Пишу истории.', tr: 'сой пэрьодиста. эскрибо историас' },
      { who: 'other', es: '¡Interesante! ¿Y tu padre?', ru: 'Интересно! А твой отец?', tr: 'интэрэсантэ! и ту падрэ?' },
      { who: 'me', es: 'Mi padre es cirujano. Trabaja en un hospital.', ru: 'Мой отец хирург. Работает в больнице.', tr: 'ми падрэ эс сирухано. трабаха эн ун оспиталь' },
      { who: 'other', es: '¿Y tu madre es médica también?', ru: 'А мама тоже врач?', tr: 'и ту мадрэ эс мэдика тамбьэн?' },
      { who: 'me', es: 'No, ella es maestra.', ru: 'Нет, она учительница.', tr: 'но, эйя эс маэстра' },
      { who: 'other', es: '¿Y tu novio?', ru: 'А твой парень?', tr: 'и ту новьо?' },
      { who: 'me', es: 'Él es arquitecto.', ru: 'Он архитектор.', tr: 'эль эс аркитэкто' },
      { who: 'other', es: 'Tu familia es inteligente.', ru: 'Твоя семья умная.', tr: 'ту фамилиа эс интэлихэнтэ' },
      { who: 'me', es: 'Sí, y trabajamos mucho.', ru: 'Да, и мы много работаем.', tr: 'си, и трабахамос мучо' }
    ]
  },
  {
    id: 'd19',
    title: 'Возраст',
    situation: 'Кристина расспрашивает, сколько лет тебе и твоим близким.',
    role: 'Кристина',
    lines: [
      { who: 'other', es: 'Anna, ¿tú tienes veinte años?', ru: 'Аня, тебе двадцать лет?', tr: 'анна, ту тьэнэс вэйнтэ аньос?' },
      { who: 'me', es: 'No, tengo veintidós años.', ru: 'Нет, мне двадцать два.', tr: 'но, тэнго вэйнтидос аньос' },
      { who: 'other', es: '¿Y María? ¿Es joven?', ru: 'А Мария? Она молодая?', tr: 'и мария? эс ховэн?' },
      { who: 'me', es: 'Sí, tiene veinte años.', ru: 'Да, ей двадцать.', tr: 'си, тьэнэ вэйнтэ аньос' },
      { who: 'other', es: '¿Y tu abuela?', ru: 'А бабушка?', tr: 'и ту абвэла?' },
      { who: 'me', es: 'Mi abuela tiene sesenta años.', ru: 'Моей бабушке шестьдесят.', tr: 'ми абвэла тьэнэ сэсэнта аньос' },
      { who: 'other', es: '¿Y el abuelo de María?', ru: 'А дедушка Марии?', tr: 'и эль абвэло дэ мария?' },
      { who: 'me', es: 'Él tiene setenta años.', ru: 'Ему семьдесят.', tr: 'эль тьэнэ сэтэнта аньос' },
      { who: 'other', es: 'Es una familia joven.', ru: 'Это молодая семья.', tr: 'эс уна фамилиа ховэн' },
      { who: 'me', es: 'Sí, y muy alegre.', ru: 'Да, и очень весёлая.', tr: 'си, и муй алэгрэ' }
    ]
  },
  {
    id: 'd20',
    title: 'Климат',
    situation: 'Сравниваете климат России и Испании, письмо подруге.',
    role: 'Хуан',
    lines: [
      { who: 'other', es: '¿Qué tal el clima en Rusia?', ru: 'Как климат в России?', tr: 'кэ таль эль клима эн русиа?' },
      { who: 'me', es: 'El clima es difícil: cero grados hoy.', ru: 'Климат суровый: сегодня ноль градусов.', tr: 'эль клима эс дифисиль: сэро градос ой' },
      { who: 'other', es: '¿Cero? ¡Fatal!', ru: 'Ноль? Ужасно!', tr: 'сэро? фаталь!' },
      { who: 'me', es: 'Sí. ¿Y el clima en España?', ru: 'Да. А климат в Испании?', tr: 'си. и эль клима эн эспанья?' },
      { who: 'other', es: 'El clima es agradable: ahora son veinte grados.', ru: 'Климат приятный: сейчас двадцать градусов.', tr: 'эль клима эс аградаблэ: аора сон вэйнтэ градос' },
      { who: 'me', es: '¡Muy bien! Ahora escribo una carta a mi amiga de España.', ru: 'Очень хорошо! Сейчас я пишу письмо подруге из Испании.', tr: 'муй бьэн! аора эскрибо уна карта а ми амига дэ эспанья' },
      { who: 'other', es: '¿Tu amiga vive en España?', ru: 'Твоя подруга живёт в Испании?', tr: 'ту амига вивэ эн эспанья?' },
      { who: 'me', es: 'Sí, en una ciudad pequeña.', ru: 'Да, в маленьком городе.', tr: 'си, эн уна сьюдад пэкэнья' },
      { who: 'other', es: '¡Bonito! ¿Y tú vives en Moscú?', ru: 'Красиво! А ты живёшь в Москве?', tr: 'бонито! и ту вивэс эн моску?' },
      { who: 'me', es: 'Sí, mi casa está en Moscú.', ru: 'Да, мой дом в Москве.', tr: 'си, ми коса эста эн моску' },
      { who: 'other', es: 'Bueno, ¡hasta luego, Anna!', ru: 'Ну, до скорого, Аня!', tr: 'буэно, аста луэго, анна!' },
      { who: 'me', es: '¡Nos vemos, Juan!', ru: 'Увидимся, Хуан!', tr: 'нос вэмос, хуан!' }
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
  '{"title":"Название по-русски","situation":"Кто, с кем и о чём говорит, по-русски, одно предложение","role":"Кто такой собеседник, по-русски, одно-два слова (Официант, Прохожий, Врач...)","lines":[{"who":"other","es":"...","ru":"...","tr":"кириллицей"},{"who":"me","es":"...","ru":"...","tr":"кириллицей"}]}',
  '',
  'Правила:',
  '1. "who": "me" — реплики пользователя (то, что он учится говорить сам), "other" — реплики собеседника.',
  '2. В каждом диалоге 8–12 реплик, они чередуются; уровень языка A1, простые бытовые фразы.',
  '3. Реплик "me" в каждом диалоге не меньше 4 — именно их пользователь будет тренировать.',
  '4. "es" — реплика на испанском; "ru" — дословный перевод на русский; "tr" — примерное чтение кириллицей по правилам испанского произношения.',
  '5. Используй только простую частотную лексику уровня A1: ser, estar, hablar, comer, vivir, trabajar, estudiar, descansar, bailar, cantar, escuchar, beber, leer, creer, comprar, escribir, conocer, hacer.',
  '6. Если я дал готовый текст — сохрани его смысл и реплики, исправь ошибки, добавь недостающие реплики с обеих сторон, чтобы диалог звучал естественно.',
  '7. Если дал одну тему — сделай ОДИН диалог по ней. Если дал список тем — по одному диалогу на каждую тему.',
  '8. Ответ должен быть ТОЛЬКО JSON-массивом. Первый символ ответа — [, последний — ]. Никакого текста до или после, никаких пояснений, никаких markdown-обёрток.',
  '9. Поля id, own НЕ добавляй — приложение проставит их само.',
  '10. Если по теме невозможно составить диалог, ответь ровно одной строкой: НЕ ПОНЯЛ ТЕМУ',
  '',
  'Моя тема или текст:'
].join('\n');

// ---------- Отдельное хранилище диалогов ----------
const DIALOGS_KEY = 'spanishDialogs.v1';
let dialogStore = { own: [], stats: {} };

function loadDialogStore() {
  let raw = null;
  try { raw = localStorage.getItem(DIALOGS_KEY); } catch (e) { console.warn('localStorage недоступен', e); }
  if (raw) {
    try {
      const p = JSON.parse(raw);
      dialogStore = {
        own: Array.isArray(p.own) ? p.own : [],
        stats: (p.stats && typeof p.stats === 'object') ? p.stats : {}
      };
      return;
    } catch (e) {
      console.error('Битые данные диалогов, начинаю с пустого набора', e);
    }
  }
  dialogStore = { own: [], stats: {} };
}

function saveDialogStore() {
  try { localStorage.setItem(DIALOGS_KEY, JSON.stringify(dialogStore)); }
  catch (e) { toast('Не удалось сохранить диалоги: хранилище недоступно'); }
}

// ---------- Состояние режима ----------
let dialogView = null;   // открытый диалог: { dialog, mode, idx, playing, queue, ... }
let draftLines = [];     // черновик создаваемого диалога
let draftWho = 'other';  // чья реплика добавляется в черновик

// Все диалоги: стартовые + созданные пользователем
function allDialogs() {
  return DIALOG_SET.concat(dialogStore.own);
}

// Статистика по диалогу: { plays, trains, best }
function dialogStats(id) {
  return dialogStore.stats[id] || { plays: 0, trains: 0, best: -1 };
}

// Переход к списку диалогов (showScreen из app.js не знает про рендер списка)
function goDialogsList() {
  stopPlay();
  showScreen('dialogs');
  renderDialogsList();
}

// ---------- Список диалогов ----------
function renderDialogsList() {
  const list = el('dialogs-list');
  if (!list) return;
  const dialogs = allDialogs();
  let html = '';
  dialogs.forEach(function (d) {
    const lines = Array.isArray(d.lines) ? d.lines : [];
    const st = dialogStats(d.id);
    const meCount = lines.filter(function (l) { return l.who === 'me'; }).length;
    const best = st.best >= 0 ? st.best + '%' : '–';
    html += '<div class="dialog-card">' +
      '<div class="dlg-top"><div class="dlg-title">' + esc(d.title) + '</div>' +
      '<span class="dlg-badge">' + esc(d.role || 'диалог') + '</span></div>' +
      (d.situation ? '<div class="dlg-situation">' + esc(d.situation) + '</div>' : '') +
      '<div class="dlg-meta">' + lines.length + ' реплик · твоих: ' + meCount +
      ' · тренировок: ' + st.trains + ' · лучший результат: ' + best + '</div>' +
      '<div class="dlg-best"><div class="dlg-best-fill" style="width:' + (st.best >= 0 ? st.best : 0) + '%"></div></div>' +
      '<div class="dlg-actions">' +
      '<button class="dlg-btn-read" data-id="' + esc(d.id) + '" data-mode="read">Читать</button>' +
      '<button class="dlg-btn-play" data-id="' + esc(d.id) + '" data-mode="play">Слушать</button>' +
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
    queue: [], answered: 0, correct: 0, step: 0
  };
  el('dlg-view-title').textContent = d.title;
  showScreen('dialog-view');
  // showScreen не знает вкладку dialog-view — подсвечиваем «Диалоги» вручную
  document.querySelectorAll('.tab').forEach(function (t) {
    t.classList.toggle('active', t.dataset.screen === 'dialogs');
  });
  if (mode === 'read') startRead();
  else if (mode === 'play') startPlay();
  else startTrain();
}

// ---------- Общие элементы чата ----------
// Прокрутка к последнему элементу чата (НЕ всего документа —
// раньше прокрутка к низу документа уводила контент из виду).
function scrollToNode(node) {
  if (!node) return;
  try { node.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  catch (e) { try { node.scrollIntoView(false); } catch (e2) {} }
}

function scrollFeed() {
  const feed = el('chat-feed');
  if (!feed) return;
  const action = el('chat-action');
  const target = (action && action.lastElementChild) ? action.lastElementChild
    : (feed.lastElementChild || feed);
  scrollToNode(target);
}

function appendRoleLabel(role) {
  const feed = el('chat-feed');
  if (!feed) return;
  const lab = document.createElement('div');
  lab.className = 'role-label';
  lab.textContent = role || 'Собеседник';
  feed.appendChild(lab);
}

// HTML пузыря. opts.tr === false — без транскрипции, opts.ru === false — без перевода
function bubbleHTML(line, opts) {
  opts = opts || {};
  const me = line.who === 'me';
  let html = '<div class="bubble ' + (me ? 'me' : 'other') + '">' +
    '<div class="b-es">' + esc(line.es) + '</div>';
  if (opts.tr !== false && line.tr) html += '<div class="b-tr">' + esc(line.tr) + '</div>';
  if (opts.ru !== false) html += '<div class="b-ru">' + esc(line.ru) + '</div>';
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
    el('chat-home2').addEventListener('click', goDialogsList);
  }
}

// ---------- РЕЖИМ «СЛУШАТЬ» ----------
function startPlay() {
  const area = el('dialog-view-area');
  area.innerHTML =
    '<div class="chat-progress">Режим прослушивания: диалог проигрывается сам, реплика за репликой.</div>' +
    '<div id="chat-feed" class="chat-feed"></div>' +
    '<div class="chat-bar"><button id="chat-stop" class="btn-danger">Остановить</button></div>';
  dialogView.idx = 0;
  dialogView.playing = true;
  el('chat-stop').addEventListener('click', goDialogsList);
  playStep();
}

// Полная остановка воспроизведения (вызывается и при уходе с экрана)
function stopPlay() {
  if (dialogView) dialogView.playing = false;
  try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) {}
}

function playStep() {
  if (!dialogView || !dialogView.playing || dialogView.mode !== 'play') return;
  const d = dialogView.dialog;
  if (dialogView.idx >= d.lines.length) { finishPlay(); return; }
  const line = d.lines[dialogView.idx];

  // Сначала индикатор «печатает…», потом пузырь
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
  const st = dialogStats(dialogView.dialog.id);
  st.plays++;
  dialogStore.stats[dialogView.dialog.id] = st;
  saveDialogStore();

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
  el('chat-home').addEventListener('click', goDialogsList);
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

// ============================================================
// РЕЖИМ «ТРЕНИРОВАТЬ» — МИКС ФОРМАТОВ
// ============================================================

const DIALOG_FORMATS = ['choice', 'build', 'input', 'gap'];
const DIALOG_FORMAT_LABELS = {
  choice: 'выбери реплику',
  build: 'собери реплику',
  input: 'впиши реплику',
  gap: 'дополни реплику',
  recall: 'вспомни реплику'
};

function startTrain() {
  const d = dialogView.dialog;
  const meIdx = [];
  d.lines.forEach(function (l, i) { if (l.who === 'me') meIdx.push(i); });
  if (!meIdx.length) {
    toast('В этом диалоге нет твоих реплик');
    goDialogsList();
    return;
  }
  dialogView.queue = shuffle(meIdx).map(function (i) { return { i: i, tries: 0 }; });
  dialogView.answered = 0;
  dialogView.correct = 0;
  dialogView.step = 0; // счётчик показов — для чередования форматов

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

// ---------- Токены и банки замен ----------
// Разбивка реплики на «сырые» токены по пробелам
function dlgTokens(es) {
  return String(es).trim().split(/\s+/).filter(Boolean);
}

// Токен → префикс (знаки до слова), ядро (само слово), хвост (знаки после)
function splitToken(t) {
  const m = String(t).match(/^([^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]*)([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)(.*)$/);
  if (!m) return null;
  return { pre: m[1], core: m[2], post: m[3] };
}

// Нормализация токена для сравнения порядка в сборке фразы
function dlgNormToken(t) { return normalizeAnswer(t); }

// Банк глагольных форм: строится из базы приложения (у глаголов есть forms).
// Ключ — форма в нижнем регистре, значение — остальные формы того же глагола.
let VERB_BANK_CACHE = null;
function verbBank() {
  if (VERB_BANK_CACHE) return VERB_BANK_CACHE;
  const bank = {};
  function addForms(forms) {
    const vals = [];
    ['yo', 'tu', 'el', 'nosotros', 'vosotros', 'ellos'].forEach(function (k) {
      if (forms[k]) vals.push(String(forms[k]).toLowerCase());
    });
    vals.forEach(function (f) {
      if (!bank[f]) bank[f] = [];
      vals.forEach(function (g) {
        if (g !== f && bank[f].indexOf(g) === -1) bank[f].push(g);
      });
    });
  }
  try {
    (db && db.words ? db.words : []).forEach(function (w) {
      if (w.type === 'verb' && w.forms) addForms(w.forms);
    });
    // Формы глаголов, которых нет в базе, но они встречаются в репликах
    EXTRA_FORMS.forEach(addForms);
  } catch (e) { /* базы нет — банк пустой, работают статические пары */ }
  VERB_BANK_CACHE = bank;
  return bank;
}

// Глаголы вне стартовой базы, чьи формы встречаются в репликах диалогов
const EXTRA_FORMS = [
  { yo: 'tengo', tu: 'tienes', el: 'tiene', nosotros: 'tenemos', vosotros: 'tenéis', ellos: 'tienen' },
  { yo: 'quiero', tu: 'quieres', el: 'quiere', nosotros: 'queremos', vosotros: 'queréis', ellos: 'quieren' },
  { yo: 'puedo', tu: 'puedes', el: 'puede', nosotros: 'podemos', vosotros: 'podéis', ellos: 'pueden' },
  { yo: 'voy', tu: 'vas', el: 'va', nosotros: 'vamos', vosotros: 'vais', ellos: 'van' },
  { yo: 'llego', tu: 'llegas', el: 'llega', nosotros: 'llegamos', vosotros: 'llegáis', ellos: 'llegan' }
];

// Статические пары близких слов из словаря приложения
const WORD_BANK = {
  'mucho': ['poco'], 'poco': ['mucho'],
  'bien': ['mal'], 'mal': ['bien'],
  'muy': ['bastante'], 'bastante': ['muy'],
  'grande': ['pequeño'], 'pequeño': ['grande'],
  'bueno': ['malo'], 'malo': ['bueno'],
  'caro': ['barato'], 'barato': ['caro'],
  'nuevo': ['viejo'], 'viejo': ['nuevo', 'joven'],
  'joven': ['viejo'],
  'alegre': ['triste'], 'triste': ['alegre', 'feliz'], 'feliz': ['triste'],
  'bonito': ['feo', 'hermoso'], 'hermoso': ['bonito', 'feo'], 'feo': ['bonito', 'hermoso'],
  'fácil': ['difícil'], 'difícil': ['fácil'],
  'interesante': ['aburrido'], 'aburrido': ['interesante'],
  'divertido': ['aburrido'],
  'español': ['francés', 'ruso'], 'francés': ['español', 'ruso'], 'ruso': ['español', 'francés'],
  'española': ['rusa', 'francesa'], 'rusa': ['española', 'francesa'],
  'hoy': ['mañana'], 'mañana': ['hoy'],
  'día': ['noche'], 'noche': ['día'],
  'sí': ['no'], 'no': ['sí'],
  'mi': ['tu'], 'tu': ['mi'], 'mis': ['tus'], 'tus': ['mis'],
  'padre': ['madre'], 'madre': ['padre'],
  'hermano': ['hermana'], 'hermana': ['hermano'],
  'abuelo': ['abuela'], 'abuela': ['abuelo'],
  'amigo': ['novio'], 'amiga': ['novio'], 'novio': ['amigo'],
  'chica': ['niña', 'chaval'], 'niña': ['chica'], 'chaval': ['chica'],
  'hombre': ['mujer'], 'mujer': ['hombre'],
  'café': ['agua'], 'agua': ['café'],
  'libro': ['página'], 'página': ['libro'],
  'casa': ['escuela', 'hospital', 'teatro'],
  'escuela': ['casa', 'universidad'], 'universidad': ['escuela'],
  'hospital': ['escuela', 'casa'],
  'teatro': ['parque'], 'parque': ['teatro'],
  'ciudad': ['mapa'], 'mapa': ['ciudad'],
  'coche': ['avión'], 'avión': ['coche'],
  'trabajo': ['clase'], 'clase': ['trabajo'],
  'profesor': ['maestro'], 'maestro': ['profesor'],
  'médico': ['cirujano'], 'cirujano': ['médico'],
  'estudiante': ['alumno'], 'alumno': ['estudiante'],
  'periodista': ['escritor'], 'escritor': ['periodista'],
  'pintor': ['pianista'], 'pianista': ['pintor'],
  'ingeniero': ['arquitecto'], 'arquitecto': ['ingeniero'],
  'abogado': ['secretario'], 'secretario': ['abogado'],
  'camarero': ['empleado'], 'empleado': ['camarero'],
  'historia': ['tema'], 'tema': ['historia'],
  'idioma': ['tema'], 'cosa': ['problema'], 'problema': ['cosa'],
  'caso': ['problema'], 'vida': ['clima'], 'clima': ['vida'],
  'mano': ['lápiz'], 'lápiz': ['mano'], 'radio': ['teléfono']
};

// Все близкие замены для слова: формы глаголов + статические пары
function replacementsFor(coreLower) {
  const out = [];
  const vb = verbBank();
  if (vb[coreLower]) {
    vb[coreLower].forEach(function (r) { if (out.indexOf(r) === -1) out.push(r); });
  }
  if (WORD_BANK[coreLower]) {
    WORD_BANK[coreLower].forEach(function (r) { if (out.indexOf(r) === -1) out.push(r); });
  }
  return out;
}

// Замена одного токена в реплике (регистр и знаки вокруг сохраняются)
function applyReplacement(tokens, idx, rep) {
  const sp = splitToken(tokens[idx]);
  if (!sp) return tokens.join(' ');
  let word = rep;
  const first = sp.core.charAt(0);
  if (first !== first.toLowerCase()) {
    word = word.charAt(0).toUpperCase() + word.slice(1);
  }
  const arr = tokens.slice();
  arr[idx] = sp.pre + word + sp.post;
  return arr.join(' ');
}

// Близкие дистракторы для выбора: 3 варианта, каждый — замена ОДНОГО
// слова правильной реплики на близкое (форма глагола / парное слово).
function buildCloseDistractions(line) {
  const tokens = dlgTokens(line.es);
  const cands = []; // { idx, rep }
  tokens.forEach(function (t, idx) {
    const sp = splitToken(t);
    if (!sp) return;
    replacementsFor(sp.core.toLowerCase()).forEach(function (r) {
      cands.push({ idx: idx, rep: r });
    });
  });
  if (cands.length < 3) return [];
  // Каждый дистрактор — замена в РАЗНОМ токене (разнообразие)
  const picked = [];
  const usedIdx = {};
  shuffle(cands).forEach(function (c) {
    if (picked.length >= 3 || usedIdx[c.idx]) return;
    usedIdx[c.idx] = true;
    picked.push(applyReplacement(tokens, c.idx, c.rep));
  });
  return picked.length >= 3 ? picked : [];
}

// Данные для формата «дополни реплику»: выбор значимого слова
// с максимумом близких замен. Возвращает { tokens, gapIdx, options, correct } или null.
const GAP_STOP = {
  'el': 1, 'la': 1, 'los': 1, 'las': 1, 'un': 1, 'una': 1, 'unos': 1, 'unas': 1,
  'y': 1, 'o': 1, 'de': 1, 'del': 1, 'en': 1, 'a': 1, 'al': 1, 'que': 1,
  'por': 1, 'para': 1, 'con': 1, 'me': 1, 'te': 1, 'se': 1, 'lo': 1,
  'mi': 1, 'tu': 1, 'su': 1, 'yo': 1, 'tú': 1, 'él': 1, 'ella': 1,
  'nosotros': 1, 'vosotros': 1, 'ellos': 1, 'ellas': 1, 'sí': 1, 'no': 1,
  'hola': 1, 'gracias': 1, 'perdón': 1, 'perdone': 1
};

function buildGapData(line) {
  const tokens = dlgTokens(line.es);
  let best = null;
  tokens.forEach(function (t, idx) {
    const sp = splitToken(t);
    if (!sp) return;
    const low = sp.core.toLowerCase();
    if (GAP_STOP[low] || sp.core.length < 3) return;
    const reps = replacementsFor(low);
    if (reps.length < 3) return;
    if (!best || reps.length > best.reps.length) best = { idx: idx, core: sp.core, reps: reps };
  });
  if (!best) return null;
  const options = shuffle([best.core.toLowerCase()].concat(shuffle(best.reps).slice(0, 3)));
  return { tokens: tokens, gapIdx: best.idx, options: options, correct: best.core };
}

// ---------- Доступность форматов и выбор ----------
function dialogFormatAvailable(line, f) {
  const tokens = dlgTokens(line.es);
  switch (f) {
    case 'choice': return buildCloseDistractions(line).length >= 3;
    case 'build': return tokens.length >= 2 && tokens.length <= 8;
    case 'input': return !!line.es;
    case 'gap': return buildGapData(line) !== null;
    default: return true;
  }
}

// Формат для текущего показа: желаемый по кругу, если недоступен — следующий
function pickDialogFormat(line, want) {
  const order = [want].concat(DIALOG_FORMATS.filter(function (f) { return f !== want; }));
  for (let i = 0; i < order.length; i++) {
    if (dialogFormatAvailable(line, order[i])) return order[i];
  }
  return 'recall';
}

// ---------- Шаг тренировки ----------
function trainStep() {
  if (!dialogView.queue.length) { finishDialogTrain(); return; }
  updateTrainProgress();
  const d = dialogView.dialog;
  const item = dialogView.queue[0];
  const line = d.lines[item.i];
  const feed = el('chat-feed');
  const action = el('chat-action');
  action.innerHTML = '';

  // Контекст: реплика собеседника, предшествующая твоей (без перевода —
  // иначе он подсказывает ответ)
  const prev = d.lines[item.i - 1];
  if (prev && prev.who === 'other') {
    appendRoleLabel(d.role);
    appendBubble(prev, { tr: false, ru: false });
  }

  // Формат: по кругу choice → build → input → gap
  const want = DIALOG_FORMATS[dialogView.step % DIALOG_FORMATS.length];
  dialogView.step++;
  item.mode = pickDialogFormat(line, want);

  // Для gap карточка задания своя (реплика с пропуском + перевод),
  // для остальных — задание с русским переводом
  if (item.mode === 'gap') {
    renderGapTask(action, item, line);
  } else {
    const task = document.createElement('div');
    task.className = 'chat-task pop';
    task.innerHTML =
      '<div class="word-mode">твой ход · ' + DIALOG_FORMAT_LABELS[item.mode] + '</div>' +
      '<div class="word-front" style="font-size:20px">' + esc(line.ru) + '</div>';
    feed.appendChild(task);

    if (item.mode === 'choice') renderChoiceTask(action, item, line);
    else if (item.mode === 'build') renderBuildTask(action, item, line);
    else if (item.mode === 'input') renderInputTask(action, item, line);
    else renderRecallTask(action, item, line);
  }
  scrollFeed();
}

// ---------- Формат «выбери реплику» (близкие дистракторы) ----------
function renderChoiceTask(action, item, line) {
  const options = shuffle([line.es].concat(buildCloseDistractions(line)));
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
      setTimeout(function () { settleTrain(item, opt, ok, {}); }, 300);
    });
    opts.appendChild(b);
  });
  action.appendChild(opts);
}

// ---------- Формат «собери реплику» (плитки) ----------
function renderBuildTask(action, item, line) {
  const tokens = dlgTokens(line.es);
  const order = shuffle(tokens.map(function (t, i) { return { t: t, i: i }; }));

  const box = document.createElement('div');
  box.innerHTML =
    '<div class="build-slots" id="bslots"><span class="slot-empty">Нажимай слова в правильном порядке</span></div>' +
    '<div class="build-tokens" id="btokens"></div>' +
    '<button class="btn-ghost" id="breset" style="margin-top:8px">Сбросить</button>';
  action.appendChild(box);

  const chosen = [];

  function refresh() {
    const slots = el('bslots');
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
      const tile = el('dtile-' + o.i);
      if (tile) tile.classList.toggle('used', chosen.some(function (c) { return c.i === o.i; }));
    });
    if (chosen.length === order.length) {
      // Автопроверка: сравниваем нормализованные последовательности
      const built = chosen.map(function (c) { return dlgNormToken(c.t); }).join(' ');
      const right = tokens.map(dlgNormToken).join(' ');
      settleTrain(item, '', built === right,
        { builtOrder: chosen.map(function (c) { return c.t; }).join(' ') });
    }
  }

  order.forEach(function (o) {
    const b = document.createElement('button');
    b.className = 'tile';
    b.id = 'dtile-' + o.i;
    b.textContent = o.t;
    b.addEventListener('click', function () {
      if (chosen.length === order.length) return;
      chosen.push(o);
      refresh();
    });
    el('btokens').appendChild(b);
  });

  el('breset').addEventListener('click', function () {
    chosen.length = 0;
    refresh();
  });
}

// ---------- Формат «впиши реплику» ----------
function renderInputTask(action, item, line) {
  const box = document.createElement('div');
  box.className = 'dialog-input';

  const hintLine = document.createElement('div');
  hintLine.className = 'hint-line';
  hintLine.textContent = '​'; // невидимый символ, чтобы блок имел высоту
  box.appendChild(hintLine);

  const inp = document.createElement('input');
  inp.id = 'dlg-input-answer';
  inp.placeholder = 'Впиши реплику на испанском';
  inp.autocomplete = 'off';
  box.appendChild(inp);

  let hintLen = 0;
  const hintBtn = document.createElement('button');
  hintBtn.className = 'btn-secondary';
  hintBtn.textContent = 'Открыть букву';
  hintBtn.addEventListener('click', function () {
    if (hintLen < line.es.length) {
      hintLen++;
      hintLine.textContent = line.es.slice(0, hintLen) + '•'.repeat(line.es.length - hintLen);
      hapticLight();
    }
  });

  const dontBtn = document.createElement('button');
  dontBtn.className = 'btn-dontknow';
  dontBtn.textContent = 'Не знаю';
  dontBtn.addEventListener('click', function () { settleTrain(item, '', false, {}); });

  const row = document.createElement('div');
  row.className = 'input-row';
  row.appendChild(hintBtn);
  row.appendChild(dontBtn);
  box.appendChild(row);

  const btn = document.createElement('button');
  btn.className = 'btn-primary';
  btn.textContent = 'Ответить';
  box.appendChild(btn);

  action.appendChild(box);

  inp.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); submitDialogInput(item, line); }
  });
  btn.addEventListener('click', function () { submitDialogInput(item, line); });
  try { inp.focus(); } catch (e) {}
}

function submitDialogInput(item, line) {
  const val = el('dlg-input-answer').value;
  if (!val.trim()) { toast('Сначала впиши реплику — или нажми «Не знаю»'); return; }
  // Прощающее сравнение: регистр, ударения и пунктуация не важны
  const ok = normalizeAnswer(val) === normalizeAnswer(line.es);
  settleTrain(item, val, ok, {});
}

// ---------- Формат «дополни реплику» (пропуск) ----------
function renderGapTask(action, item, line) {
  const data = buildGapData(line);
  if (!data) { item.mode = 'recall'; renderRecallTask(action, item, line); return; }
  item.gapData = data;

  const feed = el('chat-feed');
  const masked = data.tokens.map(function (t, i) {
    return i === data.gapIdx ? '___' : t;
  }).join(' ');

  const ans = document.createElement('div');
  ans.className = 'chat-task pop';
  ans.innerHTML =
    '<div class="word-mode">твой ход · дополни реплику</div>' +
    '<div class="word-front" style="font-size:20px">' + esc(masked) + '</div>' +
    '<div class="word-tr">' + esc(line.ru) + '</div>';
  feed.appendChild(ans);

  const opts = document.createElement('div');
  opts.className = 'options';
  data.options.forEach(function (opt) {
    const b = document.createElement('button');
    b.className = 'option';
    b.textContent = opt;
    b.addEventListener('click', function () {
      const ok = normalizeKey(opt) === normalizeKey(data.correct);
      opts.querySelectorAll('.option').forEach(function (x) {
        x.disabled = true;
        if (normalizeKey(x.textContent) === normalizeKey(data.correct)) x.style.borderColor = 'var(--ok)';
        else if (x.textContent === opt && !ok) x.style.borderColor = 'var(--err)';
      });
      setTimeout(function () { settleTrain(item, opt, ok, {}); }, 300);
    });
    opts.appendChild(b);
  });
  action.appendChild(opts);
}

// ---------- Запасной формат «вспомни реплику» ----------
function renderRecallTask(action, item, line) {
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
    el('chat-feed').appendChild(ans);
    scrollFeed();
    const known = document.createElement('button');
    known.className = 'option';
    known.textContent = 'Вспомнил';
    known.addEventListener('click', function () { settleTrain(item, '', true, {}); });
    const unknown = document.createElement('button');
    unknown.className = 'option';
    unknown.textContent = 'Не вспомнил';
    unknown.addEventListener('click', function () { settleTrain(item, '', false, {}); });
    box.appendChild(known);
    box.appendChild(unknown);
  });
  box.appendChild(show);
  action.appendChild(box);
}

// ---------- Итог хода ----------
// Пузырь правильной реплики появляется в чате, ниже — пояснение при ошибке.
// При ошибке реплика возвращается в конец очереди (не больше 2 кругов).
function settleTrain(item, chosenEs, ok, extra) {
  extra = extra || {};
  const line = dialogView.dialog.lines[item.i];
  dialogView.answered++;
  if (ok) dialogView.correct++;
  if (ok) hapticSuccess(); else hapticError();

  appendBubble(line, {});
  if (!ok) {
    item.tries++;
    if (item.tries < 2) dialogView.queue.push(item);
  }
  dialogView.queue.shift();

  // Пояснение, что именно ты сделал не так
  let wrongNote = '';
  if (!ok) {
    if (item.mode === 'build' && extra.builtOrder) {
      wrongNote = 'У тебя собрано: «' + extra.builtOrder + '»';
    } else if (chosenEs) {
      wrongNote = (item.mode === 'input' ? 'Ты написал: «' : 'Ты выбрал: «') + chosenEs + '»';
    }
  }

  const action = el('chat-action');
  const fb = document.createElement('div');
  fb.className = 'feedback pop ' + (ok ? 'ok' : 'err');
  let html = '<div class="fb-title">' + (ok ? 'Верно!' : 'Неверно') + '</div>';
  if (wrongNote) html += '<div class="fb-hinted">' + esc(wrongNote) + '</div>';
  html += '<div class="fb-answer">' + esc(line.es) + '</div>';
  if (line.tr) html += '<div class="fb-tr">' + esc(line.tr) + '</div>';
  html += '<div class="fb-ex">' + esc(line.ru) + '</div>';
  html += '<button class="btn-primary" id="chat-next-fb">Дальше</button>';
  fb.innerHTML = html;

  const sp = document.createElement('button');
  sp.className = 'speak-btn';
  sp.setAttribute('aria-label', 'Озвучить');
  sp.innerHTML = SPEAK_ICON;
  sp.addEventListener('click', function () { speak(line.es); });
  fb.insertBefore(sp, fb.querySelector('#chat-next-fb'));

  action.innerHTML = '';
  action.appendChild(fb);
  el('chat-next-fb').addEventListener('click', trainStep);
  scrollFeed();
}

function finishDialogTrain() {
  const d = dialogView.dialog;
  const answered = dialogView.answered;
  const correct = dialogView.correct;
  const pct = answered ? Math.round(correct / answered * 100) : 0;

  const st = dialogStats(d.id);
  st.trains++;
  if (pct > st.best) st.best = pct;
  dialogStore.stats[d.id] = st;
  saveDialogStore();
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
  el('fin-home').addEventListener('click', goDialogsList);
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
  dialogStore.own.push({
    id: uid(), own: true, title: title,
    situation: el('dlg-new-situation').value.trim(),
    role: el('dlg-new-role').value.trim() || 'Собеседник',
    lines: draftLines.slice()
  });
  saveDialogStore();
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
    dialogStore.own.push({
      id: uid(), own: true, title: title,
      situation: typeof item.situation === 'string' ? item.situation.trim() : '',
      role: typeof item.role === 'string' ? item.role.trim() : 'Собеседник',
      lines: clean
    });
    added++;
  });

  saveDialogStore();
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

// ---------- БЭКАП ДИАЛОГОВ (свой, отдельный от бэкапа приложения) ----------
function exportDialogs() {
  try {
    const blob = new Blob([JSON.stringify(dialogStore, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'spanish-dialogs-' + todayStr() + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('Файл диалогов сохранён в загрузки');
  } catch (e) {
    toast('Не удалось создать файл диалогов');
  }
}

function restoreDialogsFile() {
  const input = el('dlg-backup-file');
  const msg = el('dlg-restore-msg');
  msg.className = 'form-msg';
  const file = input.files && input.files[0];
  if (!file) {
    msg.classList.add('err');
    msg.textContent = 'Сначала выбери файл диалогов.';
    return;
  }
  const reader = new FileReader();
  reader.onload = function () {
    try {
      const data = JSON.parse(reader.result);
      const own = Array.isArray(data) ? data : (data && Array.isArray(data.own) ? data.own : null);
      if (!own) throw new Error('нет массива диалогов');
      own.forEach(function (d) {
        if (!d || typeof d.title !== 'string' || !Array.isArray(d.lines)) {
          throw new Error('в файле битые диалоги');
        }
      });
      tgConfirm('Заменить свои диалоги и их статистику содержимым файла?', function () {
        dialogStore = {
          own: own,
          stats: (data && data.stats && typeof data.stats === 'object') ? data.stats : {}
        };
        saveDialogStore();
        renderDialogsList();
        msg.classList.add('ok');
        msg.textContent = 'Диалоги восстановлены: ' + dialogStore.own.length + ' шт.';
        toast('Диалоги восстановлены');
      });
    } catch (e) {
      msg.classList.add('err');
      msg.textContent = 'Файл не похож на бэкап диалогов (' + e.message + ').';
    }
    input.value = '';
  };
  reader.onerror = function () {
    msg.classList.add('err');
    msg.textContent = 'Не удалось прочитать файл.';
  };
  reader.readAsText(file);
}

// ---------- УДАЛЕНИЕ СВОЕГО ДИАЛОГА ----------
function deleteOwnDialog(id) {
  const d = dialogStore.own.find(function (x) { return x.id === id; });
  if (!d) return;
  tgConfirm('Удалить диалог «' + d.title + '»?', function () {
    dialogStore.own = dialogStore.own.filter(function (x) { return x.id !== id; });
    delete dialogStore.stats[id];
    saveDialogStore();
    renderDialogsList();
    toast('Диалог удалён');
  });
}

// ---------- Привязка кнопок и старт ----------
function bindDialogs() {
  // Дополнительные слушатели на вкладках: app.js навесил свои первым,
  // эти сработают после них и навигации не мешают.
  // Задача: остановить прослушивание при уходе с экрана диалога
  // и перерисовать список при открытии вкладки «Диалоги».
  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      stopPlay();
      if (t.dataset.screen === 'dialogs') renderDialogsList();
    });
  });

  const back = el('btn-dlg-back');
  if (back) back.addEventListener('click', goDialogsList);
  const addBtn = el('btn-dlg-add-line');
  if (addBtn) addBtn.addEventListener('click', addLineToDraft);
  const saveBtn = el('btn-dlg-save');
  if (saveBtn) saveBtn.addEventListener('click', saveDraftDialog);
  const impBtn = el('btn-dlg-import');
  if (impBtn) impBtn.addEventListener('click', function () { importDialogs(el('dlg-import-json').value); });
  const prBtn = el('btn-dlg-copy-prompt');
  if (prBtn) prBtn.addEventListener('click', copyDialogPrompt);
  const expBtn = el('btn-dlg-export');
  if (expBtn) expBtn.addEventListener('click', exportDialogs);
  const resBtn = el('btn-dlg-restore');
  if (resBtn) resBtn.addEventListener('click', restoreDialogsFile);

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
// поэтому к этому моменту его утилиты и база уже готовы.
document.addEventListener('DOMContentLoaded', function () {
  loadDialogStore();
  bindDialogs();
});
