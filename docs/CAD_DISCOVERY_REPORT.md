Техническое обследование EQM перед проектированием CAD Editor
Обследование выполнено только чтением репозитория. Файлы, зависимости, миграции и исходный код не изменялись; git status --short остался пустым.
Корень приложения: D:\Projects\WEB\EQM\EQM.
Краткий вывод
В проекте нет единого editor engine:
- Network Map — собственный SVG-редактор, несмотря на наличие неиспользуемых React Flow-компонентов.
- P&ID — React Flow; метаданные процесса находятся в PostgreSQL, сама диаграмма — JSON-файл на диске.
- Serial Map — одновременно существуют legacy SVG-редактор и v2 на React Flow.
- Digital Twin — комбинированный UI: drag-and-drop раскладка шкафа и собственный SVG/DOM power graph.
- Общего пакета редактора или packages/ нет.
- Все PostgreSQL-модели документов наследуют VersionMixin, однако row_version не выходит в DTO и не принимается update-запросами. Реального optimistic locking инженерных документов нет: применяется last-write-wins.
- Предметные привязки реализованы неодинаково:
  - Network — преимущественно через кодированный node ID и скопированные данные.
  - Serial — явный sourceRef.
  - P&ID — явный sourceRef, но произвольного формата dict на backend.
  - Digital Twin — явные equipment_item_source, equipment_item_id, equipment_type_id.
A. Relevant project tree
EQM/
├── frontend/
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── theme.ts
│       ├── styles.css
│       ├── api/
│       │   ├── client.ts
│       │   ├── queryDefaults.ts
│       │   ├── digitalTwins.ts
│       │   ├── pid.ts
│       │   ├── ioSignals.ts
│       │   ├── ioTree.ts
│       │   ├── equipmentTypes.ts
│       │   ├── mainEquipment.ts
│       │   └── technologicalEquipment.ts
│       ├── context/
│       │   ├── AuthContext.tsx
│       │   └── ThemeContext.tsx
│       ├── navigation/nav.ts
│       ├── utils/
│       │   ├── permissions.ts
│       │   ├── errorMessage.ts
│       │   ├── locations.ts
│       │   ├── mainEquipment.ts
│       │   ├── dataTypes.ts
│       │   ├── signalTypes.ts
│       │   └── equipmentCategories.ts
│       ├── components/
│       │   ├── AppLayout.tsx
│       │   ├── Breadcrumbs.tsx
│       │   ├── AppNotifications.tsx
│       │   ├── ErrorSnackbar.tsx
│       │   └── pid/
│       │       ├── PidCanvas.tsx
│       │       ├── PidEditor.tsx
│       │       ├── PidToolbox.tsx
│       │       ├── PidPropertiesPanel.tsx
│       │       ├── PidLocationPanel.tsx
│       │       ├── PidEquipmentListTab.tsx
│       │       └── nodes/
│       │           ├── PidNodeRenderer.tsx
│       │           ├── EquipmentGlyph.tsx
│       │           └── InstrumentGlyph.tsx
│       ├── features/
│       │   ├── networkMap/
│       │   │   ├── NetworkMapPage.tsx
│       │   │   ├── NetworkMapNode.tsx
│       │   │   ├── NetworkMapEdge.tsx
│       │   │   ├── NetworkDeviceIcon.tsx
│       │   │   ├── types.ts
│       │   │   ├── utils.ts
│       │   │   └── api.ts
│       │   ├── serialMap/
│       │   │   ├── types.ts
│       │   │   ├── model.ts
│       │   │   ├── storage.ts
│       │   │   ├── api.ts
│       │   │   ├── SerialMapNodeRenderer.tsx
│       │   │   └── v2/
│       │   │       ├── useSerialMapEditorActions.ts
│       │   │       ├── SerialMapFlowNode.tsx
│       │   │       ├── SerialMapFlowEdge.tsx
│       │   │       └── utils.ts
│       │   ├── pid/
│       │   │   ├── io.ts
│       │   │   ├── pageState.ts
│       │   │   ├── symbols.ts
│       │   │   ├── equipmentSymbolRegistry.tsx
│       │   │   └── mainEquipmentObjectSymbols.ts
│       │   ├── digitalTwin/
│       │   │   ├── DigitalTwinPage.tsx
│       │   │   ├── PowerGraphCanvas.tsx
│       │   │   ├── utils.ts
│       │   │   └── nomenclature.ts
│       │   └── ipam/
│       │       ├── api/ipam.ts
│       │       ├── types/index.ts
│       │       └── pages/IPAMPage.tsx
│       ├── pages/
│       │   ├── NetworkMapPage.tsx
│       │   ├── SerialMapPage.tsx
│       │   ├── SerialMapV2Page.tsx
│       │   ├── TechnologicalEquipmentPage.tsx
│       │   └── CabinetCompositionPage.tsx
│       └── types/pid.ts
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── db/
│   │   │   ├── base.py
│   │   │   └── session.py
│   │   ├── core/
│   │   │   ├── access.py
│   │   │   ├── dependencies.py
│   │   │   ├── audit.py
│   │   │   ├── pagination.py
│   │   │   └── query.py
│   │   ├── models/
│   │   │   ├── network_topology.py
│   │   │   ├── serial_map.py
│   │   │   ├── pid.py
│   │   │   ├── digital_twins.py
│   │   │   ├── core.py
│   │   │   ├── operations.py
│   │   │   ├── assemblies.py
│   │   │   ├── io.py
│   │   │   └── ipam.py
│   │   ├── schemas/
│   │   │   ├── network_topology.py
│   │   │   ├── serial_map.py
│   │   │   ├── pid.py
│   │   │   ├── digital_twins.py
│   │   │   ├── io_signals.py
│   │   │   └── ipam.py
│   │   ├── routers/
│   │   │   ├── network_topologies.py
│   │   │   ├── serial_map_documents.py
│   │   │   ├── pid.py
│   │   │   ├── digital_twins.py
│   │   │   ├── equipment_in_operation.py
│   │   │   ├── io_signals.py
│   │   │   ├── io_tree.py
│   │   │   └── ipam.py
│   │   ├── services/
│   │   │   ├── pid_storage.py
│   │   │   ├── digital_twins.py
│   │   │   ├── io_signals.py
│   │   │   └── ipam.py
│   │   └── pid_storage/
│   │       └── diagrams/*.json
│   ├── alembic/versions/
│   └── tests/
├── docs/
│   ├── EQM_DB_ERD.md
│   ├── DeveloperNote_NomenclatureSelects.md
│   ├── deploy/
│   └── security/
├── deploy/
│   ├── build-offline-bundle.ps1
│   └── app/
│       ├── Dockerfile.frontend
│       ├── Dockerfile.backend
│       ├── nginx.frontend.conf
│       ├── nginx.host.conf
│       └── docker-compose.yml
└── README.md
packages/ — не найдено. Отдельного корневого tests/ нет: backend-тесты находятся в backend/tests, frontend-тесты расположены рядом с исходниками.
B. Current editor architecture matrix
Характеристика	Network	P&ID	Serial	Digital Twin
Renderer	Собственный <svg>	React Flow	Legacy SVG + v2 React Flow	HTML5 DnD + собственный SVG/DOM power graph
Storage	PostgreSQL JSONB	Process metadata в PostgreSQL; diagram JSON и images на filesystem	PostgreSQL JSONB; legacy fallback в localStorage	PostgreSQL JSONB
Document model	nodes, edges, policies, viewport, zoom	processId, viewport, nodes, edges	version 2, nodes, edges, viewport, history	walls, rails, items, cabinet properties, powerGraph, viewport, UI
DB binding	Косвенная: детерминированный ID eqm_<source>_<id>	sourceRef на main/field/equipment-in-operation/palette	sourceRef с cabinet/assembly item	Явные source/item/type IDs
History	In-memory, 100 snapshots	In-memory, 100 snapshots	History сериализуется внутри документа, 100 snapshots	Не найдено
Persistence	PATCH по commit/blur/drag	PUT с debounce 900 ms	Legacy commit-save; v2 debounce 900 ms	PATCH с debounce 700 ms
Concurrency	Last-write-wins	Last-write-wins	Last-write-wins	Last-write-wins
Inspector	Встроенный right panel, 4 вкладки	PidPropertiesPanel + equipment/location panels	Встроенный inspector, 4 вкладки	Item forms + power graph inspector
Tests	Не найдено	Helper/symbol tests + backend router	Не найдено	Backend service tests; frontend не найдено


1–2. Frontend и dependencies
Точные установленные версии из frontend/package-lock.json:
Пакет	Версия
react	18.3.1
react-dom	18.3.1
typescript	5.9.3
vite	7.3.5
@mui/material	5.18.0
@mui/icons-material	5.18.0
@emotion/react	11.14.0
@emotion/styled	11.14.1
reactflow	11.11.4
@tanstack/react-query	5.90.12
@tanstack/react-table	8.21.3
react-router-dom	6.30.4
framer-motion	12.38.0
vitest	3.2.6
@testing-library/react	16.3.2
@testing-library/jest-dom	6.9.1
jsdom	27.4.0


Проверка требуемых категорий:
- State management: отдельная библиотека не найдена; используются React state/ref и TanStack Query.
- Canvas/SVG: React Flow и собственный SVG/DOM.
- Geometry library: не найдена.
- Drag/drop library: не найдена; используются Pointer Events, HTML5 DnD и React Flow.
- Immutable/history library: не найдена; используются spread, structuredClone, ручные snapshots.
- UUID frontend library: не найдена. IDs создаются через Math.random()/Date.now(). Backend использует стандартный uuid.uuid4 для P&ID images.
- Validation/schema frontend library: Zod/Yup и аналоги не найдены; импорт проверяется ручными type guards. Backend использует Pydantic.
- PixiJS — не найден.
- Fabric.js — не найден.
- Konva — не найден.
- SVG.js — не найден.
- D3 — не найден.
- Zustand — не найден.
- Redux / Redux Toolkit — не найден.
- Immer — не найден.
Источники: [package.json](D:/Projects/WEB/EQM/EQM/frontend/package.json), [package-lock.json](D:/Projects/WEB/EQM/EQM/frontend/package-lock.json).
3. Network Topology Editor
Маршрут /engineering/network-map объявлен в [App.tsx](D:/Projects/WEB/EQM/EQM/frontend/src/App.tsx); route page только реэкспортирует feature-page.
Основная реализация: [NetworkMapPage.tsx](D:/Projects/WEB/EQM/EQM/frontend/src/features/networkMap/NetworkMapPage.tsx).
Факты:
- Renderer — inline <svg>, <g transform="translate(...) scale(...)">.
- Узлы рисуются inline через <g>, <rect>, <text>.
- Связи рисуются inline как SVG <path>.
- NetworkMapNode.tsx, NetworkMapEdge.tsx и React Flow adapters из utils.ts фактически не импортируются активной страницей.
- Координаты узлов — абсолютные world coordinates x/y.
- Viewport — {x, y} и отдельный zoom.
- Zoom — wheel-centered, clamp 0.25..2.4.
- Pan — pointer drag пустого холста или режим pan.
- Drag — собственная pointer interaction state machine.
- Selection — клик; Shift включает/исключает узел.
- Marquee — собственный SVG selection rectangle и пересечение bounding boxes.
- Multi-selection — есть.
- Keyboard:
  - Delete/Backspace;
  - Ctrl/Cmd+C/V/D;
  - Escape для сброса режимов/панелей.
  - Явные Ctrl+Z/Y shortcuts не найдены; undo/redo доступны toolbar-кнопками.
- Connections — двухшаговый режим connect.
- Minimap — отдельный SVG, поддерживает переход по клику.
- Search — имя, IP, VLAN, zone; фокусирует найденный узел.
- Inspector — selection/data/gateway/diagnostics.
- Toolbar — select/pan/copy/paste/duplicate/delete/add/connect/auto-layout/fit/fullscreen.
- History — snapshots nodes/edges/policies/viewport/zoom, максимум 100.
- Clipboard — локальное React-состояние, не системный Clipboard API.
- Dirty state — hasUnsavedChanges + refs.
- Save — PATCH /network-topologies/{id}; сохраняется после завершения пользовательского действия/blur. Временной debounce не найден.
- Одновременные saves сериализуются через saveInFlightRef и needsSaveAfterCurrentRef.
- Serialization — JSONB document; JSON import/export.
- Validation — frontend computeTopologyValidation: health, isolated nodes, routes у router/core-switch/firewall, degraded edges.
- Optimistic locking — не найдено.
- Optimistic TanStack update — не найдено; cache обновляется после успешного ответа.
- API — list/get/create/update/delete/duplicate/eligible-equipment.
Фактические типы в [types.ts](D:/Projects/WEB/EQM/EQM/frontend/src/features/networkMap/types.ts):
TopologyDocument
  nodes: NetworkNode[]
  edges: NetworkEdge[]
  policies: TopologyPolicy[]
  viewport?: { x, y }
  zoom?: number

NetworkNode
  id, name, type, x, y, ip, vlan, zone, asn, layer,
  status, model, os, interfaces, routes, services

NetworkEdge
  id, from, to, label, style, bandwidth, latency, status, network

TopologyPolicy
  id, name, type, target, state
NetworkTopologyDocumentRecord не содержит row_version.
Binding ограничен: createNodeFromEquipment() создаёт ID вида eqm_cabinet_123 или eqm_assembly_456, но отдельного структурированного sourceRef в NetworkNode нет. Business-данные (name, model, ip) копируются в документ и могут устаревать независимо от БД.
4. P&ID Editor
P&ID встроен в /engineering/technological-scheme; главная страница — [TechnologicalEquipmentPage.tsx](D:/Projects/WEB/EQM/EQM/frontend/src/pages/TechnologicalEquipmentPage.tsx).
Активный canvas — [PidCanvas.tsx](D:/Projects/WEB/EQM/EQM/frontend/src/components/pid/PidCanvas.tsx). PidEditor.tsx существует как параллельная/предыдущая реализация, но активной страницей не импортируется.
Факты:
- React Flow используется напрямую.
- Custom node types: equipment, instrument, external; все делегируются PidNodeRenderer.
- Отдельный custom edge component не найден; используются React Flow edges со стилем по edgeType.
- Handles: top/right/bottom/left; пара выбирается автоматически по взаимному положению узлов.
- Типы связей: process, signal, control, electric.
- Process/control получают стрелки; цвет и dash определяются типом.
- Координаты ограничиваются диапазоном -20000..20000.
- Viewport: {x, y, zoom} React Flow.
- Symbols:
  - встроенный TSX/SVG registry;
  - main-equipment object registry;
  - uploaded symbol через URL.
- Допустимые image uploads: JPG, JPEG, PNG, WEBP, SVG.
- DB binding: PidSourceRef.source = main-equipment | field-equipment | equipment-in-operation | palette, с id, name, meta.
- Inspector: PidPropertiesPanel.
- Equipment/source panels: PidEquipmentListTab, PidLocationPanel, PidToolbox.
- History: in-memory snapshots, максимум 100.
- Undo/redo: toolbar + Ctrl/Cmd+Z, Shift+Z и Ctrl/Cmd+Y.
- Clipboard: выбранные nodes и внутренние edges; Ctrl+C/V/D.
- Autosave: debounce 900 ms.
- Dirty detection: JSON fingerprint без updatedAt и viewport.
- Import/export: JSON.
- JSON import создаёт новый PidProcess, затем сохраняет diagram; при ошибке выполняется best-effort soft delete созданного процесса.
- PNG/SVG/PDF export — не найден.
- Backend validation: Pydantic; frontend import дополнительно проверяет shape вручную.
Storage принципиально отличается от остальных редакторов:
- Таблица pid_processes хранит только location_id, name/description и mixin-поля.
- Diagram хранится в ${PID_STORAGE_ROOT}/diagrams/{process_id}.json.
- save_diagram_atomic() пишет tempfile и заменяет целевой файл.
- Uploaded images хранятся в ${PID_STORAGE_ROOT}/images.
- Удаление процесса не удаляет diagram JSON или связанные image files.
Формат документа определён в [pid.ts](D:/Projects/WEB/EQM/EQM/frontend/src/types/pid.ts) и backend [schemas/pid.py](D:/Projects/WEB/EQM/EQM/backend/app/schemas/pid.py).
5. Serial Map / Serial Map v2
Доступны два маршрута:
- /engineering/serial-map — [SerialMapPage.tsx](D:/Projects/WEB/EQM/EQM/frontend/src/pages/SerialMapPage.tsx), собственный SVG.
- /engineering/serial-map-v2 — [SerialMapV2Page.tsx](D:/Projects/WEB/EQM/EQM/frontend/src/pages/SerialMapV2Page.tsx), React Flow.
Обе версии используют одну серверную модель и один формат SerialMapDocumentData.
Схема:
SerialMapDocumentData
  version: 2
  updatedAt
  viewport: {x, y, zoom}
  nodes: SerialMapNode[]
  edges: SerialMapEdge[]
  history: {past, future}

SerialMapNode
  id, kind, name, protocol, baudRate, address,
  parity, dataBits, stopBits, segment, note,
  width, height, position,
  dataPool, serialPorts, sourceRef,
  bridgeProtocol, converterMappings

SerialMapEdge
  id, fromNodeId, toNodeId,
  protocol, baudRate, label, cableMark, meta
Примечание: frontend содержит cableMark, но соответствующая backend Pydantic-модель SerialMapEdge его не объявляет. При стандартном поведении Pydantic extra field будет отброшено при round-trip через backend. Это подтверждённое расхождение контрактов.
Bindings:
sourceRef:
  source: cabinet | assembly
  equipmentInOperationId
  equipmentTypeId
  containerId
  containerName
Функциональность:
- v2 использует custom SerialMapFlowNode и SerialMapFlowEdge.
- Handles — left target/right source.
- Выбор и marquee — React Flow.
- History — 100 snapshots, но сериализуется прямо в document JSONB.
- Validation:
  - конфликты одинаковых protocol/address;
  - dangling endpoints;
  - protocol/baud mismatch;
  - gateway mapping diagnostics.
- Autosave v2 — 900 ms.
- Legacy SVG — сохранение по commit/blur/action.
- Import — JSON, включая конвертацию legacy multi-scheme project.
- Export — JSON, XML, CSV.
- Локальный fallback — localStorage["serial-map-editor:v1"].
- Backend router также выполняет legacy migration при GET/list и делает db.commit() в read endpoints.
- API — list/get/create/update/delete/duplicate/eligible-equipment.
6. Digital Twin Editor
Страница [CabinetCompositionPage.tsx](D:/Projects/WEB/EQM/EQM/frontend/src/pages/CabinetCompositionPage.tsx) реэкспортирует [DigitalTwinPage.tsx](D:/Projects/WEB/EQM/EQM/frontend/src/features/digitalTwin/DigitalTwinPage.tsx) для:
- /cabinets/:id/composition;
- /assemblies/:id/composition.
Реализация состоит из:
- раскладки walls/rails/items через HTML5 drag-and-drop;
- отдельного power graph в [PowerGraphCanvas.tsx](D:/Projects/WEB/EQM/EQM/frontend/src/features/digitalTwin/PowerGraphCanvas.tsx);
- собственного SVG для edges и абсолютно позиционированных DOM nodes.
Документ:
DigitalTwinDocument version 2
  walls[]
  rails[]
  items[]
  cabinet_properties
  powerGraph.nodes[]
  powerGraph.edges[]
  viewport
  ui
Binding source-backed item:
equipment_item_source: cabinet | assembly
equipment_item_id
equipment_type_id
Также документ копирует значительный объём бизнес-данных: manufacturer, article, power parameters, I/O counts, network/serial ports. sync-from-operation обновляет их из текущего EquipmentType/CabinetItem/AssemblyItem; отсутствующие source items помечаются out_of_operation.
Факты:
- Autosave — 700 ms.
- История/undo/redo — не найдено.
- Import/export — не найдено.
- Validation — frontend buildValidation и analyzePowerGraph.
- API: ensure/get/sync/PATCH.
- Delete/duplicate Digital Twin documents — не найдено.
- Backend tests проверяют sync, idempotence, preservation placement/edges, out-of-operation и upgrade v1→v2.
Особенность доступа: frontend проверяет equipment write permission, а не engineering, поскольку editor встроен в composition page.
7. Фактическое дублирование editor code
Повторяется независимо в нескольких редакторах:
- viewport {x,y,zoom};
- clamp/coordinate conversions;
- pointer pan;
- node drag;
- fit-to-view;
- fullscreen;
- selection и multi-selection;
- clipboard;
- 100-entry snapshot history;
- toolbar и inspector shells;
- document list/search/preview;
- dirty/save state;
- save-in-flight/queued-save;
- JSON download/upload;
- minimap calculations;
- equipment palette/search;
- dialogs create/delete/import;
- server document CRUD.
Наиболее близки друг к другу legacy Serial Map и Network Map: обе страницы содержат собственные pointer state machines, inline SVG rendering, minimap, inspector, history и CRUD shell.
Это только констатация текущего дублирования; рефакторинг не предлагается.
8. Backend document models
Все четыре PostgreSQL-модели наследуют TimestampMixin, SoftDeleteMixin, VersionMixin, то есть физически имеют:
created_at, updated_at,
is_deleted, deleted_at, deleted_by_id,
row_version
Модель	Таблица	Собственные колонки
NetworkTopologyDocument	network_topology_documents	id, name, description, scope, location_id FK, source_context JSONB, document_json JSONB, created_by_id FK, updated_by_id FK
SerialMapDocument	serial_map_documents	тот же набор
DigitalTwinDocument	digital_twin_documents	id, scope, source_id, source_context JSONB, document_json JSONB, created_by_id FK, updated_by_id FK
PidProcess	pid_processes	id, location_id FK, name, description; diagram JSONB отсутствует


Digital Twin source_id — не FK: смысл определяется строковым scope. Есть partial unique index по (scope, source_id) для active rows.
Связанные миграции:
- 0026_create_pid_process.py
- 0034_add_network_topology_documents.py
- 0037_add_digital_twins_and_equipment_type_power_fields.py
- 0038_add_serial_map_documents.py
- 0039_convert_serial_map_documents_to_single_scheme.py
Тесты:
- P&ID router: backend/tests/test_pid_router.py.
- Digital Twin service: backend/tests/test_digital_twins_service.py.
- Специализированные backend tests для Network/Serial document CRUD — не найдены.
- Tests optimistic conflict для этих документов — не найдены.
9–11. Engineering entity, IPAM и I/O
Предметные сущности
Сущность	Модель/таблица	CAD-значимые поля и связи	Read API
Equipment type	EquipmentType / equipment_types	manufacturer, category, channel counts, network/serial ports, power fields, meta_data, media	GET /equipment-types/, /{id}; q/filter/sort/pagination
Equipment in operation	Отдельной таблицы/модели нет	Проекция над CabinetItem и AssemblyItem	/equipment-in-operation/, /containers, /tree; q, container/type/manufacturer/location/date filters, pagination
Technological equipment	TechnologicalEquipment / technological_equipment	main equipment, optional drive, tag, location, description	list/get с q/filter/sort/pagination
Main equipment	MainEquipment / main_equipment	parent hierarchy, level, code, meta_data с P&ID symbol	list/get/tree
Cabinet	Cabinet / cabinets	location, metadata, media	list/get
Cabinet item	CabinetItem / cabinet_items	cabinet FK, equipment_type FK, quantity	list/get, IPAM summary
Assembly	Assembly / assemblies	location, metadata	list/get
Assembly item	AssemblyItem / assembly_items	assembly FK, equipment_type FK, quantity	list/get
I/O signal	IOSignal / io_signals	cabinet item, signal type, channel, tag, PLC address, datatype, signal kind, equipment category, measurement unit	list by equipment item, rebuild, update
VLAN	Vlan / vlans	number, purpose, location, active	paginated list/get
Subnet	Subnet / subnets	VLAN FK, CIDR/prefix/network/gateway, location, VRF	paginated list/get/addresses
Network interface	EquipmentNetworkInterface	cabinet item legacy FK плюс polymorphic source/id	возвращается через eligible-equipment/host-tree/IPAM summaries
IP address	IPAddress / ip_addresses	subnet FK, interface FK, equipment refs, status, primary flag	subnet address grid/details/assign/reserve/release


Все эти модели имеют row_version, кроме чистых projection DTO; но их response schemas также, как правило, не публикуют версию.
Реальная IPAM-цепочка
CabinetItem
  └─ EquipmentNetworkInterface.equipment_instance_id (настоящий FK)
      └─ IPAddress.equipment_interface_id (настоящий FK)
          └─ Subnet.id (FK)
              └─ Vlan.id (FK)
Для поддержки assembly используется пара:
equipment_item_source = "cabinet" | "assembly"
equipment_item_id = integer
Это не составной FK. Следовательно, для assembly целостность поддерживается сервисным кодом, а не PostgreSQL constraint.
Frontend получает данные через:
- /ipam/equipment/eligible;
- /ipam/equipment/host-tree;
- /ipam/subnets;
- /ipam/subnets/{id}/addresses;
- /cabinet-items/{id}/ipam-summary;
- /network-topologies/eligible-equipment/list.
I/O
Фактическая связь:
CabinetItem
  └─ IOSignal.equipment_in_operation_id
      ├─ signal_type enum AI/AO/DI/DO
      ├─ channel_index
      ├─ plc_absolute_address
      ├─ DataType
      ├─ SignalTypeDictionary
      ├─ EquipmentCategory
      └─ MeasurementUnit
equipment_in_operation_id указывает именно на cabinet_items.id; I/O для assembly item не найден.
API:
- POST /io-signals/rebuild?equipment_in_operation_id=...
- GET /io-signals/?equipment_in_operation_id=...
- PUT/PATCH /io-signals/{signal_id}
- GET /io-tree
List I/O signals не paginated.
12. Auth / RBAC
Frontend:
- RequireAuth и RequireSpace находятся в [App.tsx](D:/Projects/WEB/EQM/EQM/frontend/src/App.tsx).
- SpaceKey и hasPermission() — [permissions.ts](D:/Projects/WEB/EQM/EQM/frontend/src/utils/permissions.ts).
- Engineering pages защищены space="engineering".
- Read-only режимы editor pages вычисляются через hasPermission(user, "engineering", "write").
- Digital Twin использует equipment permission.
Backend имеет две системы:
1. require_read_access, require_write_access, require_admin — глобальные role checks.
2. require_space_access(space_key, action) — полноценная space permission система.
Однако обследованные engineering routers используют первую, глобальную систему. require_space_access(SpaceKey.engineering, ...) в Network/P&ID/Serial/Digital Twin routes не найден.
Это означает возможное расхождение frontend navigation access и backend enforcement для кастомных ролей.
Дополнительный риск: POST /digital-twins/{scope}/{source_id}/ensure защищён require_read_access(), хотя функция создаёт или обновляет запись и делает commit.
13–14. Application shell и API client
Shell:
- React Router v6.
- Lazy route imports через React.lazy.
- AppLayout с AppBar, collapsible sidebar, breadcrumbs, theme/language controls и chat.
- Breadcrumbs строятся из navTree.
- Theme — MUI light/dark плюс CSS variables.
- i18n — i18next/react-i18next, RU/EN.
- Global notifications — AppNotificationsHost; success toast подключён через MutationCache.
- Ошибки editor pages обрабатываются локальными banners/snackbars.
- Dialogs смешанные: MUI Dialog, custom overlays и window.confirm.
Новая CAD Page должна встраиваться в этот shell через lazy route, RequireSpace, navTree и breadcrumbs.
API client:
- Базовый URL — VITE_API_URL, dev default http://localhost:8000/api/v1, production /api/v1.
- Bearer token берётся из localStorage["eqm_token"].
- Ошибки преобразуются через buildHttpError.
- Query defaults: stale 30 s, GC 10 min, refetch-on-focus отключён.
- Query keys определяются локально в pages/features; централизованной query-key factory нет.
- Editor mutations обычно используют cache set/invalidate после success.
- Настоящие optimistic updates с rollback — не найдены.
15. Document concurrency
row_version автоматически увеличивается before_flush в [session.py](D:/Projects/WEB/EQM/EQM/backend/app/db/session.py).
Но для Network, Serial, Digital Twin и P&ID:
- update request DTO не содержит row_version;
- response DTO не содержит row_version;
- router не сравнивает expected/current version;
- If-Match/ETag не используются;
- HTTP 409/412 не возвращается;
- frontend не имеет conflict UI;
- соответствующих tests нет.
P&ID diagram находится вне SQLAlchemy вообще, поэтому его PidProcess.row_version не защищает JSON-файл.
Итог: фактический режим — last successful write wins.
16. Audit
Операция	Network	Serial	P&ID	Digital Twin
Create	create_network_topology	create_serial_map_document	create_process	ensure создаёт, но audit не найден
Update	update_network_topology	update_serial_map_document	update_process, save_diagram	update_digital_twin
Delete	delete_network_topology	delete_serial_map_document	delete_process	route не найден
Duplicate	duplicate_network_topology → CREATE + meta	duplicate_serial_map_document → CREATE + meta	не найдено	не найдено


Дополнительно:
- P&ID diagram audit содержит только process ID и updated timestamp, без полного before/after.
- Digital Twin sync/ensure может менять document без audit.
- Serial legacy conversion в GET/list может менять БД без audit.
- Общий механизм — add_audit_log() и model_to_dict() из [audit.py](D:/Projects/WEB/EQM/EQM/backend/app/core/audit.py).
17. Import / export
Формат	Network	P&ID	Serial	Digital Twin
JSON import	Да	Да	Да	Не найдено
JSON export	Да	Да	Да	Не найдено
XML	Нет	Нет	Да, export	Нет
CSV	Нет	Нет	Да, export	Нет
Image upload	Нет	JPG/JPEG/PNG/WEBP/SVG symbols	Нет	Media через equipment/cabinet APIs, не document import
SVG export	Не найдено	Не найдено	Не найдено	Не найдено
PNG export	Не найдено	Не найдено	Не найдено	Не найдено
PDF export	Не найдено	Не найдено	Не найдено	Не найдено


18. Tests
Frontend:
- Vitest config встроен в vite.config.ts: jsdom, globals: true.
- P&ID:
  - equipmentSymbolRegistry.test.ts
  - mainEquipmentObjectSymbols.test.ts
  - pageState.test.ts
  - symbols.test.ts
- Network editor tests — не найдены.
- Serial editor tests — не найдены.
- Digital Twin frontend tests — не найдены.
- Общего editor testing utility — не найдено.
- API mocking показан в chat tests через vi.mock, но для editor APIs отсутствует.
Backend:
- pytest/FastAPI TestClient.
- Часть tests использует SQLite in-memory fixtures.
- P&ID router tests есть.
- Digital Twin service tests есть.
- IPAM и I/O имеют отдельные tests.
- Network/Serial document API tests — не найдены.
- Optimistic locking tests для engineering documents — не найдены.
19. Build / deploy constraints
- Vite + TypeScript strict.
- Manual vendor chunks: React, MUI, React Query, React Flow, Recharts.
- Frontend Docker image — nginx 1.24 Alpine, копируется готовый frontend/dist.
- Nginx обслуживает SPA и immutable /assets.
- Offline bundle содержит Docker images, DB dump, source/deploy files.
- Dynamic imports уже используются и поддерживаются.
- CSP — не найден.
- WebGL restriction — не найдено.
- Web Workers restriction — не найдено.
- OffscreenCanvas restriction — не найдено.
- WebAssembly restriction — не найдено.
- Прямое архитектурное ограничение для этих технологий — не найдено.
Существенный deploy-риск: [build-offline-bundle.ps1](D:/Projects/WEB/EQM/EQM/deploy/build-offline-bundle.ps1) ожидает Alembic revision 0043_add_io_signal_plc_range_fields, тогда как в репозитории уже присутствуют миграции до 0050. Это выглядит как устаревшая проверка bundle.
20. Performance-relevant facts
Подтверждено кодом:
- Явный maximum nodes/edges — не найден.
- Network и legacy Serial выполняют полный React render всех SVG nodes/edges.
- Digital Twin power graph также рендерит все nodes/edges.
- React Flow используется для P&ID и Serial v2.
- История ограничена 100 snapshots, но каждый snapshot содержит полные массивы nodes/edges.
- У Serial история ещё и сериализуется в JSONB, увеличивая документ и payload.
- P&ID dirty detection делает JSON.stringify всего содержимого при изменениях.
- Digital Twin dirty detection также делает JSON.stringify всего документа.
- Network shortest path и validation выполняют линейные/повторные обходы; degree узла считается фильтрацией всех edges для каждого узла.
- Network/Serial equipment presence/search/diagnostics используют useMemo.
- Autosave: 900 ms P&ID, 900 ms Serial v2, 700 ms Digital Twin.
- Network/legacy Serial сохраняют по commit, без timer debounce.
- Request batching редакторов — не найден.
- Worker/off-main-thread computation — не найдено.
- Viewport-based culling/virtualization — не найдено.
- UI ограничивает отображение некоторых search results: 8 или 12.
- Network загружает максимум 100 documents, 200 subnets и 512 addresses; полного client pagination документа-листа нет.
C. Exact relevant files by subsystem
Network
- frontend/src/pages/NetworkMapPage.tsx
- frontend/src/features/networkMap/NetworkMapPage.tsx
- frontend/src/features/networkMap/types.ts
- frontend/src/features/networkMap/utils.ts
- frontend/src/features/networkMap/api.ts
- frontend/src/features/networkMap/NetworkMapNode.tsx
- frontend/src/features/networkMap/NetworkMapEdge.tsx
- frontend/src/features/networkMap/NetworkDeviceIcon.tsx
- backend/app/models/network_topology.py
- backend/app/schemas/network_topology.py
- backend/app/routers/network_topologies.py
- backend/alembic/versions/0034_add_network_topology_documents.py
P&ID
- frontend/src/pages/TechnologicalEquipmentPage.tsx
- frontend/src/types/pid.ts
- frontend/src/api/pid.ts
- frontend/src/components/pid/*
- frontend/src/components/pid/nodes/*
- frontend/src/features/pid/*
- backend/app/models/pid.py
- backend/app/schemas/pid.py
- backend/app/routers/pid.py
- backend/app/services/pid_storage.py
- backend/alembic/versions/0026_create_pid_process.py
- backend/tests/test_pid_router.py
Serial
- frontend/src/pages/SerialMapPage.tsx
- frontend/src/pages/SerialMapV2Page.tsx
- frontend/src/features/serialMap/*
- frontend/src/features/serialMap/v2/*
- backend/app/models/serial_map.py
- backend/app/schemas/serial_map.py
- backend/app/routers/serial_map_documents.py
- backend/alembic/versions/0038_add_serial_map_documents.py
- backend/alembic/versions/0039_convert_serial_map_documents_to_single_scheme.py
Digital Twin
- frontend/src/pages/CabinetCompositionPage.tsx
- frontend/src/features/digitalTwin/*
- frontend/src/api/digitalTwins.ts
- backend/app/models/digital_twins.py
- backend/app/schemas/digital_twins.py
- backend/app/services/digital_twins.py
- backend/app/routers/digital_twins.py
- backend/alembic/versions/0037_add_digital_twins_and_equipment_type_power_fields.py
- backend/tests/test_digital_twins_service.py
Entity bindings / IPAM / I/O
- backend/app/models/core.py
- backend/app/models/operations.py
- backend/app/models/assemblies.py
- backend/app/models/io.py
- backend/app/models/ipam.py
- backend/app/routers/equipment_in_operation.py
- backend/app/routers/io_signals.py
- backend/app/routers/io_tree.py
- backend/app/routers/ipam.py
- backend/app/services/ipam.py
- backend/app/services/io_signals.py
- frontend/src/features/ipam/*
- frontend/src/api/ioSignals.ts
- frontend/src/api/ioTree.ts
D. Existing abstractions potentially reusable by CAD
Без утверждения, что они должны быть переиспользованы:
- apiFetch, auth injection и единый HTTP error format.
- TanStack Query provider/defaults.
- RequireSpace, SpaceKey, hasPermission.
- AppLayout, breadcrumbs, navigation tree, notifications и theme.
- Generic document CRUD shape Network/Serial: metadata + JSONB document.
- TimestampMixin, SoftDeleteMixin, VersionMixin.
- Audit helpers.
- Entity list/search/pagination helpers.
- IPAM eligible-equipment and host-tree APIs.
- Equipment-in-operation projection.
- I/O tree and dictionary lookup utilities.
- P&ID symbol registry/normalization.
- Serial equipment source reference.
- Digital Twin source sync pattern.
- Existing import validation patterns.
- Existing save-in-flight/queued-save patterns.
E. Editor-specific code that is not realistically generic as-is
- Network-specific topology health, routes, shortest-path and policy logic.
- P&ID ISA/ISO glyphs, instruments, process/control/signal/electric semantics.
- P&ID filesystem storage and symbol upload.
- Serial protocol, baud, parity, registers, address conflicts and gateway mappings.
- Digital Twin walls/rails, cabinet placement, electrical load and power-chain validation.
- IPAM subnet/address selection embedded in Network inspector.
- Equipment-type power/nomenclature editing embedded in Digital Twin.
- Legacy Serial localStorage and multi-scheme migration.
- Large monolithic page-specific UI compositions and localized labels.
F. Information not determinable from repository
Явно не найдено или невозможно установить:
- Целевые maximum node/edge counts нового CAD.
- Требуемый CAD file/document compatibility versioning policy.
- Expected multi-user conflict UX.
- Требования к collaborative editing/realtime.
- Требования к DWG/DXF/SVG/PDF interoperability.
- Допустимый размер документа и server request body.
- Browser/GPU support matrix.
- Обязательность WebGL, Workers, OffscreenCanvas или WASM.
- Требования к snapping, layers, constraints, blocks, groups и symbol libraries.
- Правила жизненного цикла entity bindings при удалении/перемещении сущности.
- Должны ли bindings быть polymorphic FK, soft references или отдельной relation table.
- Требования к audit granularity для отдельных CAD operations.
- Требования к восстановлению autosave/crash recovery.
- Целевой ownership/sharing model документа.
- Требование хранить историю внутри document либо отдельно.
- Нужен ли отдельный CAD backend aggregate или существующий document CRUD contract.
G. Обнаруженные риски
1. Реальный optimistic locking отсутствует, несмотря на наличие row_version.
2. Autosave редакторов может перезаписать изменения другого пользователя.
3. Network node копирует business-data и не хранит структурированный binding.
4. P&ID хранит диаграммы вне PostgreSQL; отсутствуют транзакционность с process metadata, FK и database backup semantics.
5. P&ID soft delete не очищает JSON/images.
6. Serial history хранится внутри документа, раздувая JSONB и каждый save payload.
7. Serial frontend/backend расходятся по cableMark.
8. Serial GET/list выполняют migration и commit.
9. Digital Twin ensure изменяет данные под read permission и без audit.
10. Digital Twin source_id и IPAM polymorphic source/id не защищены FK.
11. Backend engineering routers используют role-level access вместо фактических space permissions.
12. Одновременно существуют legacy и v2 Serial Map.
13. PidEditor.tsx и Network React Flow components выглядят как неактивные альтернативные реализации.
14. Нет Network/Serial editor tests.
15. Нет проверенного performance envelope.
16. Большие документы целиком валидируются, сериализуются и отправляются при каждом save.
17. Нет viewport culling или worker-based computation для собственных SVG editors.
18. Нет общего контрактного слоя между TypeScript и Pydantic document schemas.
19. Offline bundle revision check отстаёт от текущих migrations.
20. В репозитории присутствуют реальные P&ID diagram JSON-файлы, что требует отдельной политики source control/deploy/data ownership.
H. Что архитектору прочитать вручную перед CAD_ARCHITECTURE.md
Приоритетный список:
1. [Architecture.md](D:/Projects/WEB/EQM/EQM/Architecture.md)
2. [AGENTS_CONTEXT.md](D:/Projects/WEB/EQM/EQM/AGENTS_CONTEXT.md)
3. [NetworkMapPage.tsx](D:/Projects/WEB/EQM/EQM/frontend/src/features/networkMap/NetworkMapPage.tsx)
4. [networkMap/types.ts](D:/Projects/WEB/EQM/EQM/frontend/src/features/networkMap/types.ts)
5. [TechnologicalEquipmentPage.tsx](D:/Projects/WEB/EQM/EQM/frontend/src/pages/TechnologicalEquipmentPage.tsx)
6. [PidCanvas.tsx](D:/Projects/WEB/EQM/EQM/frontend/src/components/pid/PidCanvas.tsx)
7. [serialMap/types.ts](D:/Projects/WEB/EQM/EQM/frontend/src/features/serialMap/types.ts)
8. [useSerialMapEditorActions.ts](D:/Projects/WEB/EQM/EQM/frontend/src/features/serialMap/v2/useSerialMapEditorActions.ts)
9. [DigitalTwinPage.tsx](D:/Projects/WEB/EQM/EQM/frontend/src/features/digitalTwin/DigitalTwinPage.tsx)
10. [PowerGraphCanvas.tsx](D:/Projects/WEB/EQM/EQM/frontend/src/features/digitalTwin/PowerGraphCanvas.tsx)
11. [db/base.py](D:/Projects/WEB/EQM/EQM/backend/app/db/base.py) и [db/session.py](D:/Projects/WEB/EQM/EQM/backend/app/db/session.py)
12. Четыре document models/schemas/routers.
13. [core.py](D:/Projects/WEB/EQM/EQM/backend/app/models/core.py)
14. [operations.py](D:/Projects/WEB/EQM/EQM/backend/app/models/operations.py)
15. [ipam.py](D:/Projects/WEB/EQM/EQM/backend/app/models/ipam.py)
16. [io.py](D:/Projects/WEB/EQM/EQM/backend/app/models/io.py)
17. [access.py](D:/Projects/WEB/EQM/EQM/backend/app/core/access.py)
18. [App.tsx](D:/Projects/WEB/EQM/EQM/frontend/src/App.tsx) и [nav.ts](D:/Projects/WEB/EQM/EQM/frontend/src/navigation/nav.ts)
19. [vite.config.ts](D:/Projects/WEB/EQM/EQM/frontend/vite.config.ts)
20. [build-offline-bundle.ps1](D:/Projects/WEB/EQM/EQM/deploy/build-offline-bundle.ps1)
21. [EQM_DB_ERD.md](D:/Projects/WEB/EQM/EQM/docs/EQM_DB_ERD.md)
Новый CAD не проектировался; отчёт фиксирует только текущее состояние репозитория.


11:15 AM