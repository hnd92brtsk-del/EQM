import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography
} from "@mui/material";
import type { ReactNode } from "react";

import type { HelpAnchor, HelpSearchEntry } from "./types";

type Language = "ru" | "en";

type Localized = Record<Language, string>;

type DiagnosticErrorCase = {
  id: string;
  title: Localized;
  whereSeen: Localized;
  howToRecognize: Localized;
  likelyCauses: Localized[];
  resolutionSteps: Localized[];
  verification: Localized;
  keywords: string[];
};

type DiagnosticsHelpBundle = {
  content: ReactNode;
  anchors: HelpAnchor[];
  searchEntries: HelpSearchEntry[];
};

type TextBlock = {
  id: string;
  title: Localized;
  summary: Localized;
  paragraphs: Localized[];
  bullets?: Localized[];
  keywords: string[];
};

type CodeSample = {
  title: Localized;
  language: string;
  code: string;
};

const adminDiagnosticsSectionAnchor = "admin-diagnostics";

function text(language: Language, value: Localized) {
  return value[language];
}

function renderCodeSample(language: Language, sample: CodeSample) {
  return (
    <Box sx={{ display: "grid", gap: 0.75 }}>
      <Typography variant="subtitle2">{text(language, sample.title)}</Typography>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 2,
          overflowX: "auto",
          borderRadius: 1.5,
          bgcolor: "grey.950",
          color: "grey.100",
          fontSize: "0.85rem"
        }}
      >
        <code>{sample.code}</code>
      </Box>
    </Box>
  );
}

function renderTextBlock(language: Language, block: TextBlock) {
  return (
    <Box key={block.id} id={block.id} sx={{ display: "grid", gap: 1.25, scrollMarginTop: 96 }}>
      <Typography variant="h6">{text(language, block.title)}</Typography>
      <Typography variant="body1">{text(language, block.summary)}</Typography>
      {block.paragraphs.map((paragraph, index) => (
        <Typography key={`${block.id}-paragraph-${index}`} variant="body2" color="text.secondary">
          {text(language, paragraph)}
        </Typography>
      ))}
      {block.bullets?.length ? (
        <List dense disablePadding>
          {block.bullets.map((bullet, index) => (
            <ListItem key={`${block.id}-bullet-${index}`} sx={{ display: "list-item", pl: 2.5 }}>
              <ListItemText primaryTypographyProps={{ variant: "body2" }} primary={text(language, bullet)} />
            </ListItem>
          ))}
        </List>
      ) : null}
    </Box>
  );
}

function renderRuntimeDiagram(language: Language) {
  const labels = {
    ru: {
      client: "Пользователь / браузер",
      frontend: "Frontend :5173",
      api: "API /api/v1",
      backend: "Backend :8000",
      db: "PostgreSQL :5432"
    },
    en: {
      client: "User / browser",
      frontend: "Frontend :5173",
      api: "API /api/v1",
      backend: "Backend :8000",
      db: "PostgreSQL :5432"
    }
  }[language];

  return (
    <Card variant="outlined">
      <CardContent sx={{ display: "grid", gap: 1.5 }}>
        <Typography variant="subtitle2">
          {language === "ru" ? "Схема взаимодействия слоёв" : "Layer interaction diagram"}
        </Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems="center" justifyContent="center" useFlexGap flexWrap="wrap">
          {[labels.client, labels.frontend, labels.api, labels.backend, labels.db].map((item, index, items) => (
            <Box key={item} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Chip color={index === 0 ? "default" : index === items.length - 1 ? "success" : "primary"} label={item} />
              {index < items.length - 1 ? <Typography color="text.secondary">→</Typography> : null}
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

function renderTabMap(language: Language) {
  const labels = language === "ru"
    ? [
        { title: "Обзор", body: "Общая картина: сервисы, БД, цепочка frontend/backend/database." },
        { title: "Процессы и порты", body: "Кто реально владеет портом, как запущен процесс и нет ли хвостов." },
        { title: "Ошибки и логи", body: "Какая ошибка произошла, где её читать и какие команды проверить." }
      ]
    : [
        { title: "Overview", body: "Overall picture: services, database, and the frontend/backend/database chain." },
        { title: "Processes and ports", body: "Who really owns the port, how the process was started, and whether tails remain." },
        { title: "Errors and logs", body: "What failed, where to read it, and which commands to validate next." }
      ];

  return (
    <Card variant="outlined">
      <CardContent sx={{ display: "grid", gap: 1.5 }}>
        <Typography variant="subtitle2">
          {language === "ru" ? "Мини-схема по вкладкам" : "Mini map of the diagnostics tabs"}
        </Typography>
        <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" } }}>
          {labels.map((item) => (
            <Box key={item.title} sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, p: 1.5 }}>
              <Typography variant="subtitle2">{item.title}</Typography>
              <Typography variant="body2" color="text.secondary">{item.body}</Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}

function renderDecisionTree(language: Language) {
  const steps = language === "ru"
    ? [
        "Есть ли доступ к frontend-странице и открывается ли приложение вообще?",
        "Если frontend открылся, проходит ли backend HTTP probe и отвечает ли /docs?",
        "Если backend не отвечает, существует ли слушатель на 8000 и какой процесс владеет портом?",
        "Если backend отвечает, но данные не грузятся, доступна ли PostgreSQL на 5432 и корректны ли DB-параметры?",
        "Если слой жив, но всё ещё warning, смотрите логи и конфигурационные расхождения."
      ]
    : [
        "Is the frontend page reachable, and does the application open at all?",
        "If the frontend opens, does the backend HTTP probe pass and does /docs respond?",
        "If the backend does not respond, is there a listener on 8000 and which process owns it?",
        "If the backend responds but data still fails, is PostgreSQL reachable on 5432 and are DB settings correct?",
        "If the layer is alive but still warning, inspect logs and configuration mismatches."
      ];

  return (
    <Alert severity="info">
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {language === "ru" ? "Decision tree: с чего начинать поиск причины" : "Decision tree: where to start root-cause analysis"}
      </Typography>
      <List dense disablePadding>
        {steps.map((step, index) => (
          <ListItem key={step} sx={{ display: "list-item", pl: 2.5 }}>
            <ListItemText primaryTypographyProps={{ variant: "body2" }} primary={`${index + 1}. ${step}`} />
          </ListItem>
        ))}
      </List>
    </Alert>
  );
}

const introBlock: TextBlock = {
  id: "admin-diagnostics-what-is",
  title: { ru: "Что такое Диагностика", en: "What Diagnostics Is" },
  summary: {
    ru: "Раздел помогает администратору понять, живы ли frontend, backend и PostgreSQL, согласованы ли настройки и где искать первичную причину сбоя.",
    en: "This section helps an administrator confirm that the frontend, backend, and PostgreSQL are alive, aligned, and traceable when something goes wrong."
  },
  paragraphs: [
    {
      ru: "Экран `Admin -> Диагностика` доступен только роли администратора, но сама инструкция размещается в общей странице `Помощь -> Администрирование`, чтобы её можно было открыть до перехода к админским действиям. Диагностика не исправляет систему автоматически: она показывает состояние, проблемы, связанные процессы, порты и журналы, а также подсказывает безопасные следующие шаги.",
      en: "The `Admin -> Diagnostics` screen is available only to the admin role, but this guide lives under `Help -> Administration` so that the operating instructions are easy to reach before performing admin actions. Diagnostics does not auto-fix the system: it shows state, problems, related processes, ports, logs, and the next safe actions."
    },
    {
      ru: "Данные собираются backend-сервисом из нескольких источников: списка процессов ОС, открытых TCP-портов, HTTP-проверок, конфигурации backend и frontend, параметров подключения к БД и runtime-логов. Дополнительно backend создаёт synthetic server/host-события, когда сам видит конфликт порта, осиротевший процесс, отсутствие лог-файла или расхождение конфигурации.",
      en: "Data is collected by the backend service from several sources: operating-system process lists, listening TCP ports, HTTP probes, backend and frontend configuration, database connection settings, and runtime logs. The backend also generates synthetic server/host events when it detects a port conflict, an orphaned process, a missing log file, or a configuration mismatch."
    },
    {
      ru: "Проверка обновляется вручную кнопкой `Обновить сейчас` и автоматически примерно раз в `3600` секунд. Ручное обновление полезно сразу после перезапуска сервиса. Фоновый интервал нужен для того, чтобы страница не создавала лишнюю нагрузку на локальный хост при обычной эксплуатации.",
      en: "Checks are refreshed manually by the `Refresh now` button and automatically about every `3600` seconds. Manual refresh is useful immediately after restarting a service. The background interval prevents the page from creating unnecessary load on the local host during normal operation."
    }
  ],
  bullets: [
    {
      ru: "Если экран не открывается, сначала проверьте авторизацию и роль пользователя.",
      en: "If the screen does not open, verify authentication and the user role first."
    },
    {
      ru: "Если данные выглядят устаревшими, выполните ручное обновление после запуска или остановки сервиса.",
      en: "If data looks stale, run a manual refresh after starting or stopping a service."
    }
  ],
  keywords: ["diagnostics", "admin", "refresh", "3600", "logs", "ports", "processes", "основы", "диагностика"]
};

const stackBlock: TextBlock = {
  id: "admin-diagnostics-stack",
  title: { ru: "Как устроен стек EQM", en: "How the EQM Stack Works" },
  summary: {
    ru: "EQM состоит из браузера, frontend, backend, API и PostgreSQL. Каждый слой зависит от предыдущего и передаёт запрос дальше по цепочке.",
    en: "EQM consists of a browser, frontend, backend, API, and PostgreSQL. Each layer depends on the previous one and forwards the request through the chain."
  },
  paragraphs: [
    {
      ru: "Клиент или браузер — это окно, в котором пользователь работает с приложением. Frontend — визуальная часть на `React 18 + Vite + MUI`: она показывает таблицы, формы, графики и вкладки диагностики. Backend — серверное приложение на `FastAPI`, которое принимает API-запросы, проверяет права, читает и записывает данные, собирает диагностику и отдаёт JSON-ответы.",
      en: "The client or browser is the window where the user works with the application. The frontend is the visual layer built with `React 18 + Vite + MUI`: it renders tables, forms, charts, and diagnostics tabs. The backend is the server application built with `FastAPI`: it accepts API requests, checks permissions, reads and writes data, collects diagnostics, and returns JSON responses."
    },
    {
      ru: "База данных PostgreSQL хранит постоянные данные: пользователей, справочники, оборудование, связи, сессии и журнал аудита. Сервер или хост — это сама машина, где запущены процессы EQM, PostgreSQL, возможный reverse proxy и вспомогательные shell-процессы. Reverse proxy (`Nginx`) может стоять перед frontend/backend в эксплуатационной среде и быть публичной точкой входа.",
      en: "The PostgreSQL database stores persistent data: users, dictionaries, equipment, relations, sessions, and audit logs. The server or host is the actual machine where EQM processes, PostgreSQL, an optional reverse proxy, and helper shell processes run. A reverse proxy (`Nginx`) may sit in front of the frontend/backend in an operational environment and act as the public entry point."
    },
    {
      ru: "В проекте применяются `PostgreSQL 16.3`, `FastAPI`, `SQLAlchemy 2.x`, `Alembic`, `React 18`, `Vite`, `MUI`, `TanStack Query`, `TanStack Table`, `Recharts`, `Node.js` и `npm`. API-база frontend по умолчанию берётся из `frontend/src/api/client.ts` и указывает на `http://localhost:8000/api/v1`. Backend читает параметры БД из `backend/.env`, а runtime-скрипты и журналы лежат в корне проекта: `.ps1`-скрипты рядом с `README.md`, журналы — в `runtime-logs` и legacy-файлах в корне.",
      en: "This project uses `PostgreSQL 16.3`, `FastAPI`, `SQLAlchemy 2.x`, `Alembic`, `React 18`, `Vite`, `MUI`, `TanStack Query`, `TanStack Table`, `Recharts`, `Node.js`, and `npm`. The frontend API base defaults from `frontend/src/api/client.ts` and points to `http://localhost:8000/api/v1`. The backend reads database settings from `backend/.env`, and runtime scripts and logs live in the project root: `.ps1` scripts next to `README.md`, logs in `runtime-logs` and legacy root files."
    }
  ],
  bullets: [
    {
      ru: "Типовая локальная цепочка: `браузер -> frontend :5173 -> API /api/v1 -> backend :8000 -> PostgreSQL :5432`.",
      en: "Typical local chain: `browser -> frontend :5173 -> API /api/v1 -> backend :8000 -> PostgreSQL :5432`."
    },
    {
      ru: "Если любой слой не отвечает, пользователь видит ошибку выше по цепочке, даже если проблема на самом деле находится ниже.",
      en: "If any layer stops responding, the user sees the failure higher in the chain, even when the real cause is lower."
    }
  ],
  keywords: ["frontend", "backend", "database", "postgresql", "server", "reverse proxy", "docker", "nginx", "api", "stack", "стек", "бд"]
};

const overviewBlock: TextBlock = {
  id: "admin-diagnostics-overview-tab",
  title: { ru: "Вкладка Обзор", en: "Overview Tab" },
  summary: {
    ru: "Вкладка показывает общее здоровье runtime: статус сервисов, метрики БД и согласованность цепочки frontend/backend/database.",
    en: "This tab shows overall runtime health: service status, database metrics, and the consistency of the frontend/backend/database chain."
  },
  paragraphs: [
    {
      ru: "Карточка состояния хоста показывает имя машины, количество распознанных EQM-процессов, число предупреждений и критических проблем. Цвета статусов трактуются так: `healthy` — слой работает штатно, `warning` — слой работает, но есть расхождение или риск, `critical` — сервис недоступен или явно сломан, `unknown` — данных не хватило для уверенного вывода.",
      en: "The host-state card shows the machine name, the number of recognized EQM processes, and the count of warning and critical problems. Status colors mean: `healthy` for normal operation, `warning` for a working layer with a mismatch or risk, `critical` for a clearly broken or unavailable service, and `unknown` when there is not enough evidence for a confident conclusion."
    },
    {
      ru: "Блок runtime summary агрегирует основные runtime-компоненты, служебные процессы и проблемные процессы. Здесь полезно быстро понять, нет ли дублирующих экземпляров frontend/backend/postgres и не осталось ли лишних watcher/fork-процессов после перезапуска.",
      en: "The runtime summary block aggregates primary runtime components, auxiliary processes, and problematic processes. This helps you quickly see whether duplicate frontend/backend/postgres instances exist or whether watcher/fork processes remained after a restart."
    },
    {
      ru: "Сервисные карточки `Frontend`, `Backend` и `PostgreSQL` показывают ожидаемый порт, PID слушателя, результат HTTP-проверки, количество процессов и список проблем. По ним обычно видно первичный симптом: нет слушателя, HTTP не проходит, порт занят чужим процессом, найден сиротливый или дублирующий runtime.",
      en: "The `Frontend`, `Backend`, and `PostgreSQL` service cards show the expected port, listener PID, HTTP probe result, process counts, and a list of issues. They usually reveal the first visible symptom: missing listener, failed HTTP probe, foreign port owner, orphaned runtime, or duplicate runtime."
    },
    {
      ru: "Метрики БД показывают общий размер базы, число таблиц `public schema` без `alembic_version`, суммарное число строк, самые тяжёлые таблицы и долю индексов. Эти данные нужны не только разработчику: администратор может заметить аномальный рост журнала, резкое увеличение строк или неожиданное отсутствие таблиц после сбоя миграций.",
      en: "Database metrics show total database size, the number of tables in the `public schema` excluding `alembic_version`, the total row count, the heaviest tables, and the share of indexes. This is useful for administrators as well: you can spot abnormal growth, a sudden row increase, or unexpectedly missing tables after a migration failure."
    },
    {
      ru: "Runtime topology и runtime chain объясняют, куда именно смотрит frontend, какой backend считается текущим, доступен ли `backend_http_url`, к какой БД подключается backend, и совпадает ли frontend API base с текущим backend. Если frontend указывает на другой backend API, пользователь может видеть старые данные или получать ошибку, хотя локальный backend при этом жив.",
      en: "Runtime topology and the runtime chain explain where the frontend points, which backend is considered current, whether `backend_http_url` is reachable, which database the backend uses, and whether the frontend API base matches the current backend. If the frontend points to another backend API, the user may see stale data or errors even while the local backend is alive."
    }
  ],
  bullets: [
    {
      ru: "Особое внимание уделяйте проблемам `listener_missing`, `http_probe_failed`, `foreign_listener`, `duplicate_runtime`, `orphan_process_detected`, `stale_pid`.",
      en: "Pay special attention to `listener_missing`, `http_probe_failed`, `foreign_listener`, `duplicate_runtime`, `orphan_process_detected`, and `stale_pid`."
    },
    {
      ru: "Отдельные runtime-issues означают конфигурационные расхождения: другой backend API, не локальная БД по умолчанию, сбой HTTP probe backend или отсутствие обнаруженного reverse proxy.",
      en: "Separate runtime issues represent configuration mismatches: another backend API, a non-default local database, a failed backend HTTP probe, or the absence of a detected reverse proxy."
    }
  ],
  keywords: ["overview", "runtime topology", "healthy", "warning", "critical", "unknown", "database metrics", "listener_missing", "http_probe_failed"]
};

const processesBlock: TextBlock = {
  id: "admin-diagnostics-processes-tab",
  title: { ru: "Вкладка Процессы и порты", en: "Processes and Ports Tab" },
  summary: {
    ru: "Эта вкладка нужна, когда надо понять, какой процесс реально владеет портом, как он был запущен и нет ли конфликтующих дочерних экземпляров.",
    en: "This tab is used when you need to know which process actually owns a port, how it was started, and whether conflicting child instances exist."
  },
  paragraphs: [
    {
      ru: "Фильтр `search` ищет по PID, имени процесса, роли, порту, команде запуска и поясняющему тексту. Фильтр `service` сужает выборку до frontend, backend или PostgreSQL. Флаг `only problematic` удобен после перезапуска, когда нужно быстро увидеть только подозрительные элементы.",
      en: "The `search` filter looks through PID, process name, role, port, command line, and explanatory text. The `service` filter narrows the view to frontend, backend, or PostgreSQL. The `only problematic` flag is useful after a restart when you want to see only suspicious items."
    },
    {
      ru: "Таблица портов показывает ожидаемый сервис, реальный `detected service`, PID владельца, роль порта, тип источника (`local`, `docker`, `proxy`, `config`) и команду запуска. Если ожидаемый порт занят чужим процессом, именно здесь удобнее всего найти PID нарушителя до завершения процесса.",
      en: "The ports table shows the expected service, the real `detected service`, the owner PID, the port role, the source kind (`local`, `docker`, `proxy`, `config`), and the launch command. When an expected port is owned by another process, this is the fastest place to identify the offending PID before terminating it."
    },
    {
      ru: "Таблица процессов раскрывает структуру runtime: `pid`, `parent_pid`, `runtime_root_pid`, сетевые порты, статус ОС, роль процесса и список подозрительных признаков. Поля `is_primary_runtime` и `is_auxiliary_runtime` позволяют отличить главный рабочий процесс от shell-wrapper, watcher, фонового postgres-worker или другого служебного элемента.",
      en: "The processes table exposes the runtime structure: `pid`, `parent_pid`, `runtime_root_pid`, network ports, OS status, process role, and suspicious reasons. The `is_primary_runtime` and `is_auxiliary_runtime` fields help distinguish the main worker from a shell wrapper, watcher, background postgres worker, or another auxiliary element."
    },
    {
      ru: "В проекте используются роли процессов: `uvicorn_worker` — главный backend listener, `reload_watcher` — dev-reload контроллер backend, `vite_node` — основной frontend dev server, `shell_wrapper` — оболочка PowerShell/cmd, `postmaster` — главный процесс PostgreSQL, `backend_connection`, `bgworker`, `checkpointer`, `walwriter`, `autovacuum_launcher`, `logical_replication_launcher`, `forkaux`, `forkbackend` — внутренние процессы PostgreSQL. `backend_aux` и `frontend_aux` — вспомогательные процессы конкретного сервиса.",
      en: "The project uses these process roles: `uvicorn_worker` for the main backend listener, `reload_watcher` for the backend dev-reload controller, `vite_node` for the primary frontend dev server, `shell_wrapper` for the PowerShell/cmd launcher, `postmaster` for the main PostgreSQL process, and `backend_connection`, `bgworker`, `checkpointer`, `walwriter`, `autovacuum_launcher`, `logical_replication_launcher`, `forkaux`, `forkbackend` for internal PostgreSQL workers. `backend_aux` and `frontend_aux` are auxiliary processes of their respective services."
    },
    {
      ru: "Кнопка `Kill process` доступна только для orphan-процессов, то есть для процессов без живого родителя. Это аварийная мера для очистки хвостов после некорректного завершения. Её нельзя использовать как обычный способ остановки живого backend/frontend/postgres: нормальная остановка должна выполняться через команды сервиса, systemd, Docker Compose или штатные `.ps1`-скрипты.",
      en: "The `Kill process` button is available only for orphaned processes, meaning processes without a live parent. This is an emergency cleanup measure for leftovers after an unclean shutdown. It must not be used as the normal way to stop a healthy backend/frontend/postgres instance: normal stop operations should go through service commands, systemd, Docker Compose, or the provided `.ps1` scripts."
    }
  ],
  keywords: ["processes", "ports", "pid", "runtime_root_pid", "orphan", "kill process", "uvicorn_worker", "vite_node", "postmaster", "roles"]
};

const logsBlock: TextBlock = {
  id: "admin-diagnostics-logs-tab",
  title: { ru: "Вкладка Ошибки и логи", en: "Errors and Logs Tab" },
  summary: {
    ru: "Вкладка помогает перейти от симптома к причине: здесь собраны проблемные записи runtime и подсказки по устранению.",
    en: "This tab helps you move from symptom to root cause: it collects problematic runtime entries and actionable hints."
  },
  paragraphs: [
    {
      ru: "Фильтры `source`, `severity`, `search`, `date from`, `date to` и `show low signal` позволяют сузить поток событий. Источники означают следующее: `server` — synthetic host/runtime-события backend, `postgres` — файлы PostgreSQL, `backend` — stdout/stderr backend, `frontend` — stdout/stderr frontend dev server.",
      en: "The `source`, `severity`, `search`, `date from`, `date to`, and `show low signal` filters let you narrow the event stream. Sources mean: `server` for synthetic host/runtime events from the backend, `postgres` for PostgreSQL files, `backend` for backend stdout/stderr, and `frontend` for frontend dev-server stdout/stderr."
    },
    {
      ru: "Low-signal записи — это шумовые или служебные события. Например, плановый checkpoint PostgreSQL обычно не авария и не требует действий. Поэтому по умолчанию такие записи скрыты. Включайте их только тогда, когда нужно подробно изучить временную шкалу или убедиться, что лог-файл вообще живой.",
      en: "Low-signal entries are noisy or housekeeping events. For example, a scheduled PostgreSQL checkpoint is normally not an incident and does not require action. That is why these entries are hidden by default. Enable them only when you need a detailed timeline or want to confirm that the log file is still active."
    },
    {
      ru: "Каждая карточка лога состоит из краткого `summary`, нормализованного текста `normalized_message`, исходной строки `raw_message`, пути к файлу и номера строки, а также блоков `possible_causes`, `suggested_actions` и `suggested_commands`. Если backend сумел распознать сигнатуру ошибки, администратор сразу получает не только сообщение, но и контекст: что, вероятно, произошло и чем это проверить.",
      en: "Each log card includes a short `summary`, a normalized `normalized_message`, the original `raw_message`, the file path and line number, and the `possible_causes`, `suggested_actions`, and `suggested_commands` blocks. When the backend recognizes an error signature, the administrator gets not just the message but also the likely context and the right validation commands."
    },
    {
      ru: "Кнопка `Delete selected` выполняет жёсткое удаление строк из исходных лог-файлов. Это не фильтр и не архивация. Используйте её только тогда, когда нужно убрать нерелевантный мусор из локального dev-runtime. Для производственной эксплуатации предпочтительнее сохранять логи и решать проблему через rotation/policy, а не ручное стирание строк.",
      en: "The `Delete selected` button performs a hard delete of lines from the source log files. It is not a filter and not an archive action. Use it only when you need to remove irrelevant noise from a local dev runtime. In operational environments it is better to preserve logs and solve the problem through rotation/policy rather than by manually deleting lines."
    }
  ],
  keywords: ["logs", "errors", "server", "postgres", "backend", "frontend", "low signal", "delete selected", "summary", "raw_message"]
};

const startStopBlock: TextBlock = {
  id: "admin-diagnostics-start-stop",
  title: { ru: "Запуск и останов", en: "Start and Stop Procedures" },
  summary: {
    ru: "Сначала используйте ручные команды, чтобы понимать, что именно запущено. Затем можно переходить к штатным `.ps1`-скриптам или operational-командам Docker/Nginx/Systemd.",
    en: "Use manual commands first so that you understand exactly what is running. Then move to the provided `.ps1` scripts or to Docker/Nginx/Systemd operational commands."
  },
  paragraphs: [
    {
      ru: "Локальный Windows-сценарий в этом репозитории считается основным: PostgreSQL живёт в `.postgres\\data`, backend запускается через `uvicorn`, frontend — через `npm.cmd run dev`. Перед первым запуском нужно создать `.venv`, установить зависимости backend/frontend, заполнить `backend/.env`, создать БД через `backend/scripts/create_database.py`, применить миграции `alembic upgrade head` и при необходимости загрузить seed-данные.",
      en: "The local Windows scenario is the primary one in this repository: PostgreSQL lives in `.postgres\\data`, the backend starts through `uvicorn`, and the frontend through `npm.cmd run dev`. Before the first start you should create `.venv`, install backend/frontend dependencies, fill in `backend/.env`, create the database via `backend/scripts/create_database.py`, apply `alembic upgrade head`, and load seed data if needed."
    },
    {
      ru: "Для ежедневной эксплуатации удобнее использовать `.\\start-local.ps1` и `.\\stop-local.ps1`: они поднимают локальный cluster PostgreSQL, очищают конфликтующие dev-процессы EQM и создают журналы в `runtime-logs`. Низкоуровневые `.\\start-backend.ps1` и `.\\start-frontend.ps1` полезны, когда нужно перезапустить только один слой, не трогая остальной runtime.",
      en: "For day-to-day use it is easier to rely on `.\\start-local.ps1` and `.\\stop-local.ps1`: they start the local PostgreSQL cluster, clean up conflicting EQM dev processes, and create logs in `runtime-logs`. The low-level `.\\start-backend.ps1` and `.\\start-frontend.ps1` scripts are useful when you need to restart only one layer without touching the rest of the runtime."
    },
    {
      ru: "В эксплуатационной среде диагностика уже показывает подсказки для `Docker / Docker Compose` и `Nginx / Systemd`. Их нужно понимать как operational playbook, а не как гарантию того, что этот репозиторий содержит готовые deployment-манифесты. Если инфраструктура развёрнута через Docker или systemd, команды `docker compose ps/logs/restart`, `systemctl status`, `journalctl`, `nginx -t`, `curl` и `ss` должны быть основой ручной проверки.",
      en: "In an operational environment the diagnostics page already shows hints for `Docker / Docker Compose` and `Nginx / Systemd`. Treat them as an operational playbook, not as evidence that this repository contains deployment manifests. If infrastructure is deployed with Docker or systemd, commands like `docker compose ps/logs/restart`, `systemctl status`, `journalctl`, `nginx -t`, `curl`, and `ss` should become your primary manual verification toolkit."
    }
  ],
  keywords: ["start", "stop", "pg_ctl", "uvicorn", "npm", "start-local.ps1", "stop-local.ps1", "docker compose", "systemctl", "journalctl", "nginx"]
};

const playbooksBlock: TextBlock = {
  id: "admin-diagnostics-playbooks",
  title: { ru: "Практические сценарии", en: "Practical Playbooks" },
  summary: {
    ru: "Раздел описывает рабочие ритуалы: ежедневную проверку, анализ неудачного старта, безопасный перезапуск одного слоя и подготовку данных для эскалации.",
    en: "This section describes operating rituals: the daily check, failed-start analysis, safe single-layer restart, and escalation prep."
  },
  paragraphs: [
    {
      ru: "Ежедневная проверка начинается с вкладки `Обзор`: убедитесь, что все три основных сервиса healthy или хотя бы predictable warning, runtime chain согласована, а число проблемных процессов не растёт. Затем откройте вкладку логов и убедитесь, что нет новых critical-записей после последнего окна обслуживания.",
      en: "The daily check starts from the `Overview` tab: confirm that all three primary services are healthy or at least predictably warning, the runtime chain is aligned, and the number of problematic processes is not growing. Then open the logs tab and make sure there are no new critical entries since the last maintenance window."
    },
    {
      ru: "После неудачного старта идите сверху вниз: сначала проверьте, открылся ли frontend, затем backend HTTP, затем порт и процесс PostgreSQL. Если frontend жив, а backend нет, пользователь увидит ошибки API. Если backend жив, а PostgreSQL недоступен, backend начнёт писать database-ошибки. Такой порядок помогает не лечить следствие вместо причины.",
      en: "After a failed start, inspect the stack from top to bottom: first check whether the frontend opened, then the backend HTTP endpoint, then the PostgreSQL port and process. If the frontend is alive but the backend is not, the user sees API errors. If the backend is alive but PostgreSQL is not, the backend will start writing database errors. This order prevents you from fixing symptoms instead of causes."
    },
    {
      ru: "Перед эскалацией разработчикам соберите минимальный пакет фактов: точный URL, время проблемы, PID и порт проблемного процесса, путь к log-файлу, `raw_message`, соответствующий `summary`, а также screenshot страницы диагностики. Такой пакет позволяет разработчику воспроизвести контекст, не переспрашивая базовые детали.",
      en: "Before escalating to developers, collect the minimum fact package: the exact URL, the incident time, the PID and port of the problematic process, the log-file path, the `raw_message`, the related `summary`, and a screenshot of the diagnostics page. This package lets a developer reconstruct the context without asking for basic details again."
    }
  ],
  keywords: ["playbook", "daily check", "restart", "failed start", "escalation", "screenshot", "raw_message", "pid", "порт"]
};

const localSetupCode: CodeSample = {
  title: { ru: "Первичная подготовка локального окружения", en: "Initial Local Environment Setup" },
  language: "powershell",
  code: [
    "python -m venv .venv",
    ".\\.venv\\Scripts\\Activate.ps1",
    "pip install -r backend\\requirements.txt",
    "Copy-Item backend\\.env.example backend\\.env",
    "python backend\\scripts\\create_database.py",
    "cd backend",
    "..\\.venv\\Scripts\\python.exe -m alembic upgrade head",
    "cd ..",
    "python backend\\scripts\\seed.py"
  ].join("\n")
};

const localManualRunCode: CodeSample = {
  title: { ru: "Ручной запуск Windows/local через терминал", en: "Manual Windows/Local Startup from Terminal" },
  language: "powershell",
  code: [
    "pg_ctl -D .postgres\\data -l .postgres\\postgres.log start",
    "cd backend",
    "..\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000",
    "cd ..",
    "cd frontend",
    "npm.cmd install",
    "npm.cmd run dev -- --host 127.0.0.1 --port 5173"
  ].join("\n")
};

const localStopCode: CodeSample = {
  title: { ru: "Остановка Windows/local вручную и через скрипты", en: "Stopping Windows/Local Manually and via Scripts" },
  language: "powershell",
  code: [
    "pg_ctl -D .postgres\\data status",
    "pg_ctl -D .postgres\\data stop -m fast",
    ".\\start-local.ps1",
    ".\\stop-local.ps1",
    ".\\start-backend.ps1",
    ".\\start-frontend.ps1",
    ".\\setup-local-path.ps1"
  ].join("\n")
};

const operationsCode: CodeSample = {
  title: { ru: "Операционные команды для Docker/Nginx/Systemd", en: "Operational Commands for Docker/Nginx/Systemd" },
  language: "bash",
  code: [
    "docker compose ps",
    "docker compose logs backend --tail=200",
    "docker compose restart backend",
    "sudo systemctl status eqm-backend",
    "sudo journalctl -u eqm-backend -n 100 --no-pager",
    "sudo nginx -t",
    "curl -I http://127.0.0.1:8000",
    "sudo ss -ltnp | grep ':8000'"
  ].join("\n")
};

const errorCases: DiagnosticErrorCase[] = [
  {
    id: "port-in-use",
    title: { ru: "port_in_use", en: "port_in_use" },
    whereSeen: {
      ru: "Карточки логов backend/frontend/server; иногда одновременно видно `foreign_listener` на вкладке `Процессы и порты`.",
      en: "Backend/frontend/server log cards; sometimes you also see `foreign_listener` on the `Processes and ports` tab."
    },
    howToRecognize: {
      ru: "В тексте есть `address already in use`, `EADDRINUSE` или сообщение о том, что ожидаемый порт уже занят.",
      en: "The text contains `address already in use`, `EADDRINUSE`, or an explicit message that the expected port is already occupied."
    },
    likelyCauses: [
      { ru: "Остался старый dev-процесс после предыдущего запуска.", en: "A previous dev process was left behind from an earlier run." },
      { ru: "Порт заняло другое приложение, не относящееся к EQM.", en: "Another application unrelated to EQM owns the port." }
    ],
    resolutionSteps: [
      { ru: "Откройте вкладку портов или выполните `Get-NetTCPConnection -LocalPort <PORT>`.", en: "Open the ports tab or run `Get-NetTCPConnection -LocalPort <PORT>`." },
      { ru: "Определите PID и имя владельца процесса.", en: "Identify the PID and process name of the current owner." },
      { ru: "Остановите правильный процесс штатно или, если это хвост, завершите его вручную и повторите запуск сервиса.", en: "Stop the correct process normally, or if it is a leftover tail, terminate it manually and start the service again." }
    ],
    verification: {
      ru: "После исправления порт должен принадлежать ожидаемому сервису, а `foreign_listener` и `port_in_use` должны исчезнуть.",
      en: "After the fix, the port should belong to the expected service and both `foreign_listener` and `port_in_use` should disappear."
    },
    keywords: ["port_in_use", "foreign_listener", "EADDRINUSE", "address already in use", "порт занят"]
  },
  {
    id: "connection-refused",
    title: { ru: "connection_refused", en: "connection_refused" },
    whereSeen: {
      ru: "Карточки логов backend/server, runtime issue `Backend HTTP probe не проходит`.",
      en: "Backend/server log cards, runtime issue `Backend HTTP probe failed`."
    },
    howToRecognize: {
      ru: "Сообщение содержит `connection refused`, `could not connect`, `actively refused`.",
      en: "The message contains `connection refused`, `could not connect`, or `actively refused`."
    },
    likelyCauses: [
      { ru: "Целевой сервис ещё не запущен.", en: "The target service is not running yet." },
      { ru: "Сервис упал сразу после старта или слушает другой порт.", en: "The service crashed immediately after startup or listens on a different port." }
    ],
    resolutionSteps: [
      { ru: "Проверьте слушатель на ожидаемом порту.", en: "Verify that a listener exists on the expected port." },
      { ru: "Откройте соответствующие stdout/stderr или systemd/docker логи.", en: "Open the matching stdout/stderr or systemd/docker logs." },
      { ru: "Исправьте первичную ошибку старта и перезапустите сервис.", en: "Fix the primary startup error and restart the service." }
    ],
    verification: {
      ru: "HTTP probe должен стать `OK`, а карточка сервиса должна перейти в healthy или warning без отказа соединения.",
      en: "The HTTP probe should become `OK`, and the service card should move to healthy or warning without connection refusal."
    },
    keywords: ["connection_refused", "could not connect", "actively refused", "listener_missing", "http_probe_failed"]
  },
  {
    id: "foreign-listener",
    title: { ru: "foreign_listener", en: "foreign_listener" },
    whereSeen: {
      ru: "Карточка сервиса на вкладке `Обзор`, таблица портов и synthetic host-событие.",
      en: "A service card on the `Overview` tab, the ports table, and a synthetic host event."
    },
    howToRecognize: {
      ru: "Ожидаемый порт занят процессом, который диагностика не считает правильным владельцем сервиса.",
      en: "The expected port is occupied by a process that diagnostics does not consider the correct service owner."
    },
    likelyCauses: [
      { ru: "Порт остался у предыдущего экземпляра сервиса.", en: "The port is still owned by a previous instance of the service." },
      { ru: "Порт использует другое приложение или другой runtime.", en: "The port is used by another application or runtime." }
    ],
    resolutionSteps: [
      { ru: "Откройте вкладку портов и проверьте `PID`, `process`, `command` и `detected service`.", en: "Open the ports tab and inspect `PID`, `process`, `command`, and `detected service`." },
      { ru: "Если владелец порта не нужен, остановите его штатно или вручную.", en: "If the port owner is not needed, stop it normally or manually." },
      { ru: "После освобождения порта перезапустите нужный сервис только одним способом.", en: "After freeing the port, restart the required service using only one launch method." }
    ],
    verification: {
      ru: "Ожидаемый сервис должен стать владельцем своего порта, а `foreign_listener` должен исчезнуть.",
      en: "The expected service should own its port again and `foreign_listener` should disappear."
    },
    keywords: ["foreign_listener", "wrong port owner", "port owner", "чужой процесс"]
  },
  {
    id: "postgres-auth-failed",
    title: { ru: "postgres_auth_failed", en: "postgres_auth_failed" },
    whereSeen: { ru: "Логи backend или PostgreSQL.", en: "Backend or PostgreSQL logs." },
    howToRecognize: {
      ru: "Есть `password authentication failed` или другой текст о проваленной аутентификации в PostgreSQL.",
      en: "You see `password authentication failed` or another PostgreSQL authentication failure message."
    },
    likelyCauses: [
      { ru: "Неверные `DB_USER` или `DB_PASSWORD` в `backend/.env`.", en: "Incorrect `DB_USER` or `DB_PASSWORD` in `backend/.env`." },
      { ru: "Пароль пользователя БД изменился, а backend-конфиг нет.", en: "The database-user password changed, but the backend configuration did not." }
    ],
    resolutionSteps: [
      { ru: "Сверьте `backend/.env` и фактические учётные данные PostgreSQL.", en: "Compare `backend/.env` with the actual PostgreSQL credentials." },
      { ru: "Проверьте ручное подключение через `psql`.", en: "Test a manual connection with `psql`." },
      { ru: "После исправления конфигурации перезапустите backend.", en: "Restart the backend after fixing the configuration." }
    ],
    verification: {
      ru: "Backend должен перестать писать auth-ошибки и успешно открыть обзор БД.",
      en: "The backend should stop writing auth failures and should successfully load the database overview."
    },
    keywords: ["postgres_auth_failed", "password authentication failed", "db_user", "db_password", "psql"]
  },
  {
    id: "database-missing",
    title: { ru: "database_missing", en: "database_missing" },
    whereSeen: {
      ru: "Логи backend/PostgreSQL, иногда ошибка `Не удалось собрать обзор БД` на вкладке `Обзор`.",
      en: "Backend/PostgreSQL logs, sometimes the `Failed to collect database overview` issue on the `Overview` tab."
    },
    howToRecognize: {
      ru: "Текст содержит `database ... does not exist`.",
      en: "The text contains `database ... does not exist`."
    },
    likelyCauses: [
      { ru: "База ещё не создана.", en: "The database has not been created yet." },
      { ru: "В конфигурации backend указано неверное имя БД.", en: "The backend configuration points to the wrong database name." }
    ],
    resolutionSteps: [
      { ru: "Проверьте `DB_NAME` в `backend/.env`.", en: "Check `DB_NAME` in `backend/.env`." },
      { ru: "Создайте БД через `python backend\\scripts\\create_database.py` при локальном сценарии.", en: "Create the database with `python backend\\scripts\\create_database.py` in the local scenario." },
      { ru: "Примените миграции и повторно проверьте вкладку `Обзор`.", en: "Apply migrations and re-check the `Overview` tab." }
    ],
    verification: {
      ru: "Обзор БД должен появиться, а backend перестанет писать ошибку об отсутствующей базе.",
      en: "The database overview should appear and the backend should stop reporting a missing database."
    },
    keywords: ["database_missing", "does not exist", "create_database.py", "alembic", "db overview"]
  },
  {
    id: "traceback",
    title: { ru: "traceback / exception", en: "traceback / exception" },
    whereSeen: {
      ru: "Обычно в `backend`-логах, реже в `frontend` или synthetic `server`-событиях.",
      en: "Usually in `backend` logs, less often in `frontend` or synthetic `server` events."
    },
    howToRecognize: {
      ru: "Есть `Traceback`, `RuntimeError`, `ValueError`, `TypeError`, `Fatal` или похожее исключение.",
      en: "The log shows `Traceback`, `RuntimeError`, `ValueError`, `TypeError`, `Fatal`, or a similar exception."
    },
    likelyCauses: [
      { ru: "Ошибка кода или несовместимое состояние данных.", en: "A code error or incompatible data state." },
      { ru: "Незавершённая миграция, отсутствующий файл или неверная конфигурация.", en: "An incomplete migration, a missing file, or a wrong configuration." }
    ],
    resolutionSteps: [
      { ru: "Смотрите первую прикладную строку traceback, а не только последнюю.", en: "Read the first application-level line in the traceback, not just the last one." },
      { ru: "Сопоставьте время ошибки с последними действиями: запуском, миграцией, импортом, изменением `.env`.", en: "Match the error time to the latest action: startup, migration, import, or `.env` change." },
      { ru: "Если это не эксплуатационная, а кодовая проблема, соберите факты и эскалируйте разработчику.", en: "If the issue is code-related rather than operational, collect facts and escalate to a developer." }
    ],
    verification: {
      ru: "После исправления повторите исходное действие и убедитесь, что новая запись traceback не появляется.",
      en: "After the fix, repeat the original action and confirm that no new traceback entry appears."
    },
    keywords: ["traceback", "exception", "runtimeerror", "valueerror", "typeerror", "fatal"]
  },
  {
    id: "frontend-dependency-error",
    title: { ru: "frontend_dependency_error", en: "frontend_dependency_error" },
    whereSeen: { ru: "Логи frontend/Vite, иногда вкладка `Ошибки и логи` с источником `frontend`.", en: "Frontend/Vite logs, sometimes the `Errors and logs` tab with source `frontend`." },
    howToRecognize: {
      ru: "Есть `Cannot find module`, `Module not found`, `failed to resolve import`, `is not exported by`.",
      en: "The log shows `Cannot find module`, `Module not found`, `failed to resolve import`, or `is not exported by`."
    },
    likelyCauses: [
      { ru: "Не установлены зависимости frontend.", en: "Frontend dependencies are not installed." },
      { ru: "Импорт указывает на неверный путь или отсутствующий export.", en: "An import points to a wrong path or to a missing export." }
    ],
    resolutionSteps: [
      { ru: "Проверьте `frontend/package.json` и состояние `node_modules`.", en: "Check `frontend/package.json` and the `node_modules` state." },
      { ru: "Запустите `npm.cmd install` и при необходимости `npm run build`.", en: "Run `npm.cmd install` and, if needed, `npm run build`." },
      { ru: "Если проблема в import/export, исправление потребуется в коде frontend.", en: "If the issue is in import/export wiring, the fix is in the frontend code." }
    ],
    verification: {
      ru: "Frontend должен снова собраться и открыть страницу без dependency-ошибок.",
      en: "The frontend should build again and open without dependency errors."
    },
    keywords: ["frontend_dependency_error", "failed to resolve import", "module not found", "vite", "npm run build"]
  },
  {
    id: "listener-missing",
    title: { ru: "listener_missing", en: "listener_missing" },
    whereSeen: { ru: "Карточка сервиса на вкладке `Обзор`, synthetic server-событие, вкладка портов.", en: "Service card on the `Overview` tab, synthetic server event, ports tab." },
    howToRecognize: { ru: "Ожидаемый порт есть у сервиса в конфигурации, но слушатель на нём не найден.", en: "The service has an expected port in configuration, but no listener is found on that port." },
    likelyCauses: [
      { ru: "Сервис не стартовал.", en: "The service did not start." },
      { ru: "Сервис завершился сразу после старта.", en: "The service exited immediately after startup." }
    ],
    resolutionSteps: [
      { ru: "Откройте список процессов и убедитесь, что процесса сервиса нет или он быстро исчезает.", en: "Open the process list and verify that the service process is missing or exits quickly." },
      { ru: "Изучите stdout/stderr или systemd/docker лог конкретного сервиса.", en: "Inspect stdout/stderr or the systemd/docker log of the affected service." },
      { ru: "Исправьте причину старта и запустите сервис снова.", en: "Fix the startup cause and start the service again." }
    ],
    verification: {
      ru: "На вкладке портов должен появиться корректный слушатель, а карточка сервиса перестанет быть critical.",
      en: "The ports tab should show the correct listener, and the service card should no longer be critical."
    },
    keywords: ["listener_missing", "port", "listener", "service not started", "нет слушателя"]
  },
  {
    id: "http-probe-failed",
    title: { ru: "http_probe_failed / backend_http_fail", en: "http_probe_failed / backend_http_fail" },
    whereSeen: { ru: "Карточка frontend/backend на вкладке `Обзор`, synthetic host-событие, runtime issue про backend HTTP.", en: "Frontend/backend cards on the `Overview` tab, synthetic host events, runtime issue about backend HTTP." },
    howToRecognize: { ru: "Порт слушается, но `HTTP probe` показывает `FAIL`.", en: "The port is listening, but the `HTTP probe` shows `FAIL`." },
    likelyCauses: [
      { ru: "Сервис завис в полуинициализированном состоянии.", en: "The service is stuck in a partially initialized state." },
      { ru: "Слушатель отвечает не тем приложением или не тем маршрутом.", en: "The listener responds with the wrong application or route." }
    ],
    resolutionSteps: [
      { ru: "Проверьте `Invoke-WebRequest` или `curl` на нужный URL.", en: "Run `Invoke-WebRequest` or `curl` against the expected URL." },
      { ru: "Сравните ответ со стандартным `http://localhost:8000/docs` или `http://localhost:5173`.", en: "Compare the response with the expected `http://localhost:8000/docs` or `http://localhost:5173`." },
      { ru: "Если сервис жив, но отвечает неправильно, ищите первичную ошибку в логах или несоответствие окружения.", en: "If the service is alive but responds incorrectly, look for the primary error in logs or for an environment mismatch." }
    ],
    verification: { ru: "Probe должен стать `OK`, а warning/critical по HTTP исчезнуть.", en: "The probe should become `OK`, and the HTTP warning/critical state should disappear." },
    keywords: ["http_probe_failed", "backend_http_fail", "HTTP FAIL", "Invoke-WebRequest", "curl"]
  },
  {
    id: "stale-pid",
    title: { ru: "stale_pid", en: "stale_pid" },
    whereSeen: { ru: "Карточка сервиса, synthetic host-событие.", en: "Service card, synthetic host event." },
    howToRecognize: { ru: "PID владельца порта исчез во время сбора диагностики.", en: "The port-owner PID disappeared while diagnostics was collecting data." },
    likelyCauses: [
      { ru: "Процесс завершился в момент проверки.", en: "The process exited during the check." },
      { ru: "ОС уже освобождала сокет после падения сервиса.", en: "The OS was already releasing the socket after a crash." }
    ],
    resolutionSteps: [
      { ru: "Через несколько секунд нажмите `Обновить сейчас`.", en: "Press `Refresh now` again after a few seconds." },
      { ru: "Если проблема повторяется, ищите нестабильный процесс старта или падение сразу после запуска.", en: "If it repeats, look for an unstable startup or a crash immediately after launch." }
    ],
    verification: { ru: "Проблема должна исчезнуть после стабилизации процесса или окончательной остановки сервиса.", en: "The issue should disappear after the process stabilizes or the service stops completely." },
    keywords: ["stale_pid", "pid disappeared", "нестабильный запуск"]
  },
  {
    id: "process-without-parent",
    title: { ru: "process_without_parent", en: "process_without_parent" },
    whereSeen: { ru: "Подозрительный признак в таблице процессов, synthetic host-событие.", en: "Suspicious reason in the processes table, synthetic host event." },
    howToRecognize: { ru: "Процесс есть, но живой родитель не найден; для него может стать доступной кнопка `Kill process`.", en: "The process exists, but no live parent is found; the `Kill process` button may become available." },
    likelyCauses: [
      { ru: "После перезапуска остался дочерний процесс.", en: "A child process was left behind after a restart." },
      { ru: "Родительский shell или watcher упал раньше дочернего процесса.", en: "The parent shell or watcher died before the child process." }
    ],
    resolutionSteps: [
      { ru: "Проверьте, действительно ли процесс лишний и не владеет полезным рабочим портом.", en: "Confirm that the process is actually extra and does not own a useful production port." },
      { ru: "Если это хвост, завершите его кнопкой `Kill process` или вручную по PID.", en: "If it is a leftover tail, terminate it with `Kill process` or manually by PID." },
      { ru: "После очистки повторно запустите нужный сервис штатным способом.", en: "After cleanup, start the required service again through the normal procedure." }
    ],
    verification: { ru: "Подозрительный признак должен исчезнуть, а число проблемных процессов уменьшиться.", en: "The suspicious reason should disappear, and the problematic-process count should decrease." },
    keywords: ["process_without_parent", "orphan process", "kill process", "осиротевший процесс"]
  },
  {
    id: "duplicate-runtime",
    title: { ru: "duplicate_runtime", en: "duplicate_runtime" },
    whereSeen: { ru: "Вкладки `Обзор` и `Процессы и порты`, иногда synthetic log-событие.", en: "The `Overview` and `Processes and ports` tabs, sometimes a synthetic log event." },
    howToRecognize: { ru: "Для одного сервиса найдено больше одного корневого runtime-процесса.", en: "More than one root runtime process is found for the same service." },
    likelyCauses: [
      { ru: "Сервис запускали повторно без корректной остановки.", en: "The service was started again without a proper stop." },
      { ru: "Один из прошлых экземпляров завис и не освободил процесс/порт.", en: "One of the previous instances hung and did not release its process or port." }
    ],
    resolutionSteps: [
      { ru: "Сравните PID, порты и команды запуска корневых процессов.", en: "Compare the PIDs, ports, and launch commands of the root processes." },
      { ru: "Остановите лишний экземпляр штатно или вручную, если это явный хвост.", en: "Stop the extra instance normally or manually if it is clearly a tail." },
      { ru: "Запустите сервис заново одним способом: либо вручную, либо скриптом, либо через Docker/systemd.", en: "Start the service again in one way only: manually, through a script, or through Docker/systemd." }
    ],
    verification: { ru: "Должен остаться один корневой runtime на сервис, а warning по duplicate runtime исчезнет.", en: "Only one root runtime should remain per service, and the duplicate-runtime warning should disappear." },
    keywords: ["duplicate_runtime", "duplicate root runtime", "дубликат runtime", "multiple processes"]
  },
  {
    id: "listener-without-healthy-http",
    title: { ru: "listener_without_healthy_http", en: "listener_without_healthy_http" },
    whereSeen: { ru: "Подозрительный признак процесса и host-событие в логах.", en: "A process suspicious reason and a host log event." },
    howToRecognize: { ru: "Главный runtime слушает порт, но HTTP-здоровье сервиса остаётся плохим.", en: "The primary runtime listens on the port, but the service HTTP health still looks bad." },
    likelyCauses: [
      { ru: "Сервис завис до завершения инициализации.", en: "The service got stuck before completing initialization." },
      { ru: "Порт открыт, но приложение внутри отвечает ошибкой.", en: "The port is open, but the application behind it responds with an error." }
    ],
    resolutionSteps: [
      { ru: "Проверьте последние строки stderr/stdout этого процесса.", en: "Inspect the latest stderr/stdout lines of that process." },
      { ru: "Сопоставьте проблему с recent traceback, database-ошибкой или неверной конфигурацией API/БД.", en: "Match the issue against a recent traceback, a database error, or a wrong API/database configuration." }
    ],
    verification: { ru: "HTTP probe должен стать healthy, а подозрительный признак исчезнуть.", en: "The HTTP probe should become healthy and the suspicious reason should disappear." },
    keywords: ["listener_without_healthy_http", "http_probe_failed", "listening port without healthy HTTP"]
  },
  {
    id: "missing-log-file",
    title: { ru: "missing_log_file", en: "missing_log_file" },
    whereSeen: { ru: "Synthetic host-событие на вкладке логов.", en: "A synthetic host event on the logs tab." },
    howToRecognize: { ru: "Backend сообщает, что для `postgres`, `backend` или `frontend` не найден ни один кандидат лог-файла.", en: "The backend reports that no log-file candidate was found for `postgres`, `backend`, or `frontend`." },
    likelyCauses: [
      { ru: "Сервис ещё не запускался после очистки логов.", en: "The service has not run since logs were cleaned." },
      { ru: "Логи пишутся в другой путь.", en: "Logs are written to another path." }
    ],
    resolutionSteps: [
      { ru: "Проверьте папки `runtime-logs/*` и legacy-файлы в корне проекта.", en: "Check `runtime-logs/*` folders and legacy root log files." },
      { ru: "Убедитесь, что сервис действительно был запущен после последней очистки.", en: "Confirm that the service has actually run since the last cleanup." }
    ],
    verification: { ru: "После запуска сервиса лог-файл должен появиться, и synthetic warning исчезнет.", en: "After starting the service, the log file should appear and the synthetic warning should disappear." },
    keywords: ["missing_log_file", "runtime-logs", "backend.err.log", "frontend.err.log", "postgres log"]
  },
  {
    id: "log-file-unreadable",
    title: { ru: "log_file_unreadable", en: "log_file_unreadable" },
    whereSeen: { ru: "Карточка лога с категорией `filesystem`.", en: "A log card with the `filesystem` category." },
    howToRecognize: { ru: "Backend не смог прочитать log-файл и вместо обычной записи создал warning о недоступности чтения.", en: "The backend could not read the log file and created a warning entry about read access instead of a normal parsed line." },
    likelyCauses: [
      { ru: "Файл заблокирован другим процессом.", en: "The file is locked by another process." },
      { ru: "Недостаточно прав или файл повреждён.", en: "There are insufficient permissions or the file is corrupted." }
    ],
    resolutionSteps: [
      { ru: "Проверьте существование файла и права доступа.", en: "Check that the file exists and that permissions are valid." },
      { ru: "Если файл занят, дождитесь освобождения или остановите конфликтующий процесс.", en: "If the file is locked, wait for it to be released or stop the conflicting process." }
    ],
    verification: { ru: "После исправления backend должен снова читать лог и показывать обычные записи.", en: "After the fix, the backend should read the log again and show normal entries." },
    keywords: ["log_file_unreadable", "filesystem", "locked file", "permissions"]
  },
  {
    id: "frontend-backend-mismatch",
    title: { ru: "frontend/backend mismatch", en: "frontend/backend mismatch" },
    whereSeen: { ru: "Runtime topology на вкладке `Обзор`, флаг `Frontend указывает на другой backend`.", en: "Runtime topology on the `Overview` tab, flag `Frontend points to another backend`." },
    howToRecognize: { ru: "Поле `frontend_api_base` не совпадает с ожидаемым `backend_base_url + /api/v1`.", en: "The `frontend_api_base` field does not match the expected `backend_base_url + /api/v1`." },
    likelyCauses: [
      { ru: "Неправильный `VITE_API_URL`.", en: "An incorrect `VITE_API_URL`." },
      { ru: "Frontend собран или запущен против другого backend.", en: "The frontend was built or started against another backend." }
    ],
    resolutionSteps: [
      { ru: "Проверьте frontend API base и backend public URL.", en: "Check the frontend API base and the backend public URL." },
      { ru: "Исправьте переменные окружения и перезапустите frontend.", en: "Fix the environment variables and restart the frontend." }
    ],
    verification: { ru: "Флаг согласованности должен стать зелёным, а данные должны идти в правильный backend.", en: "The consistency flag should turn green, and data should flow to the correct backend." },
    keywords: ["frontend backend mismatch", "VITE_API_URL", "frontend_api_base", "backend_base_url"]
  },
  {
    id: "db-overview-collection-failed",
    title: { ru: "db overview collection failed", en: "db overview collection failed" },
    whereSeen: { ru: "Вкладка `Обзор`, блок `database_overview.issues`.", en: "The `Overview` tab, `database_overview.issues` block." },
    howToRecognize: { ru: "Появляется сообщение `Не удалось собрать обзор БД: ...`.", en: "You see `Failed to collect database overview: ...`." },
    likelyCauses: [
      { ru: "Backend не может подключиться к БД или выполнить служебные SQL-запросы.", en: "The backend cannot connect to the database or execute metadata SQL queries." },
      { ru: "У пользователя БД нет нужных прав или есть повреждение схемы.", en: "The database user lacks permissions or the schema is damaged." }
    ],
    resolutionSteps: [
      { ru: "Сначала проверьте сетевую доступность и аутентификацию БД.", en: "Check database reachability and authentication first." },
      { ru: "Потом проверьте, применены ли миграции и существует ли `public schema`.", en: "Then verify that migrations are applied and that the `public schema` exists." }
    ],
    verification: { ru: "Блок обзора БД должен снова показывать размер, таблицы и строки без warning о сборе обзора.", en: "The database overview block should display size, tables, and rows again without a collection warning." },
    keywords: ["db overview", "database overview", "Не удалось собрать обзор БД", "pg_database_size", "schema"]
  }
];

function buildSearchEntries(language: Language, sectionId: string, blocks: TextBlock[]) {
  const blockEntries: HelpSearchEntry[] = blocks.map((block) => ({
    id: `${sectionId}-${block.id}`,
    sectionId,
    anchorId: block.id,
    title: text(language, block.title),
    body: [text(language, block.summary), ...block.paragraphs.map((paragraph) => text(language, paragraph)), ...(block.bullets || []).map((bullet) => text(language, bullet))].join(" "),
    keywords: block.keywords
  }));

  const errorEntries: HelpSearchEntry[] = errorCases.map((item) => ({
    id: `${sectionId}-error-${item.id}`,
    sectionId,
    anchorId: `${sectionId}-error-${item.id}`,
    title: text(language, item.title),
    body: [
      text(language, item.whereSeen),
      text(language, item.howToRecognize),
      ...item.likelyCauses.map((cause) => text(language, cause)),
      ...item.resolutionSteps.map((step) => text(language, step)),
      text(language, item.verification)
    ].join(" "),
    keywords: item.keywords
  }));

  const operationsEntries: HelpSearchEntry[] = [
    {
      id: `${sectionId}-manual-run`,
      sectionId,
      anchorId: startStopBlock.id,
      title: language === "ru" ? "Ручной запуск Windows/local" : "Manual Windows/local startup",
      body: `${localSetupCode.code} ${localManualRunCode.code} ${localStopCode.code}`,
      keywords: ["pg_ctl", "uvicorn", "npm.cmd", "start-local.ps1", "stop-local.ps1", "create_database.py", "alembic upgrade head", "seed.py"]
    },
    {
      id: `${sectionId}-ops-docker-nginx`,
      sectionId,
      anchorId: startStopBlock.id,
      title: language === "ru" ? "Операционные команды Docker/Nginx/Systemd" : "Operational Docker/Nginx/Systemd commands",
      body: operationsCode.code,
      keywords: ["docker compose", "systemctl", "journalctl", "nginx -t", "curl", "ss"]
    }
  ];

  return [...blockEntries, ...operationsEntries, ...errorEntries];
}

export function getAdminDiagnosticsHelpSection(language: Language): DiagnosticsHelpBundle {
  const blocks = [introBlock, stackBlock, overviewBlock, processesBlock, logsBlock, startStopBlock, playbooksBlock];
  const anchors: HelpAnchor[] = blocks.map((block) => ({
    id: block.id,
    title: text(language, block.title)
  }));

  const content = (
    <Box id={adminDiagnosticsSectionAnchor} sx={{ display: "grid", gap: 3, scrollMarginTop: 96 }}>
      <Box sx={{ display: "grid", gap: 1 }}>
        <Typography variant="h6">
          {language === "ru" ? "Диагностика" : "Diagnostics"}
        </Typography>
        <Typography variant="body1">
          {language === "ru"
            ? "Ниже находится развёрнутая эксплуатационная инструкция по экрану `Admin -> Диагностика`. Она написана для администратора, который умеет работать с терминалом, но не обязан быть разработчиком frontend или backend."
            : "Below is a detailed operating guide for the `Admin -> Diagnostics` screen. It is written for an administrator who is comfortable with a terminal but does not need to be a frontend or backend developer."}
        </Typography>
      </Box>
      {renderRuntimeDiagram(language)}
      {renderTabMap(language)}
      {renderDecisionTree(language)}
      {blocks.map((block, index) => (
        <Box key={block.id} sx={{ display: "grid", gap: 2 }}>
          {renderTextBlock(language, block)}
          {block.id === startStopBlock.id ? (
            <Box sx={{ display: "grid", gap: 2 }}>
              {renderCodeSample(language, localSetupCode)}
              {renderCodeSample(language, localManualRunCode)}
              {renderCodeSample(language, localStopCode)}
              {renderCodeSample(language, operationsCode)}
              <Alert severity="warning">
                {language === "ru"
                  ? "Сначала останавливайте или перезапускайте сервис штатным способом. Принудительное завершение PID используйте только для orphan-процессов или явных хвостов."
                  : "Stop or restart services through their normal mechanism first. Use forced PID termination only for orphaned processes or obvious leftover tails."}
              </Alert>
            </Box>
          ) : null}
          {index < blocks.length - 1 ? <Divider /> : null}
        </Box>
      ))}
      <Box id="admin-diagnostics-errors" sx={{ display: "grid", gap: 2, scrollMarginTop: 96 }}>
        <Typography variant="h6">
          {language === "ru" ? "Каталог типовых ошибок и решения" : "Typical Error Catalog and Resolutions"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {language === "ru"
            ? "Ниже перечислены сигнатуры, которые диагностика умеет распознавать напрямую или выводит synthetic-правилами по состоянию процессов, портов и runtime-конфигурации."
            : "The items below list signatures that diagnostics either recognizes directly from logs or derives through synthetic rules based on processes, ports, and runtime configuration."}
        </Typography>
        <Box sx={{ display: "grid", gap: 1.5 }}>
          {errorCases.map((item) => (
            <Card key={item.id} id={`admin-diagnostics-error-${item.id}`} variant="outlined" sx={{ scrollMarginTop: 96 }}>
              <CardContent sx={{ display: "grid", gap: 1 }}>
                <Typography variant="subtitle1">{text(language, item.title)}</Typography>
                <Typography variant="body2">
                  <strong>{language === "ru" ? "Где видно:" : "Where seen:"}</strong> {text(language, item.whereSeen)}
                </Typography>
                <Typography variant="body2">
                  <strong>{language === "ru" ? "Как распознать:" : "How to recognize:"}</strong> {text(language, item.howToRecognize)}
                </Typography>
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {language === "ru" ? "Вероятные причины" : "Likely causes"}
                  </Typography>
                  <List dense disablePadding>
                    {item.likelyCauses.map((cause, index) => (
                      <ListItem key={`${item.id}-cause-${index}`} sx={{ display: "list-item", pl: 2.5 }}>
                        <ListItemText primaryTypographyProps={{ variant: "body2" }} primary={text(language, cause)} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {language === "ru" ? "Что делать" : "What to do"}
                  </Typography>
                  <List dense disablePadding>
                    {item.resolutionSteps.map((step, index) => (
                      <ListItem key={`${item.id}-step-${index}`} sx={{ display: "list-item", pl: 2.5 }}>
                        <ListItemText primaryTypographyProps={{ variant: "body2" }} primary={text(language, step)} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
                <Typography variant="body2">
                  <strong>{language === "ru" ? "Проверка после исправления:" : "Verification after fix:"}</strong> {text(language, item.verification)}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Box>
    </Box>
  );

  return {
    content,
    anchors,
    searchEntries: buildSearchEntries(language, "admin", blocks)
  };
}
