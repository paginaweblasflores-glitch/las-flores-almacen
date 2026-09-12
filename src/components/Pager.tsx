interface PagerProps {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize?: (size: number) => void;
  pageSizeOptions?: number[];
}

const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100, 250, 500];

/** Paginación del lado cliente, con selector de "filas por página". */
export default function Pager({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: PagerProps) {
  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-stone-100 text-xs text-stone-500">
      {onPageSize ? (
        <div className="flex items-center gap-2">
          <span>Filas por página</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="border border-stone-200 rounded-md pl-2 pr-6 py-1 text-xs text-stone-700 bg-white cursor-pointer hover:border-stone-300 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          {from}–{to} de {total}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            aria-label="Página anterior"
            className="p-1.5 rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={page >= totalPages}
            aria-label="Página siguiente"
            className="p-1.5 rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
