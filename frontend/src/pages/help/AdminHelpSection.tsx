import { Box, Typography } from "@mui/material";

import { getAdminDiagnosticsHelpSection } from "./AdminDiagnosticsHelpSection";
import { buildDomainHelpSection, type HelpLanguage } from "./builders";
import type { HelpSection } from "./types";

export function getAdminHelpSection(language: HelpLanguage, title: string): HelpSection {
  const diagnosticsHelp = getAdminDiagnosticsHelpSection(language);

  return buildDomainHelpSection(language, {
    id: "admin",
    title,
    introKeywords: ["администрирование", "пользователи", "права", "сессии", "аудит", "диагностика"],
    intro: [
      {
        ru: "Администрирование объединяет системные экраны, где особенно важны права доступа и аккуратность действий. Здесь находятся пользователи, матрица ролей, журнал сессий, журнал аудита и эксплуатационная диагностика.",
        en: "Administration groups access-sensitive system screens such as users, permissions, sessions, audit, and diagnostics."
      },
      {
        ru: "Прежде чем что-то удалять, останавливать или менять в матрице ролей, убедитесь, что понимаете последствия для остальных пользователей и текущей эксплуатации.",
        en: "Verify the operational impact before deleting, stopping, or changing permissions."
      }
    ],
    screens: [
      {
        id: "admin-users",
        title: { ru: "Пользователи", en: "Users" },
        route: "/admin/users",
        summary: {
          ru: "Экран пользователей ведёт учётные записи: логин, пароль, роль, фильтры, мягкое удаление и переход к матрице ролей. Это точка создания и базового сопровождения логинов системы.",
          en: "Users manages logins, passwords, roles, soft deletion, and links to role permissions."
        },
        actions: [
          {
            ru: "Создавайте пользователя только после понимания нужной роли. Если роль ещё не существует, сначала откройте матрицу ролей.",
            en: "Create a user only after deciding the correct role."
          },
          {
            ru: "Используйте мягкое удаление и восстановление для безопасного отключения доступа без потери истории.",
            en: "Use soft delete and restore to disable access without losing history."
          }
        ],
        risks: [
          {
            ru: "Изменение роли влияет на доступ ко всем разделам сразу. Проверяйте роль до сохранения, особенно для инженеров и администраторов.",
            en: "Role changes immediately affect access across the product."
          }
        ],
        related: [
          {
            ru: "Связанные экраны: матрица ролей, карточка сотрудника, сессии.",
            en: "Related screens: role permissions, employee card, sessions."
          }
        ],
        keywords: ["пользователи", "логин", "роль", "пароль", "restore user"]
      },
      {
        id: "admin-role-permissions",
        title: { ru: "Роли и права", en: "Role permissions" },
        route: "/admin/role-permissions",
        summary: {
          ru: "Матрица ролей показывает пространства доступа и флаги `read`, `write`, `admin` для каждой роли. Здесь же создаются новые роли.",
          en: "Role permissions display a matrix of spaces and read/write/admin flags and allow role creation."
        },
        actions: [
          {
            ru: "Сначала меняйте чекбоксы в карточках пространств, затем сохраняйте матрицу общей кнопкой внизу.",
            en: "Edit the checkboxes first, then save the matrix with the global action."
          },
          {
            ru: "При создании новой роли заполняйте machine key осмысленно: он станет частью внутренних идентификаторов и переводов.",
            en: "Choose the role key carefully because it becomes part of internal identifiers."
          }
        ],
        risks: [
          {
            ru: "Снятие `read` автоматически снимает и более высокие права, а выдача `write/admin` подтягивает `read`. Учитывайте эту встроенную зависимость.",
            en: "Permission flags have built-in dependencies between read, write, and admin."
          }
        ],
        related: [
          {
            ru: "Связанные экраны: пользователи и все разделы, которые опираются на пространства доступа.",
            en: "Related screens: users and every permission-protected module."
          }
        ],
        keywords: ["права", "роли", "read write admin", "матрица прав"]
      },
      {
        id: "admin-sessions",
        title: { ru: "Сессии", en: "Sessions" },
        route: "/admin/sessions",
        summary: {
          ru: "Экран сессий показывает историю входов и завершений сессий с фильтрами по пользователю, IP и причине завершения. Он нужен для оперативного разбора доступа и инцидентов аутентификации.",
          en: "Sessions lists login history and session endings with user, IP, and reason filters."
        },
        keywords: ["сессии", "login history", "ip address", "end reason"]
      },
      {
        id: "admin-audit",
        title: { ru: "Журнал аудита", en: "Audit log" },
        route: "/admin/audit",
        summary: {
          ru: "Журнал аудита фиксирует, кто и когда менял сущности системы. Таблица поддерживает фильтрацию по актору, действию, сущности и ID записи.",
          en: "Audit log tracks who changed which entity and when."
        },
        actions: [
          {
            ru: "Используйте фильтр по entity и entity_id, если расследуете историю конкретной записи.",
            en: "Use entity and entity_id filters when investigating a specific record."
          }
        ],
        related: [
          {
            ru: "Связанные экраны: пользователи, сессии, диагностика.",
            en: "Related screens: users, sessions, diagnostics."
          }
        ],
        keywords: ["журнал аудита", "audit log", "entity id", "action"]
      },
      {
        id: "admin-diagnostics-screen",
        title: { ru: "Диагностика", en: "Diagnostics" },
        route: "/admin/diagnostics",
        summary: {
          ru: "Диагностика — самый подробный эксплуатационный экран админки. Он показывает состояние frontend, backend, PostgreSQL, процессов, портов, журналов и типовых ошибок, а также подсказывает безопасные следующие шаги.",
          en: "Diagnostics is the detailed operations screen for services, ports, processes, logs, and common failures."
        },
        actions: [
          {
            ru: "Используйте эту страницу, если проблема уже вышла за пределы обычного CRUD и похожа на инфраструктурную, сетевую или runtime-ошибку.",
            en: "Use this page for runtime, infrastructure, or service-level issues."
          }
        ],
        related: [
          {
            ru: "Ниже встроено полное руководство по диагностике с отдельными якорями и поисковыми записями.",
            en: "The full diagnostics operating guide is embedded below with its own anchors."
          }
        ],
        keywords: ["диагностика", "postgresql", "backend", "frontend", "ports", "logs"]
      }
    ],
    extraAnchors: diagnosticsHelp.anchors,
    extraSearchEntries: diagnosticsHelp.searchEntries,
    extraContent: (
      <Box sx={{ display: "grid", gap: 2 }}>
        <Box sx={{ display: "grid", gap: 1 }} id="admin-diagnostics-manual">
          <Typography variant="body2" color="text.secondary">
            {language === "ru"
              ? "Полное руководство ниже посвящено экрану `Admin -> Диагностика` и предназначено для администратора, которому нужно разбирать процессы, порты, журналы и эксплуатационные инциденты."
              : "The detailed guide below is dedicated to the `Admin -> Diagnostics` screen."}
          </Typography>
        </Box>
        {diagnosticsHelp.content}
      </Box>
    )
  });
}
