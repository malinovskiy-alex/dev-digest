# Research: frontend architecture & code organization

Матеріал для майбутнього скіла `frontend-architecture`. Зібрано 2026-09-19.
Усі посилання перевірені (HTTP 200) або прочитані напряму; винятки позначені окремо.

## 1. Навіщо окремий скіл

Наявний `react-best-practices` — це каталог правил про **код усередині компонента**
(стейт, хуки, перф, a11y, ключі). Розділ «Code Organization» у ньому займає 6 рядків
із міткою MEDIUM. Питання користувача — **де що лежить**: структура тек, межі модулів,
куди йдуть константи / типи / утиліти / бізнес-логіка. Це ортогональна тема, перетину
майже немає — потрібен лише cross-reference між двома скілами.

Частково перетинається також `next-best-practices` (file conventions для App Router)
і `typescript-expert` (монорепо, project references).

Окремо перевірено `next-best-practices` (3389 рядків, 20 файлів): він описує **механіку**
фреймворку — як працюють RSC-межі, який із трьох патернів даних обрати, довідник
file conventions, error handling, оптимізація зображень і шрифтів. Архітектурних питань
(«як `app/` співіснує з `features/`», «де проходить межа `use client` як проєктне рішення»,
«де живе Data Access Layer») він не покриває. Розділ 3 нижче — саме цей пласт.

**Конвенція репозиторію** (`.claude/skills/README.md`): скіл складається з `SKILL.md`
(обовʼязково), `examples.md` (рекомендовано) і `references.md` (опційно — саме туди
йдуть джерела, а не в README). Новий скіл треба додати рядком у каталог у тому ж README.

---

## 2. Консенсус по ключових питаннях

### 2.1 Де мають лежати компоненти

Консенсус індустрії: **групувати за фічею (бізнес-доменом), а не за технічним типом**.
`components/ hooks/ utils/` на верхньому рівні — структура, яка «кричить» про React,
а не про продукт (Screaming Architecture).

Канонічна розкладка (bulletproof-react):

```
src/
├── app/          # роутинг, провайдери, точка входу
├── components/   # спільні UI-компоненти (тільки ті, що використовують 2+ фічі)
├── config/       # env, глобальний конфіг
├── features/     # 90% коду живе тут
│   └── <feature>/
│       ├── api/
│       ├── assets/
│       ├── components/
│       ├── hooks/
│       ├── stores/
│       ├── types/
│       └── utils/
├── hooks/  lib/  stores/  testing/  types/  utils/
```

Варто дати в скілі «драбину зрілості» (Wieruch): плоский `src/` → теки-компоненти →
технічні теки → фіче-теки → домени → монорепо. Правило переходу: **не планувати структуру
наперед**. Офіційний React FAQ радить «не витрачати більше 5 хвилин на вибір структури»
і рефакторити за фактом.

Альтернатива для великих команд — **Feature-Sliced Design**: 7 шарів
(`app → pages → widgets → features → entities → shared`), усередині шару — слайси
(бізнес-домени), усередині слайса — сегменти (`ui`, `model`, `api`, `lib`, `config`).

### 2.2 Як розбивати компоненти

- Евристики-ліміти (Tao of React): близько 5 пропсів максимум; більше — компонент робить забагато.
- Виносити списки в окремий listing-компонент; не робити вкладених `renderX()` функцій.
- Хелпери, яким не потрібне замикання на компонент, — **над** компонентом або в окремий файл.
- Container/Presentational **офіційно застарів**: Dan Abramov у 2019 додав до своєї статті
  примітку «I don't suggest splitting your components like this anymore» — роль контейнера
  тепер виконує кастомний хук.
- Для складених UI (Tabs, Accordion, Select) — compound components через контекст;
  для логіки без розмітки — headless-хуки.
- Порядок усередині файлу (React Handbook): imports → props types → state → інші хуки →
  ефекти → хелпери → JSX → дрібні під-компоненти.

### 2.3 Де бізнес-логіка

Багаторівнева відповідь, від найдешевшого рівня до найдорожчого:

1. **Чисті функції** (без React) — усе, що рахується з даних. Найлегше тестувати.
2. **Кастомні хуки** — коли логіці потрібен стейт або ефекти. Хук і є «контейнер».
3. **Шар `api/` всередині фічі** — запити, DTO і маппери DTO → доменна модель.
4. **Клієнтський стор** (Zustand/Redux) — тільки те, чим володіє клієнт.
5. **Domain/use-case шар** (hexagonal) — лише для справді складної предметної логіки;
   для типового CRUD це оверинжиніринг.

Критичний вододіл, на якому зійшлася спільнота: **server state != client state**.
Питання — «хто володіє цими даними?». Сервер → TanStack Query (кеш, інвалідація, ретраї).
Клієнт → локальний стейт або невеликий стор. Офіційна позиція TanStack: після міграції
async-коду в Query глобального клієнтського стейту лишається «дуже мало».

У самому компоненті логіки бути не має — але й «виносити все» теж неправильно:
офіційні доки React прямо попереджають *«Try to resist adding abstraction too early»*.

### 2.4 Де константи

- Магічні числа й рядки — іменовані константи, `UPPER_SNAKE_CASE`.
- Локальні для файлу — **над компонентом у тому ж файлі** (це і є колокація).
- Спільні для фічі — `features/<x>/constants.ts`.
- Глобальні (роути, ключі сторіджу, ліміти) — `src/config/`.
- Env-змінні — тільки в `config/`, одним валідованим обʼєктом (Zod), а не
  `process.env.X`, розсипаним по коду.

### 2.5 Utils vs helpers vs lib vs services

Найчастіша помилка — `utils/` як «шухляда для мотлоху». Робочі визначення:

| Тека | Що туди | Ознака |
|---|---|---|
| `utils/` | чисті, stateless, доменно-нейтральні функції (`formatDate`, `clamp`) | не знає нічого про продукт |
| `lib/` | обгортки над зовнішніми бібліотеками (axios instance, конфіг Query) | адаптер до вендора |
| `api/` (services) | HTTP-запити, маппінг DTO | має побічні ефекти, ходить назовні |
| `features/<x>/utils/` | доменні функції однієї фічі | знає про продукт |

Правило просування (Wieruch): утиліта живе всередині фічі, доки її використовує
**одна** фіча; щойно зʼявився другий споживач — піднімається на спільний рівень.
Зворотне правило: абстракція з одним споживачем — передчасна.

### 2.6 Де типи

Метт Покок, три правила:
1. Тип використовується в одному місці → **той самий файл**. Не створювати `.types.ts` за звичкою.
2. Тип у кількох місцях → спільний файл на **найвужчому** спільному рівні.
3. Тип між пакетами монорепо → окремий пакет.

Глобальна тека `types/` — лише для framework-level плюмбінгу, що не належить жодній фічі.

### 2.7 Межі модулів (те, що робить архітектуру реальною)

Без лінтера правило «фіча не імпортує фічу» не виконується. Інструментарій:
- `import/no-restricted-paths` — те, що використовує сам bulletproof-react;
- `eslint-plugin-boundaries` — декларативні типи елементів і правила залежностей;
- Nx `enforce-module-boundaries` — теги й обмеження для монорепо;
- ESLint core `no-restricted-imports` — найдешевший варіант для одного-двох правил.

Напрям залежностей у bulletproof-react: **shared → features → app** (односторонній).
У FSD: шар імпортує тільки з шарів **строго нижче**, слайс не імпортує сусідній слайс.

### 2.8 Barrel files (`index.ts`) — важливе застереження

bulletproof-react прямо радить їх уникати: ламають tree-shaking, сповільнюють dev-сервер
(у dev tree-shaking не відбувається взагалі — вантажиться весь бочонок), роздувають граф
для tsc/vitest/eslint, стають розсадником циклічних залежностей.
Компроміс: barrel лише як **публічний API фічі** (один файл на фічу, без `export *`),
усередині фічі — прямі імпорти.

### 2.9 Тести, стилі, іменування

- Тести — колокація поряд із кодом (`component.test.tsx`) або `__tests__/` поруч.
  Виняток (Kent C. Dodds): інтеграційні та e2e тести не мапляться на один файл — у корінь.
- Іменування — спірне місце. Wieruch і низка гайдів: **kebab-case для файлів і тек**
  (зручний fuzzy-search, немає проблем на case-insensitive FS); інша частина спільноти —
  **PascalCase для файлів-компонентів**. Обидва варіанти захищені; головне — консистентність.
  Решта без розбіжностей: компоненти PascalCase, функції camelCase, константи UPPER_SNAKE_CASE.
- Імпорти — абсолютні через аліаси (`@/features/...`): менше правок при переїзді файлу.
- Стилі: токени в CSS (`@theme` у Tailwind v4 або CSS-змінні), варіанти компонентів — у JS.

---

## 3. Next.js: архітектурний пласт

У Next.js частину структурних рішень диктує фреймворк, тому загальні React-правила
з розділу 2 треба накласти на конвенції App Router. Нижче — тільки архітектура
(де що лежить, де проходять межі), без перф-тематики.

### 3.1 `app/` — це роутинг, а не місце для коду

Офіційна позиція Next.js: *«Next.js is unopinionated about how you organize and
colocate your project files»* — фреймворк дає інструменти, а не структуру. Інструменти:

- **колокація безпечна за замовчуванням**: маршрут не стає публічним, доки в сегменті
  немає `page.tsx` або `route.ts`, тож проєктні файли можна класти прямо в сегмент;
- **приватні теки** `_folderName` — повністю виключені з роутингу;
- **route groups** `(folderName)` — групування без впливу на URL, свої layout-и,
  кілька root-layout-ів;
- **`src/`** — відокремлює код застосунку від конфігів у корені.

Офіційно задокументовані три стратегії: файли поза `app/`; файли в топ-теках усередині
`app/`; розбиття за фічею або роутом. Далі — «оберіть одну і будьте послідовні».

Консенсус спільноти поверх цього: **`app/` відповідає за маршрути, layout-и,
loading/error-стани, route handlers і композицію сторінки, а бізнес-логіка живе
в `src/features/`**. Типова помилка великих проєктів — накидати бізнес-логіку в `app/`.

### 3.2 Межа server/client — архітектурне рішення номер один

`'use client'` — це не «позначка компонента», а **межа в module graph**. Правила перетину:

- **код** перетинає межу через імпорти: усе, що імпортує клієнтський компонент,
  потрапляє в клієнтський бандл;
- **дані** перетинають межу через пропси і мають бути серіалізовними (функція-обробник
  не пройде; Server Function із `'use server'` проходить як посилання);
- на Server Components, передані як `children` чи інші пропси, це **не поширюється** —
  вони рендеряться на сервері, а клієнтський компонент бачить лише результат.

Архітектурне правило: **тримати межу якомога нижче, на листках дерева**. Поставити
`'use client'` на layout заради однієї інтерактивної кнопки — затягнути в клієнт усе
піддерево. Офіційний приклад: layout лишається серверним, клієнтський лише `<Search />`.

Практичні наслідки, які варто винести в правила скіла:

- патерн «slot»: серверний компонент передається як `children` у клієнтський (`<Modal><Cart/></Modal>`);
- провайдери контексту рендерити **якомога глибше**, а не обгортати весь `<html>`;
- compound-компоненти ламаються на межі: статичні властивості (`Menu.Item`) стають
  `undefined`, бо серверний компонент отримує client reference — потрібні іменовані експорти;
- сторонні клієнтські бібліотеки обгортати власним `'use client'`-реекспортом;
- `server-only` / `client-only` — захист від «отруєння середовища» (помилка на білді,
  якщо серверний модуль потрапив у клієнтський граф).

### 3.3 Data Access Layer — офіційна рекомендація Next.js

Доки дають **три підходи до доступу до даних і просять не змішувати їх**:

| Підхід | Для кого |
|---|---|
| зовнішні HTTP API (Zero Trust) | наявні великі застосунки, окрема бекенд-команда |
| **Data Access Layer** | нові проєкти |
| запити прямо в Server Component | прототипи і навчання |

DAL за офіційним визначенням має: працювати **тільки на сервері** (`import 'server-only'`),
виконувати перевірки авторизації **всередині себе** і повертати мінімальні **DTO**,
а не сирі моделі БД. Окреме правило: `process.env` із секретами читає **лише DAL**.

Для мутацій — той самий патерн: `'use server'`-екшени лишаються тонкими і делегують у DAL.
Критичне застереження: **перевірка авторизації на сторінці не поширюється на Server Action**,
бо екшен — окрема точка входу, доступна прямим POST-запитом. Авторизацію (не лише
автентифікацію — ще й перевірку володіння ресурсом) треба робити в кожному екшені.

Офіційний **чек-лист аудиту** з цієї ж сторінки — готова основа для правил скіла:
чи існує ізольований DAL; чи не імпортуються пакети БД і env поза ним; чи не занадто
широкі типи пропсів у `"use client"`-файлах; чи валідуються аргументи і чи ре-авторизується
користувач у `"use server"`-файлах; чи валідуються параметри з `[param]`-тек;
окремо аудит `proxy.ts` і `route.ts`.

### 3.4 Route handlers vs server actions vs server components

Дерево рішень, яке випливає з офіційних доків:

- **Server Component** — читання даних. Прямо з джерела.
- **Server Action** — мутації з UI. Екшени виконуються в черзі, тому **не для читання**.
- **Route Handler** — публічний HTTP-ендпоінт: вебхуки, callback-URL, не-HTML контент
  (`rss.xml`, `llms.txt`, sitemap), проксі до бекенду, CORS для сторонніх клієнтів.

Важливе офіційне застереження: **не фетчити власні route handlers із серверних компонентів** —
це зайвий HTTP round trip, а для сторінок, що пререндеряться на білді, ще й падіння збірки
(сервера, який слухає, під час білду не існує).

### 3.5 Де живуть Server Actions

Глобальна тека `actions/` — антипатерн (руйнує поділ за доменами). Робочі варіанти:

- `app/<segment>/_actions/` — колокація з маршрутом, який їх використовує;
- `features/<x>/api/<name>.action.ts` — екшен належить фіче-слайсу (варіант FSD);
- `lib/actions/<domain>.ts` — централізовано за доменом, для менших застосунків.

### 3.6 FSD у Next.js

Пряма колізія імен: FSD має шари `app` і `pages`, Next.js — свої теки `app/` і `pages/`.
Два задокументовані виходи:
1. перейменувати FSD-шари на `_app` / `_pages` усередині `src/` (офіційний гайд FSD);
2. назвати шар сторінок `views`, лишивши `app/` суто під роутинг (гайд FSD по App Router).

У другому варіанті розподіл такий: `app/` тонкий (сторінка імпортує widget або feature),
мутації належать фіче-слайсам, серверні читання колокуються з сутностями
(`entities/<x>/api/<x>.queries.ts`), кожен слайс віддає публічний API через `index.ts`.

### 3.7 Як це лягає на `client/` у цьому репозиторії

Спостереження з коду (не рекомендації — матеріал для рішень при написанні скіла):

- структура типу «за технічним типом»: `src/app`, `src/components`, `src/lib`,
  `src/vendor`, `src/i18n`; теки `features/` немає;
- усередині `app/` активно використовуються приватні теки `_components`, подекуди
  вкладені (`app/agents/[id]/_components/AgentEditor/_components/...`) — тобто колокація
  з маршрутом уже є де-факто;
- `'use client'` стоїть у 67 файлах із 270; директива є в **кожному** `page.tsx`,
  єдиний серверний компонент — кореневий `layout.tsx`;
- `'use server'` і `server-only` не використовуються взагалі;
- дані йдуть через `src/lib/api.ts` і хуки в `src/lib/hooks/` до окремого Fastify-сервера
  на порту 3001.

Звідси два висновки для скіла. По-перше, межа server/client стоїть на самому верху
(рівень сторінки), тож RSC-шар фактично не задіяний — це усвідомлений вибір
SPA-архітектури при наявному окремому бекенді, і скіл не має сліпо вимагати
«push the boundary to the leaves» без огляду на це. По-друге, за офіційною
класифікацією підходів до даних тут доречний саме **External HTTP APIs (Zero Trust)**,
а не Data Access Layer — доки прямо рекомендують цей варіант, коли бекенд окремий.
Правила про DAL у скілі мають бути позначені як умовні, а не як дефолт.

---

## 4. Де джерела не згодні (це треба явно проговорити в скілі)

1. **kebab-case vs PascalCase** для файлів компонентів — реальний розкол. Дати обидва
   варіанти з критерієм вибору, а не нав'язувати один.
2. **FSD vs bulletproof-react** — FSD значно суворіший (7 шарів). Виправданий на великій
   команді; для типового SPA це надлишок. Скіл має давати критерій «коли що».
3. **Atomic Design** — сам Бред Фрост каже, що конкретні ярлики (atoms/molecules/organisms)
   «ніколи не були суттю і ми їх не використовуємо в роботі». Шарове мислення лишилось,
   буквальні теки `atoms/` — ні. Не рекомендувати як структуру тек.
4. **Clean/Hexagonal Architecture на фронті** — потужно, але дорого. Джерела продають її
   як дефолт; на практиці виправдана лише за складної доменної логіки.
5. **Колокація vs Separation of Concerns** — есей htmx про Locality of Behaviour добре
   формулює конфлікт: LoB свідомо йде проти SoC і DRY, і цей trade-off робиться руками.
6. **Next.js: колокація в `app/` vs окрема тека `features/`** — офіційні доки дають
   обидві стратегії як рівноправні, спільнота частіше радить `features/`. Критерій:
   якщо код потрібен одному маршруту — `_components` поруч із ним; якщо кільком —
   фіча. Скіл має дати правило переходу, а не один «правильний» варіант.
7. **Next.js: як назвати шар сторінок при FSD** — `_pages` (офіційний гайд FSD)
   проти `views` (гайд FSD по App Router). Обидва живі; вибрати один і зафіксувати.
8. **Next.js: DAL як дефолт** — офіційні доки рекомендують DAL для нових проєктів,
   але в тих самих доках External HTTP APIs названо правильним вибором за наявності
   окремого бекенду. Для цього репозиторію актуальний саме другий варіант (див. 3.7).

---

## 5. Повний список джерел

### 5.1 Структура проєкту (базис)

1. [bulletproof-react — Project Structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) — **головне джерело**. Повна розкладка тек, правило односторонніх імпортів, готовий ESLint-конфіг, заборона barrel files. Прочитано повністю.
2. [Feature-Sliced Design — Overview](https://feature-sliced.design/docs/get-started/overview) — шари / слайси / сегменти, правило імпорту згори вниз. Прочитано повністю.
3. [Feature-Sliced Design — сайт](https://feature-sliced.design/) — точка входу, приклади, міграційні гайди.
4. [feature-sliced/documentation (GitHub)](https://github.com/feature-sliced/documentation) — вихідники доків, ADR та обґрунтування рішень.
5. [Robin Wieruch — React Folder Structure Best Practices 2026](https://www.robinwieruch.de/react-folder-structure/) — «драбина зрілості» з 7 стадій, правило просування утиліт, суфікси файлів. Прочитано повністю.
6. [React Handbook — Project Standards](https://reacthandbook.dev/project-standards) — 8-крокова внутрішня структура компонента, лінтинг, посилання на конфіги. Прочитано повністю.
7. [React (legacy docs) — File Structure FAQ](https://legacy.reactjs.org/docs/faq-structure.html) — офіційна позиція: групування за фічею vs за типом, максимум 3–4 рівні вкладеності, «не більше 5 хвилин на вибір».
8. [Next.js — Project structure and organization](https://nextjs.org/docs/app/getting-started/project-structure) — офіційні конвенції: колокація в `app/`, приватні теки `_folder`, route groups `(folder)`, `src/`, три стратегії розкладки. Прочитано повністю.
9. [Alex Kondov — Tao of React](https://alexkondov.com/tao-of-react/) — «group by route/module from the start», common-модуль, абсолютні шляхи, обгортання зовнішніх компонентів, ліміт пропсів. Прочитано повністю.
10. [Screaming Architecture — Evolution of a React folder structure (dev.to)](https://dev.to/profydev/screaming-architecture-evolution-of-a-react-folder-structure-4g25) — покрокова еволюція структури. Оригінал на [profy.dev](https://profy.dev/article/react-folder-structure) блокує curl-перевірку; дзеркало на dev.to робоче.
11. [Milan Jovanović — Screaming Architecture](https://milanjovanovic.tech/blog/screaming-architecture) — першоджерельна ідея (з бекенду), звʼязок із vertical slices та bounded contexts.
12. [Sandro Roth — How to structure your React projects](https://sandroroth.com/blog/project-structure/) — практичний розбір із прикладами.
13. [Web Dev Simplified — How To Structure React Projects](https://blog.webdevsimplified.com/2022-07/react-folder-structure/) — рівні «beginner → advanced», добре для навчальних прикладів.
14. [Netguru — Professional React Project Structure 2025](https://www.netguru.com/blog/react-project-structure) — агенційний погляд, свіжі конвенції.
15. [Martin Piliar — Vertical Slice Architecture in React](https://www.piliar.me/blog/vertical-slice-architecture-react-native/) — «одна тека на use case» у React-контексті.

### 5.2 Колокація як фундаментальний принцип

16. [Kent C. Dodds — Colocation](https://kentcdodds.com/blog/colocation) — «Place code as close to where it's relevant as possible», переваги і два винятки (інтеграційні тести, системна документація). Прочитано повністю.
17. [Kent C. Dodds — State Colocation will make your React app faster](https://kentcdodds.com/blog/state-colocation-will-make-your-react-app-faster) — «push state down» як перф-оптимізація, а не лише естетика.
18. [htmx essays — Locality of Behaviour](https://htmx.org/essays/locality-of-behaviour/) — формулювання принципу і чесний розбір конфлікту з SoC та DRY.
19. [Alex Kondov — Locality of Behavior in React Components](https://alexkondov.com/locality-of-behavior-react/) — той самий принцип уже суто в React-коді.
20. [Matias Kinnunen — Locality of Behavior / Co-location](https://mtsknn.fi/blog/locality-of-behavior-and-co-location/) — огляд і зведення обох принципів.

### 5.3 Розбиття компонентів і патерни композиції

21. [React — Thinking in React](https://react.dev/learn/thinking-in-react) — офіційна методика: розбити макет на дерево компонентів за single responsibility.
22. [React — Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks) — офіційний механізм винесення логіки + попередження «resist adding abstraction too early».
23. [Dan Abramov — Presentational and Container Components](https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0) — оригінал 2015 з авторською приміткою 2019: більше так розбивати не радить. (Medium віддає 403 на curl, у браузері відкривається.)
24. [patterns.dev — Container/Presentational Pattern](https://www.patterns.dev/react/presentational-container-pattern/) — сучасний розбір патерну та його меж.
25. [patterns.dev — Compound Pattern](https://www.patterns.dev/react/compound-pattern/) — складені компоненти через контекст.
26. [patterns.dev — React patterns (індекс)](https://www.patterns.dev/react/) — HOC, hooks, render props, RSC і rendering-патерни в одному місці.
27. [Kent C. Dodds — Compound Components with React Hooks](https://kentcdodds.com/blog/compound-components-with-react-hooks) — канонічна реалізація.
28. [Vercel Academy — Compound Components and Advanced Composition](https://vercel.com/academy/shadcn-ui/compound-components-and-advanced-composition) — практика на прикладі shadcn/ui.
29. [Makers Den — Advanced Guide on React Component Composition](https://makersden.io/blog/guide-on-react-component-composition) — коли композиція краща за пропси.

### 5.4 Бізнес-логіка, стейт, шари

30. [React — You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) — 8 кейсів, де ефект зайвий: рахувати під час рендера, логіка подій — в обробники, скидання стейту через `key`. Прочитано повністю.
31. [React — Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure) — 5 офіційних принципів структурування стейту. Прочитано повністю.
32. [React — Extracting State Logic into a Reducer](https://react.dev/learn/extracting-state-logic-into-a-reducer) — офіційний спосіб винести перехідну логіку з компонента.
33. [React — Passing Data Deeply with Context](https://react.dev/learn/passing-data-deeply-with-context) — офіційні межі застосування контексту (DI, не глобальний стор).
34. [TanStack Query — Does this replace client state managers?](https://tanstack.com/query/v5/docs/framework/react/guides/does-this-replace-client-state) — офіційний вододіл server state / client state.
35. [Felix Gerschau — Separation of concerns with React hooks](https://felixgerschau.com/react-hooks-separation-of-concerns/) — практичний розподіл: хук = логіка, сервіс = зовнішній світ.
36. [Alex Kondov — Hexagonal-Inspired Architecture in React](https://alexkondov.com/hexagonal-inspired-architecture-in-react/) — «натхненний», а не догматичний варіант портів і адаптерів.
37. [Alex Bespoyasov — Clean Architecture on Frontend](https://bespoyasov.me/blog/clean-architecture-on-frontend/) — найдетальніший розбір доменного шару, DTO і маперів на фронті.
38. [FSD Blog — Clean Architecture in Frontend: A How-To Guide](https://feature-sliced.design/blog/frontend-clean-architecture) — як шари Clean Architecture лягають на FSD.
39. [profy.dev — Path To A Cleaner React Architecture: Business Logic Separation](https://profy.dev/article/react-architecture-business-logic-and-dependency-injection) — бізнес-логіка та DI. Сайт блокує curl-перевірку; у браузері доступний.

### 5.5 Типи, константи, утиліти, іменування

40. [Total TypeScript — Where To Put Your Types in Application Code](https://www.totaltypescript.com/where-to-put-your-types-in-application-code) — три правила Метта Покока. Прочитано повністю.
41. [Serghei — Where Your Types Live Matters More Than You Think](https://blog.serghei.pl/posts/where-your-types-live-matters/) — розгорнуто про `types/` як антипатерн.
42. [Why you should avoid helpers (dev.to)](https://dev.to/knzt/helpers-and-utils-folders-in-software-architecture-3f8h) — найкраща аргументація проти «шухляди для мотлоху».
43. [Lib vs Utils vs Services Folders](https://indie-starter.dev/blog/lib-vs-utils-vs-services-folders-simple-explanation-for-developers) — чіткі робочі визначення трьох тек.
44. [Services vs Utils (dev.to)](https://dev.to/moshfiqrony/services-vs-utils-what-is-the-difference-between-services-and-utils-5fh6) — другий погляд на той самий поділ.
45. [Sufle — Naming Conventions in React](https://www.sufle.io/blog/naming-conventions-in-react) — зведена таблиця кейсів для файлів, тек, компонентів, констант.
46. [kettanaito/naming-cheatsheet](https://github.com/kettanaito/naming-cheatsheet) — еталонна шпаргалка з іменування функцій і змінних (її рекомендує React Handbook).
47. [ryanmcdermott/clean-code-javascript](https://github.com/ryanmcdermott/clean-code-javascript) — базові правила чистого коду для JS (теж із React Handbook).
48. [Iceland Digital Handbook — ADR 0009: Naming files and directories](https://docs.devland.is/technical-overview/adr/0009-naming-files-and-directories) — реальний ADR великої кодової бази; приклад того, як зафіксувати конвенцію рішенням.

### 5.6 Межі модулів і правила імпортів

49. [eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries) — декларативні типи елементів і правила залежностей між ними.
50. [eslint-plugin-import — no-restricted-paths](https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-restricted-paths.md) — правило, яким користується bulletproof-react.
51. [ESLint — no-restricted-imports](https://eslint.org/docs/latest/rules/no-restricted-imports) — мінімальний варіант без плагінів.
52. [Nx — Enforce Module Boundaries](https://nx.dev/docs/technologies/eslint/eslint-plugin/guides/enforce-module-boundaries) — теги й обмеження на рівні монорепо.
53. [Tim Deschryver — Enforce module boundaries with no-restricted-imports](https://timdeschryver.dev/bits/enforce-module-boundaries-with-no-restricted-imports) — короткий рецепт із конфігом.
54. [Steve Kinney — Architectural Linting (Enterprise UI)](https://stevekinney.com/courses/enterprise-ui/architectural-linting-exercise) — вправа: як довести архітектурну політику до лінтера.

### 5.7 Barrel files

55. [Barrel Files: Why index.ts Re-Exports Hurt Tree Shaking, Next.js Dev Memory, and tsc](https://reactuse.com/blog/barrel-files-tree-shaking/) — найповніший сучасний розбір із вимірами.
56. [webpack discussion #16863 — barrel files, tree-shaking, code-splitting](https://github.com/webpack/webpack/discussions/16863) — позиція мейнтейнерів бандлера.
57. [Speakeasy — Disabling Barrel Files](https://www.speakeasy.com/docs/sdks/customize/typescript/disabling-barrel-files) — чому SDK-генератор дає опцію їх вимкнути.
58. [Brett Uglow — Burn the Barrel!](https://uglow.medium.com/burn-the-barrel-c282578f21b6) — класичний аргумент проти. (Medium 403 на curl, у браузері працює.)

### 5.8 Тести

59. [Yockyard — Co-locate Your Unit Tests](https://www.yockyard.com/post/co-locate-unit-tests/) — аргументи за колокацію тестів.
60. [Mario Dias — Colocation of Tests: A Cross-Language Perspective](https://itsmariodias.medium.com/colocation-of-tests-a-cross-language-perspective-982e75c872d8) — як це вирішено в інших екосистемах.
    Плюс п. 16 — офіційний виняток Kent C. Dodds для інтеграційних та e2e тестів.

### 5.9 UI-шар і дизайн-система

61. [Brad Frost — Atomic Design, Chapter 2](https://atomicdesign.bradfrost.com/chapter-2/) — першоджерело методології.
62. [Brad Frost — Atomic Web Design (оригінальний пост)](https://bradfrost.com/blog/post/atomic-web-design/) — коротка версія 2013 року.
63. [Qt — Atomic Design Systems: Why the Labels Don't Matter](https://www.qt.io/software-insights/atomic-design-systems-why-the-labels-dont-matter) — містить ключову цитату самого Фроста про те, що ярлики не є суттю.
64. [Atomic design and its relevance in frontend in 2025 (dev.to)](https://dev.to/m_midas/atomic-design-and-its-relevance-in-frontend-in-2025-32e9) — що з методології лишилось актуальним.
65. [Tailwind CSS — Theme variables](https://tailwindcss.com/docs/theme) — офіційно про `@theme` як єдине джерело дизайн-токенів.
66. [Vercel — Turborepo Design System template](https://vercel.com/templates/react/turborepo-design-system) — референсна структура спільного UI-пакета.

### 5.10 Монорепо

67. [FSD Blog — Monorepo Architecture: The Ultimate Guide](https://feature-sliced.design/blog/frontend-monorepo-explained) — apps/packages, межі, коли монорепо виправдане.
68. [Steve Kinney — Monoliths, Microfrontends and Monorepos](https://github.com/stevekinney/stevekinney.net/blob/main/courses/enterprise-ui/monoliths-microfrontends-and-monorepos.md) — курсовий матеріал із критеріями вибору.
69. [Egnworks — Frontend Monorepo Architecture: Turborepo vs Nx](https://www.egnworks.com/blog/frontend-monorepo-architecture-turborepo-vs-nx-and-best-practices) — порівняння інструментів.
    Плюс п. 5 — стадія 7 у Wieruch: як фічі стають пакетами.

### 5.11 Валідація та схеми

70. [vercel/next.js discussion #52652 — Sharing a form validation schema between server and client](https://github.com/vercel/next.js/discussions/52652) — де фізично тримати Zod-схеми, щоб перевикористати їх на обох сторонах.

### 5.12 Next.js — межа server/client як архітектура

71. [Next.js — Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — **ключове**. Коли що використовувати, як звузити межу до листків, interleaving через `children`, провайдери, обгортки для сторонніх бібліотек, `server-only`/`client-only`. Прочитано повністю.
72. [Next.js — The Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary) — найглибше офіційне пояснення: два module graph, що саме перетинає межу (код через імпорти, дані через пропси), owner vs parent, чому compound-компоненти ламаються на межі. Прочитано повністю.
73. [Next.js — `use client` (API reference)](https://nextjs.org/docs/app/api-reference/directives/use-client) — точна семантика директиви.
74. [React — Server Components (reference)](https://react.dev/reference/rsc/server-components) — першоджерело моделі RSC, незалежне від Next.js.
75. [React — `'use client'` (reference)](https://react.dev/reference/rsc/use-client) — офіційна React-сторона тієї ж межі.
76. [Next.js — Rendering Philosophy](https://nextjs.org/docs/app/guides/rendering-philosophy) — static/dynamic як спектр на рівні компонента; потрібно, щоб правила про межі не суперечили моделі рендерингу.
77. [Next.js — Route Groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups) — групування маршрутів і кілька root-layout-ів як інструмент декомпозиції.

### 5.13 Next.js — дані, Data Access Layer, Server Actions

78. [Next.js — How to think about data security](https://nextjs.org/docs/app/guides/data-security) — **ключове**. Три підходи до доступу до даних і заборона їх змішувати, визначення DAL, `server-only`, DTO, правило «тільки DAL читає `process.env`», ре-авторизація в кожному екшені, готовий чек-лист аудиту. Прочитано повністю.
79. [Next.js — How to use Next.js as a backend for your frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) — route handlers vs server actions vs proxy; офіційне застереження не фетчити власні route handlers із серверних компонентів. Прочитано повністю.
80. [Next.js — Server Actions guide](https://nextjs.org/docs/app/guides/server-actions) — модель виконання, черговість, кешування.
81. [Next.js — Authentication](https://nextjs.org/docs/app/guides/authentication) — де в архітектурі живуть сесія і перевірки.
82. [Next.js blog — Security in Next.js Server Components and Actions](https://nextjs.org/blog/security-nextjs-server-components-actions) — розгорнуте обґрунтування моделі від команди Next.js.
83. [`server-only` (npm)](https://www.npmjs.com/package/server-only) — пакет-маркер серверних модулів. (npmjs віддає 403 на curl; у браузері відкривається.)
84. [vercel/next.js discussion #55908 — Organizing Server Actions and Database Queries](https://github.com/vercel/next.js/discussions/55908) — довга дискусія спільноти саме про розкладку екшенів і запитів.
85. [GitHub community discussion #184740 — Next.js 16 folder structure for server actions](https://github.com/orgs/community/discussions/184740) — свіжіший зріз тієї самої теми.
86. [Ayush Sharma — Understanding the Data Access Layer in Next.js](https://aysh.me/blogs/data-access-layer-nextjs) — практичний розбір DAL поза офіційними доками.

### 5.14 Next.js — структура великих застосунків

87. [FSD — The Ultimate Next.js App Router Architecture](https://feature-sliced.design/blog/nextjs-app-router-guide) — `app/` тільки для роутингу, `src/` для FSD-шарів; мутації належать фіче-слайсам, серверні читання — сутностям. Прочитано повністю.
88. [FSD — Usage with Next.js](https://feature-sliced.design/docs/guides/tech/with-nextjs) — офіційне рішення колізії імен шарів (`_app`, `_pages`). Прочитано повністю.
89. [How I Structure Large-Scale Next.js Applications in 2026 (dev.to)](https://dev.to/vrushikvisavadiya/how-i-structure-large-scale-nextjs-applications-in-2026-41pc) — конкретна розкладка `app/ + features/ + lib/`, правило «якщо компонент потрібен одній фічі — лишається в ній». Прочитано повністю.
90. [Groovy Web — Next.js Folder Structure: Best Practices for 2026](https://www.groovyweb.co/blog/nextjs-project-structure-full-stack) — full-stack варіант розкладки.
91. [Dharmsy — Next.js 16 App Router Folder Structure Best Practices](https://www.dharmsy.com/blog/nextjs-16-app-router-folder-structure) — свіжий зріз під Next.js 16.
92. [Raghuveer — Next.js Server vs Client Components: Drawing the Right Boundary](https://www.iamraghuveer.com/posts/nextjs-server-vs-client-components/) — практичні критерії, де саме різати.
93. [jsmanifest — React Server Components in 2026: Patterns, Pitfalls](https://jsmanifest.com/react-server-components-patterns-pitfalls-2026) — типові помилки при розміщенні межі.

---

## 6. Пропонований каркас скіла

```
.claude/skills/frontend-architecture/
├── SKILL.md            # правила з мітками severity, як у react-best-practices
├── structure.md        # еталонні розкладки: SPA, Next App Router, монорепо
├── nextjs.md           # архітектура App Router: межа server/client, DAL, екшени
├── decision-guide.md   # дерева рішень «куди покласти цей файл?»
├── enforcement.md      # ESLint-конфіги для меж модулів
├── examples.md         # good/bad приклади (конвенція репозиторію)
├── references.md       # збирається з розділу 5 (конвенція репозиторію, не README)
└── RESEARCH.md         # цей файл
```

Розділи SKILL.md, що прямо відповідають на питання користувача:
структура тек → розбиття компонентів → бізнес-логіка → стейт → константи й конфіг →
типи → утиліти → межі й імпорти → тести → іменування → **Next.js-специфіка**.

Next.js-частина має бути окремим блоком, а не вплетеною в загальні правила: інакше
правила на кшталт «бізнес-логіка в хуках» конфліктують із «читання даних у серверних
компонентах». Структура блоку: `app/` як роутинг → межа `use client` → доступ до даних
(три підходи) → route handlers vs actions → де живуть екшени → FSD у Next.js.

Обовʼязковий cross-reference: `react-best-practices` (код усередині компонента),
`next-best-practices` (механіка App Router — не дублювати її, посилатися),
`typescript-expert` (монорепо, типи), `security` (перетин із чек-листом аудиту
з Data Security).

Не забути: додати рядок у каталог у `.claude/skills/README.md` (Scope: Frontend).
