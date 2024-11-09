import type React from 'react';

type SearchHistory = {
  completed: boolean;
  docsReceived: number;
  isError: boolean;
  totalDocsExpected: null | number;
};

export function SearchStatusBadge({
  searchHistory: { completed: isCompleted, isError },
}: {
  searchHistory: Pick<SearchHistory, 'completed' | 'isError'>;
}) {
  if (isError) {
    return (
      <span className={'tw-rounded tw-bg-error tw-p-1 tw-font-semibold'}>
        Error
      </span>
    );
  }
  if (isCompleted) {
    return (
      <span className={'tw-rounded tw-bg-primary tw-p-1 tw-font-semibold'}>
        Completed
      </span>
    );
  }
  return (
    <span className={'tw-rounded tw-bg-white tw-p-1 tw-font-semibold'}>
      Processing
    </span>
  );
}

export function SearchProgress({
  searchHistory: { completed, docsReceived, isError, totalDocsExpected },
}: {
  searchHistory: Pick<
    SearchHistory,
    'completed' | 'docsReceived' | 'isError' | 'totalDocsExpected'
  >;
}) {
  const shouldRenderProgress = totalDocsExpected && !isError && !completed;
  if (!shouldRenderProgress) {
    return null;
  }
  return (
    <span className={'tw-text-center tw-font-semibold'}>
      {new Intl.NumberFormat('en-gb', {
        style: 'percent',
      }).format(docsReceived / totalDocsExpected)}
    </span>
  );
}
