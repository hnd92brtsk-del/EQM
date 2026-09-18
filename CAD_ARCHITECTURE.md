# EQM CAD — целевая архитектура встроенного инженерного редактора

- Статус: **Target Architecture / проектная спецификация**
- Версия документа: **0.1**
- Дата: **18.09.2026**
- Базовый проект: **EQM v1.1.19**
- Базовая ревизия БД: **0050_add_main_equipment_drive_to_technological_equipment**
- Основание: `Architecture.md`, `CAD_DISCOVERY_REPORT.md`

> Этот документ описывает целевую архитектуру нового CAD-подсистемы EQM. Он не является описанием текущего состояния. Текущее состояние существующих редакторов зафиксировано отдельно в `CAD_DISCOVERY_REPORT.md`.

---

## 1. Назначение

EQM CAD — встроенный 2D schematic CAD/workspace для инженерных схем внутри on-premise EQM.

Цель подсистемы — заменить разрозненные редакторы Network Map, Serial Map, P&ID и часть графового UI Digital Twin единым editor engine с общей моделью документа, единым UX, общей системой команд, слоёв, привязок к данным, сохранения, версионирования, аудита и диагностики.

Редактор должен восприниматься пользователем как самостоятельное desktop-подобное рабочее пространство внутри EQM: верхнее меню и контекстная панель инструментов, вертикальная панель инструментов, панели Symbols/Data/Layers слева, основной canvas по центру, Inspector/Data/Links/Diagnostics справа и status bar снизу.

EQM CAD является **схематическим инженерным CAD**, а не механическим/геометрическим CAD уровня AutoCAD/SolidWorks. В первой версии он не обязан поддерживать DWG, полноценные геометрические constraints, 3D, BIM или realtime collaborative editing.

---

## 2. Исходное состояние и причины замены

На момент проектирования в EQM нет общего editor engine:

- Network Map использует собственный inline SVG, Pointer Events и ручную state machine;
- P&ID использует React Flow, а diagram JSON хранится на файловой системе;
- Serial Map существует в двух реализациях: legacy SVG и v2 React Flow;
- Digital Twin совмещает HTML5 drag-and-drop, DOM и собственный SVG power graph;
- pan/zoom, selection, history, clipboard, minimap, dirty/save state и inspector реализованы несколько раз независимо;
- Network копирует часть бизнес-данных в document JSON, поэтому данные могут устаревать относительно PostgreSQL;
- optimistic locking фактически отсутствует: `row_version` есть физически, но не участвует в update contract;
- Serial хранит history внутри документа;
- P&ID хранит diagram JSON вне PostgreSQL;
- frontend/backend document contracts местами расходятся;
- backend engineering routes не везде используют фактический `SpaceKey.engineering` access control.

Новый CAD не должен продолжать эти паттерны.

---

## 3. Архитектурные принципы

### 3.1. CAD не является источником истины для бизнес-данных

CAD хранит:

- геометрию;
- визуальное состояние;
- слои;
- стили;
- topology/connector structure;
- ссылки на реальные EQM entities;
- ограниченный immutable snapshot для fallback/истории.

CAD **не должен** хранить актуальные IP, VLAN, manufacturer, model, I/O values, location и другие предметные поля как независимый источник истины.

Актуальные данные разрешаются через EQM API/Entity Resolver.

```text
CAD element
    │
    │ binding
    ▼
Entity Resolver
    │
    ├─ Equipment / Cabinet / Assembly
    ├─ Technological Equipment
    ├─ Main Equipment
    ├─ IPAM
    └─ I/O
          │
          ▼
      PostgreSQL
```

### 3.2. Domain Entity, CAD Element и Render Object разделены

```text
Domain Entity
    ↓ binding
CAD Element
    ↓ renderer adapter
Render Object
```

Canvas не должен знать, что такое Siemens CPU, VLAN или клапан. Core оперирует `CadElement`, `CadPort`, `CadConnector`, `CadBinding`. Domain adapters интерпретируют EQM entities. Renderer интерпретирует geometry/style.

### 3.3. React не является scene graph

React отвечает за application UI:

- menus;
- toolbar;
- docks;
- inspector;
- dialogs;
- document tabs;
- status bar.

Перемещение объекта мышью не должно обновлять React tree на каждом `pointermove`.

Runtime interaction flow:

```text
Pointer event
    ↓
Active Tool
    ↓
CAD Editor / Transaction
    ↓
Document Store
    ↓
Renderer diff
    ↓
Pixi scene graph
```

### 3.4. Один editor engine, несколько профилей

Один CAD Core обслуживает разные инженерные DSL/профили:

- `generic`
- `network`
- `serial`
- `pid`
- `electrical`
- `io`
- позднее: `digital_twin` / `cabinet`

Профиль определяет доступные tools, symbol libraries, semantic connector types, validators, inspector extensions и entity providers.

### 3.5. Плагинная архитектура — compile-time в v1

CAD проектируется как plugin-ready subsystem, но v1 не загружает произвольный JavaScript третьих сторон во время runtime.

Причины:

- on-premise/offline deployment;
- security/supply-chain risk;
- отсутствие необходимости в runtime marketplace;
- упрощение version compatibility.

Плагины v1 регистрируются в build time через типизированный registry. Runtime plugin loading может быть добавлен позднее отдельным ADR.

### 3.6. Read endpoints не меняют состояние

Новый CAD запрещает side effects в `GET/list` routes. Миграции, schema upgrades и legacy conversion выполняются явными write-операциями или при следующем подтверждённом save, но не через скрытый commit во время чтения.

---

## 4. Решение по размещению модуля

### 4.1. Первая стадия: внутренний изолированный модуль

Поскольку текущий frontend не является npm workspace и `packages/` отсутствует, v1 не должен начинаться с перестройки всего repository под monorepo.

Рекомендуемая структура:

```text
frontend/src/
├─ cad/                         # framework-agnostic-ish CAD subsystem
│  ├─ core/
│  ├─ model/
│  ├─ commands/
│  ├─ history/
│  ├─ geometry/
│  ├─ selection/
│  ├─ snapping/
│  ├─ routing/
│  ├─ plugins/
│  ├─ serialization/
│  ├─ renderer/
│  │  └─ pixi/
│  ├─ react/
│  ├─ testing/
│  └─ index.ts
│
└─ features/
   └─ cad/                      # EQM integration layer
      ├─ CadPage.tsx
      ├─ integration/
      │  ├─ EqmCadRepository.ts
      │  ├─ EqmEntityResolver.ts
      │  ├─ EqmSymbolProvider.ts
      │  └─ EqmPermissionProvider.ts
      ├─ profiles/
      │  ├─ generic/
      │  ├─ network/
      │  ├─ serial/
      │  ├─ pid/
      │  ├─ electrical/
      │  └─ io/
      ├─ panels/
      └─ api/
```

Dependency rule:

```text
features/cad  ──────► cad
      │
      ├─────────────► existing EQM API/context/theme/i18n

cad ─X─► features/*
cad ─X─► EQM domain API modules
cad ─X─► AuthContext
```

`frontend/src/cad` должен иметь один публичный API через `index.ts`.

### 4.2. Вторая стадия: физическое извлечение package

Когда API CAD Core стабилизируется, модуль может быть вынесен без изменения контрактов:

```text
packages/
└─ eqm-cad/
```

Позднее, если появится реальная необходимость:

```text
packages/
├─ eqm-cad-core/
├─ eqm-cad-renderer-pixi/
├─ eqm-cad-react/
└─ eqm-cad-profile-*/
```

Дробить систему на множество packages до стабилизации core API не требуется.

---

## 5. Высокоуровневая архитектура frontend

```text
                         EQM React SPA
                              │
        ┌─────────────────────┼──────────────────────┐
        │                     │                      │
     Menus/Toolbar          Docks                Inspector
        │                     │                      │
        └─────────────────────┼──────────────────────┘
                              │
                         CAD React Host
                              │
                         CadEditor API
                              │
       ┌──────────────────────┼────────────────────────┐
       │                      │                        │
     Tools                 Commands                  Store
       │                      │                        │
       └──────────────────────┼────────────────────────┘
                              │
                       Geometry Services
              ┌───────────────┼────────────────┐
              │               │                │
           Hit Test        Snapping          Routing
              │               │                │
              └───────────────┼────────────────┘
                              │
                         Pixi Renderer
                              │
                            WebGL
```

Сбоку от Core:

```text
CadEditor
   │
   ├─ DocumentRepository
   ├─ EntityResolver
   ├─ SymbolProvider
   ├─ PermissionProvider
   └─ PluginRegistry
         ▲
         │
   EQM integration adapters
```

---

## 6. Rendering engine

### 6.1. Основной renderer

Целевой renderer v1: **PixiJS 8 / WebGL**.

Причины:

- retained scene graph;
- независимость scene graph от React DOM;
- пригодность для большого количества интерактивных 2D objects;
- явное управление transforms, containers и render order;
- возможность culling и частичного обновления;
- отсутствие архитектурного ограничения WebGL в текущем deploy.

### 6.2. WebGPU, OffscreenCanvas и Workers

Для v1:

- WebGPU не является обязательным;
- OffscreenCanvas не является обязательным;
- Web Workers не являются обязательными для базового editor interaction;
- архитектура geometry/validation должна позволять вынести тяжёлые задачи в worker позже.

Перед production rollout должен быть зафиксирован browser/GPU support matrix. Если целевая эксплуатационная среда не гарантирует WebGL, решение по Pixi renderer необходимо пересмотреть до реализации renderer-heavy стадий.

### 6.3. Renderer contract

Core не должен импортировать Pixi types в document model.

```ts
interface CadRenderer {
  mount(host: HTMLElement): void
  unmount(): void
  sync(changes: CadDocumentChangeSet): void
  setViewport(viewport: CadViewport): void
  hitTest(point: CadPoint, options?: HitTestOptions): HitResult[]
  resize(width: number, height: number): void
}
```

---

## 7. Runtime Editor Core

Главный объект runtime:

```ts
interface CadEditor {
  readonly document: CadDocumentStore
  readonly history: CadHistory
  readonly selection: CadSelection
  readonly viewport: CadViewportController
  readonly plugins: CadPluginRegistry

  setTool(toolId: string): void
  execute(command: CadCommand): void
  undo(): void
  redo(): void
  save(): Promise<void>
  dispose(): void
}
```

React интеграция подписывается на агрегированное состояние через `useSyncExternalStore` или эквивалентный адаптер. Для pointer interaction отдельный Redux/Zustand store не требуется.

---

## 8. Модель CAD-документа

### 8.1. Database record и document JSON разделены

Metadata хранится колонками `cad_documents`.

`document_json` содержит только редакторскую модель.

Пример:

```json
{
  "schemaVersion": 1,
  "pages": [],
  "layers": [],
  "elements": [],
  "styles": {},
  "profileState": {},
  "extensions": {}
}
```

Не дублировать внутрь `document_json` поля `name`, `created_at`, `row_version`, `location_id`, которые уже являются database metadata.

### 8.2. Страница

```ts
interface CadPage {
  id: string
  name: string
  worldBounds?: CadRect
  background?: CadBackground
  grid: CadGridSettings
}
```

В v1 допускается один page на document, но schema должна поддерживать несколько страниц без breaking change.

### 8.3. Слои

```ts
interface CadLayer {
  id: string
  name: string
  order: number
  visible: boolean
  locked: boolean
  printable: boolean
  opacity: number
}
```

Минимальные действия:

- create;
- rename;
- reorder;
- hide/show;
- lock/unlock;
- move selection to layer.

### 8.4. Базовый element

```ts
interface CadElementBase {
  id: string
  kind: CadElementKind
  pageId: string
  layerId: string
  transform: CadTransform
  visible: boolean
  locked: boolean
  styleRef?: string
  bindings?: CadBinding[]
  extensions?: Record<string, unknown>
}
```

IDs создаются как collision-safe UUID. Не использовать `Math.random()`/`Date.now()` как production ID generator.

### 8.5. Минимальные element types

```ts
type CadElement =
  | CadSymbolElement
  | CadLineElement
  | CadPolylineElement
  | CadRectangleElement
  | CadEllipseElement
  | CadTextElement
  | CadConnectorElement
  | CadImageElement
  | CadGroupElement
```

Позднее:

- arc;
- bezier path;
- dimensions;
- frame/container;
- table/legend;
- plugin-specific compound elements.

### 8.6. Координаты

Geometry хранится в **world units**, не в screen pixels.

Viewport отвечает только за world-to-screen conversion.

Core не должен предполагать CSS pixel как физическую единицу документа. Профиль может объявлять интерпретацию `unitless`, `mm` или другую units policy.

---

## 9. Symbols и Ports

### 9.1. Symbol

```ts
interface CadSymbolDefinition {
  id: string
  version: number
  libraryId: string
  name: string
  geometry: CadSymbolGeometry
  ports: CadPortDefinition[]
  defaultStyle?: CadStyle
  allowedBindings?: CadEntityType[]
  extensions?: Record<string, unknown>
}
```

System symbols могут поставляться как version-controlled assets внутри приложения. Пользовательские/custom libraries добавляются позднее через backend storage.

### 9.2. Port

Port является first-class semantic object.

```ts
interface CadPortDefinition {
  id: string
  x: number
  y: number
  direction: 'input' | 'output' | 'bidirectional' | 'none'
  semanticType: string
  capacity?: number
}
```

Например:

- `ethernet`
- `fiber`
- `rs485`
- `ai`
- `ao`
- `di`
- `do`
- `power_ac`
- `power_dc`
- `process`
- `pneumatic`

Compatibility определяется profile/plugin validator, а не Core.

---

## 10. Connectors

Connector — полноценный CAD element, а не React Flow edge.

```ts
interface CadConnectorElement extends CadElementBase {
  kind: 'connector'
  source: CadEndpoint
  target: CadEndpoint
  routing: 'straight' | 'orthogonal' | 'polyline' | 'bezier'
  vertices: CadPoint[]
  semanticType: string
}
```

Endpoint может ссылаться на:

- symbol port;
- свободную world coordinate;
- junction;
- plugin-specific anchor.

Routing service должен быть заменяемым.

```ts
interface CadRouter {
  route(input: RouteRequest): CadPoint[]
}
```

v1 достаточно straight/polyline/orthogonal. Автоматический obstacle-aware routing может быть отдельной стадией.

---

## 11. Entity Binding

### 11.1. Основной контракт

```ts
interface CadEntityRef {
  entityType: string
  entityId: string
}

interface CadBinding {
  id: string
  role: string
  target: CadEntityRef
  snapshot?: CadBindingSnapshot
  snapshotAt?: string
}
```

### 11.2. Binding status

Resolver возвращает:

```ts
type CadBindingStatus =
  | 'resolved'
  | 'stale'
  | 'missing'
  | 'forbidden'
```

Поведение:

- `resolved` — entity доступна и актуальные данные получены;
- `stale` — entity существует, snapshot отличается от live representation;
- `missing` — ссылка больше не разрешается;
- `forbidden` — entity существует либо может существовать, но пользователь не имеет права получать её данные.

`forbidden` не должен раскрывать чувствительные детали source entity.

### 11.3. Snapshot

Snapshot не является источником истины. Он нужен только для:

- понятного отображения orphaned element;
- audit/history context;
- offline-safe fallback внутри уже загруженного документа.

Минимальный snapshot:

```json
{
  "displayName": "PLC-01",
  "secondaryText": "SIMATIC CPU 1211C"
}
```

Не копировать весь domain object.

### 11.4. Binding types текущего EQM

Canonical refs должны ссылаться на реальные устойчивые модели, а не на виртуальную строку `equipment-in-operation` как будто это отдельная таблица.

Минимальные типы:

```text
equipment_type
cabinet_item
assembly_item
cabinet
assembly
technological_equipment
main_equipment
io_signal
network_interface
ip_address
subnet
vlan
```

`equipment_in_operation` в текущем EQM является projection над `CabinetItem`/`AssemblyItem`. Resolver может предоставлять общий UI-класс `equipment_instance`, но canonical binding должен сохранять фактический source type и source id.

### 11.5. Ограничение текущей inventory model

`CabinetItem` и `AssemblyItem` содержат quantity и не образуют подтверждённую в discovery стабильную глобальную identity отдельной физической единицы оборудования.

Следствие:

> Новый CAD не должен обещать сохранение идентичности конкретного физического экземпляра при перемещении между cabinet/assembly, пока в предметной модели не появится стабильный equipment instance identity либо эквивалентный invariant.

До этого момента binding на `cabinet_item`/`assembly_item` считается binding на текущую учётную позицию/источник.

Автоматическое «следование» CAD binding за перемещением запрещено без отдельного подтверждённого механизма идентификации.

### 11.6. Entity Resolver

```ts
interface CadEntityResolver {
  search(request: EntitySearchRequest): Promise<EntitySearchResult>
  resolve(refs: CadEntityRef[]): Promise<ResolvedEntity[]>
}
```

Resolver должен поддерживать batch resolve.

Нельзя делать N HTTP-запросов для N элементов.

Пример backend API:

```http
POST /api/v1/cad/entities/resolve
POST /api/v1/cad/entities/search
```

### 11.7. Editing source data from CAD

Вкладка `Properties` редактирует CAD properties.

Вкладка `Data` показывает live domain data.

Изменение domain entity из CAD допускается только через существующий domain API/adaptor с обычными domain permissions и validation. После mutation resolver повторно загружает entity.

Нельзя изменять business-data путём записи нового snapshot в CAD document.

---

## 12. EQM-specific binding adapters

### 12.1. IPAM

Resolver должен скрывать сложность существующей модели:

```text
CabinetItem
   └─ EquipmentNetworkInterface
         └─ IPAddress
               └─ Subnet
                     └─ VLAN
```

Для assembly-backed network interface текущая модель использует polymorphic source/id без полноценного FK. CAD не должен дублировать эту логику; её инкапсулирует backend resolver/service.

### 12.2. I/O

Текущая I/O модель привязана к `cabinet_items.id`; I/O для assembly items в discovery не найден.

Поэтому IO profile/inspector обязан корректно показывать:

- доступные signals для cabinet-backed source;
- отсутствие/unsupported state для assembly-backed source;
- нельзя синтезировать несуществующие I/O связи.

### 12.3. P&ID

P&ID profile использует logical/process bindings:

- main equipment;
- technological equipment;
- equipment/current source where supported;
- instrument/signal references.

Legacy `sourceRef` преобразуется migration adapter-ом в canonical `CadBinding`.

---

## 13. Plugin API

### 13.1. Plugin

```ts
interface CadPlugin {
  id: string
  version: string
  activate(context: CadPluginContext): void
  deactivate?(): void
}
```

Plugin может регистрировать:

- tools;
- element renderers;
- validators;
- commands;
- inspector sections;
- symbol providers;
- connector semantic types;
- import/export adapters;
- profile extensions.

### 13.2. Profile

```ts
interface CadProfile {
  id: string
  displayName: string
  tools: string[]
  symbolLibraries: string[]
  connectorTypes: string[]
  validators: string[]
  entityProviders: string[]
  inspectorExtensions?: string[]
}
```

Profile — composition/configuration, а не отдельный editor engine.

### 13.3. Namespaced extensions

Plugin-specific data хранится только в namespaced extension sections:

```json
{
  "extensions": {
    "eqm.network": {},
    "eqm.pid": {}
  }
}
```

Core schema не должен расти каждым domain-specific полем.

---

## 14. Profiles

### 14.1. Generic

Базовые primitives:

- select/pan;
- line/polyline;
- rectangle/ellipse;
- text;
- image;
- groups;
- layers;
- generic connectors.

### 14.2. Network

Symbols:

- switch;
- router;
- firewall;
- server;
- workstation;
- PLC/network-capable equipment.

Connectors:

- ethernet;
- fiber;
- logical/other future types.

Entity providers:

- cabinet/assembly equipment;
- interfaces;
- IPAM;
- VLAN/subnet.

Network-specific validators остаются plugin-level:

- isolated nodes;
- interface compatibility;
- duplicate/conflicting addressing where resolvable;
- optional topology/policy diagnostics.

### 14.3. Serial

Domain fields/validators:

- protocol;
- baud rate;
- parity;
- data bits;
- stop bits;
- address;
- cable mark;
- gateway mapping.

Legacy `history` не переносится в новый document JSON.

### 14.4. P&ID

Symbols и semantics остаются domain-specific:

- equipment;
- instruments;
- process line;
- signal;
- control;
- electric.

P&ID symbols могут использовать SVG geometry, но runtime rendering проходит через CAD renderer/adapter.

### 14.5. Electrical / IO

Electrical и I/O не должны быть искусственно сведены в Network/P&ID. Они используют тот же engine, но свои ports, symbol libraries и validation rules.

### 14.6. Digital Twin

Digital Twin мигрируется последним.

Cabinet walls/rails/placement имеют особые constraints и не обязаны становиться обычными generic symbols в первой версии CAD.

На первом этапе допустимо:

- использовать CAD Core для power graph;
- сохранить специализированную cabinet layout domain layer;
- позже создать `digital_twin` profile/plugin, если unified interaction model подтвердит ценность.

---

## 15. Tools

Минимальный tool contract:

```ts
interface CadTool {
  id: string
  activate(ctx: CadToolContext): void
  deactivate(): void
  onPointerDown?(e: CadPointerEvent): void
  onPointerMove?(e: CadPointerEvent): void
  onPointerUp?(e: CadPointerEvent): void
  onKeyDown?(e: KeyboardEvent): void
  cancel?(): void
}
```

Core tools v1:

- Select;
- Pan;
- Rectangle;
- Ellipse;
- Line/Polyline;
- Text;
- Connector;
- Symbol placement;
- Eraser/Delete optional, Delete key remains primary.

---

## 16. Selection и transforms

Обязательные возможности:

- click selection;
- Shift/Ctrl multi-select;
- marquee selection;
- move;
- resize;
- rotate;
- duplicate;
- copy/paste;
- group/ungroup;
- align/distribute — phase 2;
- lock-aware selection;
- select all in layer/page.

Selection state является runtime UI state и не сериализуется в document.

---

## 17. Snapping

Snapping — отдельный service pipeline.

```ts
interface CadSnapProvider {
  getCandidates(context: SnapContext): SnapCandidate[]
}
```

v1 providers:

- grid snap;
- element bounds;
- centers;
- ports;
- connector endpoints.

phase 2:

- guides;
- equal spacing;
- angle snap;
- alignment/distribution hints.

Snapping settings являются user/editor preference, а не обязательной частью business semantics.

---

## 18. Spatial index и hit testing

Для editor-scale документов нельзя выполнять полный linear scan всех элементов на каждый pointermove.

Core должен иметь пространственный индекс bounding boxes.

```ts
interface CadSpatialIndex {
  insert(id: string, bounds: CadRect): void
  update(id: string, bounds: CadRect): void
  remove(id: string): void
  query(bounds: CadRect): string[]
}
```

Конкретная реализация может использовать R-tree/RBush или собственную структуру. Document model не зависит от библиотеки.

---

## 19. History и Command Pattern

Snapshot-history текущих editors не переносится.

Новый CAD использует команды/inverse operations.

```ts
interface CadCommand {
  id: string
  label: string
  execute(ctx: CadCommandContext): CadCommandResult
  undo(ctx: CadCommandContext): void
  redo?(ctx: CadCommandContext): void
}
```

Примеры:

- `CreateElementsCommand`
- `DeleteElementsCommand`
- `TransformElementsCommand`
- `ChangeElementPropertyCommand`
- `ConnectPortsCommand`
- `DisconnectCommand`
- `BindEntityCommand`
- `UnbindEntityCommand`
- `GroupCommand`
- `MoveToLayerCommand`

Pointer drag от down до up формирует **одну** command transaction.

History:

- runtime only;
- не сериализуется в `document_json`;
- configurable limit по количеству/памяти;
- очищается/перебазируется при reload конфликтного документа.

---

## 20. Dirty state и Autosave

`pointermove` не вызывает HTTP save.

```text
pointerdown
  ↓
interactive transaction
  ↓
pointermove × N
  ↓
local transient transform/render
  ↓
pointerup
  ↓
commit command
  ↓
queue document operations
  ↓
autosave debounce
```

Рекомендуемый стартовый debounce: **750–1000 ms** после последней committed command.

Состояния:

```text
clean
modified
saving
saved
conflict
error
read-only
```

Обязательны:

- save-in-flight serialization;
- queued follow-up save;
- explicit Save command;
- visible save status.

---

## 21. Concurrency

### 21.1. V1 strategy

Realtime collaboration не входит в v1.

Используется single-document optimistic concurrency.

Каждый response document содержит `row_version`.

Update request содержит `expected_version`.

Пример:

```json
{
  "expectedVersion": 17,
  "operations": [
    {
      "op": "transform",
      "elementId": "...",
      "transform": {"x": 120, "y": 80, "rotation": 0}
    }
  ]
}
```

Backend:

1. загружает active `cad_documents` row;
2. сравнивает `row_version`;
3. при mismatch возвращает `409 Conflict`;
4. применяет operations;
5. валидирует resulting document;
6. обновляет binding index;
7. пишет audit;
8. commit transaction;
9. возвращает новый `row_version`.

### 21.2. Conflict UX

При `409`:

- autosave останавливается;
- локальные изменения не выбрасываются;
- пользователь видит conflict banner/dialog;
- v1 предлагает:
  - Reload server version;
  - Save local version as copy;
  - Export local JSON;
- автоматический CRDT/OT merge не выполняется.

Phase 2 может добавить structured operation rebase, но только после появления реальных требований collaborative editing.

---

## 22. Backend domain

Рекомендуемая структура:

```text
backend/app/
├─ models/
│  └─ cad.py
├─ schemas/
│  └─ cad.py
├─ routers/
│  └─ cad.py
└─ services/
   └─ cad/
      ├─ documents.py
      ├─ operations.py
      ├─ entity_resolver.py
      ├─ bindings.py
      ├─ validation.py
      ├─ migrations.py
      ├─ symbols.py
      └─ assets.py
```

Нельзя превращать router в editor service. Router отвечает за HTTP/auth/DTO; document mutation и resolver logic находятся в services.

---

## 23. PostgreSQL model

### 23.1. `cad_documents`

Предлагаемые поля:

```text
id
name
description
profile
location_id FK nullable
owner_type nullable
owner_id nullable
schema_version
document_json JSONB
created_by_id FK
updated_by_id FK

TimestampMixin
SoftDeleteMixin
VersionMixin
```

Индексы:

- active/profile;
- active/location_id;
- owner_type/owner_id;
- updated_at;
- optional name search strategy consistent with project helpers.

### 23.2. `cad_entity_bindings`

Это **derived searchable index**, а не отдельный источник истины.

Canonical binding хранится в `document_json`. Таблица синхронно пересобирается/обновляется из resulting document в той же DB transaction.

Поля:

```text
id
document_id FK ON DELETE CASCADE
element_id
binding_id
binding_role
entity_type
entity_id
snapshot_name nullable
created_at
updated_at
```

Индексы:

```text
(document_id, element_id)
(entity_type, entity_id)
```

Use case:

> «На каких CAD-документах используется этот объект?»

Запрещено напрямую редактировать `cad_entity_bindings` без изменения `document_json`.

### 23.3. `cad_document_revisions`

Не является заменой undo/redo.

Хранит server-side checkpoints для:

- explicit checkpoint/manual save policy;
- import;
- migration;
- restore;
- optional administrative recovery.

Не создавать revision на каждый pointer action.

Поля:

```text
id
document_id
source_row_version
reason
snapshot_json
created_by_id
created_at
```

Retention должен быть configurable.

### 23.4. `cad_assets`

Для uploaded images/custom symbols:

```text
id UUID
document_id nullable
library_id nullable
kind
original_filename
storage_path
mime_type
size_bytes
sha256
sanitized
created_by_id
created_at
```

Бинарные данные не хранить в JSONB.

### 23.5. Symbol libraries

Phase 1 system symbols могут быть source-controlled.

Для пользовательских libraries/enterprise extensions позднее:

```text
cad_symbol_libraries
cad_symbols
```

Не блокировать MVP обязательной DB-редакцией symbol libraries.

---

## 24. API

Базовый prefix:

```text
/api/v1/cad
```

### 24.1. Documents

```http
GET    /cad/documents
POST   /cad/documents
GET    /cad/documents/{id}
PATCH  /cad/documents/{id}
DELETE /cad/documents/{id}
POST   /cad/documents/{id}/duplicate
POST   /cad/documents/{id}/restore
```

### 24.2. Entity integration

```http
POST /cad/entities/search
POST /cad/entities/resolve
GET  /cad/entities/{entity_type}/{entity_id}/usage
```

`resolve` — batch endpoint.

### 24.3. Import/export

```http
POST /cad/documents/import
GET  /cad/documents/{id}/export/json
```

SVG/PNG/PDF export добавляются отдельными capabilities, а не обещаются базовым CRUD API.

### 24.4. Assets

```http
POST   /cad/assets
GET    /cad/assets/{id}
DELETE /cad/assets/{id}
```

### 24.5. Revisions

```http
GET  /cad/documents/{id}/revisions
POST /cad/documents/{id}/revisions
```

---

## 25. API contract и TypeScript/Pydantic consistency

Текущая система имеет риск расхождения frontend/backend схем. Новый CAD не должен поддерживать две вручную синхронизируемые копии core contract.

Целевой подход:

1. Pydantic DTO определяют HTTP contract.
2. FastAPI/OpenAPI является источником API schema.
3. TypeScript API types генерируются из OpenAPI в CI/build step либо отдельным checked-in generation step.
4. CAD document schema имеет `schemaVersion` и runtime import validation.
5. Изменение backend schema, generated types и tests входит в одну итерацию.

Для local/imported CAD JSON рекомендуется runtime schema validation. Конкретная библиотека выбирается при реализации, но ручные неполные type guards не должны быть единственной защитой.

---

## 26. Authorization

Новый CAD router использует именно space-based access control.

```text
read CAD document  -> require_space_access(engineering, read)
create/update      -> require_space_access(engineering, write)
delete/admin ops   -> policy согласно существующей RBAC модели
```

Нельзя повторять текущий паттерн, при котором frontend использует `engineering`, а backend router проверяет только общую роль.

Entity Resolver обязан отдельно учитывать доступ к source domain entities. Если source entity недоступна, binding status = `forbidden`.

Digital Twin/cabinet integration должна иметь явно описанную permission policy; нельзя использовать read permission для endpoint, который создаёт/модифицирует data.

---

## 27. Audit

Audit granularity v1:

Писать отдельные audit events для:

- create document;
- update document batch;
- delete/restore;
- duplicate;
- import;
- migration;
- restore revision;
- binding add/remove/rebind;
- custom symbol/asset lifecycle;
- explicit export, если это требуется политикой эксплуатации.

Не писать отдельный audit row на каждый pixel drag frame.

Для update batch metadata содержит минимум:

```json
{
  "rowVersionBefore": 17,
  "rowVersionAfter": 18,
  "operationCount": 4,
  "operationTypes": ["transform", "property-change"],
  "affectedElementCount": 3
}
```

Если операция изменяет binding, audit должен содержать старую и новую `CadEntityRef` в безопасной форме.

---

## 28. Validation и diagnostics

Validation делится на уровни.

### 28.1. Structural validation

Core/backend:

- schema version;
- unique IDs;
- existing page/layer refs;
- valid transforms;
- connector endpoint references;
- no invalid cyclic group ownership;
- bounded/valid serialized values.

### 28.2. Profile validation

Plugins:

Network:

- port compatibility;
- orphaned topology;
- address/VLAN diagnostics.

Serial:

- protocol/address conflicts;
- baud mismatch;
- gateway mapping.

P&ID:

- semantic connection rules;
- missing references.

Electrical/I/O:

- port/signal compatibility;
- domain-specific constraints.

### 28.3. Incremental validation

Не запускать полный `JSON.stringify`/полный graph analysis на каждый pointermove.

Validation запускается:

- по committed command;
- только для затронутых elements/neighbor graph, где возможно;
- full validation — на load/import/save/check command.

Diagnostics отображаются отдельной панелью и могут ссылаться на element ID.

---

## 29. Document schema migrations

Каждый document содержит integer `schemaVersion`.

Migration pipeline:

```ts
interface CadDocumentMigration {
  from: number
  to: number
  migrate(input: unknown): unknown
}
```

Правила:

- миграции deterministic;
- покрыты fixtures/golden tests;
- read endpoint не пишет upgrade в БД;
- legacy import не меняет legacy source автоматически;
- persistence upgrade выполняется явным migration action или обычным version-checked save;
- backup/revision создаётся перед destructive migration.

---

## 30. Import / Export

### 30.1. Native format

Канонический interchange format:

```text
EQM CAD JSON
```

Файл содержит versioned document payload и минимальные metadata, достаточные для import.

### 30.2. Legacy adapters

Отдельные adapters:

- Network legacy JSON → CAD Network profile;
- Serial v2/legacy JSON → CAD Serial profile;
- P&ID diagram JSON → CAD P&ID profile;
- Digital Twin power graph → CAD graph subset, если выполняется миграция.

Adapters не являются частью Core.

### 30.3. SVG/PNG/PDF

План:

- SVG export — phase 2;
- PNG export — phase 2/3;
- PDF/print layout — phase 3.

### 30.4. DWG/DXF

Не входит в v1.

Если interoperability станет обязательным, добавить отдельный import/export adapter после фиксации требований к совместимости. Не внедрять полноценный DWG/DXF stack заранее.

---

## 31. Assets и SVG security

Поскольку текущий P&ID допускает SVG upload, новый CAD обязан считать SVG недоверенным input.

Минимальная policy:

- validate MIME + extension + size;
- sanitize SVG;
- запрещать scripts/event handlers;
- запрещать или контролировать external URL references;
- нормализовать dangerous `foreignObject` policy;
- вычислять SHA-256;
- хранить metadata в DB, bytes в persistent storage;
- не исполнять uploaded JS/plugin code.

Custom symbol geometry после sanitization должна преобразовываться в безопасное internal representation или загружаться renderer-ом только в разрешённом режиме.

---

## 32. UI workspace

Целевой shell:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ File  Edit  View  Insert  Engineering  Data                        │
├─────────────────────────────────────────────────────────────────────┤
│ Context toolbar                                                     │
├───┬────────────────────┬────────────────────────────┬───────────────┤
│ T │ Symbols / Data     │                            │ Inspector     │
│ o │ Layers / Documents │          CANVAS            │ Properties    │
│ o │                    │                            │ Data          │
│ l │                    │                            │ Links         │
│ s │                    │                            │ Diagnostics   │
├───┴────────────────────┴────────────────────────────┴───────────────┤
│ X/Y | Zoom | Grid | Snap | Selection | Save state                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 32.1. Document navigation

Постоянный широкий document manager слева не является обязательным.

Предпочтение:

- `File → Open`;
- document tabs;
- collapsible Documents dock;
- recent documents.

### 32.2. Inspector tabs

Минимум:

- `Properties` — CAD properties;
- `Data` — live EQM entity data;
- `Links` — bindings/ports/connections;
- `Diagnostics` — structural/profile warnings/errors.

### 32.3. Fullscreen workspace

CAD page должна уметь скрывать/сворачивать обычный EQM shell/sidebar без создания отдельного SPA.

---

## 33. Keyboard и interaction baseline

Минимальный набор:

```text
Ctrl/Cmd+S          Save
Ctrl/Cmd+Z          Undo
Ctrl/Cmd+Shift+Z    Redo
Ctrl/Cmd+Y          Redo
Ctrl/Cmd+C/V        Copy/Paste
Ctrl/Cmd+D          Duplicate
Delete/Backspace    Delete
Ctrl/Cmd+A          Select all
Esc                 Cancel current tool/action
Space + drag        Temporary pan
Mouse wheel         Zoom/pan according to final UX policy
```

Keyboard scope должен учитывать inputs/text editing и не перехватывать typing.

---

## 34. Performance architecture

### 34.1. Обязательные правила

- no full React render on pointermove;
- no full document clone per pointermove;
- no snapshot history of full arrays per command;
- no serialized history inside document;
- no full `JSON.stringify(document)` dirty check per interaction;
- renderer updates only dirty display objects;
- viewport culling для невидимых объектов;
- spatial index для hit test/marquee/snapping;
- batch Entity Resolver;
- incremental diagnostics;
- save only committed operation batches.

### 34.2. Provisional performance envelope

До появления эксплуатационных данных принять как инженерную цель, не как подтверждённый current requirement:

- 2,000 элементов + 3,000 connectors: целевые плавные interactive операции на обычной desktop workstation;
- 5,000 элементов + 8,000 connectors: документ должен оставаться редактируемым без архитектурного отказа;
- selection/marquee и pan/zoom не должны иметь O(N×E) алгоритмов на каждый pointermove;
- 1000 selected elements не должны создавать 1000 React editor components.

После первого vertical slice обязателен browser benchmark на реальном deployment-class PC. Численные цели пересматриваются по результату.

---

## 35. Persistence strategy

### 35.1. Operation batches over wire

Предпочтительный update contract — операции, а не отправка полного JSON после каждой команды.

Backend может внутри transaction собирать resulting full `document_json` и сохранять JSONB целиком на ранней стадии, но HTTP contract и history должны оставаться operation-oriented.

Это оставляет возможность позднее перейти на:

- selective JSONB updates;
- event/revision storage;
- structured conflict rebase;

без переписывания editor command model.

### 35.2. Full snapshot endpoints

Full document payload нужен для:

- GET/load;
- import/export;
- duplicate;
- restore revision;
- admin recovery.

---

## 36. Crash recovery

v1 recovery:

1. committed commands уходят через autosave;
2. save status всегда виден;
3. при unload с unsaved changes используется стандартное browser warning где допустимо;
4. локальный emergency draft допускается в IndexedDB, но не является canonical storage.

Если IndexedDB draft реализуется:

- key = document id + user id;
- хранить только последний unsaved operation queue/snapshot;
- очищать после подтверждённого save;
- не использовать `localStorage` для больших documents;
- recovery UI должен явно спрашивать пользователя.

Это phase 2, если MVP autosave окажется достаточным.

---

## 37. Testing strategy

### 37.1. Pure Core — Vitest

Обязательные unit tests:

- document mutations;
- command execute/undo/redo;
- transaction collapsing;
- selection;
- geometry;
- spatial index adapter;
- snapping;
- connector endpoint integrity;
- routing;
- schema migrations;
- plugin registration;
- binding normalization.

### 37.2. React integration

Testing Library:

- toolbar/tool switching;
- inspector state;
- permissions/read-only;
- conflict UI;
- save states;
- dialogs.

### 37.3. Real browser editor tests

Pointer/zoom/drag/canvas behaviour плохо проверяется только через jsdom.

Рекомендуется добавить browser E2E layer (например Playwright) для:

- drag/move;
- pan/zoom;
- marquee;
- connector creation;
- keyboard shortcuts;
- clipboard/duplicate;
- fullscreen;
- large document smoke/performance.

### 37.4. Backend — pytest

Обязательные tests:

- CRUD;
- engineering RBAC;
- row_version conflict 409;
- binding index transactionality;
- batch resolve;
- missing/forbidden binding behaviour;
- import schema validation;
- document migrations;
- audit;
- soft delete/restore;
- duplicate;
- asset validation.

### 37.5. Contract tests

CI должен обнаруживать drift между:

- Pydantic/OpenAPI;
- generated TS API types;
- persisted document schema fixtures.

---

## 38. Migration strategy from existing editors

Миграция выполняется постепенно. Big-bang rewrite запрещён.

### Phase 0 — Foundation

- создать CAD Core skeleton;
- CadPage route/shell;
- Pixi renderer spike;
- new CAD backend document model;
- true optimistic locking;
- engineering space RBAC;
- Entity Resolver skeleton;
- contract generation/validation baseline;
- tests/performance harness.

### Phase 1 — Generic vertical slice

Функциональность:

- pan/zoom/grid;
- select/multi/marquee;
- rectangle/text/symbol;
- equipment search/drop;
- canonical binding;
- inspector Properties/Data;
- move;
- command undo/redo;
- save/load;
- conflict handling.

Это первый production-quality acceptance slice.

### Phase 2 — Network profile

- network symbols/ports;
- IPAM binding;
- connectors;
- network validation;
- legacy Network importer;
- read-only migration preview;
- explicit migration/cutover.

Старый Network Map остаётся доступен для rollback до подтверждения parity.

### Phase 3 — Serial profile

- protocol semantics;
- address/baud validators;
- cable mark contract fix;
- import legacy + v2;
- удалить serialized history при migration;
- deprecate legacy localStorage fallback.

### Phase 4 — P&ID profile

- migrate React Flow nodes/edges;
- convert sourceRef → canonical bindings;
- перенести diagram canonical storage из filesystem JSON в CAD JSONB;
- сохранить file storage только для assets;
- внедрить symbol migration;
- решить orphan image cleanup policy.

`pid_processes` metadata сохраняется либо связывается с CAD document через owner reference; решение фиксируется migration ADR до cutover.

### Phase 5 — Digital Twin

Сначала power graph.

Cabinet physical layout мигрируется только если CAD constraints подтвердят пригодность. Специализированный placement layer может продолжить существовать поверх общего CAD Core.

### Phase 6 — Legacy removal

Только после:

- migrated data verification;
- parity tests;
- rollback window;
- user acceptance;
- backup validation;
- removal plan.

---

## 39. Legacy migration rules

1. Legacy document никогда не переписывается во время простого просмотра.
2. Migration создаёт новый CAD document либо explicit new version.
3. До cutover legacy source остаётся неизменённым.
4. Migration report содержит warnings/errors/unmapped fields.
5. Пользователь/администратор может открыть side-by-side preview.
6. После cutover старый editor сначала переводится в read-only, а не удаляется мгновенно.
7. Rollback возвращает route/source selection, но не пытается reverse-convert CAD document в legacy формат.

---

## 40. Integration with application shell

CAD route добавляется через существующие:

- `React.lazy`;
- `RequireSpace`;
- `navTree`;
- breadcrumbs;
- ThemeContext;
- i18next;
- AppNotifications.

Рекомендуемый route:

```text
/engineering/cad
/engineering/cad/:documentId
```

Legacy routes сохраняются на migration period.

Editor errors не должны использовать `window.alert/confirm` как основной UX; использовать единый MUI/dialog/notification layer.

---

## 41. Theme и localization

- CAD shell использует существующие MUI theme tokens/CSS variables.
- Core не содержит жёстко заданных RU/EN strings.
- Plugin/profile UI strings регистрируются через i18n resources.
- Canvas visual theme может иметь отдельные CAD palette tokens, но должен поддерживать light/dark workspace policy.

---

## 42. Security boundaries

### Backend is authoritative

Frontend validation — UX. Backend проверяет:

- authorization;
- schema;
- document size;
- operation types;
- entity resolver permissions;
- asset type/size;
- final structural invariants.

### Do not trust plugin/document JSON

- validate discriminators;
- reject unknown dangerous operations;
- cap nested sizes/array lengths;
- cap text lengths;
- sanitize URLs;
- do not evaluate code from document/extensions;
- avoid arbitrary HTML rendering.

### Size limits

Точный production limit должен быть согласован с Nginx/FastAPI configuration и реальным benchmark. Он не должен существовать только как frontend check.

---

## 43. Observability

Минимум логировать:

- document load failure;
- save failure;
- optimistic conflict;
- migration failure;
- resolver failure;
- asset validation failure;
- schema validation failure.

Не логировать полный CAD JSON по умолчанию.

Для performance debug допустимы development metrics:

- element count;
- visible element count;
- render/update time;
- validation time;
- save payload bytes;
- resolver batch size/latency.

---

## 44. Non-goals v1

В v1 **не входят**:

- realtime multi-user co-editing;
- CRDT/OT;
- 3D;
- mechanical CAD constraints;
- DWG/DXF compatibility;
- arbitrary runtime third-party JS plugins;
- cloud dependency;
- external SaaS rendering;
- automatic background rewrite всех legacy documents;
- full Digital Twin cabinet migration в первой итерации.

---

## 45. Ключевые решения по проблемам discovery

| Discovery problem | Target decision |
| --- | --- |
| Нет общего editor engine | Единый CAD Core + profiles/plugins |
| Network copies business data | Canonical Entity Binding + live resolver |
| P&ID diagram на filesystem | CAD JSONB становится canonical document storage; filesystem только для assets |
| Serial history в JSONB | History runtime only, не сериализуется |
| Last-write-wins | `row_version` в DTO + expectedVersion + HTTP 409 |
| GET/list может менять Serial DB | Read endpoints side-effect free |
| React Flow/SVG fragmentation | Pixi renderer + common geometry/command core |
| Нет common contract layer | Pydantic/OpenAPI → generated TS + runtime document validation |
| Engineering RBAC mismatch | `require_space_access(engineering, ...)` на CAD backend |
| Digital Twin ensure under read permission | Write effects требуют write permission |
| Нет editor tests | Core Vitest + browser E2E + backend pytest |
| Full document snapshots/history | Command/inverse operations |
| Нет viewport culling | renderer culling + spatial index |
| N requests к related domain data risk | batch Entity Resolver |
| Polymorphic weak FKs | Resolver encapsulates; CAD uses typed soft refs + derived binding index |

---

## 46. Первый vertical slice — Definition of Done

Первый slice считается завершённым только если реализовано всё ниже.

### UI

- `/engineering/cad/:id`;
- editor shell;
- fullscreen workspace mode;
- tool selection;
- Properties/Data inspector;
- visible save status.

### Canvas

- Pixi mount/unmount;
- grid;
- pan;
- zoom;
- select;
- multi-select;
- marquee;
- rectangle;
- text;
- generic symbol;
- move.

### Data integration

- equipment search через backend CAD resolver;
- drag/drop or place from Data panel;
- canonical `cabinet_item`/`assembly_item` binding;
- batch resolve;
- resolved/missing/forbidden status;
- live data shown in Data inspector.

### Commands

- create;
- delete;
- move;
- property change;
- bind/unbind;
- undo/redo.

### Persistence

- create/get/update CAD document;
- `row_version` в response;
- expectedVersion update;
- 409 conflict test + UI;
- autosave queue;
- manual save;
- JSON export.

### Security

- engineering read/write RBAC backend;
- read-only viewer;
- entity resolver permission checks.

### QA

- core unit tests;
- backend CRUD/concurrency/binding tests;
- at least one browser E2E for create→move→undo→save→reload;
- benchmark fixture.

Не добавлять Network/P&ID semantics до прохождения этого DoD.

---

## 47. Предварительный implementation backlog

Порядок разработки:

1. CAD contracts + `CadDocument` schema.
2. Backend `cad_documents` + migration + CRUD + true concurrency.
3. Frontend `cad` module skeleton/public API.
4. Pixi renderer spike.
5. Document Store + command engine.
6. Viewport/pan/zoom/grid.
7. Selection + transforms + spatial index.
8. React workspace shell.
9. Entity Resolver backend/frontend.
10. Generic symbol + binding.
11. Inspector.
12. Autosave/conflict UI.
13. Import/export JSON.
14. Browser E2E + benchmark.
15. Network profile.
16. Legacy Network migration adapter.
17. Serial profile.
18. P&ID profile.
19. Digital Twin evaluation.

---

## 48. ADRs, которые должны быть закрыты до соответствующих стадий

### ADR-CAD-001 — Renderer/browser support

Нужно зафиксировать:

- поддерживаемые browsers;
- minimum WebGL requirement;
- deployment-class hardware baseline.

До этого Pixi/WebGL считается целевым, но проверяемым решением.

### ADR-CAD-002 — Physical equipment identity

Нужно решить, требуется ли EQM стабильная identity отдельной физической единицы оборудования, переживающая movements между cabinet/assembly/warehouse.

Если да — это domain model change вне CAD Core.

### ADR-CAD-003 — P&ID process ownership

Нужно решить окончательную связь `pid_processes` и `cad_documents` при P&ID migration.

### ADR-CAD-004 — Custom symbol persistence

Когда custom libraries входят в scope, определить system vs user library lifecycle и DB/file representation.

### ADR-CAD-005 — Print/PDF units

Перед PDF/print phase определить page sizes, units, margins, DPI/vector policy.

---

## 49. Codex guardrails для реализации

Любой Codex task по CAD должен соблюдать:

1. Не менять legacy editor одновременно с созданием Core, если task явно не является migration step.
2. Не копировать Network/Serial/P&ID monolithic page в новый module.
3. Не использовать React state как per-frame canvas state.
4. Не добавлять business fields в core element schema.
5. Не хранить history в document JSON.
6. Не сохранять на каждый pointermove.
7. Не делать GET endpoints с commit/upgrade side effects.
8. Не обходить `SpaceKey.engineering` backend authorization.
9. Не создавать N+1 entity resolve requests.
10. Не использовать `Math.random()/Date.now()` как единственный element ID mechanism.
11. Не добавлять new source-of-truth для IPAM/I/O/equipment data.
12. Любое persisted schema change сопровождается migration + tests + schemaVersion policy.
13. Любой document update path покрывается optimistic concurrency test.
14. Любая legacy migration имеет fixture и не уничтожает original source.
15. После изменений соблюдать общие EQM release criteria: tests, i18n, version bump и deploy bundle freshness.

---

## 50. Архитектурный итог

Целевой CAD должен быть **встроенным в EQM, но архитектурно независимым от EQM**.

Он не является ещё одной страницей React Flow и не является новым набором ручных SVG handlers.

Граница системы выглядит так:

```text
EQM Application
    │
    ├─ React shell / MUI / i18n / RBAC
    │
    ├─ EQM CAD Integration
    │      ├─ repository
    │      ├─ entity resolver
    │      ├─ permissions
    │      └─ profile adapters
    │
    └─ CAD Engine
           ├─ document model
           ├─ commands/history
           ├─ tools
           ├─ geometry
           ├─ selection/snapping/routing
           ├─ plugin registry
           └─ Pixi renderer
```

Backend:

```text
FastAPI
  └─ /api/v1/cad
       ├─ documents
       ├─ operations/concurrency
       ├─ entity resolver
       ├─ bindings index
       ├─ assets
       └─ migrations
                │
                ▼
          PostgreSQL + persistent asset storage
```

Главный invariant:

> **CAD хранит инженерное представление и ссылки; EQM domain models остаются источником истины для оборудования, IPAM, I/O и других предметных данных.**

Такой boundary позволяет сначала использовать CAD как встроенный модуль текущего SPA, а затем — при реальной необходимости — физически извлечь его в отдельный package или самостоятельный продукт без переписывания core model и editor engine.
