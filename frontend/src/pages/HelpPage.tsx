import { useMemo, useState } from "react";
import { Box, Card, CardContent, Chip, Link, Stack, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import { getHelpSections } from "./helpSections";
import type { HelpSearchEntry, HelpSection } from "./help/types";

type SearchMatch = HelpSearchEntry & {
  sectionTitle: string;
};

function normalizeValue(value: string) {
  return value.toLocaleLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderHighlightedText(text: string, query: string) {
  if (!query.trim()) {
    return text;
  }
  const normalizedQuery = query.trim();
  const pattern = new RegExp(`(${escapeRegExp(normalizedQuery)})`, "ig");
  const parts = text.split(pattern);
  return parts.map((part, index) => (
    part.toLocaleLowerCase() === normalizedQuery.toLocaleLowerCase()
      ? <Box key={`${part}-${index}`} component="mark" sx={{ bgcolor: "warning.light", px: 0.25 }}>{part}</Box>
      : <Box key={`${part}-${index}`} component="span">{part}</Box>
  ));
}

function getMatches(sections: HelpSection[], query: string) {
  const normalizedQuery = normalizeValue(query.trim());
  if (!normalizedQuery) {
    return [];
  }

  return sections.flatMap<SearchMatch>((section) => {
    return section.searchEntries
      .filter((entry) => {
        const title = normalizeValue(entry.title);
        const body = normalizeValue(entry.body);
        const keywords = entry.keywords.map((item) => normalizeValue(item)).join(" ");
        const sectionTitle = normalizeValue(section.title);
        return title.includes(normalizedQuery) || body.includes(normalizedQuery) || keywords.includes(normalizedQuery) || sectionTitle.includes(normalizedQuery);
      })
      .map((entry) => ({
        ...entry,
        sectionTitle: section.title
      }));
  });
}

function buildVisibleSections(sections: HelpSection[], matches: SearchMatch[], query: string) {
  if (!query.trim()) {
    return sections;
  }

  const ids = new Set(matches.map((match) => match.sectionId || ""));
  return sections.filter((section) => ids.has(section.id));
}

export default function HelpPage() {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");

  const sections = useMemo(() => getHelpSections(t, i18n.resolvedLanguage || i18n.language || "en"), [i18n.language, i18n.resolvedLanguage, t]);
  const matches = useMemo(() => getMatches(sections, query), [query, sections]);
  const visibleSections = useMemo(() => buildVisibleSections(sections, matches, query), [matches, query, sections]);
  const matchesBySection = useMemo(() => {
    return matches.reduce<Record<string, SearchMatch[]>>((accumulator, match) => {
      const key = match.sectionId || "unknown";
      accumulator[key] = [...(accumulator[key] || []), match];
      return accumulator;
    }, {});
  }, [matches]);

  const hasQuery = query.trim().length > 0;

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">{t("pages.help")}</Typography>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "320px 1fr" }
        }}
      >
        <Card>
          <CardContent sx={{ display: "grid", gap: 2 }}>
            <Typography variant="h6">{t("pages.helpTableOfContents")}</Typography>
            <TextField
              size="small"
              label={t("pages.helpSearchLabel")}
              placeholder={t("pages.helpSearchPlaceholder")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />

            {hasQuery ? (
              <Box sx={{ display: "grid", gap: 1 }}>
                <Typography variant="subtitle2">
                  {t("pages.helpSearchResultsTitle", { count: matches.length })}
                </Typography>
                {matches.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {t("pages.helpSearchEmpty")}
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {matches.map((match) => (
                      <Box key={match.id} sx={{ display: "grid", gap: 0.5 }}>
                        <Link href={`#${match.anchorId || match.sectionId}`} underline="hover">
                          {renderHighlightedText(match.title, query)}
                        </Link>
                        <Typography variant="caption" color="text.secondary">
                          {match.sectionTitle}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {renderHighlightedText(match.body.slice(0, 220), query)}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            ) : (
              <Box sx={{ display: "grid", gap: 1.25 }}>
                {sections.map((section) => (
                  <Box key={section.id} sx={{ display: "grid", gap: 0.5 }}>
                    <Link href={`#${section.id}`} underline="hover">
                      {section.title}
                    </Link>
                    {section.anchors?.length ? (
                      <Box sx={{ display: "grid", gap: 0.25, pl: 2 }}>
                        {section.anchors.map((anchor) => (
                          <Link key={anchor.id} href={`#${anchor.id}`} underline="hover" color="text.secondary">
                            {anchor.title}
                          </Link>
                        ))}
                      </Box>
                    ) : null}
                  </Box>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ display: "grid", gap: 3 }}>
            {hasQuery && visibleSections.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t("pages.helpSearchEmpty")}
              </Typography>
            ) : visibleSections.map((section) => {
              const sectionMatches = matchesBySection[section.id] || [];
              return (
                <Box key={section.id} id={section.id} sx={{ display: "grid", gap: 1.5, scrollMarginTop: 96 }}>
                  <Typography variant="h6">{section.title}</Typography>
                  {hasQuery && sectionMatches.length > 0 ? (
                    <Box sx={{ display: "grid", gap: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        {t("pages.helpSectionMatches")}
                      </Typography>
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        {sectionMatches.map((match) => (
                          <Chip
                            key={match.id}
                            label={match.title}
                            component="a"
                            clickable
                            href={`#${match.anchorId || match.sectionId}`}
                          />
                        ))}
                      </Stack>
                    </Box>
                  ) : null}
                  {section.content}
                </Box>
              );
            })}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
