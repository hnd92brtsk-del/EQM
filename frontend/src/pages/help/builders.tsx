import { Alert, Box, Card, CardContent, Chip, Divider, List, ListItem, ListItemText, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

import type { HelpAnchor, HelpSearchEntry, HelpSection } from "./types";

export type HelpLanguage = "ru" | "en";

export type LocalizedText = Record<HelpLanguage, string>;

export type HelpScreenGuide = {
  id: string;
  title: LocalizedText;
  route?: string;
  summary: LocalizedText;
  whenToUse?: LocalizedText[];
  areas?: LocalizedText[];
  actions?: LocalizedText[];
  scenario?: LocalizedText[];
  risks?: LocalizedText[];
  related?: LocalizedText[];
  note?: LocalizedText;
  keywords?: string[];
};

export type DomainHelpConfig = {
  id: string;
  title: string;
  intro: LocalizedText[];
  screens: HelpScreenGuide[];
  introKeywords?: string[];
  extraContent?: ReactNode;
  extraAnchors?: HelpAnchor[];
  extraSearchEntries?: HelpSearchEntry[];
};

function text(language: HelpLanguage, value: LocalizedText) {
  return value[language];
}

function renderBulletBlock(language: HelpLanguage, title: LocalizedText, items?: LocalizedText[]) {
  if (!items?.length) {
    return null;
  }

  return (
    <Box sx={{ display: "grid", gap: 0.75 }}>
      <Typography variant="subtitle2">{text(language, title)}</Typography>
      <List dense disablePadding>
        {items.map((item, index) => (
          <ListItem key={`${text(language, title)}-${index}`} sx={{ display: "list-item", pl: 2.5 }}>
            <ListItemText primaryTypographyProps={{ variant: "body2" }} primary={text(language, item)} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

function renderScreenGuide(language: HelpLanguage, guide: HelpScreenGuide, isLast: boolean) {
  return (
    <Box key={guide.id} id={guide.id} sx={{ display: "grid", gap: 1.5, scrollMarginTop: 96 }}>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
        <Typography variant="h6">{text(language, guide.title)}</Typography>
        {guide.route ? <Chip size="small" variant="outlined" label={guide.route} /> : null}
      </Stack>

      <Typography variant="body1">{text(language, guide.summary)}</Typography>

      {guide.note ? <Alert severity="info">{text(language, guide.note)}</Alert> : null}

      {renderBulletBlock(language, { ru: "Когда использовать", en: "When to use" }, guide.whenToUse)}
      {renderBulletBlock(language, { ru: "Как устроен экран", en: "How the screen is structured" }, guide.areas)}
      {renderBulletBlock(language, { ru: "Основные действия", en: "Key actions" }, guide.actions)}
      {renderBulletBlock(language, { ru: "Типовой сценарий", en: "Typical workflow" }, guide.scenario)}
      {guide.risks?.length ? (
        <Alert severity="warning">
          <Box sx={{ display: "grid", gap: 0.75 }}>
            <Typography variant="subtitle2">{language === "ru" ? "Риски и ограничения" : "Risks and limitations"}</Typography>
            <List dense disablePadding>
              {guide.risks.map((item, index) => (
                <ListItem key={`${guide.id}-risk-${index}`} sx={{ display: "list-item", pl: 2.5 }}>
                  <ListItemText primaryTypographyProps={{ variant: "body2" }} primary={text(language, item)} />
                </ListItem>
              ))}
            </List>
          </Box>
        </Alert>
      ) : null}
      {renderBulletBlock(language, { ru: "Связанные экраны", en: "Related screens" }, guide.related)}

      {!isLast ? <Divider /> : null}
    </Box>
  );
}

function buildSearchEntries(language: HelpLanguage, config: DomainHelpConfig): HelpSearchEntry[] {
  const introBody = config.intro.map((item) => text(language, item)).join(" ");
  const introEntry: HelpSearchEntry = {
    id: `${config.id}-summary`,
    sectionId: config.id,
    anchorId: config.id,
    title: config.title,
    body: introBody,
    keywords: [...(config.introKeywords || []), config.title]
  };

  const screenEntries = config.screens.map<HelpSearchEntry>((guide) => {
    const body = [
      text(language, guide.summary),
      guide.route || "",
      ...(guide.whenToUse || []).map((item) => text(language, item)),
      ...(guide.areas || []).map((item) => text(language, item)),
      ...(guide.actions || []).map((item) => text(language, item)),
      ...(guide.scenario || []).map((item) => text(language, item)),
      ...(guide.risks || []).map((item) => text(language, item)),
      ...(guide.related || []).map((item) => text(language, item)),
      guide.note ? text(language, guide.note) : ""
    ]
      .filter(Boolean)
      .join(" ");

    return {
      id: `${config.id}-${guide.id}-search`,
      sectionId: config.id,
      anchorId: guide.id,
      title: text(language, guide.title),
      body,
      keywords: [text(language, guide.title), guide.route || "", ...(guide.keywords || [])].filter(Boolean)
    };
  });

  return [introEntry, ...screenEntries, ...(config.extraSearchEntries || [])];
}

export function buildDomainHelpSection(language: HelpLanguage, config: DomainHelpConfig): HelpSection {
  const anchors: HelpAnchor[] = [
    ...config.screens.map((guide) => ({
      id: guide.id,
      title: text(language, guide.title)
    })),
    ...(config.extraAnchors || [])
  ];

  return {
    id: config.id,
    title: config.title,
    anchors,
    searchEntries: buildSearchEntries(language, config),
    content: (
      <Box sx={{ display: "grid", gap: 3 }}>
        <Card variant="outlined">
          <CardContent sx={{ display: "grid", gap: 1 }}>
            {config.intro.map((paragraph, index) => (
              <Typography key={`${config.id}-intro-${index}`} variant={index === 0 ? "body1" : "body2"} color={index === 0 ? "text.primary" : "text.secondary"}>
                {text(language, paragraph)}
              </Typography>
            ))}
          </CardContent>
        </Card>

        {config.screens.map((guide, index) => renderScreenGuide(language, guide, index === config.screens.length - 1 && !config.extraContent))}

        {config.extraContent ? (
          <Box sx={{ display: "grid", gap: 2 }}>
            {config.screens.length ? <Divider /> : null}
            {config.extraContent}
          </Box>
        ) : null}
      </Box>
    )
  };
}
