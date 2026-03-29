import type { HelpSection } from "./types";
import { buildDomainHelpSection, type HelpLanguage } from "./builders";

export function getPersonnelHelpSection(language: HelpLanguage, title: string): HelpSection {
  return buildDomainHelpSection(language, {
    id: "personnel",
    title,
    introKeywords: ["персонал", "сотрудники", "график", "карточка сотрудника"],
    intro: [
      {
        ru: "Раздел персонала покрывает три связанные задачи: ведение списка сотрудников, работу с личной карточкой и планирование годового графика. Эти экраны часто используются вместе, потому что карточка хранит привязку к пользователю и шаблону графика, а планировщик уже работает по сотрудникам.",
        en: "Personnel combines the employee list, the employee card, and the yearly planner."
      },
      {
        ru: "Если нужно быстро найти человека, начать лучше со списка. Если нужно поправить профиль, обучение, фото или заметки, переходите в карточку. Если нужно менять статусы дней по календарю, открывайте годовой планировщик.",
        en: "Start with the list to find a person, use the card for profile data, and use the planner for day statuses."
      }
    ],
    screens: [
      {
        id: "personnel-list",
        title: { ru: "Список сотрудников", en: "Personnel list" },
        route: "/personnel",
        summary: {
          ru: "Список сотрудников показывает кадровые записи с поиском, сортировкой, фильтрами по подразделению и службе, а также действиями создания, редактирования, удаления и восстановления, если роль позволяет запись.",
          en: "The personnel list provides search, sorting, filters, and CRUD actions for employee records."
        },
        whenToUse: [
          {
            ru: "Когда нужно найти сотрудника по ФИО, подразделению, службе, табельному номеру или привязанному пользователю.",
            en: "Use it to find an employee by name, department, service, number, or linked user."
          },
          {
            ru: "Когда нужно завести нового сотрудника или открыть карточку уже существующего.",
            en: "Use it to create a new employee or open an existing card."
          }
        ],
        areas: [
          {
            ru: "Сверху находится панель фильтров: строка поиска, сортировка, отдельные фильтры и переключатель показа удалённых записей.",
            en: "The top area contains search, sorting, filters, and the show-deleted switch."
          },
          {
            ru: "Основная таблица показывает ФИО, роль, должность, табельный номер, логин пользователя, организацию и статус записи.",
            en: "The main table shows identity, role, position, linked login, and status."
          }
        ],
        actions: [
          {
            ru: "Нажмите на ФИО в строке, чтобы открыть карточку сотрудника.",
            en: "Click the full name to open the employee card."
          },
          {
            ru: "Создание и редактирование выполняются через диалог формы. В него входят базовые поля, привязка к шаблону графика и связка с учётной записью пользователя.",
            en: "Create and edit actions open a dialog with profile, schedule template, and user-link fields."
          },
          {
            ru: "Удаление мягкое: запись можно вернуть через действие «Восстановить», если включён показ удалённых.",
            en: "Deletion is soft and can be reversed through restore."
          }
        ],
        scenario: [
          {
            ru: "Найдите сотрудника поиском, откройте карточку по клику на ФИО, затем уже меняйте профиль или связанные данные на детальном экране.",
            en: "Search for the employee, open the card from the table, then edit the detailed profile."
          }
        ],
        risks: [
          {
            ru: "Удаление из списка не означает физическое исчезновение истории. Это мягкое удаление, и запись может продолжать встречаться в связанной аналитике, пока не будет восстановлена или исключена фильтрами.",
            en: "List deletion is a soft delete and the record may still appear in historical contexts."
          }
        ],
        related: [
          {
            ru: "Связанные экраны: карточка сотрудника `/personnel/:id`, годовой планировщик `/personnel/schedule`, администрирование пользователей `/admin/users`.",
            en: "Related screens: employee card, yearly planner, admin users."
          }
        ],
        keywords: ["список сотрудников", "удалить сотрудника", "восстановить сотрудника", "табельный номер"]
      },
      {
        id: "personnel-details",
        title: { ru: "Карточка сотрудника", en: "Personnel details" },
        route: "/personnel/:id",
        summary: {
          ru: "Карточка сотрудника делит данные на вкладки «Профиль», «Компетенции», «Обучение» и «Заметки». Здесь хранятся фото, персональные поля, учебные записи, вложения и внутренние заметки.",
          en: "The employee card is split into profile, competencies, training, and notes tabs."
        },
        whenToUse: [
          {
            ru: "Когда нужно редактировать полный профиль человека, а не только строку в списке.",
            en: "Use it for detailed profile management."
          },
          {
            ru: "Когда нужно загрузить фото, добавить обучение, срок следующей проверки или приложить файл.",
            en: "Use it to upload a photo, add training, due dates, or attachments."
          }
        ],
        areas: [
          {
            ru: "Вкладка «Профиль» содержит личные поля, даты, логин, шаблон графика и фото.",
            en: "The Profile tab contains personal fields, dates, linked login, schedule template, and photo."
          },
          {
            ru: "Вкладка «Компетенции» ведёт отдельную таблицу с диалогом создания и загрузкой вложений.",
            en: "The Competencies tab has a dedicated table and dialog with attachments."
          },
          {
            ru: "Вкладка «Обучение» хранит завершённые обучения, дату следующего допуска и смещение для напоминаний.",
            en: "The Training tab stores completed trainings, next due dates, and reminder offsets."
          },
          {
            ru: "Вкладка «Заметки» нужна для свободного внутреннего текста по сотруднику.",
            en: "The Notes tab stores free-form internal notes."
          }
        ],
        actions: [
          {
            ru: "Редактируйте профиль прямо на экране и сохраняйте изменения отдельной кнопкой.",
            en: "Edit the profile on the screen and save explicitly."
          },
          {
            ru: "Добавляйте компетенции и обучения через диалоги. Для каждой записи можно загружать и просматривать вложения.",
            en: "Add competencies and training items through dialogs, including attachments."
          },
          {
            ru: "Используйте связку с логином и шаблоном графика, если сотрудник должен работать в системе и участвовать в планировщике.",
            en: "Link the employee to a login and schedule template when needed."
          }
        ],
        scenario: [
          {
            ru: "Откройте карточку из списка, обновите профиль, затем перейдите на вкладки компетенций и обучения, если нужно дооформить квалификацию и напоминания.",
            en: "Open the card from the list, update the profile, then complete competencies and training."
          }
        ],
        risks: [
          {
            ru: "Карточка хранит больше данных, чем список. Здесь проще случайно забыть сохранить изменения после редактирования полей или заметок.",
            en: "The card contains more editable fields, so explicit saving matters."
          },
          {
            ru: "Привязка к логину и шаблону графика влияет на смежные процессы. Меняйте эти поля осознанно, особенно для уже работающих сотрудников.",
            en: "Changing the login or schedule template affects related workflows."
          }
        ],
        related: [
          {
            ru: "Связанные экраны: список сотрудников, годовой планировщик, администрирование пользователей.",
            en: "Related screens: personnel list, yearly planner, admin users."
          }
        ],
        keywords: ["карточка сотрудника", "обучение", "компетенции", "фото сотрудника", "заметки"]
      },
      {
        id: "personnel-schedule",
        title: { ru: "Годовой планировщик", en: "Yearly planner" },
        route: "/personnel/schedule",
        summary: {
          ru: "Планировщик показывает календарную матрицу по сотрудникам и дням года, умеет массово проставлять статусы, добавлять события поверх ячеек и считает агрегаты в правой панели.",
          en: "The yearly planner shows a day matrix, bulk status fill, event overlays, and summary panels."
        },
        whenToUse: [
          {
            ru: "Когда нужно распределять статусы рабочих дней, отпусков, отсутствий и других обозначений по году или месяцу.",
            en: "Use it to assign day statuses across a month or a whole year."
          },
          {
            ru: "Когда нужно быстро увидеть картину по конкретному сотруднику или по всему коллективу.",
            en: "Use it to inspect one employee or overall staffing patterns."
          }
        ],
        areas: [
          {
            ru: "Сверху управляются год, выбранный месяц, режим показа месяца или всего года и активный статус для простановки.",
            en: "The top controls manage year, month, view mode, and the active status."
          },
          {
            ru: "Центральная сетка состоит из сотрудников по строкам и календарных дней по столбцам.",
            en: "The center grid shows employees by rows and days by columns."
          },
          {
            ru: "Справа находится аналитическая панель по выбранному сотруднику, месяцу, году и событиям.",
            en: "The right sidebar shows analytics for the selected employee and period."
          }
        ],
        actions: [
          {
            ru: "Клик по ячейке ставит активный статус и может сразу заполнить несколько дней подряд по параметру `fillDays`.",
            en: "Clicking a cell applies the active status and can fill several days at once."
          },
          {
            ru: "Команда заполнения месяца переносит выбранный статус на весь текущий месяц для выбранного сотрудника.",
            en: "Month fill applies the active status to the entire selected month."
          },
          {
            ru: "События добавляются и удаляются отдельно от статусов и отображаются поверх календаря.",
            en: "Events are managed separately from statuses and appear as overlays."
          }
        ],
        scenario: [
          {
            ru: "Выберите год, сотрудника и статус, проставьте диапазон кликом по сетке, затем проверьте агрегаты и события в правой панели.",
            en: "Select year, employee, and status, fill the range, then verify the sidebar aggregates."
          }
        ],
        risks: [
          {
            ru: "Экран чувствителен к правам записи: без write-доступа он остаётся полезным для просмотра, но не позволит менять статусы и события.",
            en: "Without write permission the screen becomes read-only."
          },
          {
            ru: "Массовое заполнение месяца и диапазона меняет много дат сразу. Перед применением проверьте выбранный месяц, сотрудника и активный статус.",
            en: "Bulk fill changes many dates at once, so verify month, employee, and active status first."
          }
        ],
        related: [
          {
            ru: "Связанные экраны: список сотрудников и карточка сотрудника, где настраивается шаблон графика.",
            en: "Related screens: personnel list and employee card."
          }
        ],
        keywords: ["годовой планировщик", "календарь", "статусы дней", "события", "fill month"]
      }
    ]
  });
}
