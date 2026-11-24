'use strict';
{
// The pages' language: English, as written in the code, or Russian. The choice is kept in
// this browser (tlv-lang); with none, a saved report uses the language it was saved in,
// and otherwise the browser's language decides.
//
//   t('English text {n}', { n })   the text in the chosen language, with {name} filled in
//   plural(n, 'sale', 'sales', 'продажа', 'продажи', 'продаж')
//   apply()                         translates the page's own text once, as it loads:
//     - an element with data-i18n="key" gets the HTML stored under '#key'
//     - any other text, and title / aria-label / placeholder, is looked up as written
//
// Add ?i18n to a page's address to list untranslated text in the console.
// The sell check carries a copy of this file, so a saved report works offline;
// scripts/sync.mjs keeps that copy in step.

const KEY = 'tlv-lang';
const LANGS = ['en', 'ru'];
const browser = typeof document !== 'undefined';

function pick() {
  try { const v = localStorage.getItem(KEY); if (LANGS.includes(v)) return v; } catch {}
  const saved = document.documentElement.getAttribute('data-lang');
  if (LANGS.includes(saved)) return saved;
  return /^ru\b/i.test(navigator.language || '') ? 'ru' : 'en';
}
const lang = browser ? pick() : 'en';

/* RU:BEGIN */
// English as written in the pages and scripts → Russian. Keys starting with # are whole
// blocks marked data-i18n="…" in the pages.
const RU = {
  // ---- everywhere ----
  'Language': 'Язык',
  'Q portfolio': 'Q portfolio',
  'Theme': 'Тема',
  'System': 'Системная',
  'Follows your device': 'Как на устройстве',
  'Popular themes': 'Популярные темы',
  'Light': 'Светлая',
  'Dark': 'Тёмная',
  'Results': 'Результаты',
  'Performance': 'Доходность',
  'Sell check': 'Что продать',
  'Upload new file': 'Загрузить новый файл',
  'Refresh prices': 'Обновить цены',
  'Update prices automatically': 'Обновлять цены автоматически',
  'Updates run while the US market is open (9:30 AM to 4:00 PM New York time), plus once after the close, and pause while this tab is hidden.':
    'Обновления идут, пока открыт рынок США (с 9:30 до 16:00 по Нью-Йорку), и ещё раз после закрытия; пока вкладка скрыта, они на паузе.',
  'Manual': 'Вручную',
  'New file': 'Новый файл',
  '5 min': '5 мин',
  '15 min': '15 мин',
  '30 min': '30 мин',
  '1 hour': '1 час',
  'Hide amounts, leaving percentages, so you can share a screenshot': 'Скрыть суммы, оставив проценты, чтобы поделиться скриншотом',
  'Hide amounts': 'Скрыть суммы',
  'Show amounts': 'Показать суммы',
  'Save report': 'Сохранить отчёт',
  'Forget this result': 'Забыть этот результат',
  'Click again to forget': 'Нажмите ещё раз, чтобы забыть',
  'Show amounts first: a saved report always contains your dollar figures.': 'Сначала покажите суммы: сохранённый отчёт всегда содержит ваши суммы в долларах.',
  'Long-Term Sell Check {date}.html': 'Что продать {date}.html',
  'The report couldn\'t be saved. Try again.': 'Не удалось сохранить отчёт. Попробуйте ещё раз.',
  'Getting prices · {n} of {total}': 'Загружаем цены · {n} из {total}',
  'Updating prices · {n} of {total}': 'Обновляем цены · {n} из {total}',
  'Updating…': 'Обновляем…',
  'Automatic update failed: {reason}': 'Автообновление не удалось: {reason}',
  'This page couldn\'t be drawn:': 'Не удалось показать страницу:',
  'Try <b>Refresh prices</b>, or upload your file again.': 'Нажмите <b>Обновить цены</b> или загрузите файл ещё раз.',
  'Prices as of {date}, {time} New York time': 'Цены на {date}, {time} по Нью-Йорку',
  '{a} of {b}': '{a} из {b}',
  'All stocks': 'Все акции',
  'Today': 'Сегодня',
  'This year': 'С начала года',
  'Bought': 'Куплено',
  'Sold': 'Продано',
  'Value': 'Стоимость',
  'Value now': 'Стоимость сейчас',
  'Stock': 'Акция',
  'Shares': 'Акции',
  'Price': 'Цена',
  'Date': 'Дата',
  'Gain': 'Прибыль',
  'Dividends': 'Дивиденды',
  'Long-term shares': 'Долгосрочные акции',
  'Close': 'Закрыть',
  'How this is worked out': 'Как это считается',
  'Totals': 'Итоги',
  'Show': 'Показать',

  // ---- upload page ----
  'See which shares are long-term': 'Какие акции уже долгосрочные',
  'Open your brokerage\'s Quicken export to see every purchase, its cost basis, and which shares you can sell at the lower long-term tax rate.':
    'Откройте выгрузку Quicken от вашего брокера: вы увидите каждую покупку, её стоимость и какие акции можно продать по более низкой ставке налога для долгосрочных акций.',
  '← Back to your last result': '← Вернуться к последнему результату',
  'Drop your .qfx file here': 'Перетащите сюда файл .qfx',
  'Release to open': 'Отпустите, чтобы открыть',
  'or': 'или',
  'Choose File…': 'Выбрать файл…',
  '.qfx or .ofx · up to 25 MB': '.qfx или .ofx · до 25 МБ',
  'Progress': 'Ход загрузки',
  'Couldn\'t open that file': 'Не удалось открыть файл',
  'Choose another file': 'Выбрать другой файл',
  '#privacy': 'Файл читается в этом браузере и никуда не загружается. Отправляются только тикеры — в поиск цен этого сайта, за текущими ценами. Последний результат хранится только в этом браузере, чтобы он был здесь в следующий раз; кнопка <b>Забыть этот результат</b> в отчёте удаляет его.',
  'Reading your file…': 'Читаем файл…',
  'Rebuilding every purchase from your export.': 'Восстанавливаем каждую покупку из выгрузки.',
  'Building your report…': 'Собираем отчёт…',
  'Prices and history for {ticker}': 'Цены и история {ticker}',
  'Almost done.': 'Почти готово.',
  '“{name}” isn\'t a Quicken export. Choose a file ending in .qfx or .ofx.': '«{name}» — не выгрузка Quicken. Выберите файл с расширением .qfx или .ofx.',
  'That file is larger than 25 MB, which is too big for a Quicken export.': 'Файл больше 25 МБ — слишком много для выгрузки Quicken.',
  'This browser doesn\'t allow sites to keep data, so the report can\'t be shown. Try a normal (not private) window.':
    'Этот браузер не разрешает сайтам хранить данные, поэтому отчёт не показать. Откройте обычное (не приватное) окно.',
  'Drop one file at a time.': 'Перетаскивайте по одному файлу.',
  'This doesn\'t look like a Quicken (.qfx) export.': 'Это не похоже на выгрузку Quicken (.qfx).',
  'No open stock positions were found in this export. If the shares were transferred out, export the account they moved to.':
    'В выгрузке нет открытых позиций по акциям. Если акции перевели на другой счёт, выгрузите тот счёт.',
  'no response': 'нет ответа',
  'network error': 'ошибка сети',
  'Couldn\'t get prices for {symbol} ({reason}). Check your internet connection and try again.': 'Не удалось получить цены {symbol} ({reason}). Проверьте подключение к интернету и попробуйте ещё раз.',
  'No current price for {symbol}.': 'Нет текущей цены {symbol}.',
  'No price history for {symbol}.': 'Нет истории цен {symbol}.',
  'Couldn\'t get details for {symbol}.': 'Не удалось получить данные о {symbol}.',

  // ---- performance page ----
  'Portfolio Performance': 'Доходность портфеля',
  'Compare with': 'Сравнить с',
  'Total US market': 'Весь рынок США',
  'Nasdaq 100': 'Nasdaq 100',
  'total US market': 'VTI (весь рынок США)',
  'Period': 'Период',
  '6M': '6 мес',
  'YTD': 'С нач. года',
  '1Y': '1 год',
  '2Y': '2 года',
  'All': 'Всё',
  'Share card': 'Карточка',
  'Percentages only: no dollar amounts or share counts. Made in this browser.': 'Только проценты: без сумм в долларах и количества акций. Создаётся в этом браузере.',
  'Save image': 'Сохранить картинку',
  'Copy image': 'Копировать картинку',
  'Upload your file again to see performance': 'Загрузите файл ещё раз, чтобы увидеть доходность',
  'This result was saved before the performance page existed, so it doesn\'t have your purchase history yet. Uploading the same export again adds it.':
    'Этот результат сохранён до появления страницы доходности, поэтому в нём нет истории покупок. Загрузите ту же выгрузку ещё раз — она добавится.',
  'Upload your file': 'Загрузить файл',
  'Your gains': 'Ваша прибыль',
  'Last week': 'За неделю',
  'Last': 'За последние',
  'years': 'лет',
  '#gains-note': 'Прибыль не учитывает внесённые или выведенные деньги; дивиденды считаются прибылью. Проценты — доходность, взвешенная по времени, рядом с доходностью индекса за тот же период.',
  'Total gain': 'Общая прибыль',
  'Compared with the market': 'По сравнению с рынком',
  'Your yearly return': 'Ваша годовая доходность',
  'Largest drop': 'Наибольшая просадка',
  'What you own': 'Что у вас есть',
  'Color tiles by': 'Цвет плиток',
  'Color': 'Цвет',
  'Sector': 'Сектор',
  'Your stocks by size': 'Ваши акции по размеру',
  'Your stocks against the market': 'Ваши акции против рынка',
  'Value ($)': 'Стоимость ($)',
  'Return (%)': 'Доходность (%)',
  'How each stock did': 'Как показала себя каждая акция',
  '#holdings-note': '<b>Общая прибыль</b> складывает прибыль по акциям, которые у вас есть, прибыль от продаж и дивиденды. <b id="h-vs-label">vs market</b> сравнивает её с вложением тех же денег в те же дни в индекс.',
  'Include stocks you sold': 'Показать проданные акции',
  'Weight': 'Доля',
  'Gain on shares held': 'Прибыль по текущим акциям',
  'Gain on sales': 'Прибыль от продаж',
  'Return': 'Доходность',
  'vs market': 'против рынка',
  'First bought': 'Первая покупка',
  'Buying and selling': 'Покупки и продажи',
  'Money you put into stocks and took out, by month.': 'Сколько денег вы вложили в акции и вывели, по месяцам.',
  'Everything': 'Всё',
  'Buys': 'Покупки',
  'Sales': 'Продажи',
  'Type': 'Тип',
  'Amount': 'Сумма',
  '#how-value': '<b>Стоимость</b> — акции на каждую неделю, умноженные на цену закрытия той недели с поправкой на сплиты; последняя точка — по сегодняшним ценам. Деньги на счёте не учитываются, только акции.',
  '#how-put-in': '<b>Вложено</b> — потрачено на покупки минус получено от продаж. Покупки на дивиденды считаются вложенными деньгами, а дивиденды — прибылью, так что ничего не считается дважды.',
  '#how-market': '<b>Те же деньги в рынке</b> — покупаем индекс на сумму каждой покупки в тот же день и продаём на сумму каждой продажи. Цены индекса включают реинвестированные дивиденды. Это самое честное «а что если»: те же суммы в те же дни.',
  '#how-return': '<b>Доходность (%)</b> взвешена по времени: она показывает, как росли ваши акции, без учёта того, когда вы вносили деньги, поэтому именно её правильно сравнивать с индексом. <b>Ваша годовая доходность</b> взвешена по деньгам: сколько в год принёс ваш реальный выбор моментов.',
  '#how-drop': '<b>Наибольшая просадка</b> — самое большое падение от предыдущего максимума доходности, взвешенной по времени.',
  'Prices come from Yahoo Finance. A stock that\'s no longer listed uses the prices you traded at.': 'Цены — из Yahoo Finance. Для акций, которых больше нет на бирже, берутся цены ваших сделок.',
  'This is a record of past results, not tax or investment advice.': 'Это запись прошлых результатов, а не налоговая или инвестиционная рекомендация.',
  'In the last 6 months': 'За последние 6 месяцев',
  'In the last year': 'За последний год',
  'In the last 2 years': 'За последние 2 года',
  'Since your first purchase': 'С первой покупки',
  'Amounts are hidden': 'Суммы скрыты',
  'Getting {index} prices…': 'Загружаем цены {index}…',
  'No {index} prices to compare with.': 'Нет цен {index} для сравнения.',
  '{date} (last trading day)': '{date} (последний торговый день)',
  'Refresh prices to see today': 'Обновите цены, чтобы увидеть сегодняшний день',
  'you\'ve invested {n} years': 'вы инвестируете {n} г.',
  '{stocks} held': 'в портфеле {stocks}',
  '{n} {trades} since {date}': '{n} {trades} с {date}',
  'No price found for {list}: valued at what you last paid': 'Нет цены для {list}: оценено по последней цене покупки',
  'Your stocks are worth {value}. You put in {invested} net, so you\'re {change}': 'Ваши акции стоят {value}. Вы вложили {invested} за вычетом продаж, так что вы {change}',
  'up {amount}': 'в плюсе на {amount}',
  'down {amount}': 'в минусе на {amount}',
  ', counting {amount} of dividends': ' с учётом {amount} дивидендов',
  'The same money in the {index} would be worth {value}, so you\'re {diff} the market.': 'Те же деньги в {index} стоили бы {value}, так что вы {diff} рынка.',
  '{amount} ahead of': 'на {amount} впереди',
  '{amount} behind': 'на {amount} позади',
  '{amount} put in': 'вложено {amount}',
  '{pct} on what you put in': '{pct} к вложенному',
  '{amount} dividends': '{amount} дивидендов',
  'Compared with the {index}': 'По сравнению с {index}',
  'More return than the {index}: you {mine}, {index} {theirs}': 'Доходность выше, чем у {index}: у вас {mine}, у {index} {theirs}',
  'Less return than the {index}: you {mine}, {index} {theirs}': 'Доходность ниже, чем у {index}: у вас {mine}, у {index} {theirs}',
  'Ahead · the same money there: {amount}': 'Впереди · те же деньги там: {amount}',
  'Behind · the same money there: {amount}': 'Позади · те же деньги там: {amount}',
  'Shown after a year of history': 'Появится после года истории',
  '{index}: {pct} a year with the same money': '{index}: {pct} в год с теми же деньгами',
  'From a previous high; the low is this week': 'От предыдущего максимума; дно — на этой неделе',
  'Low in the week of {date}. Since then {rise}, back above the previous high.': 'Дно на неделе {date}. С тех пор {rise}, уже выше прежнего максимума.',
  'Low in the week of {date}. Since then {rise}, still {below} under the previous high.': 'Дно на неделе {date}. С тех пор {rise}, но ещё на {below} ниже прежнего максимума.',
  '{pct} since the low': '{pct} от дна',
  'Card period': 'Период карточки',
  'All time': 'За всё время',
  'Return so far in {year}': 'Доходность с начала {year} года',
  'Last month': 'За месяц',
  'Last 3 months': 'За 3 месяца',
  'Percentages only · time-weighted returns with dividends; best performers by their return this year': 'Только проценты · доходность взвешена по времени, с дивидендами; лучшие акции — по доходности с начала года',
  'No fall from a high so far': 'Падений от максимума пока не было',
  'vs {index}': 'против {index}',
  'Each tile is a stock, sized by its share of your portfolio and grouped by sector. Hover a tile for details; click one to change its sector. Holdings under 1.5% are drawn at 1.5% so they stay visible, with their real share on the label.':
    'Каждая плитка — акция; её размер — доля в портфеле, плитки сгруппированы по секторам. Наведите на плитку, чтобы увидеть подробности; нажмите, чтобы сменить сектор. Позиции меньше 1,5% нарисованы как 1,5%, чтобы их было видно, а настоящая доля — на подписи.',
  'Sector for {ticker}': 'Сектор для {ticker}',
  'As Yahoo lists it: {sector}': 'Как в Yahoo: {sector}',
  'Saved in this browser. Choose the first option to go back to Yahoo’s sector.': 'Сохраняется в этом браузере. Выберите первый вариант, чтобы вернуть сектор из Yahoo.',
  '{ticker}, {sector}, {share} of your stocks, {value}, {gain} on shares held. Press Enter to change its sector.':
    '{ticker}, {sector}, {share} ваших акций, {value}, {gain} по текущим акциям. Нажмите Enter, чтобы сменить сектор.',
  '(your choice)': '(ваш выбор)',
  'Share of your stocks': 'Доля в ваших акциях',
  'Below what you paid': 'Ниже цены покупки',
  'Above · full color at ±50%': 'Выше · полный цвет при ±50%',
  'Looking up sectors for {stocks}…': 'Ищем секторы… ({stocks})',
  'Your stocks': 'Ваши акции',
  'Same money in the {index}': 'Те же деньги в {index}',
  'Put in, net': 'Вложено (чистыми)',
  'Your stocks (time-weighted)': 'Ваши акции (взвешенная по времени)',
  'Each week\'s value of your stocks, against the same money put into the {index} on the same days. The bars underneath show what you bought and sold each week.':
    'Стоимость ваших акций по неделям против тех же денег, вложенных в {index} в те же дни. Столбики внизу — что вы покупали и продавали каждую неделю.',
  'How your stocks grew with your deposits taken out (time-weighted), against the {index}, from the start of the period.':
    'Как росли ваши акции без учёта пополнений (взвешенная по времени доходность) против {index}, с начала периода.',
  '(from {date})': '(с {date})',
  'you put in {added} net (bought {bought}, sold {sold}), and your stocks gained {gain}': 'вы вложили {added} чистыми (куплено на {bought}, продано на {sold}), а ваши акции принесли {gain}',
  ' including {amount} of dividends': ', включая {amount} дивидендов',
  'The same money in the {index} would have gained {gain}.': 'Те же деньги в {index} принесли бы {gain}.',
  'Time-weighted: you {mine}, the {index} {theirs}.': 'Взвешенная по времени доходность: у вас {mine}, у {index} {theirs}.',
  'Value of your stocks against the {index}': 'Стоимость ваших акций против {index}',
  'Time-weighted return against the {index}': 'Доходность, взвешенная по времени, против {index}',
  ', +{n} more': ', и ещё {n}',
  'Week ending {date}': 'Неделя до {date}',
  'Money put in and taken out each month': 'Деньги, вложенные и выведенные по месяцам',
  'Buy': 'Покупка',
  'Sale': 'Продажа',
  'Dividend': 'Дивиденд',
  'Moved in': 'Зачисление',
  'Moved out': 'Списание',
  // sectors, as Yahoo names them
  'Technology': 'Технологии',
  'Communication Services': 'Связь и медиа',
  'Consumer Cyclical': 'Товары не первой необходимости',
  'Consumer Defensive': 'Товары первой необходимости',
  'Healthcare': 'Здравоохранение',
  'Financial Services': 'Финансы',
  'Industrials': 'Промышленность',
  'Energy': 'Энергетика',
  'Utilities': 'Коммунальные услуги',
  'Real Estate': 'Недвижимость',
  'Basic Materials': 'Сырьё и материалы',
  'Funds (ETFs)': 'Фонды (ETF)',
  'Other': 'Другое',
  'Sector unknown': 'Сектор неизвестен',

  // ---- share card ----
  'My portfolio': 'Мой портфель',
  'As of {date}': 'На {date}',
  'Total return since {month}': 'Общая доходность с первой покупки ({month})',
  'Same return as the {index}': 'Та же доходность, что у {index}',
  '{pct} more return than the {index}': 'на {pct} доходнее, чем {index}',
  '{pct} less return than the {index}': 'на {pct} менее доходно, чем {index}',
  'Best performers': 'Лучшие акции',
  'Last 12 months': 'За 12 месяцев',
  'Per year': 'В год',
  'Last 6 months': 'За 6 месяцев',
  'Percentages only · time-weighted returns with dividends; "per year" is money-weighted': 'Только проценты · доходность взвешена по времени, с дивидендами; «в год» — взвешена по деньгам',
  'Could not make the image': 'Не удалось создать картинку',
  'Portfolio performance {date}.png': 'Доходность портфеля {date}.png',
  'Saved to your downloads.': 'Сохранено в загрузки.',
  'Copied. Paste it into a message or post.': 'Скопировано. Вставьте в сообщение или пост.',
  'This browser didn’t allow copying; use Save image instead.': 'Браузер не разрешил копирование; используйте «Сохранить картинку».',

  // ---- sell check ----
  'Your tax rates': 'Ваши налоговые ставки',
  'Income tax bracket': 'Ставка подоходного налога',
  'Long-term rate': 'Долгосрочная ставка',
  'State': 'Штат',
  '3.8% investment income tax': 'налог 3,8% на инвестиционный доход',
  'Used for the tax estimates on this page and kept in this browser. Rough estimates: deductions, limits and your other gains and losses aren\'t counted.':
    'Используются для оценки налога на этой странице и хранятся в этом браузере. Оценка приблизительная: вычеты, лимиты и другие ваши прибыли и убытки не учитываются.',
  'Best to sell now': 'Лучше всего продать сейчас',
  'You can sell as long-term': 'Можно продать как долгосрочные',
  'Long-term profit in it': 'Долгосрочная прибыль в них',
  'Estimated tax if you sold it': 'Примерный налог при продаже',
  'Short-term shares': 'Краткосрочные акции',
  'Turns long-term in 30 days': 'Станут долгосрочными за 30 дней',
  'Which stocks to sell now': 'Какие акции продать сейчас',
  '#rank-note': 'По тому, насколько сегодняшняя цена близка к историческому максимуму акции. Пониженную ставку для долгосрочных получают только акции, которые вы держите больше года. <b>Продать до</b> — сколько долларов можно продать так, чтобы вся прибыль была долгосрочной; <b>Налог</b> — налог на эту прибыль по вашим ставкам. Наведите на шкалу, чтобы увидеть цену и максимум; нажмите на строку, чтобы увидеть все покупки.',
  'The bar fills to today\'s price as a share of the all-time high. The ticks mark 80% and 90%: past 90% is a sell candidate, 80–90% is near the high.':
    'Шкала заполнена до сегодняшней цены как доли исторического максимума. Отметки — 80% и 90%: выше 90% — кандидат на продажу, 80–90% — близко к максимуму.',
  'Verdict': 'Вывод',
  'Price vs all-time high': 'Цена к максимуму',
  'Sell up to (long-term)': 'Продать до (долгосрочно)',
  'Long-term profit': 'Долгосрочная прибыль',
  'Est. tax': 'Налог',
  'Short-term profit': 'Краткосрочная прибыль',
  'Next turns long-term': 'Следующая станет долгосрочной',
  'Sell candidate': 'Кандидат на продажу',
  'long-term gain, within 10% of its high': 'долгосрочная прибыль, до 10% ниже максимума',
  'Near high': 'Близко к максимуму',
  '10–20% below its high': 'на 10–20% ниже максимума',
  'Below high': 'Ниже максимума',
  'more than 20% below': 'больше чем на 20% ниже',
  'At a loss': 'В убытке',
  'long-term shares are below cost': 'долгосрочные акции дешевле цены покупки',
  'Not yet': 'Пока нет',
  'no long-term shares': 'нет долгосрочных акций',
  'No price': 'Нет цены',
  'All your purchases': 'Все ваши покупки',
  'Every purchase you still own, with what you paid, and every buy and sale on the chart. Pick a stock to see just that stock and to estimate the tax on selling it.':
    'Каждая покупка, которая у вас ещё есть, с ценой покупки, а на графике — каждая покупка и продажа. Выберите акцию, чтобы увидеть только её и оценить налог при продаже.',
  'Choose a stock': 'Выберите акцию',
  'Estimate the tax on a sale': 'Оценить налог при продаже',
  'Type a dollar amount to see which shares would go and the tax': 'Введите сумму в долларах, чтобы увидеть, какие акции уйдут и какой будет налог',
  'When you sell by dollar amount, your broker chooses which shares go. This shows the two most likely orders side by side, with the estimated tax at your rates.':
    'Когда вы продаёте на сумму в долларах, брокер сам выбирает, какие акции продать. Здесь два самых вероятных порядка рядом, с примерным налогом по вашим ставкам.',
  'Amount to sell': 'Сумма продажи',
  'Oldest shares first': 'Сначала самые старые',
  'Losses first, then long-term': 'Сначала убыточные, потом долгосрочные',
  'Buy over a year ago': 'Покупка больше года назад',
  'Buy in the last year': 'Покупка за последний год',
  'One year ago': 'Год назад',
  'Buys above the line, sales below; the farther from it, the larger (each grid line is 10× the one before)': 'Покупки над линией, продажи под ней; чем дальше от линии, тем больше сумма (каждая линия сетки в 10 раз больше предыдущей)',
  'Long-term buy': 'Долгосрочная покупка',
  'Short-term buy': 'Краткосрочная покупка',
  'Weekly closing price': 'Цена закрытия недели',
  'All-time high': 'Исторический максимум',
  'Dot size = shares bought': 'Размер точки = куплено акций',
  'Purchases and cost basis': 'Покупки и их стоимость',
  'Group by stock': 'Группировать по акциям',
  'Expand all': 'Развернуть все',
  'Collapse all': 'Свернуть все',
  'Cost / share': 'Цена покупки',
  'Cost basis': 'Стоимость покупки',
  'Gain %': 'Прибыль, %',
  'Long-term from': 'Долгосрочно с',
  'Status': 'Статус',
  'Turning long-term in the next 90 days': 'Станут долгосрочными в ближайшие 90 дней',
  '#soon-note': 'Если одна из этих дат близко, ожидание может означать налог по долгосрочной ставке вместо ставки подоходного налога. <b>Экономия от ожидания</b> — разница на сегодняшней прибыли по вашим ставкам.',
  'Tax saved by waiting': 'Экономия от ожидания',
  'Losses you could use': 'Убытки, которые можно использовать',
  '#losses-note': 'Акции, которые сейчас стоят меньше, чем вы заплатили. Продажа превращает убыток в вычет: он уменьшает прибыль, затем до $3000 другого дохода в год, а остаток переносится на следующие годы. <b>Налог, который он может уменьшить</b> — максимум, сколько он стоит по вашим ставкам. Убыток не засчитывается (wash sale), если вы купили ту же акцию в пределах 30 дней до или после продажи.',
  'None of your shares are below what you paid.': 'Ни одна ваша акция не стоит меньше цены покупки.',
  'Shares below cost': 'Акции ниже цены покупки',
  'Short-term loss': 'Краткосрочный убыток',
  'Long-term loss': 'Долгосрочный убыток',
  'Tax it could offset': 'Налог, который он может уменьшить',
  'Wash sale check': 'Проверка wash sale',
  'Your sales by tax year': 'Ваши продажи по налоговым годам',
  'Year': 'Год',
  'Proceeds': 'Выручка',
  'Short-term gain': 'Краткосрочная прибыль',
  'Long-term gain': 'Долгосрочная прибыль',
  'Wash-sale losses not counted': 'Незасчитанные убытки (wash sale)',
  'Wash sale checks look only at this account\'s purchases of the same stock. Purchases in your other accounts (retirement accounts and a spouse\'s included), and of nearly identical funds, count too.':
    'Проверка wash sale смотрит только на покупки той же акции на этом счёте. Покупки на других ваших счетах (включая пенсионные и счета супруга или супруги) и почти идентичных фондов тоже считаются.',
  '#how-long-term': 'Акция становится долгосрочной, если её продают после годовщины покупки. <b>Долгосрочно с</b> — первый такой день.',
  'When you sell by dollar amount, your broker picks the shares. Some sell losing shares first, then the shares with the smallest tax (usually long-term gains); others sell the oldest first, the IRS default. Your long-term shares are your oldest, so selling up to their value creates no short-term gains under either rule. After a sale, your broker\'s cost basis details show which shares it used.':
    'Когда вы продаёте на сумму в долларах, акции выбирает брокер. Одни продают сначала убыточные, потом с наименьшим налогом (обычно долгосрочные с прибылью); другие — сначала самые старые, как по умолчанию у IRS. Ваши долгосрочные акции — самые старые, поэтому продажа в пределах их стоимости не даёт краткосрочной прибыли ни при одном правиле. После продажи в данных брокера о стоимости покупки видно, какие акции он взял.',
  '#how-years': '<b>Продажи по налоговым годам</b> взяты из продаж в вашей выгрузке; акции каждой продажи разделены на краткосрочные и долгосрочные. Дивиденды, другие счета и убытки, перенесённые с прошлых лет, не учитываются.',
  '#how-tax': '<b>Оценки налога</b> используют ставки вверху: долгосрочная прибыль — по долгосрочной ставке, краткосрочная — по ставке подоходного налога, плюс ставка штата и налог 3,8%, если он отмечен. Убыток одного вида уменьшает прибыль другого. Вычеты, лимиты и другие ваши прибыли и убытки за год не учитываются.',
  'Current prices and all-time highs come from Yahoo Finance when this report was made. The all-time high is the highest intraday price ever, adjusted for splits. The verdicts use simple cutoffs; being near a high doesn\'t predict where a price goes next.':
    'Текущие цены и исторические максимумы взяты из Yahoo Finance на момент создания отчёта. Исторический максимум — самая высокая внутридневная цена за всё время с поправкой на сплиты. Выводы используют простые пороги; близость к максимуму не говорит, куда пойдёт цена дальше.',
  'This is a holding-period and tax estimate, not tax or investment advice.': 'Это оценка срока владения и налога, а не налоговая или инвестиционная рекомендация.',
  '{ticker}: sold {n} more shares than bought on {date}': '{ticker}: {date} продано на {n} акций больше, чем куплено',
  'Purchases come from your Quicken export. Every buy and sell was replayed': 'Покупки взяты из вашей выгрузки Quicken. Каждая покупка и продажа воспроизведена',
  ', including {splits} ({list})': ', включая {splits} ({list})',
  'a split': 'сплит',
  'These stocks don\'t match the share count in the export: {list}.': 'Эти акции не совпадают с количеством в выгрузке: {list}.',
  'The result matches the share count in the export for every stock.': 'Количество каждой акции совпадает с выгрузкой.',
  'No price could be found for {list}, so it\'s valued at what you last paid.': 'Не удалось найти цену для {list}, поэтому она оценена по последней цене покупки.',
  'No price could be found for {list}, so they\'re valued at what you last paid.': 'Не удалось найти цены для {list}, поэтому они оценены по последней цене покупки.',
  'Check these against your broker:': 'Сверьте с данными брокера:',
  'Shares may have come from a transfer the export doesn\'t show.': 'Возможно, акции пришли переводом, которого нет в выгрузке.',
  'The export doesn\'t say which purchase each past sale came from, so oldest-first is assumed (the IRS default).': 'В выгрузке не сказано, из какой покупки была каждая прошлая продажа, поэтому считается, что сначала продавались самые старые (по умолчанию у IRS).',
  '<b>Wash sales:</b> {sales} at a loss had the same stock bought within 30 days, so {amount} of losses couldn\'t be claimed then. That amount was added to the cost of the replacement shares, and their holding period starts earlier. Those purchases are marked <b>Wash sale</b>.':
    '<b>Wash sale:</b> {sales} в убыток с покупкой той же акции в пределах 30 дней, поэтому {amount} убытков тогда не засчитано. Эта сумма добавлена к стоимости новых акций, а их срок владения начинается раньше. Такие покупки отмечены <b>Wash sale</b>.',
  '<b>Wash sales:</b> none found. A sale at a loss with the same stock bought within 30 days before or after would have its loss moved into the new shares’ cost.':
    '<b>Wash sale:</b> не найдено. Если продать в убыток и купить ту же акцию за 30 дней до или после, убыток перейдёт в стоимость новых акций.',
  'Long-term shares at a gain, trading within 20% of their all-time high, closest first. Sell up to the amount shown and all of the profit is long-term.':
    'Долгосрочные акции в прибыли, цена которых не дальше 20% от исторического максимума, самые близкие первыми. Продайте не больше указанной суммы — и вся прибыль будет долгосрочной.',
  'None of your long-term shares at a gain are near their all-time high right now.': 'Сейчас ни одна ваша долгосрочная акция в прибыли не близка к историческому максимуму.',
  'Estimated tax': 'Примерный налог',
  '{pct} of your stocks': '{pct} ваших акций',
  'At your long-term rate of {pct}': 'По вашей долгосрочной ставке {pct}',
  'If you sold every long-term share today': 'Если продать все долгосрочные акции сегодня',
  'Profit {gain}, taxed at {pct} if sold now': 'Прибыль {gain}, налог {pct} при продаже сейчас',
  'waiting saves about {amount}': 'ожидание сэкономит около {amount}',
  'Nothing': 'Ничего',
  'No price found': 'Цена не найдена',
  '{ticker} is at {pct} of its all-time high: {price} now, {ath} at its high.': '{ticker} — {pct} от исторического максимума: сейчас {price}, на максимуме {ath}.',
  'All long-term': 'Все долгосрочные',
  '{pct} of its all-time high': '{pct} от исторического максимума',
  'Price now': 'Цена сейчас',
  'All-time high ({date})': 'Исторический максимум ({date})',
  'Cost includes {amount} a share of loss that couldn\'t be claimed on a sale on {date}; its holding period starts earlier.': 'Стоимость включает {amount} на акцию — убыток, не засчитанный при продаже {date}; срок владения начинается раньше.',
  'Long-term': 'Долгосрочные',
  'Short-term': 'Краткосрочные',
  'Wash sale': 'Wash sale',
  '{a} of {b} long-term': 'долгосрочных {a} из {b}',
  'Hide {ticker} purchases': 'Скрыть покупки {ticker}',
  'Show {ticker} purchases': 'Показать покупки {ticker}',
  'Buys and sales': 'Покупки и продажи',
  'All {purchases} you still own, oldest first. Long-term rows can be sold at the lower rate.': 'Все покупки, которые у вас ещё есть ({purchases}), самые старые первыми. Долгосрочные строки можно продать по пониженной ставке.',
  'Every {ticker} buy': 'Все покупки {ticker}',
  'Price vs high': 'Цена к максимуму',
  'Avg cost / share': 'Средняя цена покупки',
  'sh': 'шт.',
  'Every purchase of {ticker}, with what you paid. Long-term rows can be sold at the lower rate.': 'Каждая покупка {ticker} с ценой покупки. Долгосрочные строки можно продать по пониженной ставке.',
  '{ticker} has no long-term shares yet. The first ones qualify on {date}.': 'У {ticker} пока нет долгосрочных акций. Первые станут долгосрочными {date}.',
  'All long-term: {amount}': 'Все долгосрочные: {amount}',
  'No long-term shares yet': 'Долгосрочных акций пока нет',
  'Everything: {amount}': 'Всё: {amount}',
  'Shares sold': 'Продано акций',
  'From long-term shares': 'Из долгосрочных',
  'From short-term shares': 'Из краткосрочных',
  '<b>Long-term profit</b> (lower rate)': '<b>Долгосрочная прибыль</b> (пониженная ставка)',
  '<b>Short-term profit</b> (income rate)': '<b>Краткосрочная прибыль</b> (ставка подоходного)',
  'Loss blocked as a wash sale': 'Убыток, не засчитанный (wash sale)',
  '<b>Estimated tax</b> at your rates': '<b>Примерный налог</b> по вашим ставкам',
  'Wash sale: this sale includes shares sold at a loss, and you bought {ticker} on {bought}, within 30 days. About {amount} of the loss couldn\'t be claimed now; it would be added to the newer shares\' cost instead. To claim all of it, sell on or after {clear}.':
    'Wash sale: в эту продажу входят акции в убытке, а вы покупали {ticker} {bought}, в пределах 30 дней. Около {amount} убытка сейчас не засчитают — он добавится к стоимости более новых акций. Чтобы засчитать весь убыток, продавайте {clear} или позже.',
  'This sale includes up to {amount} of losses. To keep them, don\'t buy {ticker} again before {date}: a purchase within 30 days after the sale blocks the loss.':
    'В эту продажу входит до {amount} убытков. Чтобы их засчитали, не покупайте {ticker} снова до {date}: покупка в течение 30 дней после продажи отменяет убыток.',
  'Selling {amount} of {ticker} creates no short-term profit either way, so all of the profit is taxed at the long-term rate: about {tax} in tax.':
    'Продажа {ticker} на {amount} ни при каком порядке не даёт краткосрочной прибыли, поэтому вся прибыль облагается по долгосрочной ставке: налог около {tax}.',
  'Selling {amount} of {ticker} could create up to {profit} of short-term profit, taxed at your income rate (about {tax} in tax).':
    'Продажа {ticker} на {amount} может дать до {profit} краткосрочной прибыли по ставке подоходного налога (налог около {tax}).',
  'Sell {amount} or less to keep it all long-term.': 'Продайте на {amount} или меньше, чтобы вся прибыль была долгосрочной.',
  '{ticker} has no long-term shares until {date}.': 'У {ticker} не будет долгосрочных акций до {date}.',
  '{ticker} purchase prices and weekly closes': 'Цены покупок {ticker} и недельные закрытия',
  '← long-term': '← долгосрочные',
  'short-term →': 'краткосрочные →',
  'All-time high {price}': 'Исторический максимум {price}',
  'All-time high {price} ({date}, off chart)': 'Исторический максимум {price} ({date}, вне графика)',
  'Bought {date}': 'Куплено {date}',
  'Sold {date}': 'Продано {date}',
  'Gain now': 'Прибыль сейчас',
  'Long-term since': 'Долгосрочно с',
  'Wash sale: cost includes a loss that couldn’t be claimed earlier.': 'Wash sale: стоимость включает убыток, который не засчитали раньше.',
  'Week of {date}': 'Неделя {date}',
  'Closing price': 'Цена закрытия',
  'Paid': 'Заплачено',
  'Every buy and sale by date and dollar amount': 'Все покупки и продажи по дате и сумме',
  '↑ Bought': '↑ Куплено',
  '↓ Sold': '↓ Продано',
  'Nothing turns long-term in the next 90 days.': 'В ближайшие 90 дней ничего не станет долгосрочным.',
  'Wait until {date}': 'Подождите до {date}',
  'You bought more on {date}; selling now would block about {amount} of the loss.': 'Вы докупали {date}; продажа сейчас отменит около {amount} убытка.',
  'Clear to sell': 'Можно продавать',
  'Don\'t buy it again before {date}.': 'Не покупайте снова до {date}.',
  'You haven\'t sold anything yet, so there are no gains to report.': 'Вы пока ничего не продавали, поэтому прибыли нет.',
  'This result was saved before sales were split by tax year. Upload your file again to see them.': 'Этот результат сохранён до разделения продаж по налоговым годам. Загрузите файл ещё раз, чтобы их увидеть.',
  'Gains and losses from the sales in your export. The estimated tax uses your rates at the top; dividends and other accounts aren\'t included.':
    'Прибыли и убытки от продаж в вашей выгрузке. Налог посчитан по вашим ставкам вверху; дивиденды и другие счета не учитываются.',
  '{year} short-term gain so far': 'Краткосрочная прибыль за {year}',
  '{year} long-term gain so far': 'Долгосрочная прибыль за {year}',
  'Taxed at {pct}': 'Налог {pct}',
  'Estimated tax on {year} sales': 'Примерный налог на продажи {year}',
  'A net loss: up to $3,000 offsets other income, the rest carries forward': 'Чистый убыток: до $3000 уменьшают другой доход, остаток переносится',
  '{sales} this year': '{sales} в этом году',
  'Losses you could still use': 'Убытки, которые ещё можно использовать',
  'Nothing is below cost': 'Нет акций дешевле цены покупки',
  'Selling them would cut this year\'s tax by about {amount}': 'Их продажа уменьшит налог за этот год примерно на {amount}',
  'No gains to offset yet this year': 'В этом году пока нечего уменьшать',
};
/* RU:END */

const dict = lang === 'ru' ? RU : {};
const debug = browser && /[?&]i18n\b/.test(location.search);
const missing = new Set();
const miss = (k) => { if (debug && !missing.has(k)) { missing.add(k); console.warn('[i18n] untranslated:', k); } };

const fill = (s, v) => (v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m)) : s);
function t(en, vars) {
  if (lang !== 'en' && !(en in dict)) miss(en);
  return fill(dict[en] ?? en, vars);
}
const rules = new Intl.PluralRules(lang);
function plural(n, one, many, ru1, ru2, ru5) {
  if (lang !== 'ru') return n === 1 ? one : many;
  const r = rules.select(n);
  return r === 'one' ? ru1 : r === 'few' || r === 'other' ? ru2 : ru5; // 'other' is a fraction: 1,5 акции
}

function apply(root = document) {
  document.documentElement.lang = lang;
  if (lang !== 'en') {
    for (const el of root.querySelectorAll('[data-i18n]')) {
      const k = '#' + el.dataset.i18n;
      if (k in dict) el.innerHTML = dict[k]; else miss(k);
    }
    const skip = 'script,style,[data-i18n],[translate="no"]';
    const walk = document.createTreeWalker(root.body || root, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const k = n.nodeValue.replace(/\s+/g, ' ').trim();
      if (!k || n.parentElement?.closest(skip)) continue;
      if (k in dict) n.nodeValue = n.nodeValue.match(/^\s*/)[0] + dict[k] + n.nodeValue.match(/\s*$/)[0];
      else if (/[A-Za-z]{3}/.test(k)) miss(k);
    }
    for (const a of ['title', 'aria-label', 'placeholder']) {
      for (const el of root.querySelectorAll(`[${a}]`)) {
        const v = el.getAttribute(a);
        if (v in dict) el.setAttribute(a, dict[v]); else if (/[A-Za-z]{3}/.test(v)) miss(v);
      }
    }
    document.title = document.title.split(' · ').map((p) => dict[p] ?? p).join(' · ');
  }
  for (const host of document.querySelectorAll('.lang-switch')) switcher(host);
  document.documentElement.style.visibility = '';   // theme-boot.js hid the page until now
}

// EN | RU buttons; a choice reloads the page in place.
function switcher(host) {
  const box = document.createElement('span');
  box.className = 'lang-sw';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', t('Language'));
  for (const [l, name] of [['en', 'English'], ['ru', 'Русский']]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.lang = l;
    b.textContent = l.toUpperCase();
    b.title = name;
    b.setAttribute('aria-pressed', String(l === lang));
    b.addEventListener('click', () => choose(l));
    box.append(b);
  }
  host.replaceChildren(box);
}
function choose(l) {
  if (l === lang) return;
  try { localStorage.setItem(KEY, l); } catch {}
  // come back to the same place on the page (toolbar.js restores it)
  try { sessionStorage.setItem('tlv-scroll', JSON.stringify({ path: location.pathname, y: scrollY })); } catch {}
  location.reload();
}

const api = { lang, locale: lang === 'ru' ? 'ru-RU' : 'en-US', t, plural, apply, RU };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else {
  window.I18n = api;
  apply();
}
}
