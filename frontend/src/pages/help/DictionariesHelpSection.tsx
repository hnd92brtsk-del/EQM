import { buildDomainHelpSection, type HelpLanguage } from "./builders";
import type { HelpSection } from "./types";

export function getDictionariesHelpSection(language: HelpLanguage, title: string): HelpSection {
  return buildDomainHelpSection(language, {
    id: "dictionaries",
    title,
    introKeywords: ["справочники", "дерево", "иерархия", "производители", "локации"],
    intro: [
      {
        ru: "Справочники в EQM делятся на два типа: плоские табличные записи и иерархические деревья. От их качества зависят формы в оборудовании, сигнализации, IPAM и персонале, поэтому правки здесь нужно делать особенно аккуратно.",
        en: "Dictionaries are either flat tables or hierarchical trees and they drive many other forms."
      },
      {
        ru: "Если экран показывает дерево, это обычно означает поддержку корневых и дочерних узлов. Если экран табличный, он чаще служит для карточек-списков с сортировкой, фильтрами и мягким удалением.",
        en: "Tree screens usually support root and child nodes, while table screens focus on list-style CRUD."
      }
    ],
    screens: [
      {
        id: "dictionary-manufacturers",
        title: { ru: "Производители", en: "Manufacturers" },
        route: "/dictionaries/manufacturers",
        summary: {
          ru: "Справочник производителей организован как дерево стран, брендов и связанных карточек производителя. Он нужен для выбора бренда в номенклатуре и других связанных формах.",
          en: "Manufacturers are organized as a tree of countries, brands, and manufacturer records."
        },
        actions: [
          {
            ru: "Используйте создание на нужном уровне дерева, если нужно добавить страну, бренд или конкретного производителя в правильный контекст.",
            en: "Create nodes at the correct tree level to preserve structure."
          }
        ],
        risks: [
          {
            ru: "Неправильная структура дерева усложняет выбор производителя в номенклатуре и отчётах.",
            en: "A bad tree structure complicates downstream selection and reporting."
          }
        ],
        keywords: ["производители", "бренд", "страна"]
      },
      {
        id: "dictionary-locations",
        title: { ru: "Локации", en: "Locations" },
        route: "/dictionaries/locations",
        summary: {
          ru: "Локации построены как иерархическое дерево и используются почти во всех эксплуатационных и инженерных модулях.",
          en: "Locations are a hierarchical tree reused throughout the system."
        },
        actions: [
          {
            ru: "Создавайте дочерние узлы через действие у родителя, если хотите сохранить правильный путь и иерархию.",
            en: "Create child nodes from the intended parent to preserve the path."
          }
        ],
        risks: [
          {
            ru: "Изменение структуры локаций влияет на фильтры и отображение путей в шкафах, оборудовании, IPAM и технологических процессах.",
            en: "Location structure changes ripple through many modules."
          }
        ],
        keywords: ["локации", "дерево локаций", "location path"]
      },
      {
        id: "dictionary-field-equipments",
        title: { ru: "Полевое оборудование", en: "Field equipment" },
        route: "/dictionaries/field-equipments",
        summary: {
          ru: "Полевое оборудование хранится деревом и используется в I/O-сигналах и связанных инженерных формах.",
          en: "Field equipment is a tree used by I/O and related engineering forms."
        },
        keywords: ["полевое оборудование", "field equipment"]
      },
      {
        id: "dictionary-main-equipment",
        title: { ru: "Основное оборудование", en: "Main equipment" },
        route: "/dictionaries/main-equipment",
        summary: {
          ru: "Основное оборудование — иерархическое дерево произвольной глубины. Уровень узла вычисляется автоматически от выбранного родителя.",
          en: "Main equipment is a hierarchy with automatically derived depth."
        },
        keywords: ["основное оборудование", "main equipment"]
      },
      {
        id: "dictionary-data-types",
        title: { ru: "Типы данных", en: "Data types" },
        route: "/dictionaries/data-types",
        summary: {
          ru: "Типы данных — дерево с поддержкой подсказки `tooltip`, которая отображается при наведении на имя узла в связанных местах интерфейса.",
          en: "Data types are a tree and can carry a tooltip used in related UI."
        },
        actions: [
          {
            ru: "Заполняйте tooltip там, где пользователям реально нужна подсказка по смыслу типа, а не просто дублирование названия.",
            en: "Use the tooltip for meaningful clarification, not mere label duplication."
          }
        ],
        keywords: ["типы данных", "tooltip", "data types"]
      },
      {
        id: "dictionary-measurement-units",
        title: { ru: "Единицы измерения", en: "Measurement units" },
        route: "/dictionaries/measurement-units",
        summary: {
          ru: "Единицы измерения ведутся как дерево и используются там, где сущности должны хранить нормализованную инженерную единицу.",
          en: "Measurement units are stored as a tree for normalized engineering units."
        },
        keywords: ["единицы измерения", "measurement units"]
      },
      {
        id: "dictionary-signal-types",
        title: { ru: "Типы сигналов", en: "Signal types" },
        route: "/dictionaries/signal-types",
        summary: {
          ru: "Типы сигналов представлены деревом и нужны для унифицированной классификации сигналов в инженерных сценариях.",
          en: "Signal types are a tree used for unified signal classification."
        },
        keywords: ["типы сигналов", "signal types"]
      },
      {
        id: "dictionary-warehouses",
        title: { ru: "Склады", en: "Warehouses" },
        route: "/warehouses",
        summary: {
          ru: "Склады — табличный справочник складских площадок с привязкой к локациям, фильтрами и мягким удалением.",
          en: "Warehouses are a table-driven dictionary linked to locations."
        },
        related: [
          {
            ru: "Связанные экраны: складские позиции и движения.",
            en: "Related screens: warehouse items and movements."
          }
        ],
        keywords: ["склады", "warehouses"]
      },
      {
        id: "dictionary-equipment-categories",
        title: { ru: "Категории оборудования", en: "Equipment categories" },
        route: "/dictionaries/equipment-categories",
        summary: {
          ru: "Категории оборудования живут в отдельном дереве и помогают фильтровать и классифицировать номенклатуру и остатки.",
          en: "Equipment categories form a dedicated tree for classification and filtering."
        },
        keywords: ["категории оборудования", "equipment categories"]
      }
    ]
  });
}
