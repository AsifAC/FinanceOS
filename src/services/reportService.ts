import { InsertRow, ReportCache } from "./dbTypes";
import { createOwnRow, deleteOwnRow, ListFilters, listOwnRows } from "./serviceUtils";

export const listReports = (filters: ListFilters & { reportType?: string } = {}) =>
  listOwnRows<ReportCache>("reports_cache", filters, "generated_at").then((result) => ({
    ...result,
    data: result.data?.filter((report) => !filters.reportType || report.report_type === filters.reportType) ?? null,
  }));
export const createReportCache = (values: InsertRow<ReportCache>) => createOwnRow<ReportCache>("reports_cache", values);
export const deleteReportCache = (id: string) => deleteOwnRow("reports_cache", id);
