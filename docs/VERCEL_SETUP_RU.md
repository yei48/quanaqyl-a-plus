# Запуск QuanAQYL на Vercel

Код готов к Next.js на Vercel. Для сохранения профилей, результатов, покупок, Pomodoro и фотографий подключи Supabase по шагам ниже. Данные прежнего сайта Sites остаются там; новая база создаётся пустой.

## 1. Подготовь проект Supabase

Открой [Supabase Dashboard](https://supabase.com/dashboard) и создай проект `QuanAQYL` либо используй отдельный существующий проект для этого сайта. Сохрани пароль базы данных в менеджере паролей. Дождись готовности базы.

Не используй чужую рабочую базу: миграции создают схему `quanaqyl` и настраивают bucket `profile-photos`.

## 2. Создай таблицы и хранилище фото

В Supabase открой **SQL Editor → New query**. По очереди скопируй полное содержимое файлов из репозитория и нажми **Run**:

1. [`202610230001_quanaqyl.sql`](../supabase/migrations/202610230001_quanaqyl.sql) — семь таблиц, ограничения и индексы.
2. [`202610230002_photos.sql`](../supabase/migrations/202610230002_photos.sql) — приватный bucket и правила доступа к фото.

В Table Editor выбери схему `quanaqyl`; в Storage должен появиться приватный `profile-photos`.

Не добавляй `quanaqyl` в **Exposed schemas** Data API. Прямой доступ браузера к учебным таблицам отключён; операции выполняются сервером сайта. Не меняй bucket на Public.

Альтернатива для локальной разработки: после заполнения `.env.local` запусти `pnpm db:migrate`. Миграции допускают повторный запуск; они не удаляют существующие учебные записи.

## 3. Получи три значения

| Переменная Vercel | Где взять | Назначение |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Connect / API: Project URL | URL твоего проекта |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API Keys: Publishable key | Публичный ключ для Auth и Storage; не Secret key |
| `DATABASE_URL` | Supabase → Connect → Transaction pooler | PostgreSQL-подключение сервера, обычно порт `6543` |

В строке Transaction pooler подставь настоящий пароль базы вместо `[YOUR-PASSWORD]`. Копируй адрес хоста из Supabase: регион и имя пула зависят от проекта. Спецсимволы пароля должны быть URL-encoded, если собираешь строку самостоятельно.

`DATABASE_URL` — секрет. В Vercel добавляй её без префикса `NEXT_PUBLIC_`; не помещай её в код, GitHub, сообщения или скриншоты. `service_role`/Secret key этому приложению не нужен.

Если Supabase требует отдельный CA-сертификат для проверки TLS, добавь его PEM-текст как серверную переменную `DATABASE_SSL_CERT`. Не отключай проверку сертификата.

## 4. Настрой вход и письма

В Supabase **Authentication** включи провайдер Email и регистрацию новых пользователей. Оставь подтверждение e-mail включённым.

Для регистрации пользователей с произвольными адресами и восстановления пароля настрой **Custom SMTP**. Стандартный почтовый сервер Supabase предназначен для тестирования и отправляет письма только участникам команды проекта. Для проверки до подключения SMTP используй адрес участника команды; не отключай подтверждение почты ради обхода этой настройки.

После получения адреса Vercel в **Authentication → URL Configuration** задай:

- **Site URL:** полный адрес сайта, например `https://имя-твоего-сайта.vercel.app`.
- **Redirect URLs:** `https://имя-твоего-сайта.vercel.app/auth/callback` и `https://имя-твоего-сайта.vercel.app/auth/callback?next=/auth/reset`.
- Для локальной разработки добавь аналогичные адреса с `http://localhost:3000`.

Используй действительный адрес из Vercel, не оставляй пример. Для отдельных Preview-деплоев добавляй конкретный проверяемый адрес; не разрешай все чужие домены.

Рекомендуемые ссылки для шаблонов **Authentication → Email Templates** (работают также при открытии письма на другом устройстве):

**Confirm signup:**

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">Подтвердить e-mail</a>
```

**Reset password:**

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Изменить пароль</a>
```

Остальное оформление писем можно сохранить. Обычные шаблоны с `{{ .ConfirmationURL }}` тоже поддерживаются через `/auth/callback`; для PKCE-ссылок открывай письмо в том же браузере, где запросила его.

## 5. Импортируй репозиторий в Vercel

На странице **New Project**:

- Repository: `yei48/quanaqyl-a-plus`.
- Branch: `main`.
- Framework: **Next.js**.
- Root Directory: `./`.
- Node.js: **22.x** (также закреплён в `package.json`).
- Output Directory: оставить стандартную, без переопределения.

В **Environment Variables** добавь три переменные из шага 3. Для первого запуска выбери Production. Если будешь использовать Preview, настрой переменные и там; для независимого тестирования лучше отдельная база/проект.

`vercel.json` уже задаёт установку закреплённого pnpm и сборку. Не выбирай Static Export и не задавай `dist`:

```text
Install Command: npm exec --yes --package=pnpm@11.25.0 -- pnpm install --frozen-lockfile
Build Command: npm run build
```

Нажми **Deploy**. После получения адреса заверши URL Configuration в Supabase по шагу 4. Если проект Vercel был создан раньше, проверь отсутствие старых ручных переопределений Build/Install/Output, дождись обновления `main` и сделай Redeploy последнего коммита. Изменение переменных окружения также требует Redeploy.

## 6. Проверь полноценный запуск

1. Зарегистрируй аккаунт, подтверди письмо и войди. Открой сайт повторно — сессия должна сохраниться.
2. Измени профиль, загрузи PNG/JPEG/WebP до 2 МБ и обнови страницу.
3. Пройди диагностику и практику; проверь историю и начисление баллов.
4. Купи доступный товар и проверь коллекцию и баланс после обновления.
5. Поставь Pomodoro на 1 минуту работы и 1 минуту отдыха. Проверь паузу, продолжение и запись в «Прогрессе».
6. Переключи RU/KK/EN, проверь теорию и симуляцию, открой сайт на телефоне.
7. Выйди, войди другим аккаунтом и убедись, что чужой прогресс, фото и покупки не отображаются.
8. Запроси восстановление пароля и пройди по ссылке из письма.

## Если что-то не работает

| Симптом | Что проверить |
| --- | --- |
| «Вход ещё настраивается» | Обе `NEXT_PUBLIC_SUPABASE_*` переменные и новый Redeploy |
| Письмо не приходит | Подтверждение e-mail, Custom SMTP, правильный адрес, папка «Спам», лимиты Supabase |
| Ссылка из письма возвращает ошибку | Site URL, Redirect URLs, шаблоны писем, срок действия ссылки |
| Вход работает, но профиль не загружается | `DATABASE_URL`, пароль, Transaction pooler и первая SQL-миграция |
| Фото не загружается | Вторая миграция, приватный bucket, допустимый формат и размер |
| Ошибка TLS | Правильный pooler host; при необходимости CA в `DATABASE_SSL_CERT` |
| Ошибка pnpm/lockfile | Install Command из `vercel.json`, Node 22, отсутствие старых overrides |

Не присылай пароли или ключи. Для диагностики достаточно текста ошибки без секретов и имени неработающего шага.

## Документация сервисов

- [Supabase SSR и проверка сессии](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Подключение PostgreSQL и transaction pooler](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Настройка отправки писем](https://supabase.com/docs/guides/auth/auth-smtp)
- [Версии Node.js на Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
