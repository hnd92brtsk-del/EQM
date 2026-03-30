export type MainEquipmentObjectSymbolKind =
  | "actuator_electric"
  | "actuator_hydraulic"
  | "actuator_manual"
  | "actuator_pneumatic"
  | "actuator_solenoid"
  | "airlift"
  | "autoclave_pox"
  | "cell_electrowinning"
  | "centrifuge_sedimentation"
  | "clarifier_lamella"
  | "classifier_air"
  | "classifier_hydrocyclone"
  | "classifier_hydrocyclone_cluster"
  | "classifier_spiral"
  | "column_ion_exchange"
  | "column_pulsation"
  | "conveying_pneumatic"
  | "conveyor_apron"
  | "conveyor_belt"
  | "conveyor_scraper"
  | "conveyor_screw"
  | "crusher_cone_fine"
  | "crusher_cone_medium"
  | "crusher_gyratory"
  | "crusher_hammer"
  | "crusher_jaw"
  | "crusher_roll"
  | "cyclone_thickening"
  | "dryer_flash"
  | "dryer_rotary"
  | "dryer_spray"
  | "elevator_bucket"
  | "extractor_centrifugal"
  | "fan_exhauster"
  | "feeder_apron"
  | "feeder_belt_scale"
  | "feeder_disc"
  | "feeder_reciprocating"
  | "feeder_screw"
  | "feeder_vibratory"
  | "feeder_weigh_hopper"
  | "filter_belt_vacuum"
  | "filter_disc_vacuum"
  | "filter_drum_vacuum"
  | "filter_press_chamber"
  | "filter_press_tower"
  | "flotation_column"
  | "flotation_mechanical"
  | "flotation_pneumatic_column"
  | "flotation_pneumomechanical"
  | "furnace_fluidized_bed"
  | "heap_leach_pad"
  | "hpgr"
  | "kiln_rotary"
  | "mill_ag"
  | "mill_ball"
  | "mill_rod"
  | "mill_sag"
  | "mill_vertical"
  | "mill_vibratory"
  | "mixer_settler"
  | "mixer_static"
  | "motor_electric"
  | "pipeline_recirculation"
  | "pond_settling"
  | "pump_centrifugal_process"
  | "pump_diaphragm"
  | "pump_dosing_liquid"
  | "pump_drainage"
  | "pump_metering"
  | "pump_multistage"
  | "pump_plunger"
  | "pump_reagent_dosing"
  | "pump_slurry"
  | "pump_vacuum"
  | "pump_vertical_sump"
  | "reactor_biox"
  | "reactor_leach_tank"
  | "rectifier"
  | "sampler_auto"
  | "scale_truck_rail"
  | "screen_arc"
  | "screen_fine"
  | "screen_resonance"
  | "screen_trommel"
  | "screen_vibrating_inertial"
  | "station_compressor"
  | "station_flocculant"
  | "station_oil"
  | "station_ph_regulator"
  | "station_tailings_pump"
  | "station_water_pump"
  | "system_cathode_wash"
  | "tank_bioleach"
  | "tank_conditioner"
  | "tank_day"
  | "tank_electrolyte_head"
  | "tank_sump_general"
  | "thickener_paste"
  | "thickener_radial"
  | "thickener_tailings"
  | "valve_ball"
  | "valve_butterfly"
  | "valve_check"
  | "valve_control"
  | "valve_knife_gate"
  | "valve_pinch"
  | "valve_relief"
  | "washer_ccd";

export type MainEquipmentObjectSymbolEntry = {
  id: number;
  code: string;
  name: string;
  libraryKey: string;
  kind: MainEquipmentObjectSymbolKind;
};

export function makeMainEquipmentObjectLibraryKey(code: string): string {
  return `me_${code.replace(/[^0-9a-z]+/gi, '_').replace(/^_+|_+$/g, '')}`;
}

export const MAIN_EQUIPMENT_OBJECT_SYMBOLS: MainEquipmentObjectSymbolEntry[] = [
  { id: 262, code: "1.1", name: "Щёковая дробилка", libraryKey: "me_1_1", kind: "crusher_jaw" },
  { id: 356, code: "1.2.1", name: "ККД (крупного дробления)", libraryKey: "me_1_2_1", kind: "crusher_gyratory" },
  { id: 357, code: "1.2.2", name: "КСД (среднего дробления)", libraryKey: "me_1_2_2", kind: "crusher_cone_medium" },
  { id: 358, code: "1.2.3", name: "КМД (мелкого дробления)", libraryKey: "me_1_2_3", kind: "crusher_cone_fine" },
  { id: 264, code: "1.3", name: "Молотковая (роторная) дробилка", libraryKey: "me_1_3", kind: "crusher_hammer" },
  { id: 265, code: "1.4", name: "Валковая дробилка", libraryKey: "me_1_4", kind: "crusher_roll" },
  { id: 266, code: "1.5", name: "Высокого давления мельница (ВДРМ / HPGR)", libraryKey: "me_1_5", kind: "hpgr" },
  { id: 267, code: "2.1", name: "Инерционный грохот (вибрационный)", libraryKey: "me_2_1", kind: "screen_vibrating_inertial" },
  { id: 268, code: "2.2", name: "Резонансный грохот", libraryKey: "me_2_2", kind: "screen_resonance" },
  { id: 269, code: "2.3", name: "Бурат (барабанный грохот)", libraryKey: "me_2_3", kind: "screen_trommel" },
  { id: 270, code: "2.4", name: "Дуговое сито (DSM / дуговое сито)", libraryKey: "me_2_4", kind: "screen_arc" },
  { id: 271, code: "2.5", name: "Высокочастотный грохот (Fine Screen)", libraryKey: "me_2_5", kind: "screen_fine" },
  { id: 272, code: "3.1", name: "Шаровая мельница", libraryKey: "me_3_1", kind: "mill_ball" },
  { id: 273, code: "3.2", name: "Стержневая мельница", libraryKey: "me_3_2", kind: "mill_rod" },
  { id: 274, code: "3.3", name: "Мельница самоизмельчения (МСИ / AG)", libraryKey: "me_3_3", kind: "mill_ag" },
  { id: 275, code: "3.4", name: "Мельница полусамоизмельчения (МПСИ / SAG)", libraryKey: "me_3_4", kind: "mill_sag" },
  { id: 276, code: "3.5", name: "Вертикальная мельница (IsaMill, Vertimill)", libraryKey: "me_3_5", kind: "mill_vertical" },
  { id: 277, code: "3.6", name: "Вибрационная мельница", libraryKey: "me_3_6", kind: "mill_vibratory" },
  { id: 278, code: "4.1", name: "Спиральный классификатор", libraryKey: "me_4_1", kind: "classifier_spiral" },
  { id: 279, code: "4.2", name: "Гидроциклон", libraryKey: "me_4_2", kind: "classifier_hydrocyclone" },
  { id: 280, code: "4.3", name: "Батарея гидроциклонов", libraryKey: "me_4_3", kind: "classifier_hydrocyclone_cluster" },
  { id: 281, code: "4.4", name: "Классификатор с воздушной сепарацией (воздушный)", libraryKey: "me_4_4", kind: "classifier_air" },
  { id: 282, code: "5.1", name: "Механическая флотомашина", libraryKey: "me_5_1", kind: "flotation_mechanical" },
  { id: 283, code: "5.2", name: "Пневматическая флотомашина (колонная)", libraryKey: "me_5_2", kind: "flotation_pneumatic_column" },
  { id: 284, code: "5.3", name: "Пневмомеханическая флотомашина", libraryKey: "me_5_3", kind: "flotation_pneumomechanical" },
  { id: 285, code: "5.4", name: "Флотационная колонна", libraryKey: "me_5_4", kind: "flotation_column" },
  { id: 359, code: "5.5.1", name: "Бак-мешалка (кондиционер реагентов)", libraryKey: "me_5_5_1", kind: "tank_conditioner" },
  { id: 360, code: "5.5.2", name: "Дозатор реагентов (насос-дозатор)", libraryKey: "me_5_5_2", kind: "pump_reagent_dosing" },
  { id: 361, code: "5.5.3", name: "Расходный бак с подачей самотёком", libraryKey: "me_5_5_3", kind: "tank_day" },
  { id: 287, code: "5.6", name: "pH-регулятор (известковое молоко)", libraryKey: "me_5_6", kind: "station_ph_regulator" },
  { id: 288, code: "6.1", name: "Радиальный сгуститель (Thickener)", libraryKey: "me_6_1", kind: "thickener_radial" },
  { id: 289, code: "6.2", name: "Высокопроизводительный сгуститель (HRT / Paste Thickener)", libraryKey: "me_6_2", kind: "thickener_paste" },
  { id: 290, code: "6.3", name: "Ламельный (тонкослойный) отстойник", libraryKey: "me_6_3", kind: "clarifier_lamella" },
  { id: 291, code: "6.4", name: "Гидроциклон сгущающий", libraryKey: "me_6_4", kind: "cyclone_thickening" },
  { id: 292, code: "6.5", name: "Флокулянтная станция (система дозирования флокулянта)", libraryKey: "me_6_5", kind: "station_flocculant" },
  { id: 293, code: "7.1", name: "Барабанный вакуум-фильтр", libraryKey: "me_7_1", kind: "filter_drum_vacuum" },
  { id: 294, code: "7.2", name: "Дисковый вакуум-фильтр", libraryKey: "me_7_2", kind: "filter_disc_vacuum" },
  { id: 295, code: "7.3", name: "Ленточный вакуум-фильтр", libraryKey: "me_7_3", kind: "filter_belt_vacuum" },
  { id: 296, code: "7.4", name: "Фильтр-пресс камерный", libraryKey: "me_7_4", kind: "filter_press_chamber" },
  { id: 297, code: "7.5", name: "Гидрофол / Центрифуга осадительная", libraryKey: "me_7_5", kind: "centrifuge_sedimentation" },
  { id: 298, code: "7.6", name: "Пресс-фильтр (Tower Press / Vertical)", libraryKey: "me_7_6", kind: "filter_press_tower" },
  { id: 299, code: "8.1", name: "Барабанная сушилка", libraryKey: "me_8_1", kind: "dryer_rotary" },
  { id: 300, code: "8.2", name: "Вращающаяся трубчатая печь (ВТП / Rotary Kiln)", libraryKey: "me_8_2", kind: "kiln_rotary" },
  { id: 301, code: "8.3", name: "Аэрофонтанная сушилка (Flash Dryer)", libraryKey: "me_8_3", kind: "dryer_flash" },
  { id: 302, code: "8.4", name: "Распылительная сушилка", libraryKey: "me_8_4", kind: "dryer_spray" },
  { id: 303, code: "8.5", name: "Печь кипящего слоя (ПКС)", libraryKey: "me_8_5", kind: "furnace_fluidized_bed" },
  { id: 304, code: "9.1", name: "Чан-реактор выщелачивания с мешалкой (CIL/CIP/CSTR)", libraryKey: "me_9_1", kind: "reactor_leach_tank" },
  { id: 305, code: "9.2", name: "Автоклав высокого давления (POX / PAL)", libraryKey: "me_9_2", kind: "autoclave_pox" },
  { id: 306, code: "9.3", name: "Кучное выщелачивание (орошение кучи)", libraryKey: "me_9_3", kind: "heap_leach_pad" },
  { id: 307, code: "9.4", name: "Реактор биовыщелачивания (BIOX)", libraryKey: "me_9_4", kind: "reactor_biox" },
  { id: 308, code: "9.5", name: "Бактериальные чаны (Tank Bioleaching)", libraryKey: "me_9_5", kind: "tank_bioleach" },
  { id: 309, code: "9.6", name: "Промывная декантация (CCD)", libraryKey: "me_9_6", kind: "washer_ccd" },
  { id: 310, code: "10.1", name: "Смеситель-отстойник (Mixer-Settler)", libraryKey: "me_10_1", kind: "mixer_settler" },
  { id: 311, code: "10.2", name: "Пульсационная колонна", libraryKey: "me_10_2", kind: "column_pulsation" },
  { id: 312, code: "10.3", name: "Центробежный экстрактор (Podbielniak / CINC)", libraryKey: "me_10_3", kind: "extractor_centrifugal" },
  { id: 313, code: "10.4", name: "Ионообменная колонна (сорбция/десорбция)", libraryKey: "me_10_4", kind: "column_ion_exchange" },
  { id: 314, code: "11.1", name: "Электролизёр (ЭВ / Electrowinning cell)", libraryKey: "me_11_1", kind: "cell_electrowinning" },
  { id: 315, code: "11.2", name: "Выпрямительный агрегат (ТПС / Rectifier)", libraryKey: "me_11_2", kind: "rectifier" },
  { id: 316, code: "11.3", name: "Система промывки и съёма катодов", libraryKey: "me_11_3", kind: "system_cathode_wash" },
  { id: 317, code: "11.4", name: "Циркуляционный бак электролита (Head Tank)", libraryKey: "me_11_4", kind: "tank_electrolyte_head" },
  { id: 318, code: "12.1", name: "Центробежный насос для воды/растворов", libraryKey: "me_12_1", kind: "pump_centrifugal_process" },
  { id: 319, code: "12.2", name: "Пульповый (шламовый) насос центробежный", libraryKey: "me_12_2", kind: "pump_slurry" },
  { id: 320, code: "12.3", name: "Горизонтальный многоступенчатый насос", libraryKey: "me_12_3", kind: "pump_multistage" },
  { id: 321, code: "12.4", name: "Вертикальный насос (sump pump)", libraryKey: "me_12_4", kind: "pump_vertical_sump" },
  { id: 322, code: "12.5", name: "Диафрагменный насос (перистальтический)", libraryKey: "me_12_5", kind: "pump_diaphragm" },
  { id: 323, code: "12.6", name: "Поршневой (плунжерный) насос высокого давления", libraryKey: "me_12_6", kind: "pump_plunger" },
  { id: 324, code: "12.7", name: "Насос-дозатор (мембранный/плунжерный)", libraryKey: "me_12_7", kind: "pump_metering" },
  { id: 325, code: "12.8", name: "Эрлифт (пневматический подъём пульпы)", libraryKey: "me_12_8", kind: "airlift" },
  { id: 362, code: "13.1.1", name: "Шаровой кран", libraryKey: "me_13_1_1", kind: "valve_ball" },
  { id: 363, code: "13.1.2", name: "Шиберная задвижка (пульповая)", libraryKey: "me_13_1_2", kind: "valve_knife_gate" },
  { id: 364, code: "13.1.3", name: "Дисковый затвор (баттерфляй)", libraryKey: "me_13_1_3", kind: "valve_butterfly" },
  { id: 365, code: "13.1.4", name: "Регулирующий клапан (седельный / cage)", libraryKey: "me_13_1_4", kind: "valve_control" },
  { id: 366, code: "13.1.5", name: "Пинч-клапан (шланговый)", libraryKey: "me_13_1_5", kind: "valve_pinch" },
  { id: 367, code: "13.1.6", name: "Обратный клапан", libraryKey: "me_13_1_6", kind: "valve_check" },
  { id: 368, code: "13.1.7", name: "Предохранительный клапан", libraryKey: "me_13_1_7", kind: "valve_relief" },
  { id: 369, code: "13.2.1", name: "Ручной привод (маховик/редуктор)", libraryKey: "me_13_2_1", kind: "actuator_manual" },
  { id: 370, code: "13.2.2", name: "Электрический привод (МЭО/МЭП)", libraryKey: "me_13_2_2", kind: "actuator_electric" },
  { id: 371, code: "13.2.3", name: "Пневматический привод + электропневмопозиционер", libraryKey: "me_13_2_3", kind: "actuator_pneumatic" },
  { id: 372, code: "13.2.4", name: "Гидравлический привод", libraryKey: "me_13_2_4", kind: "actuator_hydraulic" },
  { id: 373, code: "13.2.5", name: "Соленоидный (электромагнитный)", libraryKey: "me_13_2_5", kind: "actuator_solenoid" },
  { id: 328, code: "14.1", name: "Пластинчатый питатель (апрон)", libraryKey: "me_14_1", kind: "feeder_apron" },
  { id: 329, code: "14.2", name: "Вибрационный питатель", libraryKey: "me_14_2", kind: "feeder_vibratory" },
  { id: 330, code: "14.3", name: "Лотковый питатель с переменным ходом", libraryKey: "me_14_3", kind: "feeder_reciprocating" },
  { id: 331, code: "14.4", name: "Шнековый дозатор (volumetric / gravimetric)", libraryKey: "me_14_4", kind: "feeder_screw" },
  { id: 332, code: "14.5", name: "Ленточный дозатор (конвейерные весы)", libraryKey: "me_14_5", kind: "feeder_belt_scale" },
  { id: 333, code: "14.6", name: "Бункерные весы (loss-in-weight / batch)", libraryKey: "me_14_6", kind: "feeder_weigh_hopper" },
  { id: 334, code: "14.7", name: "Дисковый питатель", libraryKey: "me_14_7", kind: "feeder_disc" },
  { id: 335, code: "14.8", name: "Насос-дозатор жидких реагентов", libraryKey: "me_14_8", kind: "pump_dosing_liquid" },
  { id: 336, code: "15.1", name: "Ленточный конвейер", libraryKey: "me_15_1", kind: "conveyor_belt" },
  { id: 337, code: "15.2", name: "Пластинчатый конвейер (апрон)", libraryKey: "me_15_2", kind: "conveyor_apron" },
  { id: 338, code: "15.3", name: "Шнековый конвейер", libraryKey: "me_15_3", kind: "conveyor_screw" },
  { id: 339, code: "15.4", name: "Скребковый конвейер", libraryKey: "me_15_4", kind: "conveyor_scraper" },
  { id: 340, code: "15.5", name: "Ковшовый элеватор (нория)", libraryKey: "me_15_5", kind: "elevator_bucket" },
  { id: 341, code: "15.6", name: "Пневмотранспорт (трубопроводный)", libraryKey: "me_15_6", kind: "conveying_pneumatic" },
  { id: 342, code: "16.1", name: "Сгуститель хвостов (Tailings Thickener)", libraryKey: "me_16_1", kind: "thickener_tailings" },
  { id: 343, code: "16.2", name: "Насосная станция хвостопровода", libraryKey: "me_16_2", kind: "station_tailings_pump" },
  { id: 344, code: "16.3", name: "Насосная станция оборотной воды", libraryKey: "me_16_3", kind: "station_water_pump" },
  { id: 345, code: "16.4", name: "Прудок-отстойник (накопитель)", libraryKey: "me_16_4", kind: "pond_settling" },
  { id: 346, code: "16.5", name: "Дренажный насос (зумпфовый)", libraryKey: "me_16_5", kind: "pump_drainage" },
  { id: 347, code: "16.6", name: "Система оборотного водоснабжения (трубопровод)", libraryKey: "me_16_6", kind: "pipeline_recirculation" },
  { id: 348, code: "17.1", name: "Компрессорная станция (воздух КИП и автоматики)", libraryKey: "me_17_1", kind: "station_compressor" },
  { id: 349, code: "17.2", name: "Маслостанция (гидростанция)", libraryKey: "me_17_2", kind: "station_oil" },
  { id: 350, code: "17.3", name: "Ёмкость (бак, зумпф, чан)", libraryKey: "me_17_3", kind: "tank_sump_general" },
  { id: 351, code: "17.4", name: "Весы автомобильные / железнодорожные", libraryKey: "me_17_4", kind: "scale_truck_rail" },
  { id: 352, code: "17.5", name: "Пробоотборник (автоматический)", libraryKey: "me_17_5", kind: "sampler_auto" },
  { id: 353, code: "17.6", name: "Трубопроводный смеситель (статический / инжекционный)", libraryKey: "me_17_6", kind: "mixer_static" },
  { id: 354, code: "17.7", name: "Вентилятор / Дымосос (технологический)", libraryKey: "me_17_7", kind: "fan_exhauster" },
  { id: 355, code: "17.8", name: "Вакуум-насос (для фильтров)", libraryKey: "me_17_8", kind: "pump_vacuum" },
  { id: 374, code: "17.9", name: "Электродвигатель", libraryKey: "me_17_9", kind: "motor_electric" },
];

export const MAIN_EQUIPMENT_OBJECT_SYMBOL_BY_CODE = new Map(MAIN_EQUIPMENT_OBJECT_SYMBOLS.map((item) => [item.code, item] as const));
export const MAIN_EQUIPMENT_OBJECT_SYMBOL_BY_ID = new Map(MAIN_EQUIPMENT_OBJECT_SYMBOLS.map((item) => [item.id, item] as const));
export const MAIN_EQUIPMENT_OBJECT_SYMBOL_BY_KEY = new Map(MAIN_EQUIPMENT_OBJECT_SYMBOLS.map((item) => [item.libraryKey, item] as const));

export function getMainEquipmentObjectSymbolByCode(code?: string | null) {
  return code ? MAIN_EQUIPMENT_OBJECT_SYMBOL_BY_CODE.get(code) || null : null;
}

export function getMainEquipmentObjectSymbolById(id?: number | null) {
  return typeof id === "number" ? MAIN_EQUIPMENT_OBJECT_SYMBOL_BY_ID.get(id) || null : null;
}

export function getMainEquipmentObjectSymbolByKey(key?: string | null) {
  return key ? MAIN_EQUIPMENT_OBJECT_SYMBOL_BY_KEY.get(key) || null : null;
}

export function resolveMainEquipmentLibraryKey(args: {
  id?: number | null;
  code?: string | null;
  libraryKey?: string | null;
}) {
  const explicitKey = args.libraryKey?.trim();
  if (explicitKey && explicitKey !== "generic") {
    return explicitKey;
  }
  const byId = getMainEquipmentObjectSymbolById(args.id);
  if (byId) {
    return byId.libraryKey;
  }
  const byCode = getMainEquipmentObjectSymbolByCode(args.code);
  if (byCode) {
    return byCode.libraryKey;
  }
  if (args.code?.trim()) {
    return makeMainEquipmentObjectLibraryKey(args.code);
  }
  return explicitKey || null;
}
