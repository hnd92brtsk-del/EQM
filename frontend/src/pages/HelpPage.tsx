import { Box, Card, CardContent, Link, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import { getHelpSections } from "./helpSections";

export default function HelpPage() {
  const { t } = useTranslation();
  const sections = getHelpSections(t);

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">{t("pages.help")}</Typography>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "260px 1fr" }
        }}
      >
        <Card>
          <CardContent sx={{ display: "grid", gap: 1 }}>
            <Typography variant="h6">{t("pages.helpTableOfContents")}</Typography>
            <Box sx={{ display: "grid", gap: 0.5 }}>
              {sections.map((section) => (
                <Link key={section.id} href={`#${section.id}`} underline="hover">
                  {section.title}
                </Link>
              ))}
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ display: "grid", gap: 3 }}>
            {sections.map((section) => (
              <Box key={section.id} id={section.id} sx={{ scrollMarginTop: 96 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {section.title}
                </Typography>
                {section.content}
              </Box>
            ))}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
