"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Receipt,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  Download,
  RefreshCw,
  FileText,
} from "lucide-react";
import { invoiceApi, Invoice } from "@/lib/api";

export default function CustomerInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await invoiceApi.listInvoices({
        search: searchTerm || undefined,
        status: statusFilter || undefined,
        page,
        page_size: 10,
      });
      setInvoices(res.items);
      setTotalPages(res.pages || 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, page]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleDownloadPdf = async (id: string, invoiceNumber: string) => {
    try {
      const blob = await invoiceApi.downloadPdf(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to download PDF");
    }
  };

  const statusBadge = (status: string, isOverdue: boolean) => {
    if (isOverdue && status !== "PAID" && status !== "CANCELLED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-nb-coral text-white border border-nb-dark shadow-nb-sm">
          <AlertCircle className="h-3 w-3 stroke-[2.5]" /> Overdue
        </span>
      );
    }
    switch (status) {
      case "PAID":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-nb-green text-nb-dark border border-nb-dark shadow-nb-sm">
            <CheckCircle className="h-3 w-3 stroke-[2.5]" /> Paid
          </span>
        );
      case "PARTIALLY_PAID":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-nb-yellow text-nb-dark border border-nb-dark shadow-nb-sm">
            <Clock className="h-3 w-3 stroke-[2.5]" /> Partial
          </span>
        );
      case "CONFIRMED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-nb-blue text-white border border-nb-dark shadow-nb-sm">
            <CheckCircle className="h-3 w-3 stroke-[2.5]" /> Confirmed
          </span>
        );
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-cream text-nb-dark border border-nb-dark shadow-nb-sm">
            Draft
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-white text-nb-dark border border-nb-dark shadow-nb-sm">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border-2 sm:border-3 border-nb-dark p-6 shadow-nb flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-nb-green border-2 border-nb-dark text-[10px] font-black uppercase tracking-wider shadow-nb-sm mb-2">
            Documents
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-2.5 text-nb-dark">
            <Receipt className="h-7 w-7 stroke-[2.5]" />
            My Invoices & Documents
          </h1>
          <p className="text-xs font-bold text-zinc-600 mt-1">
            Review your recurring billing statements and download PDF tax invoices for accounting.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 border-2 sm:border-3 border-nb-dark shadow-nb flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-nb-dark stroke-[2.5]" />
            <input
              type="text"
              placeholder="Search invoice number..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="nb-input pl-9 pr-3 py-2 text-xs w-full bg-white font-bold"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="nb-input text-xs py-2 px-3 bg-white font-bold"
          >
            <option value="">All Statuses</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
          </select>
        </div>
        <button
          onClick={() => loadInvoices()}
          className="nb-btn nb-btn-white p-2 text-nb-dark"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 stroke-[2.5] ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border-2 sm:border-3 border-nb-dark shadow-nb overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs font-black uppercase tracking-wider text-nb-dark flex flex-col items-center gap-3">
            <RefreshCw className="h-7 w-7 animate-spin stroke-[2.5] text-nb-dark" />
            Loading invoices...
          </div>
        ) : error ? (
          <div className="p-6 text-center text-white bg-nb-coral text-xs font-bold">{error}</div>
        ) : invoices.length === 0 ? (
          <div className="py-20 text-center text-nb-dark flex flex-col items-center">
            <FileText className="h-12 w-12 stroke-[2] mb-3 text-zinc-400" />
            <p className="font-black uppercase tracking-wide text-base">No invoices found</p>
            <p className="text-xs font-bold text-zinc-500 mt-1">
              Your generated statements will be available for download here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold">
              <thead className="bg-nb-dark text-white font-black uppercase tracking-wider border-b-2 border-nb-dark text-[11px]">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Billing Period</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-nb-dark text-nb-dark">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-cream transition-colors">
                    <td className="py-3 px-4 font-mono font-black">
                      {inv.invoice_number}
                      <span className="block text-[10px] text-zinc-500 font-sans font-bold">
                        Issued: {inv.issue_date}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-600 font-mono">
                      {inv.billing_period_start || inv.period_start} → {inv.billing_period_end || inv.period_end}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold">
                      <span className={inv.is_overdue ? "text-nb-coral font-black" : ""}>
                        {inv.due_date}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-black">
                      ${parseFloat(inv.total_amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-black">
                      <span
                        className={
                          parseFloat(inv.balance_due) > 0
                            ? "text-nb-coral"
                            : "text-nb-dark"
                        }
                      >
                        ${parseFloat(inv.balance_due).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {statusBadge(inv.status, inv.is_overdue)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDownloadPdf(inv.id, inv.invoice_number)}
                        className="nb-btn nb-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wider"
                      >
                        <Download className="h-3.5 w-3.5 stroke-[2.5]" /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t-2 border-nb-dark bg-cream flex items-center justify-between text-xs font-black uppercase tracking-wider">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="nb-btn nb-btn-white px-3 py-1 text-xs disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="nb-btn nb-btn-white px-3 py-1 text-xs disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
