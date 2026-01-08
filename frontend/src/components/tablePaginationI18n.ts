import type { TFunction } from "i18next";

type LabelDisplayedRowsArgs = {
  from: number;
  to: number;
  count: number;
};

export const getTablePaginationProps = (t: TFunction) => ({
  labelRowsPerPage: t("common.rowsPerPage"),
  labelDisplayedRows: ({ from, to, count }: LabelDisplayedRowsArgs) =>
    t("common.rowsDisplayed", {
      from,
      to,
      countLabel: count === -1 ? t("common.rowsMore") : count
    })
});
