export function normalizeLiveFilterQuery(value: string | null | undefined) {
  return String(value || "").trim().toLocaleLowerCase();
}

function getMatchScore(label: string, query: string) {
  if (!query) {
    return 0;
  }

  const normalizedLabel = normalizeLiveFilterQuery(label);
  if (!normalizedLabel) {
    return Number.NEGATIVE_INFINITY;
  }

  if (normalizedLabel === query) {
    return 3;
  }

  if (normalizedLabel.startsWith(query)) {
    return 2;
  }

  if (normalizedLabel.includes(query)) {
    return 1;
  }

  return Number.NEGATIVE_INFINITY;
}

function compareMatches(
  left: { score: number; label: string; index: number },
  right: { score: number; label: string; index: number }
) {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  const labelOrder = left.label.localeCompare(right.label, undefined, { sensitivity: "base" });
  if (labelOrder !== 0) {
    return labelOrder;
  }

  return left.index - right.index;
}

export type LiveTreeAnnotation<T> = {
  item: T;
  children: LiveTreeAnnotation<T>[];
  selfMatch: boolean;
  shouldForceExpand: boolean;
  bestMatchScore: number;
};

export type LiveFlatAnnotation<T> = {
  item: T;
  label: string;
  selfMatch: boolean;
  matchScore: number;
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

  const walk = (item: T): LiveTreeAnnotation<T> | null => {
    const label = getLabel(item);
    const selfScore = getMatchScore(label, normalizedQuery);
    const selfMatch = normalizedQuery === "" ? true : selfScore > Number.NEGATIVE_INFINITY;

    const children = (getChildren(item) || [])
      .map(walk)
      .filter((child): child is LiveTreeAnnotation<T> => child !== null)
      .sort((left, right) =>
        compareMatches(
          { score: left.bestMatchScore, label: getLabel(left.item), index: 0 },
          { score: right.bestMatchScore, label: getLabel(right.item), index: 0 }
        )
      );

    if (normalizedQuery !== "" && !selfMatch && children.length === 0) {
      return null;
    }

    return {
      item,
      children,
      selfMatch,
      shouldForceExpand: normalizedQuery !== "" && children.length > 0,
      bestMatchScore:
        normalizedQuery === ""
          ? 0
          : Math.max(
              selfScore,
              ...children.map((child) => child.bestMatchScore)
            )
    };
  };

  return items
    .map(walk)
    .filter((item): item is LiveTreeAnnotation<T> => item !== null)
    .sort((left, right) =>
      compareMatches(
        { score: left.bestMatchScore, label: getLabel(left.item), index: 0 },
        { score: right.bestMatchScore, label: getLabel(right.item), index: 0 }
      )
    );
}

export function annotateLiveFlatOptions<T>(
  items: T[],
  getLabel: (item: T) => string,
  query: string
): LiveFlatAnnotation<T>[] {
  const normalizedQuery = normalizeLiveFilterQuery(query);

  return items
    .map((item, index) => {
      const label = getLabel(item);
      const matchScore = getMatchScore(label, normalizedQuery);
      const selfMatch = normalizedQuery === "" ? true : matchScore > Number.NEGATIVE_INFINITY;

      return {
        item,
        label,
        selfMatch,
        matchScore,
        index
      };
    })
    .filter((item) => normalizedQuery === "" || item.selfMatch)
    .sort((left, right) =>
      compareMatches(
        { score: left.matchScore, label: left.label, index: left.index },
        { score: right.matchScore, label: right.label, index: right.index }
      )
    )
    .map(({ index: _index, ...item }) => item);
}
