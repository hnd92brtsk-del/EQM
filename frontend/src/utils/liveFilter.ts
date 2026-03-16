export const LIVE_FILTER_DIM_OPACITY = 0.1;

export function normalizeLiveFilterQuery(value: string | null | undefined) {
  return String(value || "").trim().toLocaleLowerCase();
}

export type LiveTreeAnnotation<T> = {
  item: T;
  label: string;
  selfMatch: boolean;
  hasMatchInSubtree: boolean;
  isDimmed: boolean;
  shouldForceExpand: boolean;
  children: LiveTreeAnnotation<T>[];
};

export type LiveFlatAnnotation<T> = {
  item: T;
  label: string;
  selfMatch: boolean;
  isDimmed: boolean;
};

export function annotateLiveTree<T>(
  items: T[],
  {
    getLabel,
    getChildren
  }: {
    getLabel: (item: T) => string;
    getChildren: (item: T) => T[] | undefined;
  },
  query: string
): LiveTreeAnnotation<T>[] {
  const normalizedQuery = normalizeLiveFilterQuery(query);

  const walk = (item: T): LiveTreeAnnotation<T> => {
    const children = (getChildren(item) || []).map(walk);
    const label = getLabel(item);
    const normalizedLabel = normalizeLiveFilterQuery(label);
    const selfMatch = normalizedQuery === "" ? true : normalizedLabel.includes(normalizedQuery);
    const hasMatchInSubtree =
      normalizedQuery === "" ? true : selfMatch || children.some((child) => child.hasMatchInSubtree);

    return {
      item,
      label,
      selfMatch,
      hasMatchInSubtree,
      isDimmed: normalizedQuery !== "" && !selfMatch,
      shouldForceExpand:
        normalizedQuery !== "" &&
        children.length > 0 &&
        (selfMatch || children.some((child) => child.hasMatchInSubtree)),
      children
    };
  };

  return items.map(walk);
}

export function annotateLiveFlatOptions<T>(
  items: T[],
  getLabel: (item: T) => string,
  query: string
): LiveFlatAnnotation<T>[] {
  const normalizedQuery = normalizeLiveFilterQuery(query);

  return items.map((item) => {
    const label = getLabel(item);
    const normalizedLabel = normalizeLiveFilterQuery(label);
    const selfMatch = normalizedQuery === "" ? true : normalizedLabel.includes(normalizedQuery);

    return {
      item,
      label,
      selfMatch,
      isDimmed: normalizedQuery !== "" && !selfMatch
    };
  });
}
