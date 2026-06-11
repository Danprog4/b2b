# Сити Маркет — план исправлений по аудиту v2 (2026-06-10)

## 0. Контекст для исполнителя

Этот документ — результат независимого аудита кода против первоисточника ТЗ
(`/Users/daniil/Downloads/Финал ТЗ.txt`, v1.1). Сверка по разделам — в
`TZ_V1_1_STATUS_DETAILED.md`, общий план — в `TZ_V1_1_PLAN.md`. Здесь только
задачи по найденным багам/пробелам, которых нет в тех документах.

### Правила работы
1. **Прочитай `AGENTS.md`**: проект на нестандартной версии Next.js — перед написанием
   кода читай гайды в `node_modules/next/dist/docs/`.
2. В рабочей копии есть **незакоммиченные изменения** (email-рассылки:
   `src/lib/email/queue.ts`, правки в `orders/actions.ts`, `admin/order-actions.ts`,
   `chat/actions.ts`, `contracts/generation.ts`, `documents/actions.ts`,
   `scripts/send-email-outbox.ts`). Они проверены и корректны — **не откатывать,
   не коммитить**, просто работать поверх них.
3. **Ничего не коммитить** без явной просьбы пользователя.
4. Порядок: сверху вниз (A → B → C). Внутри каждой задачи: реализация →
   самопроверка → обновить статус здесь же.
5. Статусы: `⬜ TODO` · `🟦 IN PROGRESS` · `✅ DONE (code)` · `🟢 VERIFIED (human)`.
   После завершения задачи заполни блок «Изменения» (какие файлы, что сделано).
6. После каждой задачи: `bunx tsc --noEmit` без ошибок. После всех задач:
   `bun run lint` (0 errors) и `bun run build` (успешно).
7. Стиль кода — как в соседнем коде (server actions, drizzle, audit_events,
   уведомления через helpers). Деньги — `toMoney`/`formatMoney`, как в
   `src/lib/admin/order-actions.ts`.
8. Если нужна миграция: `bun run db:generate` (drizzle-kit), миграцию проверить глазами.

---

## A. Критичные (логика маркетплейса)

### A-1. Модерация не должна перебивать priority-предложение
- Статус: ✅ DONE (code) · ТЗ: §8.5 п.1, п.9-11; §2.3 п.10-11
- Где: `src/lib/admin/product-moderation-actions.ts` (approve, строки ~160-270),
  `src/lib/admin/product-actions.ts` (`setPriorityProductOfferAction`, upsert offer),
  `src/db/schema.ts` (products).
- Проблема: при approve заявки типа `create`/`update` код принудительно ставит
  `products.priorityOfferId = offer редактирующего продавца` и `isPriority = true`.
  У товара с несколькими продавцами одобрение правки описания меняет витринного
  продавца/цену, перебивая и ручной выбор админа, и правило минимальной цены.
  При `offer_create` новый дешёвый offer тоже молча замещает ручной priority админа.
- Сделать:
  1. Добавить в `products` колонку `priority_is_manual boolean not null default false`
     (+ миграция).
  2. `setPriorityProductOfferAction` (админ вручную назначает priority) → ставит
     `priorityIsManual = true`. Добавить в admin UI товара действие «Сбросить на
     автоматический выбор» → `priorityIsManual = false` + пересчёт priority по
     правилу min-цена/ранняя публикация среди published offers.
  3. В approve модерации:
     - `create` (новый товар, единственный offer): можно назначать priority этому
       offer (как сейчас), `priorityIsManual` не трогать (false).
     - `update`: **не трогать** `priorityOfferId`/`isPriority` вообще. Если текущий
       priority указывает на offer этого товара — оставить как есть.
     - `offer_create`: пересчитывать выбранный offer (как сейчас) **только если**
       `priorityIsManual = false`. Если true — priority не менять, уведомление
       «цена перебита» прежнему продавцу не слать.
  4. Excel-импорт и admin upsert offer: если они трогают priority — применить то же
     условие `priorityIsManual = false` (проверить `product-import-actions.ts`,
     `product-actions.ts`).
- Проверить: товар с 2 продавцами и ручным priority у дорогого offer; продавец B
  правит описание → approve → priority не изменился; продавец B создаёт более
  дешёвый offer к товару с ручным priority → approve → витрина не изменилась;
  тот же кейс без ручного priority → витрина переключилась на минимальную цену.
- Изменения: добавлена колонка `products.priority_is_manual` и миграция
  `drizzle/0015_deep_iron_monger.sql`; добавлен helper
  `src/lib/admin/product-priority.ts` для ручного/автоматического priority;
  `setPriorityProductOfferAction` теперь ставит ручной режим, добавлен
  `resetProductPriorityOfferAction` и кнопка «Сбросить на авто» в карточке
  товара; approve модерации `update` больше не трогает priority, а
  `offer_create` пересчитывает min-price priority только в автоматическом
  режиме; admin upsert/update offer и Excel-импорт не перебивают ручной priority
  и пересчитывают автоматический выбор. Проверка: `bunx tsc --noEmit` — 0
  ошибок.
- Проверено человеком: нет

### A-2. Скрытая категория должна скрывать товары на витрине
- Статус: ✅ DONE (code) · ТЗ: §8.2
- Где: `src/lib/catalog/queries.ts` — `getCatalogProducts` (~строка 209-289),
  `getProductBySlug` (~строка 320-364).
- Проблема: фильтр `categories.isActive` применяется только при заходе по slug
  категории. В «Все товары», в поиске и по прямой ссылке на карточку товары
  скрытой категории остаются видимыми и покупаемыми.
- Сделать: добавить `eq(categories.isActive, true)` в WHERE обоих запросов
  (categories уже в innerJoin). Подкатегории не трогать: по §8.3 скрытая
  подкатегория убирает товары только со своей страницы (это уже работает).
  Проверить, что `getSelectedOffer` в `src/lib/cart/actions.ts` тоже не позволяет
  добавить в корзину товар скрытой категории (добавить join+фильтр по категории).
- Проверить: скрыть категорию в админке → её товары исчезли из «Все товары»,
  поиска и карточки (404), добавление в корзину невозможно; включить обратно —
  всё вернулось.
- Изменения: `getCatalogProducts` и `getProductBySlug` теперь фильтруют только
  товары активных категорий; `getSelectedOffer` в `src/lib/cart/actions.ts`
  проверяет активность категории перед добавлением в корзину; `getCurrentCart`
  помечает позиции скрытой категории неактивными; `createOrderAction`
  повторно проверяет активность категории в транзакции checkout. Проверка:
  `bunx tsc --noEmit` — 0 ошибок.
- Проверено человеком: нет

### A-3. Пагинация каталога (сейчас жёсткий обрез на 60 товарах)
- Статус: ✅ DONE (code) · ТЗ: §33.1 (каталог от 300 товаров), §8.6
- Где: `src/lib/catalog/queries.ts` (`getCatalogProducts`, `limit = 60`),
  `src/app/(public)/catalog/page.tsx`, `.../catalog/[categorySlug]/page.tsx`,
  `.../catalog/[categorySlug]/[subcategorySlug]/page.tsx`.
- Проблема: limit 60 без пагинации — товары дальше 60-го недоступны покупателю,
  «Найдено: N» врёт.
- Сделать: `getCatalogProducts` возвращает `{ items, totalCount }` с параметрами
  `page`/`pageSize` (pageSize 24). Выборка/фильтры/сортировка уже в памяти —
  допустимо для масштаба v1 (сотни товаров): считать totalCount после фильтров,
  потом slice по странице. На страницах каталога: параметр `?page=`, ссылки
  пагинации (Назад/Вперёд + номера), сохранение остальных query-параметров
  (использовать существующий `catalogHref`), «Найдено» = totalCount. При смене
  фильтров page сбрасывается на 1. Невалидный/выходящий за диапазон page → 1.
- Проверить: при >24 товарах появляются страницы; фильтры/сортировка/категория
  сохраняются при переходе по страницам; пустых страниц нет.
- Изменения: `getCatalogProducts` возвращает `{ items, totalCount, page,
  pageSize, totalPages }`, считает `totalCount` после фильтров и режет выдачу
  по `page/pageSize`; дефолт каталога — 24 товара на страницу, невалидный или
  выходящий за диапазон `page` нормализуется в 1; главная страница адаптирована
  к новому контракту; в `/catalog`, `/catalog/[categorySlug]` и
  `/catalog/[categorySlug]/[subcategorySlug]` добавлены ссылки пагинации
  «Назад/Вперёд» и номера страниц с сохранением фильтров через `catalogHref`,
  формы фильтров не сохраняют `page`, поэтому сбрасывают его на 1; «Найдено»
  показывает `totalCount`. Проверка: `bunx tsc --noEmit` — 0 ошибок.
- Проверено человеком: нет

---

## B. Средние (надёжность и матрица уведомлений)

### B-1. Уведомление админу + Telegram оператору при оформлении заказа
- Статус: ✅ DONE (code) · ТЗ: §11.4 п.31, §21.2 («Оформление заказа → Администратор →
  Админ-панель», «Оформление заказа → Оператор → Telegram»)
- Где: `src/lib/orders/actions.ts` (`createOrderAction`), `src/lib/telegram/*`.
- Проблема: при создании заказа уведомляются только продавцы. Нет in-app
  уведомления админам и нет Telegram оператору.
- Сделать:
  1. В транзакции `createOrderAction` добавить `insertAdminNotifications`
     (type `new_order`, title `Новый заказ {number}`, body: компания + сумма,
     `buyerCompanyId`).
  2. После коммита транзакции (не внутри!) отправить Telegram оператору простое
     сообщение: номер заказа, ИНН компании, сумма. Использовать существующий
     клиент `src/lib/telegram/api.ts` и конфиг бота, по образцу
     `chat-sync.ts`. Ошибка/отсутствие конфига → запись в `system_events`
     (type `telegram`, severity `error`/`warning`), заказ не ломать (try/catch).
- Проверить: новый заказ → уведомление в `/admin/notifications`; без TELEGRAM
  env-переменных checkout не падает, в system_events появляется запись.
- Изменения: в транзакции `createOrderAction` добавлено
  `insertAdminNotifications` с type `new_order`, номером заказа, компанией,
  суммой и `buyerCompanyId`; в `src/lib/telegram/api.ts` добавлен
  `sendTelegramOperatorMessage`; после commit заказа `createOrderAction`
  best-effort отправляет оператору Telegram сообщение с номером заказа, ИНН,
  компанией и суммой; отсутствие Telegram env пишет warning в `system_events`,
  ошибка отправки пишет error, checkout не ломается. Проверка:
  `bunx tsc --noEmit` — 0 ошибок.
- Проверено человеком: нет

### B-2. Guard статуса заказа внутри UPDATE (race conditions)
- Статус: ✅ DONE (code) · ТЗ: §12.6
- Где: `src/lib/orders/actions.ts` (`cancelAcceptedOrderAction`),
  `src/lib/admin/order-actions.ts` (`updateOrderStatusAction`).
- Проблема: статус проверяется до транзакции, UPDATE без условия по статусу.
  Покупатель может отменить заказ одновременно с переводом в «Оплачен».
- Сделать: в обоих местах UPDATE с условием
  `and(eq(orders.id, ...), eq(orders.status, ожидаемыйИсходный))` +
  `.returning(...)`; если строк 0 — откатиться (ничего больше в транзакции не
  писать) и redirect на `?cancelError=status` / `?statusError=1`. Образец
  паттерна — conditional update в `product-moderation-actions.ts:105-125`.
  Для `updateOrderStatusAction` ожидаемый исходный — `order.status`, прочитанный
  до транзакции.
- Проверить: tsc; вручную — отмена/смена статуса работают как раньше; повторный
  сабмит формы со «старым» статусом даёт понятную ошибку, а не двойной переход.
- Изменения: `cancelAcceptedOrderAction` теперь внутри транзакции делает
  conditional `UPDATE orders ... WHERE id = ... AND status = 'accepted'`
  с `.returning()`, и при 0 строках не пишет уведомления/email/audit, а
  редиректит на `?cancelError=status`; `updateOrderStatusAction` аналогично
  обновляет заказ только при совпадении статуса, прочитанного перед транзакцией,
  и при конфликте редиректит на `?statusError=1`. Проверка:
  `bunx tsc --noEmit` — 0 ошибок.
- Проверено человеком: нет

### B-3. Дробное количество: выровнять корзину и админ-редактирование
- Статус: ✅ DONE (code) · ТЗ: §10.3 п.5-6, §11.7 п.1
- Где: `src/lib/admin/order-actions.ts` (`getQuantity`, строка ~54),
  `src/lib/cart/actions.ts` (`sanitizeQuantity`).
- Проблема: корзина допускает дробное количество (2.5 кг), админ-редактирование
  требует целое (`Number.isInteger`) — админ не сможет править такую позицию.
- Сделать: в `getQuantity` принимать положительное число ≤ 9999 с округлением до
  3 знаков (как numeric в схеме позволяет), не требовать integer. Согласовать с
  `sanitizeQuantity` (там тоже ограничить до 3 знаков после запятой).
- Проверить: позиция с количеством 2.5 редактируется админом; 0 и отрицательные
  отклоняются.
- Изменения: `getQuantity` в `src/lib/admin/order-actions.ts` принимает
  положительное число `<= 9999` и округляет до 3 знаков после запятой вместо
  требования integer; `sanitizeQuantity` в `src/lib/cart/actions.ts` использует
  такое же округление до 3 знаков; `addProductToBuyerCart` также нормализует
  дробное количество; quantity input в карточке товара получил `step="0.001"`.
  Проверка: `bunx tsc --noEmit` — 0 ошибок.
- Проверено человеком: нет

### B-4. Email со счётом — всем активным пользователям компании
- Статус: ✅ DONE (code) · ТЗ: §21.2 («Формирование счёта → Клиент → Email с PDF»)
- Где: `src/lib/invoices/generation.ts` (~строки 276-288).
- Проблема: счёт уходит только на email автора заказа (`order.buyerEmail`), все
  остальные письма проекта — через `queueBuyerCompanyEmails` всем пользователям
  компании. Несогласованная аудитория.
- Сделать: заменить прямой `tx.insert(emailOutbox)` на
  `queueBuyerCompanyEmails(tx, order.buyerCompanyId, { ..., attachmentFileId: file.id,
  orderId, invoiceId не теряем — добавить поддержку invoiceId в QueueAudienceEmailInput
  в src/lib/email/queue.ts })`. Текст письма сохранить.
- Проверить: после checkout в `email_outbox` по одной записи на каждого активного
  пользователя компании, с вложением и invoiceId.
- Изменения: `generateOrderInvoice` больше не вставляет одно письмо напрямую
  в `email_outbox`; генерация счёта вызывает `queueBuyerCompanyEmails` для всех
  активных пользователей компании, сохраняя прежние subject/body, `orderId`,
  `invoiceId` и `attachmentFileId`; `QueueAudienceEmailInput` уже поддерживал
  `invoiceId` в текущих email-изменениях. Проверка: `bunx tsc --noEmit` — 0
  ошибок.
- Проверено человеком: нет

### B-5. Отчёт по комиссиям — из сохранённых commissionAmount
- Статус: ✅ DONE (code) · ТЗ: §19.9
- Где: `src/app/(admin)/admin/commissions/page.tsx` (~строка 143).
- Проблема: отчёт пересчитывает `amount * 0.05`, тогда как позиции заказа хранят
  комиссию по `sellers.commissionRate`. При индивидуальной ставке отчёт разойдётся
  с данными заказов.
- Сделать: брать `orderItems.commissionAmount` (сумма по строкам); fallback на 5%
  только если поле NULL/0 у легаси-строк. Подпись «Комиссия 5%» в UI оставить,
  т.к. по ТЗ ставка фиксированная.
- Проверить: суммы отчёта совпадают с «Комиссия по продавцам» в карточках заказов.
- Изменения: отчёт `src/app/(admin)/admin/commissions/page.tsx` выбирает
  `orderItems.commissionAmount` и использует его в строках отчёта; fallback на
  `lineTotal * 0.05` оставлен только для legacy-строк с пустой/нулевой
  комиссией. Проверка: `bunx tsc --noEmit` — 0 ошибок.
- Проверено человеком: нет

---

## C. Мелкие (UX/полнота ТЗ)

### C-1. Состояние «Товар временно недоступен» в карточке
- Статус: ✅ DONE (code) · ТЗ: §9.4, §28.3 п.3
- Где: `src/lib/catalog/queries.ts` (`getProductBySlug`),
  `src/app/(public)/product/[slug]/page.tsx`.
- Проблема: товар без published-предложений отдаёт `notFound()`. По ТЗ карточка
  должна открываться с неактивной кнопкой и текстом «Товар временно недоступен».
- Сделать: если по slug товар существует (`products.isActive`, категория активна),
  но published offers нет — вернуть карточку с флагом `unavailable: true` (цену
  не показывать или показывать прочерк), на странице задизейблить `AddToCartButton`
  и вывести плашку «Товар временно недоступен». Прямой `notFound()` оставить
  только для несуществующего/неактивного товара.
- Проверить: скрыть единственный offer товара → карточка открывается с плашкой,
  кнопка неактивна; в каталоге товар не отображается (как и сейчас).
- Изменения: `getProductBySlug` разделён на проверку активного товара/категории
  и отдельную выборку published offers; если товар существует, но опубликованных
  предложений нет, возвращается карточка с `unavailable: true`, без цены и
  `sellerOfferId`; страница товара показывает плашку «Товар временно
  недоступен», цену прочерком и отключает `AddToCartButton`; 404 сохранён для
  несуществующего/неактивного товара и скрытой категории. Проверка:
  `bunx tsc --noEmit` — 0 ошибок.
- Проверено человеком: нет

### C-2. Метаданные в audit при скрытии документа
- Статус: ✅ DONE (code) · ТЗ: §15.7 п.8
- Где: `src/lib/documents/actions.ts` (`hideDocumentAction`, ~строка 1150-1181).
- Сделать: перед UPDATE прочитать документ (type, title, buyerCompanyId, orderId,
  sellerId, имя файла текущей версии) и записать это в `metadata` audit-события
  `document.hide`. Несуществующий documentId → redirect с ошибкой, не писать audit.
- Изменения: `hideDocumentAction` перед `UPDATE` читает документ и текущую
  версию файла через `document_versions`/`files`; если `documentId` не найден,
  редиректит с `documentError` и не пишет audit; audit `document.hide` теперь
  содержит `type`, `title`, `buyerCompanyId`, `orderId`, `sellerId`,
  `currentVersion` и `fileName`. Проверка: `bunx tsc --noEmit` — 0 ошибок.
- Проверено человеком: нет

### C-3. Экранировать wildcards в поиске
- Статус: ✅ DONE (code) · ТЗ: §8.7
- Где: `src/lib/catalog/queries.ts` (~строка 251-254).
- Сделать: экранировать `%`, `_`, `\` в пользовательском запросе перед подстановкой
  в `ilike` (replace `\` → `\\`, `%` → `\%`, `_` → `\_`).
- Проверить: запрос `%` не возвращает весь каталог; обычный поиск работает.
- Изменения: в `src/lib/catalog/queries.ts` добавлен `escapeLikePattern`,
  который экранирует `\`, `%` и `_` перед подстановкой пользовательского
  запроса в `ilike`; обычный поиск по названию продолжает использовать
  `%...%`. Проверка: `bunx tsc --noEmit` — 0 ошибок.
- Проверено человеком: нет

### C-4. Слияние позиций при смене предложения в заказе
- Статус: ✅ DONE (code) · ТЗ: §11.7 п.4
- Где: `src/lib/admin/order-actions.ts` (`changeOrderItemOfferAction`).
- Проблема: если в заказе уже есть другая позиция с целевым offer, после смены
  получатся две строки одного offer.
- Сделать: внутри транзакции проверить существующую позицию с целевым
  `sellerOfferId`; если есть — сложить количества в неё, исходную позицию удалить,
  пересчитать её суммы/НДС/комиссию (по образцу `addOrderItemAction`), в audit
  записать `merged: true` + оба itemId. Итоговые суммы заказа пересчитываются как
  сейчас.
- Проверить: заказ с позициями offer A и offer B одного товара; смена A → B даёт
  одну позицию с суммарным количеством, счёт пересоздаётся.
- Изменения: `changeOrderItemOfferAction` проверяет наличие другой позиции
  заказа с целевым `sellerOfferId`; при наличии целевой позиции суммирует
  количество, пересчитывает цену/НДС/комиссию по текущему offer, обновляет
  целевую строку и удаляет исходную; audit `order.item_offer_change` содержит
  `merged`, `sourceItemId` и `targetItemId`; пересчёт итогов заказа и
  пересоздание счёта остаются в прежнем потоке. Проверка:
  `bunx tsc --noEmit` — 0 ошибок.
- Проверено человеком: нет

---

## D. Финальная самопроверка (после всех задач)
1. `bunx tsc --noEmit` — 0 ошибок.
2. `bun run lint` — 0 errors (warnings про `<img>` допустимы).
3. `bun run build` — успешно.
4. Если генерировались миграции — они в `drizzle/` и применяются на чистой БД
   (`bun run db:migrate`).
5. Обновить статусы задач в этом файле (`✅ DONE (code)` + «Изменения»).
6. В `TZ_V1_1_STATUS_DETAILED.md` ничего не менять — сверку обновит ревьюер.

## Вне скоупа (не делать)
- Внешние блокеры C-01..C-11 из `TZ_V1_1_PLAN.md` (реквизиты, подпись/печать,
  логотип, шаблон договора, email-ключи, DaData, тексты, домен).
- Ручная браузерная приёмка (§27 адаптив, §28 состояния, §35 сценарии).
- Перегенерация договора с новым номером, физическое хранение старых PDF договора
  (по ТЗ версионность не нужна — осознанно оставлено как есть).
