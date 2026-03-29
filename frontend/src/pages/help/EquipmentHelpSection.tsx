import type { HelpSection } from "./types";
import { buildDomainHelpSection, type HelpLanguage } from "./builders";

export function getEquipmentHelpSection(language: HelpLanguage, title: string): HelpSection {
  return buildDomainHelpSection(language, {
    id: "equipment",
    title,
    introKeywords: ["оборудование", "склад", "номенклатура", "перемещение", "шкафные позиции"],
    intro: [
      {
        ru: "Раздел оборудования объединяет жизненный цикл позиции от номенклатуры до её местонахождения на складе, в шкафу или в технологической схеме. На практике пользователь чаще всего двигается между номенклатурой, складскими остатками, движениями и размещением в шкафах.",
        en: "Equipment covers the lifecycle from nomenclature to stock, movements, and placement in operation."
      },
      {
        ru: "Если нужно описать сам тип изделия, идите в номенклатуру. Если нужно видеть остатки и документы по ним, открывайте складские позиции. Если требуется зафиксировать перемещение, используйте журнал движений. Если оборудование уже установлено, работайте со шкафными позициями или технологическими схемами.",
        en: "Use nomenclature for the type, warehouse items for stock, movements for transfer history, and cabinet or technological screens for installed equipment."
      }
    ],
    screens: [
      {
        id: "equipment-nomenclature",
        title: { ru: "Номенклатура", en: "Nomenclature" },
        route: "/dictionaries/equipment-types",
        summary: {
          ru: "Номенклатура хранит описание типов оборудования: производителя, признаки каналообразования и сети, количество каналов, набор портов, фото и datasheet. Это главный источник свойств для складских и установленных экземпляров.",
          en: "Nomenclature stores equipment-type definitions, ports, channel traits, and media."
        },
        whenToUse: [
          {
            ru: "Когда нужно завести новый тип изделия или поправить его техническое описание.",
            en: "Use it to create or edit an equipment type."
          },
          {
            ru: "Когда складские или установленные экземпляры должны унаследовать исправленные свойства от типа.",
            en: "Use it when downstream instances must inherit updated type properties."
          }
        ],
        areas: [
          {
            ru: "В верхней панели находятся поиск, сортировка, фильтры по производителю и каналообразованию, а также переключатель показа удалённых.",
            en: "The top panel contains search, sorting, manufacturer and channel filters, and show-deleted."
          },
          {
            ru: "Таблица показывает тип, производителя, признаки каналов и сети, вложенные медиа и действия для записи.",
            en: "The table shows the type, manufacturer, channel and network traits, media, and write actions."
          }
        ],
        actions: [
          {
            ru: "Создавайте и редактируйте типы через расширенную форму, где задаются каналы, сетевые и последовательные порты, файлы и изображения.",
            en: "Create and edit types through the detailed form with channels, ports, files, and images."
          },
          {
            ru: "Используйте фото и datasheet как опорный контент для складских и шкафных экранов: они отображаются и там.",
            en: "Photos and datasheets are reused by stock and cabinet screens."
          }
        ],
        risks: [
          {
            ru: "Изменение номенклатуры влияет на множество связанных экранов. Перед правкой сетевых портов, количества каналов и признаков сети проверьте, кто уже использует этот тип.",
            en: "Changing a type affects many downstream screens and instances."
          }
        ],
        related: [
          {
            ru: "Связанные экраны: складские позиции, шкафные позиции, технологическое оборудование.",
            en: "Related screens: warehouse items, cabinet items, technological equipment."
          }
        ],
        keywords: ["номенклатура", "equipment type", "datasheet", "порты", "каналы"]
      },
      {
        id: "equipment-warehouse-items",
        title: { ru: "Складские позиции", en: "Warehouse items" },
        route: "/warehouse-items",
        summary: {
          ru: "Складские позиции показывают фактические остатки оборудования на складах с количеством, учётом, фото, datasheet и фильтрами по складу, локации, производителю, категории и цене.",
          en: "Warehouse items track stock balances by warehouse with rich filters and attachments."
        },
        whenToUse: [
          {
            ru: "Когда нужно понять, где лежит оборудование, сколько его доступно и какие позиции готовы к перемещению или установке.",
            en: "Use it to locate stock and decide what can be moved or installed."
          }
        ],
        areas: [
          {
            ru: "Сверху находятся фильтры по складу, локации, типу, производителю, категории и диапазону цены, плюс сортировка и показ удалённых.",
            en: "The filter area covers warehouse, location, type, manufacturer, category, price, sorting, and deleted state."
          },
          {
            ru: "Таблица содержит сами остатки. Из строки можно открыть вложенные файлы и медиа, а из командной зоны запустить приход или перемещение.",
            en: "The table displays stock lines and exposes media plus movement actions."
          }
        ],
        actions: [
          {
            ru: "Используйте экран как точку старта для приходов и перемещений: отсюда открываются связанные сценарии пополнения и отправки в шкаф или сборку.",
            en: "Use this screen as the launch point for inbound and transfer flows."
          },
          {
            ru: "Создавайте и редактируйте остатки только если уверены, что меняете именно складскую запись, а не тип номенклатуры.",
            en: "Edit the stock row only when the stock record itself must change."
          }
        ],
        risks: [
          {
            ru: "На экране сочетаются тип изделия и складской экземпляр. Не путайте изменение количества на складе с изменением свойств номенклатуры.",
            en: "Do not confuse stock-quantity changes with nomenclature changes."
          },
          {
            ru: "Некоторые движения ещё не реализованы как универсальная кнопка на каждой строке; если видите ограничение или сообщение `Not implemented`, используйте доступный сценарий через существующие формы.",
            en: "Some movement flows are still constrained and may show not-implemented behavior."
          }
        ],
        related: [
          {
            ru: "Связанные экраны: журнал движений, номенклатура, шкафные позиции.",
            en: "Related screens: movements, nomenclature, cabinet items."
          }
        ],
        keywords: ["складские позиции", "остатки", "приход", "перемещение", "склад"]
      },
      {
        id: "equipment-movements",
        title: { ru: "Журнал движений", en: "Movements" },
        route: "/movements",
        summary: {
          ru: "Журнал движений фиксирует операции прихода и перемещения между складом, шкафом и сборкой. Верхняя форма создаёт новое движение, а нижняя таблица показывает уже проведённые операции с фильтрацией.",
          en: "Movements records inbound and transfer operations between warehouses, cabinets, and assemblies."
        },
        whenToUse: [
          {
            ru: "Когда нужно оформить перемещение, которое должно изменить остатки и зафиксироваться в истории.",
            en: "Use it when the move must change balances and be recorded historically."
          }
        ],
        areas: [
          {
            ru: "В верхней части выбираются тип движения, номенклатура, количество, склад-источник, шкаф или сборка назначения, а также reference и комментарий.",
            en: "The top form selects movement type, nomenclature, quantity, source warehouse, target cabinet or assembly, and reference fields."
          },
          {
            ru: "Нижняя таблица нужна для аудита и поиска уже проведённых движений.",
            en: "The lower table is for audit and lookup of completed moves."
          }
        ],
        actions: [
          {
            ru: "Подбирайте тип движения первым: набор обязательных полей в форме меняется в зависимости от выбранного сценария.",
            en: "Choose movement type first because the required fields change with the scenario."
          },
          {
            ru: "Заполняйте reference и комментарий, если нужна трассируемость происхождения или причины движения.",
            en: "Fill reference and comment fields for better traceability."
          }
        ],
        risks: [
          {
            ru: "Движение меняет фактическое расположение остатков. Перед сохранением проверьте источник, назначение и количество, особенно при переводе в шкаф или сборку.",
            en: "A movement changes real stock location, so verify source, target, and quantity."
          }
        ],
        related: [
          {
            ru: "Связанные экраны: складские позиции, шкафные позиции, шкафы и сборки.",
            en: "Related screens: warehouse items, cabinet items, cabinets and assemblies."
          }
        ],
        keywords: ["движения", "перемещение", "приход", "шкаф", "сборка"]
      },
      {
        id: "equipment-cabinet-items",
        title: { ru: "Шкафные позиции", en: "Cabinet items" },
        route: "/cabinet-items",
        summary: {
          ru: "Шкафные позиции показывают оборудование, уже размещённое в шкафах и сборках, вместе с группировкой по локациям и контейнерам, IPAM-сводкой, фото, datasheet и быстрыми действиями по составу.",
          en: "Cabinet items show installed equipment in cabinets and assemblies with grouping and IPAM summaries."
        },
        whenToUse: [
          {
            ru: "Когда нужно увидеть, что уже установлено на объекте, а не просто лежит на складе.",
            en: "Use it to inspect equipment already installed in operation."
          }
        ],
        areas: [
          {
            ru: "Экран собирает данные по локациям, контейнерам и группам оборудования, а не только по отдельным строкам. Поэтому им удобно пользоваться как обзором размещения.",
            en: "The screen is grouped by locations, containers, and equipment groups."
          },
          {
            ru: "Из карточек и строк доступны сведения по портам, каналам, IPAM и переходы к более глубоким сценариям состава.",
            en: "Rows expose ports, channels, IPAM, and deeper composition actions."
          }
        ],
        actions: [
          {
            ru: "Используйте этот экран для контроля установленного оборудования и переходов к составу шкафа или сборки, если нужно детально менять размещение.",
            en: "Use it to review installed equipment and jump to composition views."
          },
          {
            ru: "Проверяйте IPAM-сводку для сетевых устройств, чтобы понять, есть ли привязанные адреса и подсети.",
            en: "Check the IPAM summary for network-capable equipment."
          }
        ],
        risks: [
          {
            ru: "Количество некоторых позиций может быть заблокировано логикой группировки или способа установки. Если поле количества не редактируется, это обычно намеренное ограничение.",
            en: "Some quantities are intentionally locked by grouping or placement logic."
          },
          {
            ru: "Часть действий экрана всё ещё ограничена текущей реализацией и может выводить `Not implemented` вместо полной операции.",
            en: "Some actions still have implementation limits and may show not-implemented behavior."
          }
        ],
        related: [
          {
            ru: "Связанные экраны: шкафы, сборки, состав шкафа/сборки, IPAM.",
            en: "Related screens: cabinets, assemblies, composition, and IPAM."
          }
        ],
        keywords: ["шкафные позиции", "установленное оборудование", "IPAM summary", "состав шкафа"]
      },
      {
        id: "equipment-technological",
        title: { ru: "Технологическое оборудование / PID", en: "Technological equipment / PID" },
        route: "/equipment/technological",
        summary: {
          ru: "Экран технологического оборудования работает как редактор PID-процессов: слева выбираются процессы по локации, в центре открыт холст PID, а справа живёт инспектор свойств выбранных узлов и связей.",
          en: "The technological equipment screen is a PID process editor with a sidebar, canvas, and inspector."
        },
        whenToUse: [
          {
            ru: "Когда нужно рисовать или редактировать технологическую схему процесса, а не только вести табличный учёт оборудования.",
            en: "Use it when you need to draw or edit a PID process diagram."
          }
        ],
        areas: [
          {
            ru: "Левая панель управляет процессами: выбор локации, список процессов, создание, открытие, редактирование метаданных, удаление и импорт.",
            en: "The left panel manages process documents and location context."
          },
          {
            ru: "Верхняя панель холста содержит режимы инструмента, команды копирования/вставки, подгонки схемы, полноэкранный режим и поиск узлов.",
            en: "The top canvas bar contains tool modes, clipboard actions, fit/fullscreen controls, and search."
          },
          {
            ru: "Правая панель показывает свойства и позволяет редактировать выбранный узел или связь.",
            en: "The right panel edits properties of the selected node or edge."
          }
        ],
        actions: [
          {
            ru: "Создавайте новый PID-процесс только после выбора локации: экран жёстко привязан к контексту местоположения.",
            en: "Create a process only after selecting a location."
          },
          {
            ru: "Открывайте документ на холсте отдельно от простого выбора в списке: это позволяет сначала просмотреть метаданные и статистику.",
            en: "Opening a process on the canvas is separate from merely selecting it in the list."
          },
          {
            ru: "Используйте поиск по узлам, copy/paste/duplicate и переключение режима инструмента для ускорения редактирования больших схем.",
            en: "Use node search, copy/paste/duplicate, and tool modes to edit larger diagrams faster."
          }
        ],
        risks: [
          {
            ru: "Это не табличный CRUD, а редактор схем. Удаление и правка на холсте влияют на структуру PID-процесса целиком.",
            en: "This is a diagram editor, so deletes and edits affect the process structure directly."
          }
        ],
        related: [
          {
            ru: "Связанные экраны: DCL, шкафные позиции, инженерные карты.",
            en: "Related screens: DCL, cabinet items, and engineering map editors."
          }
        ],
        keywords: ["технологическое оборудование", "pid", "процесс", "схема", "холст"]
      }
    ]
  });
}
