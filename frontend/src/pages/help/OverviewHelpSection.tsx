import type { HelpSection } from "./types";
import { buildDomainHelpSection, type HelpLanguage } from "./builders";

export function getOverviewHelpSection(language: HelpLanguage, title: string): HelpSection {
  return buildDomainHelpSection(language, {
    id: "overview",
    title,
    introKeywords: ["dashboard", "дашборд", "kpi", "сводка"],
    intro: [
      {
        ru: "Экран обзора нужен для быстрой оценки состояния хозяйства EQM без перехода в режим редактирования. Он собирает ключевые показатели, укрупнённые диаграммы и последние строки по активности.",
        en: "The overview gives a read-only snapshot of the EQM installation with KPIs, charts, and recent activity."
      },
      {
        ru: "Этот раздел удобно использовать как стартовую точку рабочего дня, но не как место для точечных исправлений: любые изменения выполняются уже в профильных разделах оборудования, персонала, инженерии или администрирования.",
        en: "Use it as the first screen for orientation, then move to the relevant functional area to make changes."
      }
    ],
    screens: [
      {
        id: "overview-dashboard",
        title: { ru: "Главный дашборд", en: "Main dashboard" },
        route: "/dashboard",
        summary: {
          ru: "Дашборд показывает агрегированные KPI по шкафам, ПЛК, каналам и стоимости складских запасов, а также несколько сводных диаграмм и две таблицы с последними записями по действиям и входам.",
          en: "The dashboard shows aggregated KPIs, summary charts, and two recent-activity tables."
        },
        whenToUse: [
          {
            ru: "Когда нужно быстро понять общий масштаб системы: сколько шкафов и ПЛК заведено, как выглядят канальные ёмкости и как меняется стоимость остатков.",
            en: "Use it to understand overall system size and the current high-level metrics."
          },
          {
            ru: "Когда нужно открыть последние действия пользователей или последние входы без перехода сразу в журналы администрирования.",
            en: "Use it to glance at the most recent actions and logins before drilling into admin logs."
          }
        ],
        areas: [
          {
            ru: "Верхняя часть экрана состоит из KPI-карточек. Они только читаются и не являются кнопками перехода.",
            en: "The top area contains read-only KPI cards."
          },
          {
            ru: "Средняя часть показывает графические сводки по оборудованию и связанным показателям. Они помогают заметить дисбалансы, но не заменяют детальные таблицы.",
            en: "The middle area shows charts for quick comparison, not record-level editing."
          },
          {
            ru: "Нижняя часть содержит две таблицы с поиском: по последним действиям и последним сессиям входа.",
            en: "The lower area contains two searchable recent-activity tables."
          }
        ],
        actions: [
          {
            ru: "Используйте поиск внутри таблиц внизу, если нужно быстро отфильтровать последние строки по пользователю, роли или сущности.",
            en: "Use the table search fields to narrow recent rows."
          },
          {
            ru: "Сверяйте показатели обзора с профильными разделами, если цифра кажется неожиданной: обзор показывает итог, а не причину.",
            en: "Cross-check suspicious numbers in the dedicated modules."
          }
        ],
        scenario: [
          {
            ru: "Откройте обзор утром, оцените KPI и аномалии на графиках, затем переходите в разделы оборудования, персонала или администрирования для разбора деталей.",
            en: "Open the dashboard first, inspect the KPIs, then jump to the detailed module."
          }
        ],
        risks: [
          {
            ru: "На дашборде нельзя редактировать записи напрямую. Если кажется, что что-то «не кликается», это нормальное поведение для read-only сводки.",
            en: "Records cannot be edited directly from the dashboard."
          },
          {
            ru: "Показатели зависят от данных в других разделах. Ошибка в справочнике или оборудовании будет видна здесь только как симптом.",
            en: "The dashboard reflects data from other modules and does not explain root cause by itself."
          }
        ],
        related: [
          {
            ru: "Для детальных действий переходите в «Оборудование», «Персонал», «Инженерия» или «Администрирование».",
            en: "Move to Equipment, Personnel, Engineering, or Administration for detailed work."
          }
        ],
        keywords: ["обзор", "дашборд", "kpi", "последние действия", "последние входы"]
      }
    ]
  });
}
