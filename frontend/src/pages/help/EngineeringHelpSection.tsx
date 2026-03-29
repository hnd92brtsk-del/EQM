import { Box, Typography } from "@mui/material";

import { buildDomainHelpSection, type HelpLanguage } from "./builders";
import type { HelpSection } from "./types";

export function getEngineeringHelpSection(language: HelpLanguage, title: string): HelpSection {
  return buildDomainHelpSection(language, {
    id: "engineering",
    title,
    introKeywords: ["инженерия", "io signals", "ipam", "dcl", "serial map", "network map"],
    intro: [
      {
        ru: "Инженерный блок EQM объединяет табличные и графические инструменты: сигналы, IP-адресное пространство, DCL и редакторы карт. Здесь особенно важно различать справочник, документ схемы и живую эксплуатационную модель.",
        en: "Engineering combines table-driven screens and graphical editors."
      },
      {
        ru: "Если задача начинается с адресов и подсетей, открывайте IPAM. Если требуется работа с сигналами, идите в I/O. Для последовательных и сетевых топологий используются отдельные документные редакторы. DCL пока остаётся ограниченным экраном текущей реализации.",
        en: "Use IPAM for addressing, I/O for signals, map editors for topologies, and note that DCL is still limited."
      }
    ],
    screens: [
      {
        id: "engineering-io-signals",
        title: { ru: "I/O сигналы", en: "I/O signals" },
        route: "/io-signals",
        summary: {
          ru: "Экран I/O-сигналов показывает инженерные сигналы в табличной форме и поддерживает live-фильтрацию, редактирование, удаление и восстановление записей, если роль имеет право на запись.",
          en: "I/O signals provide a filterable table with edit, delete, and restore actions."
        },
        areas: [
          {
            ru: "Сверху размещены live-фильтры и панель действий, снизу — широкая таблица сигналов.",
            en: "The top contains live filters and actions, and the lower area shows a wide signal table."
          },
          {
            ru: "При редактировании используются связанные справочники: типы данных, полевое оборудование и точки подключения.",
            en: "Editing relies on related dictionaries such as data types and field equipment."
          }
        ],
        actions: [
          {
            ru: "Используйте live-поиск, когда нужно быстро отобрать сигналы по тегу, имени, оборудованию или связанной классификации.",
            en: "Use live search to narrow signals by tag, name, equipment, or related classification."
          },
          {
            ru: "Корректируйте тип данных и привязку к оборудованию внимательно: эти поля участвуют в смежных инженерных сценариях.",
            en: "Update data type and equipment links carefully because they affect related flows."
          }
        ],
        risks: [
          {
            ru: "Сигнал может зависеть от актуальности справочников. Если нужный тип данных или оборудование не находится, сначала проверьте словари.",
            en: "Signal editing depends on up-to-date dictionary entries."
          }
        ],
        related: [
          {
            ru: "Связанные экраны: типы данных, полевое оборудование, технологическое оборудование.",
            en: "Related screens: data types, field equipment, and technological equipment."
          }
        ],
        keywords: ["io", "сигналы", "live filter", "тип данных", "точка подключения"]
      },
      {
        id: "engineering-ipam",
        title: { ru: "IPAM / Сеть", en: "IPAM / Network" },
        route: "/ipam",
        summary: {
          ru: "IPAM управляет VLAN, подсетями и адресами. Слева переключаются вкладки `Подсети` и `VLAN`, в центре открыт список и сетка адресов, справа — карточка выбранного IP с редактированием статуса, хоста, MAC, комментария и привязки к оборудованию.",
          en: "IPAM manages VLANs, subnets, and addresses with subnet and VLAN sidebars plus address editing."
        },
        whenToUse: [
          {
            ru: "Когда нужно выделить адрес устройству, спланировать подсеть или быстро понять занятость адресного пространства.",
            en: "Use it to assign addresses, plan subnets, and inspect address usage."
          }
        ],
        areas: [
          {
            ru: "Верхняя строка содержит экспорт CSV по активной подсети и быстрый доступ к созданию через IP-калькулятор.",
            en: "The top area includes CSV export for the active subnet and creation via the IP calculator."
          },
          {
            ru: "Левая колонка переключает списки подсетей и VLAN, поиск и создание новых сущностей.",
            en: "The left column switches between subnets and VLANs, search, and create actions."
          },
          {
            ru: "Центральная часть показывает сетку адресов и список с фильтрами по статусу `all/free/used/reserved`.",
            en: "The center shows the address grid and a filtered address list."
          },
          {
            ru: "Правая карточка редактирует выбранный IP-адрес и умеет связывать его с оборудованием и конкретным интерфейсом.",
            en: "The right card edits the selected address and links it to equipment and interfaces."
          }
        ],
        actions: [
          {
            ru: "Используйте IP-калькулятор, если подсеть ещё не заведена: сначала вычислите параметры, затем создайте подсеть в системе.",
            en: "Use the IP calculator to compute and then create a new subnet."
          },
          {
            ru: "Редактируйте VLAN и подсети через отдельные диалоги. Для удаления используется подтверждение, поэтому всегда проверяйте, что выбрана нужная сущность.",
            en: "Edit VLANs and subnets in dedicated dialogs and verify the selected entity before deletion."
          },
          {
            ru: "Для адреса `free` сохраняется освобождение, а для `used` или `reserved` — атрибуты хоста и привязка к оборудованию. Это разные сценарии записи.",
            en: "Saving a free address releases it, while used or reserved addresses store host attributes and equipment links."
          }
        ],
        risks: [
          {
            ru: "Удаление VLAN или подсети — чувствительное действие. Перед подтверждением убедитесь, что зависимые адреса и оборудование уже обработаны.",
            en: "Deleting a VLAN or subnet is sensitive and should be checked against dependent addresses and equipment."
          },
          {
            ru: "Статусы `network`, `broadcast`, `gateway` и service-адреса ведут себя не так, как обычные адреса хостов. Не пытайтесь редактировать их по шаблону пользовательского IP.",
            en: "Network, broadcast, gateway, and service addresses do not behave like regular host IPs."
          }
        ],
        related: [
          {
            ru: "Связанные экраны: шкафные позиции, Digital Twin, карта сети.",
            en: "Related screens: cabinet items, Digital Twin, and network map."
          }
        ],
        keywords: ["ipam", "подсети", "vlan", "ip-калькулятор", "csv", "assign address", "release address"]
      },
      {
        id: "engineering-dcl",
        title: { ru: "DCL", en: "DCL" },
        route: "/engineering/dcl",
        summary: {
          ru: "DCL в текущем состоянии — минимальный экран с таблицей без реального наполнения и без развитых операций редактирования. Его стоит воспринимать как заготовку интерфейса, а не как полноценный рабочий модуль.",
          en: "DCL is currently a minimal placeholder table rather than a fully featured module."
        },
        actions: [
          {
            ru: "Используйте этот экран только как индикатор текущего статуса разработки и не планируйте через него операционные сценарии.",
            en: "Treat this screen as a development stub, not an operational workflow."
          }
        ],
        risks: [
          {
            ru: "Раздел не обещает полный UX. В help важно не интерпретировать его как скрытый полноценный функционал.",
            en: "Do not assume hidden full functionality behind the current DCL screen."
          }
        ],
        related: [
          {
            ru: "Связанные экраны: технологическое оборудование и I/O сигналы.",
            en: "Related screens: technological equipment and I/O signals."
          }
        ],
        keywords: ["dcl", "заглушка", "placeholder"]
      },
      {
        id: "engineering-serial-map",
        title: { ru: "Карта последовательных протоколов", en: "Serial map" },
        route: "/engineering/serial-map",
        summary: {
          ru: "Serial Map — документный редактор карт последовательных протоколов. Слева управляются схемы и предпросмотр, в центре расположен холст, справа инспектор с вкладками свойств, данных, gateway mapping и диагностики.",
          en: "Serial Map is a document-based editor for serial protocol topology maps."
        },
        areas: [
          {
            ru: "Левая панель содержит список схем, создание, открытие, редактирование метаданных, удаление, импорт, экспорт JSON и восстановление localStorage-черновика.",
            en: "The left panel manages documents, metadata, import-export, and local draft recovery."
          },
          {
            ru: "На холсте доступны режимы выделения, соединения и панорамирования, поиск по узлам и быстрые команды copy/paste/duplicate/delete.",
            en: "The canvas supports selection, connection, pan, search, and clipboard commands."
          },
          {
            ru: "Инспектор делится на вкладки `Свойства`, `Данные`, `Шлюз` и `Диагностика`.",
            en: "The inspector is split into properties, data, gateway, and diagnostics tabs."
          }
        ],
        actions: [
          {
            ru: "Создавайте новую схему как отдельный серверный документ перед редактированием холста.",
            en: "Create a new server document before editing the canvas."
          },
          {
            ru: "Используйте импорт и экспорт для переноса схемы, а XML и CSV — для внешнего обмена, если сценарий это требует.",
            en: "Use import/export for document transfer and XML or CSV when external exchange is required."
          },
          {
            ru: "Проверяйте вкладку диагностики после любых структурных изменений: она показывает предупреждения и ошибки по документу.",
            en: "Review diagnostics after structural edits."
          }
        ],
        risks: [
          {
            ru: "Удаление схемы уничтожает серверный документ, а не просто скрывает его из списка.",
            en: "Deleting a scheme removes the server document, not just the list row."
          },
          {
            ru: "Черновик localStorage полезен только как аварийное восстановление. Не используйте его как основной способ хранения рабочей версии.",
            en: "The localStorage draft is for recovery only, not primary storage."
          }
        ],
        related: [
          {
            ru: "Связанные экраны: Digital Twin, карта сети, технологическое оборудование.",
            en: "Related screens: Digital Twin, network map, and technological equipment."
          }
        ],
        keywords: ["serial map", "последовательные протоколы", "gateway mapping", "xml", "csv", "диагностика"]
      },
      {
        id: "engineering-network-map",
        title: { ru: "Карта сети", en: "Network map" },
        route: "/engineering/network-map",
        summary: {
          ru: "Карта сети — отдельный документный редактор топологии. Он хранит сетевые схемы на сервере, умеет импортировать и экспортировать JSON, строить путь между узлами, редактировать интерфейсы, маршруты и политики.",
          en: "The network map is a server-backed topology editor with path tracing, interfaces, routes, and policies."
        },
        areas: [
          {
            ru: "Левая панель управляет документами топологии: список, предпросмотр, создание, открытие, редактирование, удаление, импорт и экспорт JSON.",
            en: "The left panel manages topology documents and their metadata."
          },
          {
            ru: "Центральный холст поддерживает режимы выбора, связи и панорамирования, поиск по узлам, авто-раскладку и fit view.",
            en: "The central canvas supports selection, linking, pan, search, auto-layout, and fit view."
          },
          {
            ru: "Правая часть редактирует свойства узла или связи, интерфейсы, маршруты, сервисы и политики, а также показывает диагностику документа.",
            en: "The right side edits node and edge details plus policies and diagnostics."
          }
        ],
        actions: [
          {
            ru: "Используйте path tracing, когда нужно быстро проверить маршрут между двумя узлами и при необходимости создать прямую связь.",
            en: "Use path tracing to inspect routes and optionally create a direct link."
          },
          {
            ru: "Добавляйте узлы либо вручную, либо из инвентаря, чтобы сеть отражала реальное установленное оборудование.",
            en: "Add nodes manually or from inventory so the topology matches installed equipment."
          },
          {
            ru: "После крупных перестроений запускайте авто-раскладку и смотрите диагностику: это помогает выявить разрывы, лишние связи и несогласованность атрибутов.",
            en: "After major edits run auto-layout and inspect diagnostics."
          }
        ],
        risks: [
          {
            ru: "Удаление документа удаляет схему целиком. Убедитесь, что экспорт или серверная версия больше не нужны.",
            en: "Deleting a document removes the entire topology."
          },
          {
            ru: "Ручное редактирование интерфейсов, маршрутов и политик влияет на аналитические сценарии трассировки. Неверный ввод ломает не только внешний вид, но и вычисления пути.",
            en: "Incorrect manual edits of interfaces, routes, or policies can break path calculations."
          }
        ],
        related: [
          {
            ru: "Связанные экраны: IPAM, номенклатура сетевого оборудования, Serial Map.",
            en: "Related screens: IPAM, network-capable nomenclature, and Serial Map."
          }
        ],
        keywords: ["карта сети", "network map", "path tracing", "политики", "маршруты", "экспорт json"]
      }
    ],
    extraContent: language === "ru" ? (
      <Box id="engineering-map-note" sx={{ display: "grid", gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Карта сети и карта последовательных протоколов похожи по UX, потому что обе построены как серверные документные редакторы. Но они решают разные задачи: одна описывает сетевую топологию и маршруты, другая — последовательные шины, адреса и gateway mapping.
        </Typography>
      </Box>
    ) : null
  });
}
