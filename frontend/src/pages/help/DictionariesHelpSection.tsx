import { buildDomainHelpSection, type HelpLanguage } from "./builders";
import type { HelpSection } from "./types";

export function getDictionariesHelpSection(language: HelpLanguage, title: string): HelpSection {
  return buildDomainHelpSection(language, {
    id: "dictionaries",
    title,
    introKeywords: ["СЃРїСЂР°РІРѕС‡РЅРёРєРё", "РґРµСЂРµРІРѕ", "РёРµСЂР°СЂС…РёСЏ", "РїСЂРѕРёР·РІРѕРґРёС‚РµР»Рё", "Р»РѕРєР°С†РёРё"],
    intro: [
      {
        ru: "РЎРїСЂР°РІРѕС‡РЅРёРєРё РІ EQM РґРµР»СЏС‚СЃСЏ РЅР° РґРІР° С‚РёРїР°: РїР»РѕСЃРєРёРµ С‚Р°Р±Р»РёС‡РЅС‹Рµ Р·Р°РїРёСЃРё Рё РёРµСЂР°СЂС…РёС‡РµСЃРєРёРµ РґРµСЂРµРІСЊСЏ. РћС‚ РёС… РєР°С‡РµСЃС‚РІР° Р·Р°РІРёСЃСЏС‚ С„РѕСЂРјС‹ РІ РѕР±РѕСЂСѓРґРѕРІР°РЅРёРё, СЃРёРіРЅР°Р»РёР·Р°С†РёРё, IPAM Рё РїРµСЂСЃРѕРЅР°Р»Рµ, РїРѕСЌС‚РѕРјСѓ РїСЂР°РІРєРё Р·РґРµСЃСЊ РЅСѓР¶РЅРѕ РґРµР»Р°С‚СЊ РѕСЃРѕР±РµРЅРЅРѕ Р°РєРєСѓСЂР°С‚РЅРѕ.",
        en: "Dictionaries are either flat tables or hierarchical trees and they drive many other forms."
      },
      {
        ru: "Р•СЃР»Рё СЌРєСЂР°РЅ РїРѕРєР°Р·С‹РІР°РµС‚ РґРµСЂРµРІРѕ, СЌС‚Рѕ РѕР±С‹С‡РЅРѕ РѕР·РЅР°С‡Р°РµС‚ РїРѕРґРґРµСЂР¶РєСѓ РєРѕСЂРЅРµРІС‹С… Рё РґРѕС‡РµСЂРЅРёС… СѓР·Р»РѕРІ. Р•СЃР»Рё СЌРєСЂР°РЅ С‚Р°Р±Р»РёС‡РЅС‹Р№, РѕРЅ С‡Р°С‰Рµ СЃР»СѓР¶РёС‚ РґР»СЏ РєР°СЂС‚РѕС‡РµРє-СЃРїРёСЃРєРѕРІ СЃ СЃРѕСЂС‚РёСЂРѕРІРєРѕР№, С„РёР»СЊС‚СЂР°РјРё Рё РјСЏРіРєРёРј СѓРґР°Р»РµРЅРёРµРј.",
        en: "Tree screens usually support root and child nodes, while table screens focus on list-style CRUD."
      }
    ],
    screens: [
      {
        id: "dictionary-manufacturers",
        title: { ru: "РџСЂРѕРёР·РІРѕРґРёС‚РµР»Рё", en: "Manufacturers" },
        route: "/dictionaries/manufacturers",
        summary: {
          ru: "РЎРїСЂР°РІРѕС‡РЅРёРє РїСЂРѕРёР·РІРѕРґРёС‚РµР»РµР№ РѕСЂРіР°РЅРёР·РѕРІР°РЅ РєР°Рє РґРµСЂРµРІРѕ СЃС‚СЂР°РЅ, Р±СЂРµРЅРґРѕРІ Рё СЃРІСЏР·Р°РЅРЅС‹С… РєР°СЂС‚РѕС‡РµРє РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЏ. РћРЅ РЅСѓР¶РµРЅ РґР»СЏ РІС‹Р±РѕСЂР° Р±СЂРµРЅРґР° РІ РЅРѕРјРµРЅРєР»Р°С‚СѓСЂРµ Рё РґСЂСѓРіРёС… СЃРІСЏР·Р°РЅРЅС‹С… С„РѕСЂРјР°С….",
          en: "Manufacturers are organized as a tree of countries, brands, and manufacturer records."
        },
        actions: [
          {
            ru: "РСЃРїРѕР»СЊР·СѓР№С‚Рµ СЃРѕР·РґР°РЅРёРµ РЅР° РЅСѓР¶РЅРѕРј СѓСЂРѕРІРЅРµ РґРµСЂРµРІР°, РµСЃР»Рё РЅСѓР¶РЅРѕ РґРѕР±Р°РІРёС‚СЊ СЃС‚СЂР°РЅСѓ, Р±СЂРµРЅРґ РёР»Рё РєРѕРЅРєСЂРµС‚РЅРѕРіРѕ РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЏ РІ РїСЂР°РІРёР»СЊРЅС‹Р№ РєРѕРЅС‚РµРєСЃС‚.",
            en: "Create nodes at the correct tree level to preserve structure."
          }
        ],
        risks: [
          {
            ru: "РќРµРїСЂР°РІРёР»СЊРЅР°СЏ СЃС‚СЂСѓРєС‚СѓСЂР° РґРµСЂРµРІР° СѓСЃР»РѕР¶РЅСЏРµС‚ РІС‹Р±РѕСЂ РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЏ РІ РЅРѕРјРµРЅРєР»Р°С‚СѓСЂРµ Рё РѕС‚С‡С‘С‚Р°С….",
            en: "A bad tree structure complicates downstream selection and reporting."
          }
        ],
        keywords: ["РїСЂРѕРёР·РІРѕРґРёС‚РµР»Рё", "Р±СЂРµРЅРґ", "СЃС‚СЂР°РЅР°"]
      },
      {
        id: "dictionary-locations",
        title: { ru: "Р›РѕРєР°С†РёРё", en: "Locations" },
        route: "/dictionaries/locations",
        summary: {
          ru: "Р›РѕРєР°С†РёРё РїРѕСЃС‚СЂРѕРµРЅС‹ РєР°Рє РёРµСЂР°СЂС…РёС‡РµСЃРєРѕРµ РґРµСЂРµРІРѕ Рё РёСЃРїРѕР»СЊР·СѓСЋС‚СЃСЏ РїРѕС‡С‚Рё РІРѕ РІСЃРµС… СЌРєСЃРїР»СѓР°С‚Р°С†РёРѕРЅРЅС‹С… Рё РёРЅР¶РµРЅРµСЂРЅС‹С… РјРѕРґСѓР»СЏС….",
          en: "Locations are a hierarchical tree reused throughout the system."
        },
        actions: [
          {
            ru: "РЎРѕР·РґР°РІР°Р№С‚Рµ РґРѕС‡РµСЂРЅРёРµ СѓР·Р»С‹ С‡РµСЂРµР· РґРµР№СЃС‚РІРёРµ Сѓ СЂРѕРґРёС‚РµР»СЏ, РµСЃР»Рё С…РѕС‚РёС‚Рµ СЃРѕС…СЂР°РЅРёС‚СЊ РїСЂР°РІРёР»СЊРЅС‹Р№ РїСѓС‚СЊ Рё РёРµСЂР°СЂС…РёСЋ.",
            en: "Create child nodes from the intended parent to preserve the path."
          }
        ],
        risks: [
          {
            ru: "РР·РјРµРЅРµРЅРёРµ СЃС‚СЂСѓРєС‚СѓСЂС‹ Р»РѕРєР°С†РёР№ РІР»РёСЏРµС‚ РЅР° С„РёР»СЊС‚СЂС‹ Рё РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ РїСѓС‚РµР№ РІ С€РєР°С„Р°С…, РѕР±РѕСЂСѓРґРѕРІР°РЅРёРё, IPAM Рё С‚РµС…РЅРѕР»РѕРіРёС‡РµСЃРєРёС… РїСЂРѕС†РµСЃСЃР°С….",
            en: "Location structure changes ripple through many modules."
          }
        ],
        keywords: ["Р»РѕРєР°С†РёРё", "РґРµСЂРµРІРѕ Р»РѕРєР°С†РёР№", "location path"]
      },
      {
        id: "dictionary-main-equipment",
        title: { ru: "РћСЃРЅРѕРІРЅРѕРµ РѕР±РѕСЂСѓРґРѕРІР°РЅРёРµ", en: "Main equipment" },
        route: "/dictionaries/main-equipment",
        summary: {
          ru: "РћСЃРЅРѕРІРЅРѕРµ РѕР±РѕСЂСѓРґРѕРІР°РЅРёРµ вЂ” РёРµСЂР°СЂС…РёС‡РµСЃРєРѕРµ РґРµСЂРµРІРѕ РїСЂРѕРёР·РІРѕР»СЊРЅРѕР№ РіР»СѓР±РёРЅС‹. РЈСЂРѕРІРµРЅСЊ СѓР·Р»Р° РІС‹С‡РёСЃР»СЏРµС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РѕС‚ РІС‹Р±СЂР°РЅРЅРѕРіРѕ СЂРѕРґРёС‚РµР»СЏ.",
          en: "Main equipment is a hierarchy with automatically derived depth."
        },
        keywords: ["РѕСЃРЅРѕРІРЅРѕРµ РѕР±РѕСЂСѓРґРѕРІР°РЅРёРµ", "main equipment"]
      },
      {
        id: "dictionary-data-types",
        title: { ru: "РўРёРїС‹ РґР°РЅРЅС‹С…", en: "Data types" },
        route: "/dictionaries/data-types",
        summary: {
          ru: "РўРёРїС‹ РґР°РЅРЅС‹С… вЂ” РґРµСЂРµРІРѕ СЃ РїРѕРґРґРµСЂР¶РєРѕР№ РїРѕРґСЃРєР°Р·РєРё `tooltip`, РєРѕС‚РѕСЂР°СЏ РѕС‚РѕР±СЂР°Р¶Р°РµС‚СЃСЏ РїСЂРё РЅР°РІРµРґРµРЅРёРё РЅР° РёРјСЏ СѓР·Р»Р° РІ СЃРІСЏР·Р°РЅРЅС‹С… РјРµСЃС‚Р°С… РёРЅС‚РµСЂС„РµР№СЃР°.",
          en: "Data types are a tree and can carry a tooltip used in related UI."
        },
        actions: [
          {
            ru: "Р—Р°РїРѕР»РЅСЏР№С‚Рµ tooltip С‚Р°Рј, РіРґРµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏРј СЂРµР°Р»СЊРЅРѕ РЅСѓР¶РЅР° РїРѕРґСЃРєР°Р·РєР° РїРѕ СЃРјС‹СЃР»Сѓ С‚РёРїР°, Р° РЅРµ РїСЂРѕСЃС‚Рѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ РЅР°Р·РІР°РЅРёСЏ.",
            en: "Use the tooltip for meaningful clarification, not mere label duplication."
          }
        ],
        keywords: ["С‚РёРїС‹ РґР°РЅРЅС‹С…", "tooltip", "data types"]
      },
      {
        id: "dictionary-measurement-units",
        title: { ru: "Р•РґРёРЅРёС†С‹ РёР·РјРµСЂРµРЅРёСЏ", en: "Measurement units" },
        route: "/dictionaries/measurement-units",
        summary: {
          ru: "Р•РґРёРЅРёС†С‹ РёР·РјРµСЂРµРЅРёСЏ РІРµРґСѓС‚СЃСЏ РєР°Рє РґРµСЂРµРІРѕ Рё РёСЃРїРѕР»СЊР·СѓСЋС‚СЃСЏ С‚Р°Рј, РіРґРµ СЃСѓС‰РЅРѕСЃС‚Рё РґРѕР»Р¶РЅС‹ С…СЂР°РЅРёС‚СЊ РЅРѕСЂРјР°Р»РёР·РѕРІР°РЅРЅСѓСЋ РёРЅР¶РµРЅРµСЂРЅСѓСЋ РµРґРёРЅРёС†Сѓ.",
          en: "Measurement units are stored as a tree for normalized engineering units."
        },
        keywords: ["РµРґРёРЅРёС†С‹ РёР·РјРµСЂРµРЅРёСЏ", "measurement units"]
      },
      {
        id: "dictionary-signal-types",
        title: { ru: "РўРёРїС‹ СЃРёРіРЅР°Р»РѕРІ", en: "Signal types" },
        route: "/dictionaries/signal-types",
        summary: {
          ru: "РўРёРїС‹ СЃРёРіРЅР°Р»РѕРІ РїСЂРµРґСЃС‚Р°РІР»РµРЅС‹ РґРµСЂРµРІРѕРј Рё РЅСѓР¶РЅС‹ РґР»СЏ СѓРЅРёС„РёС†РёСЂРѕРІР°РЅРЅРѕР№ РєР»Р°СЃСЃРёС„РёРєР°С†РёРё СЃРёРіРЅР°Р»РѕРІ РІ РёРЅР¶РµРЅРµСЂРЅС‹С… СЃС†РµРЅР°СЂРёСЏС….",
          en: "Signal types are a tree used for unified signal classification."
        },
        keywords: ["С‚РёРїС‹ СЃРёРіРЅР°Р»РѕРІ", "signal types"]
      },
      {
        id: "dictionary-warehouses",
        title: { ru: "РЎРєР»Р°РґС‹", en: "Warehouses" },
        route: "/warehouses",
        summary: {
          ru: "РЎРєР»Р°РґС‹ вЂ” С‚Р°Р±Р»РёС‡РЅС‹Р№ СЃРїСЂР°РІРѕС‡РЅРёРє СЃРєР»Р°РґСЃРєРёС… РїР»РѕС‰Р°РґРѕРє СЃ РїСЂРёРІСЏР·РєРѕР№ Рє Р»РѕРєР°С†РёСЏРј, С„РёР»СЊС‚СЂР°РјРё Рё РјСЏРіРєРёРј СѓРґР°Р»РµРЅРёРµРј.",
          en: "Warehouses are a table-driven dictionary linked to locations."
        },
        related: [
          {
            ru: "РЎРІСЏР·Р°РЅРЅС‹Рµ СЌРєСЂР°РЅС‹: СЃРєР»Р°РґСЃРєРёРµ РїРѕР·РёС†РёРё Рё РґРІРёР¶РµРЅРёСЏ.",
            en: "Related screens: warehouse items and movements."
          }
        ],
        keywords: ["СЃРєР»Р°РґС‹", "warehouses"]
      },
      {
        id: "dictionary-equipment-categories",
        title: { ru: "РљР°С‚РµРіРѕСЂРёРё РѕР±РѕСЂСѓРґРѕРІР°РЅРёСЏ", en: "Equipment categories" },
        route: "/dictionaries/equipment-categories",
        summary: {
          ru: "РљР°С‚РµРіРѕСЂРёРё РѕР±РѕСЂСѓРґРѕРІР°РЅРёСЏ Р¶РёРІСѓС‚ РІ РѕС‚РґРµР»СЊРЅРѕРј РґРµСЂРµРІРµ Рё РїРѕРјРѕРіР°СЋС‚ С„РёР»СЊС‚СЂРѕРІР°С‚СЊ Рё РєР»Р°СЃСЃРёС„РёС†РёСЂРѕРІР°С‚СЊ РЅРѕРјРµРЅРєР»Р°С‚СѓСЂСѓ Рё РѕСЃС‚Р°С‚РєРё.",
          en: "Equipment categories form a dedicated tree for classification and filtering."
        },
        keywords: ["РєР°С‚РµРіРѕСЂРёРё РѕР±РѕСЂСѓРґРѕРІР°РЅРёСЏ", "equipment categories"]
      }
    ]
  });
}
