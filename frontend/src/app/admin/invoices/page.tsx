"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Receipt,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  Download,
  Mail,
  CreditCard,
  Ban,
  Eye,
  X,
  Play,
  RefreshCw,
} from "lucide-react";
import {
  invoiceApi,
  paymentApi,
  Invoice,
  InvoiceDetail,
  PaymentMethod,
  formatApiError,
} from "@/lib/api";

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [isOverdueOnly, setIsOverdueOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Detail Modal
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Run Billing Modal
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [billingDate, setBillingDate] = useState(new Date().toISOString().split("T")[0]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingResult, setBillingResult] = useState<any | null>(null);

  // Record Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [targetInvoice, setTargetInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CARD");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await invoiceApi.listInvoices({
        search: searchTerm || undefined,
        status: statusFilter || undefined,
        is_overdue: isOverdueOnly ? true : undefined,
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
  }, [searchTerm, statusFilter, isOverdueOnly, page]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const openInvoiceDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const detail = await invoiceApi.getInvoice(id);
      setSelectedInvoice(detail);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to load invoice details");
    } finally {
      setDetailLoading(false);
    }
  };

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

  const handleSendEmail = async (id: string) => {
    if (!confirm("Send invoice PDF to customer email?")) return;
    try {
      const res = await invoiceApi.sendEmail(id);
      alert(`Email dispatch processed: ${res.recipient} (${res.status})`);
      if (selectedInvoice && selectedInvoice.id === id) {
        openInvoiceDetail(id);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to send email");
    }
  };

  const handleCancelInvoice = async (id: string) => {
    const reason = prompt("Enter cancellation reason:");
    if (!reason) return;
    try {
      await invoiceApi.cancelInvoice(id, reason);
      loadInvoices();
      if (selectedInvoice && selectedInvoice.id === id) {
        openInvoiceDetail(id);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to cancel invoice");
    }
  };

  const handleRunBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    setBillingLoading(true);
    setBillingResult(null);
    try {
      const res = await invoiceApi.runBilling({ run_date: billingDate });
      setBillingResult(res);
      loadInvoices();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Batch billing run failed");
    } finally {
      setBillingLoading(false);
    }
  };

  const openRecordPayment = (inv: Invoice) => {
    setTargetInvoice(inv);
    setPaymentAmount(inv.balance_due);
    setPaymentMethod("CARD");
    setPaymentReference("");
    setPaymentNotes("");
    setPaymentError(null);
    setIsPaymentModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetInvoice) return;
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      await paymentApi.createPayment({
        invoice_id: targetInvoice.id,
        amount: parseFloat(paymentAmount),
        payment_method: paymentMethod,
        reference_number: paymentReference || undefined,
        notes: paymentNotes || undefined,
      });
      setIsPaymentModalOpen(false);
      loadInvoices();
      if (selectedInvoice && selectedInvoice.id === targetInvoice.id) {
        openInvoiceDetail(targetInvoice.id);
      }
    } catch (err: unknown) {
      setPaymentError(formatApiError(err) || "Payment recording failed");
    } finally {
      setPaymentLoading(false);
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
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-zinc-200 text-zinc-700 border border-nb-dark shadow-nb-sm">
            <Ban className="h-3 w-3 stroke-[2.5]" /> Cancelled
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
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-nb-yellow border-2 border-nb-dark text-[10px] font-black uppercase tracking-wider shadow-nb-sm mb-2">
            Billing Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-2.5 text-nb-dark">
            <Receipt className="h-7 w-7 stroke-[2.5]" />
            Invoices & Billing
          </h1>
          <p className="text-xs font-bold text-zinc-600 mt-1">
            Manage recurring invoices, issue payments, generate PDF receipts and execute automated billing runs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setBillingResult(null);
              setIsBillingModalOpen(true);
            }}
            className="nb-btn nb-btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider"
          >
            <Play className="h-4 w-4 stroke-[2.5]" />
            Run Billing Engine
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 border-2 sm:border-3 border-nb-dark shadow-nb flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-nb-dark stroke-[2.5]" />
            <input
              type="text"
              placeholder="Search invoice # or customer..."
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
            <option value="DRAFT">Draft</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider cursor-pointer bg-cream border-2 border-nb-dark px-3 py-2 shadow-nb-sm">
            <input
              type="checkbox"
              checked={isOverdueOnly}
              onChange={(e) => {
                setIsOverdueOnly(e.target.checked);
                setPage(1);
              }}
              className="accent-nb-coral h-4 w-4 rounded-none border-2 border-nb-dark"
            />
            Overdue Only
          </label>
        </div>
        <button
          onClick={() => loadInvoices()}
          className="nb-btn nb-btn-white p-2 text-nb-dark"
          title="Refresh table"
        >
          <RefreshCw className={`h-4 w-4 stroke-[2.5] ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Invoices Table */}
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
            <Receipt className="h-12 w-12 stroke-[2] mb-3 text-zinc-400" />
            <p className="font-black uppercase tracking-wide text-base">No invoices found</p>
            <p className="text-xs font-bold text-zinc-500 mt-1">
              Create an invoice or trigger the billing engine to generate invoices from active subscriptions.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold">
              <thead className="bg-nb-dark text-white font-black uppercase tracking-wider border-b-2 border-nb-dark text-[11px]">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Billing Period</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
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
                    <td className="py-3 px-4 font-black">
                      {inv.customer_name || "—"}
                    </td>
                    <td className="py-3 px-4 text-zinc-600 font-mono">
                      {inv.billing_period_start || inv.period_start} → {inv.billing_period_end || inv.period_end}
                    </td>
                    <td className="py-3 px-4 font-mono">
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
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openInvoiceDetail(inv.id)}
                          className="nb-btn nb-btn-white p-1.5"
                          title="View Details"
                        >
                          <Eye className="h-3.5 w-3.5 stroke-[2.5]" />
                        </button>
                        <button
                          onClick={() => handleDownloadPdf(inv.id, inv.invoice_number)}
                          className="nb-btn nb-btn-white p-1.5"
                          title="Download PDF"
                        >
                          <Download className="h-3.5 w-3.5 stroke-[2.5]" />
                        </button>
                        {parseFloat(inv.balance_due) > 0 && inv.status !== "CANCELLED" && (
                          <button
                            onClick={() => openRecordPayment(inv)}
                            className="nb-btn nb-btn-primary inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-black uppercase"
                            title="Record Payment"
                          >
                            <CreditCard className="h-3 w-3 stroke-[2.5]" />
                            Pay
                          </button>
                        )}
                        {inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                          <button
                            onClick={() => handleCancelInvoice(inv.id)}
                            className="nb-btn p-1.5 bg-nb-coral text-white"
                            title="Cancel Invoice"
                          >
                            <Ban className="h-3.5 w-3.5 stroke-[2.5]" />
                          </button>
                        )}
                      </div>
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

      {/* Invoice Detail Drawer / Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 sm:border-3 border-nb-dark max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-nb-xl flex flex-col">
            <div className="p-5 border-b-2 border-nb-dark bg-cream flex items-center justify-between sticky top-0 z-10">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight text-nb-dark flex items-center gap-2">
                  <Receipt className="h-5 w-5 stroke-[2.5]" />
                  Invoice {selectedInvoice.invoice_number}
                </h3>
                <p className="text-xs font-bold text-zinc-600 mt-0.5">
                  Issue Date: {selectedInvoice.issue_date} • Due Date: {selectedInvoice.due_date}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadPdf(selectedInvoice.id, selectedInvoice.invoice_number)}
                  className="nb-btn nb-btn-white inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase"
                >
                  <Download className="h-3.5 w-3.5 stroke-[2.5]" /> PDF
                </button>
                <button
                  onClick={() => handleSendEmail(selectedInvoice.id)}
                  className="nb-btn nb-btn-white inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase"
                >
                  <Mail className="h-3.5 w-3.5 stroke-[2.5]" /> Email
                </button>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="nb-btn nb-btn-white p-1.5 text-nb-dark"
                >
                  <X className="h-5 w-5 stroke-[2.5]" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 flex-1">
              {/* Financial Snapshot */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-cream border-2 border-nb-dark shadow-nb-sm text-xs font-bold">
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-zinc-600 block">Subtotal</span>
                  <span className="text-base font-black text-nb-dark">
                    ${parseFloat(selectedInvoice.subtotal_amount).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-zinc-600 block">Discount</span>
                  <span className="text-base font-black text-nb-dark">
                    -${parseFloat(selectedInvoice.discount_amount).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-zinc-600 block">Taxes</span>
                  <span className="text-base font-black text-nb-dark">
                    +${parseFloat(selectedInvoice.tax_amount).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-zinc-600 block">Balance Due</span>
                  <span className="text-base font-black text-nb-coral">
                    ${parseFloat(selectedInvoice.balance_due).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider mb-2">
                  Line Items
                </h4>
                <div className="border-2 border-nb-dark overflow-hidden shadow-nb-sm">
                  <table className="w-full text-left text-xs font-bold">
                    <thead className="bg-nb-dark text-white font-black uppercase tracking-wider border-b-2 border-nb-dark text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3 text-right">Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit Price</th>
                        <th className="py-2.5 px-3 text-right">Discount</th>
                        <th className="py-2.5 px-3 text-right">Tax</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-nb-dark">
                      {selectedInvoice.lines.map((ln) => (
                        <tr key={ln.id} className="hover:bg-cream">
                          <td className="py-2.5 px-3">
                            <span className="font-black text-nb-dark block">{ln.description}</span>
                            {ln.product_name && (
                              <span className="text-[10px] text-zinc-500 font-bold">
                                {ln.product_name} {ln.plan_name ? `• ${ln.plan_name}` : ""}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">{ln.quantity}</td>
                          <td className="py-2.5 px-3 text-right font-mono">${parseFloat(ln.unit_price).toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-mono">-${parseFloat(ln.discount_amount).toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-mono">+${parseFloat(ln.tax_amount).toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-nb-dark">
                            ${parseFloat(ln.line_total || ln.total_amount || "0").toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment History */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider mb-2">
                  Payment History ({selectedInvoice.payments.length})
                </h4>
                {selectedInvoice.payments.length === 0 ? (
                  <p className="text-xs font-bold text-zinc-500 italic">No payments recorded for this invoice yet.</p>
                ) : (
                  <div className="border-2 border-nb-dark overflow-hidden shadow-nb-sm">
                    <table className="w-full text-left text-xs font-bold">
                      <thead className="bg-nb-dark text-white font-black uppercase tracking-wider border-b-2 border-nb-dark text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3">Payment #</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Method</th>
                          <th className="py-2.5 px-3 text-right">Amount</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-2 divide-nb-dark">
                        {selectedInvoice.payments.map((p) => (
                          <tr key={p.id} className="hover:bg-cream">
                            <td className="py-2.5 px-3 font-mono font-black">{p.payment_number}</td>
                            <td className="py-2.5 px-3 text-zinc-600 font-mono">{p.payment_date}</td>
                            <td className="py-2.5 px-3 font-black">{p.payment_method}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-black">
                              ${parseFloat(p.amount).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 text-[10px] font-black uppercase border border-nb-dark shadow-nb-sm ${
                                  p.status === "SUCCESS"
                                    ? "bg-nb-green text-nb-dark"
                                    : "bg-nb-coral text-white"
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t-2 border-nb-dark bg-cream flex items-center justify-between">
              <div className="text-xs font-mono font-bold text-zinc-600">
                Rounding adjustment: ${parseFloat(selectedInvoice.rounding_adjustment).toFixed(2)}
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="nb-btn nb-btn-white px-4 py-2 text-xs font-black uppercase"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Run Billing Modal */}
      {isBillingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 sm:border-3 border-nb-dark max-w-md w-full p-6 shadow-nb-xl space-y-4">
            <div className="flex items-center justify-between border-b-2 border-nb-dark pb-3">
              <h3 className="text-base font-black uppercase tracking-tight text-nb-dark flex items-center gap-2">
                <Play className="h-5 w-5 stroke-[2.5]" />
                Run Recurring Billing Engine
              </h3>
              <button
                onClick={() => setIsBillingModalOpen(false)}
                className="nb-btn nb-btn-white p-1 text-nb-dark"
              >
                <X className="h-4 w-4 stroke-[2.5]" />
              </button>
            </div>

            <form onSubmit={handleRunBilling} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1.5">
                  Billing Execution Date
                </label>
                <input
                  type="date"
                  required
                  value={billingDate}
                  onChange={(e) => setBillingDate(e.target.value)}
                  className="nb-input w-full text-xs p-2.5 font-bold bg-white"
                />
                <p className="text-[11px] font-bold text-zinc-600 mt-2 leading-relaxed">
                  Evaluates all active subscriptions whose next billing date is on or before this date. Idempotent: previously invoiced periods will be skipped.
                </p>
              </div>

              {billingResult && (
                <div className="p-3.5 bg-nb-green border-2 border-nb-dark text-xs font-bold text-nb-dark shadow-nb-sm space-y-1">
                  <p className="font-black uppercase flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 stroke-[2.5]" />
                    Billing Run Completed
                  </p>
                  <p>Subscriptions evaluated: {billingResult.subscriptions_evaluated}</p>
                  <p>Invoices created: {billingResult.invoices_created}</p>
                  <p>Invoices skipped (already billed): {billingResult.invoices_skipped}</p>
                  {billingResult.failed > 0 && (
                    <p className="text-nb-coral font-black">Failed: {billingResult.failed}</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t-2 border-nb-dark">
                <button
                  type="button"
                  onClick={() => setIsBillingModalOpen(false)}
                  className="nb-btn nb-btn-white px-3.5 py-2 text-xs font-black uppercase"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={billingLoading}
                  className="nb-btn nb-btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs font-black uppercase disabled:opacity-50"
                >
                  {billingLoading ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin stroke-[2.5]" /> Running...
                    </>
                  ) : (
                    "Execute Billing"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isPaymentModalOpen && targetInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 sm:border-3 border-nb-dark max-w-md w-full p-6 shadow-nb-xl space-y-4">
            <div className="flex items-center justify-between border-b-2 border-nb-dark pb-3">
              <h3 className="text-base font-black uppercase tracking-tight text-nb-dark flex items-center gap-2">
                <CreditCard className="h-5 w-5 stroke-[2.5]" />
                Record Payment
              </h3>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="nb-btn nb-btn-white p-1 text-nb-dark"
              >
                <X className="h-4 w-4 stroke-[2.5]" />
              </button>
            </div>

            <div className="p-3.5 bg-cream border-2 border-nb-dark shadow-nb-sm text-xs font-bold space-y-1">
              <p className="font-black text-nb-dark uppercase">
                Invoice {targetInvoice.invoice_number}
              </p>
              <div className="flex justify-between text-zinc-600">
                <span>Invoice Total:</span>
                <span className="font-mono">${parseFloat(targetInvoice.total_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-black text-nb-coral">
                <span>Current Balance Due:</span>
                <span className="font-mono">${parseFloat(targetInvoice.balance_due).toFixed(2)}</span>
              </div>
            </div>

            {paymentError && (
              <div className="p-3 bg-nb-coral border-2 border-nb-dark text-white text-xs font-bold shadow-nb-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 stroke-[2.5] shrink-0" />
                {paymentError}
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-3.5">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1">
                  Payment Amount ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={targetInvoice.balance_due}
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="nb-input w-full text-xs p-2.5 font-mono font-black text-nb-dark bg-white"
                />
                <span className="text-[11px] font-bold text-zinc-500 mt-1 block">
                  Cannot exceed current balance due (${parseFloat(targetInvoice.balance_due).toFixed(2)})
                </span>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1">
                  Payment Method *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="nb-input w-full text-xs p-2.5 font-bold bg-white"
                >
                  <option value="CARD">Credit Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer / ACH</option>
                  <option value="UPI">UPI</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1">
                  Reference / Transaction ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. TXN-94821 or Bank Ref"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="nb-input w-full text-xs p-2.5 font-mono font-bold bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional settlement notes..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="nb-input w-full text-xs p-2.5 font-bold bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t-2 border-nb-dark">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="nb-btn nb-btn-white px-3.5 py-2 text-xs font-black uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentLoading}
                  className="nb-btn nb-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase disabled:opacity-50"
                >
                  {paymentLoading ? "Recording..." : "Confirm & Settle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
