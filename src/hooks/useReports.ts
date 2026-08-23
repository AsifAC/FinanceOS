import { useCallback } from "react";
import { createReportCache, deleteReportCache, listReports } from "../services/reportService";
import { ListFilters } from "../services/serviceUtils";
import { useServiceQuery } from "./useServiceQuery";

export function useReports(filters: ListFilters & { reportType?: string } = {}) {
  const loader = useCallback(
    () => listReports(filters),
    [filters.year, filters.month, filters.type, filters.reportType],
  );
  return { ...useServiceQuery(loader), createReportCache, deleteReportCache };
}
