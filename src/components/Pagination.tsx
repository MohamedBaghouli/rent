import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  itemsPerPage: number;
  onItemsPerPageChange: (itemsPerPage: number) => void;
  onPageChange: (page: number) => void;
  totalItems: number;
}

const pageSizeOptions = [10, 20, 50];

export function Pagination({
  currentPage,
  itemsPerPage,
  onItemsPerPageChange,
  onPageChange,
  totalItems,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (totalItems <= itemsPerPage || totalPages <= 1) {
    return null;
  }

  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const startItem = (safeCurrentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(safeCurrentPage * itemsPerPage, totalItems);
  const pageNumbers = getVisiblePageNumbers(safeCurrentPage, totalPages);

  return (
    <div className="flex flex-col gap-3 border-t border-border bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <p className="text-sm font-medium text-muted-foreground">
        Affichage de {startItem} à {endItem} sur {totalItems} paiements
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          Lignes
          <select
            className="h-9 rounded-md border border-input bg-white px-2 text-sm font-semibold text-foreground outline-none transition-smooth hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/15"
            onChange={(event) => onItemsPerPageChange(Number(event.target.value))}
            value={itemsPerPage}
          >
            {pageSizeOptions.map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1">
          <PaginationButton
            ariaLabel="Page précédente"
            disabled={safeCurrentPage === 1}
            onClick={() => onPageChange(safeCurrentPage - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </PaginationButton>

          {pageNumbers.map((pageNumber) => (
            <PaginationButton
              active={pageNumber === safeCurrentPage}
              ariaLabel={`Page ${pageNumber}`}
              key={pageNumber}
              onClick={() => onPageChange(pageNumber)}
            >
              {pageNumber}
            </PaginationButton>
          ))}

          <PaginationButton
            ariaLabel="Page suivante"
            disabled={safeCurrentPage === totalPages}
            onClick={() => onPageChange(safeCurrentPage + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </PaginationButton>
        </div>
      </div>
    </div>
  );
}

function PaginationButton({
  active,
  ariaLabel,
  children,
  disabled,
  onClick,
}: {
  active?: boolean;
  ariaLabel: string;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 min-w-9 items-center justify-center rounded-md border border-border px-2 text-sm font-semibold transition-smooth",
        active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-white text-foreground hover:bg-muted",
        disabled && "cursor-not-allowed opacity-45 hover:bg-white",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function getVisiblePageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, 5];
  }

  if (currentPage >= totalPages - 2) {
    return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
}
