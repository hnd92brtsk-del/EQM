import type { HelpSection } from "./types";
import { buildDomainHelpSection, type HelpLanguage } from "./builders";

export function getCabinetsHelpSection(language: HelpLanguage, title: string): HelpSection {
  return buildDomainHelpSection(language, {
    id: "cabinets",
    title,
    introKeywords: ["шкафы", "сборки", "состав шкафа", "digital twin"],
    intro: [
      {
        ru: "Блок шкафов и сборок отвечает за контейнеры эксплуатации: сначала вы ведёте сами шкафы и сборки, а затем проваливаетесь в их состав и цифровой двойник. Это отдельный слой над складом: сюда попадает уже установленное оборудование.",
        en: "Cabinets and assemblies manage operational containers and their composition."
      },
      {
        ru: "Если нужно завести новый физический шкаф или сборку, начинайте со списков. Если нужно менять внутреннее размещение, питание, связи или размещённые элементы, открывайте состав.",
        en: "Create the cabinet or assembly in the list first, then use composition for internal layout work."
      }
    ],
    screens: [
      {
        id: "cabinets-list",
        title: { ru: "Список шкафов", en: "Cabinets list" },
        route: "/cabinets",
        summary: {
          ru: "Список шкафов ведёт карточки шкафов с фильтрами, сортировкой, мягким удалением и быстрым переходом в состав шкафа.",
          en: "The cabinets list manages cabinet records and links to composition."
        },
        areas: [
          {
            ru: "Сверху расположены сортировка, column-фильтры, показ удалённых и создание новых шкафов.",
            en: "The top area contains sorting, filters, show-deleted, and create actions."
          },
          {
            ru: "В таблице доступны просмотр состава, редактирование, удаление или восстановление.",
            en: "The table exposes composition, edit, delete, and restore actions."
          }
        ],
        actions: [
          {
            ru: "Используйте кнопку перехода в состав, если нужно работать уже с наполнением шкафа, а не с его паспортной карточкой.",
            en: "Open composition when you need the cabinet contents, not only the record."
          }
        ],
        risks: [
          {
            ru: "Удаление шкафа как записи не эквивалентно редактированию его состава. Не используйте delete вместо перехода к составу.",
            en: "Deleting a cabinet record is not the same as editing its composition."
          }
        ],
        related: [
          {
            ru: "Связанные экраны: шкафные позиции и состав шкафа.",
            en: "Related screens: cabinet items and cabinet composition."
          }
        ],
        keywords: ["шкафы", "список шкафов", "состав шкафа"]
      },
      {
        id: "assemblies-list",
        title: { ru: "Список сборок", en: "Assemblies list" },
        route: "/assemblies",
        summary: {
          ru: "Список сборок повторяет модель шкафов: отдельные записи, фильтры, мягкое удаление и переход в состав сборки.",
          en: "Assemblies follow the same record-and-composition model as cabinets."
        },
        actions: [
          {
            ru: "Открывайте состав сборки из строки таблицы, если нужно работать с внутренней структурой и наполнением.",
            en: "Open the assembly composition from the table row for internal structure work."
          }
        ],
        risks: [
          {
            ru: "Сборка и шкаф похожи по UX, но это разные контейнеры. Следите, чтобы перемещения и состав правились в правильной сущности.",
            en: "Assemblies and cabinets look similar but remain different entities."
          }
        ],
        related: [
          {
            ru: "Связанные экраны: движения, шкафные позиции, состав сборки.",
            en: "Related screens: movements, cabinet items, and assembly composition."
          }
        ],
        keywords: ["сборки", "список сборок", "assembly composition"]
      },
      {
        id: "cabinet-composition",
        title: { ru: "Состав шкафа или сборки / Digital Twin", en: "Composition / Digital Twin" },
        route: "/cabinets/:id/composition и /assemblies/:id/composition",
        summary: {
          ru: "Экран состава — это не просто список элементов, а цифровой двойник контейнера. Он позволяет работать с документом двойника, ручными и источниковыми элементами, размещением, питанием, I/O, сетью, serial-частью и IPAM-связями.",
          en: "The composition screen is a digital-twin editor, not only a simple list of items."
        },
        whenToUse: [
          {
            ru: "Когда нужно детально разложить элементы по стенкам и DIN-рейкам, проверить питание, каналы и сетевые связи контейнера.",
            en: "Use it for detailed placement, power, I/O, and network work inside a container."
          }
        ],
        areas: [
          {
            ru: "Экран работает с документом цифрового двойника, который можно создать, открыть, синхронизировать и сохранять.",
            en: "The screen works with a digital-twin document that can be created, opened, synced, and saved."
          },
          {
            ru: "Внутри доступны элементы из номенклатуры и ручные элементы, режимы размещения, граф питания и сводки по каналам, сети и serial-узлам.",
            en: "Inside it combines source-backed and manual items, placement modes, a power graph, and channel, network, and serial summaries."
          },
          {
            ru: "Для сетевых элементов экран интегрирован с IPAM и умеет показывать связанные адреса.",
            en: "Network-capable items integrate with IPAM and can show linked addresses."
          }
        ],
        actions: [
          {
            ru: "Начинайте с выбора или создания документа двойника, затем синхронизируйте его с операционным составом, если нужен базовый черновик.",
            en: "Start by choosing or creating the twin document, then sync from operational composition when needed."
          },
          {
            ru: "Добавляйте элементы из номенклатуры, если важно наследовать свойства типа; используйте ручные элементы только для того, чего ещё нет в справочниках.",
            en: "Use nomenclature-backed items for inherited properties and manual items only for missing cases."
          },
          {
            ru: "Проверяйте граф питания и сводки каналов после перестановок и изменений ролей питания.",
            en: "Review the power graph and channel summaries after placement or role changes."
          }
        ],
        risks: [
          {
            ru: "Состав чувствителен к структуре документа. Непродуманное удаление элемента может затронуть граф питания, сетевые связи и выбор на холсте.",
            en: "Removing an item can affect power, network, and canvas state."
          },
          {
            ru: "Не смешивайте ручные элементы и элементы из номенклатуры без причины: ручные записи не получают автоматическое обновление свойств от типа оборудования.",
            en: "Manual items do not automatically inherit later type updates."
          }
        ],
        related: [
          {
            ru: "Связанные экраны: шкафные позиции, IPAM, номенклатура, карта последовательных протоколов.",
            en: "Related screens: cabinet items, IPAM, nomenclature, and serial map."
          }
        ],
        keywords: ["digital twin", "состав шкафа", "din-рейка", "питание", "IPAM", "serial"]
      }
    ]
  });
}
