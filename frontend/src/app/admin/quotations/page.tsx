"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  FileText,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  Send,
  Check,
  RefreshCw,
  X,
  Eye,
} from "lucide-react";
import {
  catalogApi,
  customerApi,
  quotationApi,
  subscriptionApi,
  Customer,
  Plan,
  Product,
  Quotation,
  QuotationDetail,
  QuotationTemplate,
} from "@/lib/api";

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Aux state for dropdowns
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [templates, setTemplates] = useState<QuotationTemplate[]>([]);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);
  const [quotationDetail, setQuotationDetail] = useState<QuotationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Form states
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formPlanId, setFormPlanId] = useState("");
  const [formTemplateId, setFormTemplateId] = useState("");
  const [formValidityDays, setFormValidityDays] = useState(30);
  const [formNotes, setFormNotes] = useState("");
  const [formDiscountCode, setFormDiscountCode] = useState("");
  const [formLines, setFormLines] = useState<
    { product_id: string; quantity: number; unit_price?: string }[]
  >([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Conversion prompt
  const [converting, setConverting] = useState(false);
  const [conversionSuccess, setConversionSuccess] = useState<string | null>(null);

  const loadQuotations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await quotationApi.listQuotations({
        search: searchTerm || undefined,
        status: statusFilter || undefined,
        page,
        page_size: 10,
      });
      setQuotations(res.items);
      setTotalPages(res.pages || 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load quotations");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, page]);

  useEffect(() => {
    loadQuotations();
  }, [loadQuotations]);

  // Load supporting entities for creation
  useEffect(() => {
    customerApi.listCustomers({ is_active: true, page_size: 100 }).then((r) => setCustomers(r.items)).catch(() => {});
    catalogApi.listPlans({ is_active: true, page_size: 100 }).then((r) => setPlans(r.items)).catch(() => {});
    catalogApi.listProducts({ is_active: true, page_size: 100 }).then((r) => setProducts(r.items)).catch(() => {});
    quotationApi.listTemplates({ is_active: true, page_size: 100 }).then((r) => setTemplates(r.items)).catch(() => {});
  }, []);

  const loadQuotationDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const detail = await quotationApi.getQuotation(id);
      setQuotationDetail(detail);
      setSelectedQuotationId(id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to fetch quotation details");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleTemplateSelect = async (templateId: string) => {
    setFormTemplateId(templateId);
    if (!templateId) return;
    try {
      const tpl = await quotationApi.getTemplate(templateId);
      setFormPlanId(tpl.plan_id);
      setFormValidityDays(tpl.validity_duration_days);
      const lines = tpl.lines.map((l) => ({
        product_id: l.product_id,
        quantity: l.quantity,
        unit_price: l.unit_price_override || undefined,
      }));
      setFormLines(lines);
    } catch (err: unknown) {
      console.error(err);
    }
  };

  const openCreateModal = () => {
    setFormCustomerId(customers[0]?.id || "");
    setFormPlanId(plans[0]?.id || "");
    setFormTemplateId("");
    setFormValidityDays(30);
    setFormNotes("");
    setFormDiscountCode("");
    setFormLines([]);
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleAddLine = () => {
    if (products.length === 0) return;
    setFormLines([...formLines, { product_id: products[0].id, quantity: 1 }]);
  };

  const handleRemoveLine = (index: number) => {
    setFormLines(formLines.filter((_, i) => i !== index));
  };

  const handleSaveQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerId || !formPlanId) {
      setFormError("Please select both a customer organization and a subscription plan.");
      return;
    }
    setFormSubmitting(true);
    setFormError(null);
    try {
      const linesPayload = formLines.map((l) => ({
        line_type: "PRODUCT",
        product_id: l.product_id,
        quantity: Number(l.quantity),
        unit_price: l.unit_price ? l.unit_price : undefined,
      }));

      const quote = await quotationApi.createQuotation({
        customer_id: formCustomerId,
        plan_id: formPlanId,
        template_id: formTemplateId || undefined,
        validity_duration_days: Number(formValidityDays),
        notes: formNotes || undefined,
        discount_code: formDiscountCode.trim() || undefined,
        lines: linesPayload,
      });

      setIsCreateOpen(false);
      loadQuotations();
      loadQuotationDetail(quote.id);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create quotation");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleStatusTransition = async (targetStatus: string, reason?: string) => {
    if (!quotationDetail) return;
    try {
      await quotationApi.updateStatus(quotationDetail.id, targetStatus, reason);
      loadQuotationDetail(quotationDetail.id);
      loadQuotations();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to transition status");
    }
  };

  const handleConvertToSubscription = async () => {
    if (!quotationDetail) return;
    if (!confirm(`Convert Quotation ${quotationDetail.quotation_number} into an active subscription?`)) return;
    setConverting(true);
    try {
      const sub = await subscriptionApi.convertFromQuotation(quotationDetail.id, {
        start_date: new Date().toISOString().split("T")[0],
        payment_terms_days: 15,
      });
      setConversionSuccess(`Successfully generated Subscription: ${sub.subscription_number}`);
      setTimeout(() => setConversionSuccess(null), 5000);
      loadQuotationDetail(quotationDetail.id);
      loadQuotations();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to convert quotation to subscription");
    } finally {
      setConverting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-cream text-nb-dark border border-nb-dark shadow-nb-sm">DRAFT</span>;
      case "SENT":
        return <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-nb-blue text-white border border-nb-dark shadow-nb-sm">SENT</span>;
      case "CONFIRMED":
        return <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-nb-green text-nb-dark border border-nb-dark shadow-nb-sm">CONFIRMED</span>;
      case "REJECTED":
        return <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-nb-coral text-white border border-nb-dark shadow-nb-sm">REJECTED</span>;
      case "EXPIRED":
        return <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-zinc-200 text-zinc-700 border border-nb-dark shadow-nb-sm">EXPIRED</span>;
      default:
        return <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-white text-nb-dark border border-nb-dark shadow-nb-sm">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border-2 sm:border-3 border-nb-dark p-6 shadow-nb flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-nb-yellow border-2 border-nb-dark text-[10px] font-black uppercase tracking-wider shadow-nb-sm mb-2">
            Sales & Proposals
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-2.5 text-nb-dark">
            <FileText className="h-7 w-7 stroke-[2.5]" />
            Quotation Management
          </h1>
          <p className="text-xs font-bold text-zinc-600 mt-1">
            Create commercial proposals from templates, review tax and discount snapshots, manage approval lifecycles, and convert to subscriptions.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="nb-btn nb-btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          Prepare Quotation
        </button>
      </div>

      {conversionSuccess && (
        <div className="p-4 bg-nb-green border-2 border-nb-dark shadow-nb flex items-center gap-3 text-nb-dark text-xs font-bold">
          <CheckCircle className="h-5 w-5 stroke-[2.5] text-nb-dark shrink-0" />
          <span>{conversionSuccess}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 border-2 sm:border-3 border-nb-dark shadow-nb flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-nb-dark stroke-[2.5]" />
          <input
            type="text"
            placeholder="Search by quotation number or notes..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="nb-input w-full pl-9 pr-4 py-2 text-xs bg-white font-bold"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="nb-input px-3 py-2 text-xs bg-white font-bold"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">DRAFT</option>
          <option value="SENT">SENT</option>
          <option value="CONFIRMED">CONFIRMED</option>
          <option value="REJECTED">REJECTED</option>
          <option value="EXPIRED">EXPIRED</option>
        </select>
      </div>

      {error && (
        <div className="p-3.5 bg-nb-coral text-white border-2 border-nb-dark shadow-nb flex items-center gap-2.5 text-xs font-bold">
          <AlertCircle className="h-5 w-5 stroke-[2.5] shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border-2 sm:border-3 border-nb-dark shadow-nb overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs font-black uppercase tracking-wider text-nb-dark flex flex-col items-center gap-3">
            <RefreshCw className="h-7 w-7 animate-spin stroke-[2.5] text-nb-dark" />
            Loading quotations...
          </div>
        ) : quotations.length === 0 ? (
          <div className="py-20 text-center text-nb-dark flex flex-col items-center">
            <FileText className="h-12 w-12 stroke-[2] mb-3 text-zinc-400" />
            <h3 className="font-black uppercase tracking-wide text-base">No quotations found</h3>
            <p className="text-xs font-bold text-zinc-500 mt-1">Prepare commercial proposals for customers above.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs font-bold">
            <thead className="bg-nb-dark text-white font-black uppercase tracking-wider border-b-2 border-nb-dark text-[11px]">
              <tr>
                <th className="px-5 py-3 text-left">Quote #</th>
                <th className="px-5 py-3 text-left">Issue / Expiry</th>
                <th className="px-5 py-3 text-right">Subtotal</th>
                <th className="px-5 py-3 text-right">Tax</th>
                <th className="px-5 py-3 text-right">Total Payable</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-nb-dark text-nb-dark">
              {quotations.map((q) => (
                <tr key={q.id} className="hover:bg-cream transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-mono font-black text-sm text-nb-dark">{q.quotation_number}</div>
                    {q.notes && <div className="text-[11px] text-zinc-600 line-clamp-1 font-normal mt-0.5">{q.notes}</div>}
                  </td>
                  <td className="px-5 py-4 text-xs font-mono">
                    <div className="font-bold text-nb-dark">Issued: {q.issue_date}</div>
                    <div className="text-zinc-500 font-normal">Expires: {q.expiry_date}</div>
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-zinc-700">
                    ₹{Number(q.subtotal_amount).toFixed(2)}
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-zinc-700">
                    ₹{Number(q.tax_amount).toFixed(2)}
                  </td>
                  <td className="px-5 py-4 text-right font-mono font-black text-nb-dark">
                    ₹{Number(q.total_amount).toFixed(2)}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {getStatusBadge(q.status)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => loadQuotationDetail(q.id)}
                      className="nb-btn nb-btn-white inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wider"
                    >
                      <Eye className="h-3.5 w-3.5 stroke-[2.5]" /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="px-5 py-3 border-t-2 border-nb-dark bg-cream flex items-center justify-between text-xs font-black uppercase tracking-wider">
            <div>Page {page} of {totalPages}</div>
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

      {/* Quotation Detail Modal */}
      {selectedQuotationId && quotationDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 sm:border-3 border-nb-dark max-w-2xl w-full p-6 shadow-nb-xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header info */}
            <div className="flex items-start justify-between border-b-2 border-nb-dark pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-black font-mono text-nb-dark uppercase">
                    {quotationDetail.quotation_number}
                  </h2>
                  {getStatusBadge(quotationDetail.status)}
                </div>
                <div className="text-xs text-zinc-600 font-bold mt-1.5 flex flex-wrap items-center gap-4">
                  <span>Customer: <strong className="text-nb-dark">{quotationDetail.customer_company_name || quotationDetail.customer_id}</strong></span>
                  <span>Plan: <strong className="text-nb-dark">{quotationDetail.plan_name || "Plan Fee Included"}</strong></span>
                </div>
              </div>
              <button onClick={() => setSelectedQuotationId(null)} className="nb-btn nb-btn-white p-1 text-nb-dark">
                <X className="h-5 w-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Line Items Table */}
            <div>
              <h3 className="text-xs font-black text-nb-dark uppercase tracking-wider mb-2">
                Agreed Line Items & Snapshots
              </h3>
              <div className="border-2 border-nb-dark overflow-hidden shadow-nb-sm">
                <table className="w-full text-left text-xs font-bold">
                  <thead className="bg-nb-dark text-white font-black uppercase tracking-wider border-b-2 border-nb-dark text-[11px]">
                    <tr>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-center">Type</th>
                      <th className="px-3 py-2 text-right">Unit Price</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-right">Tax Rate</th>
                      <th className="px-3 py-2 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-nb-dark text-nb-dark">
                    {quotationDetail.lines.map((l) => (
                      <tr key={l.id} className="hover:bg-cream">
                        <td className="px-3 py-2 font-black text-nb-dark">
                          {l.description_snapshot}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-1.5 py-0.5 text-[10px] font-black uppercase bg-cream border border-nb-dark">
                            {l.line_type}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          ₹{Number(l.unit_price).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-center font-mono font-black">{l.quantity}</td>
                        <td className="px-3 py-2 text-right font-mono text-zinc-600">
                          {Number(l.tax_rate_snapshot).toFixed(2)}%
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-black text-nb-dark">
                          ₹{Number(l.line_total).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary Block with Explicit Rounding Adjustment */}
            <div className="bg-cream p-4 border-2 border-nb-dark shadow-nb-sm flex flex-col items-end text-xs space-y-1.5 font-mono font-bold">
              <div className="flex justify-between w-64 text-zinc-700">
                <span>Subtotal:</span>
                <span className="font-black text-nb-dark">₹{Number(quotationDetail.subtotal_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between w-64 text-zinc-700">
                <span>Discount:</span>
                <span className="text-nb-green font-black">- ₹{Number(quotationDetail.discount_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between w-64 text-zinc-700">
                <span>Statutory Tax:</span>
                <span className="text-nb-dark font-black">+ ₹{Number(quotationDetail.tax_amount).toFixed(2)}</span>
              </div>
              {Number(quotationDetail.rounding_adjustment) !== 0 && (
                <div className="flex justify-between w-64 text-zinc-600 text-[11px]">
                  <span>Rounding Adjustment:</span>
                  <span>{Number(quotationDetail.rounding_adjustment) > 0 ? "+" : ""}₹{Number(quotationDetail.rounding_adjustment).toFixed(2)}</span>
                </div>
              )}
              <div className="border-t-2 border-nb-dark pt-2 flex justify-between w-64 text-sm font-black text-nb-dark">
                <span>Total Payable:</span>
                <span>₹{Number(quotationDetail.total_amount).toFixed(2)}</span>
              </div>
            </div>

            {/* Action Buttons based on lifecycle */}
            <div className="flex items-center justify-between pt-3 border-t-2 border-nb-dark">
              <div className="text-xs font-mono font-bold text-zinc-600">
                Valid until {quotationDetail.expiry_date}
              </div>
              <div className="flex items-center gap-2.5">
                {quotationDetail.status === "DRAFT" && (
                  <>
                    <button
                      onClick={() => handleStatusTransition("SENT")}
                      className="nb-btn nb-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-black uppercase"
                    >
                      <Send className="h-3.5 w-3.5 stroke-[2.5]" /> Dispatch to Customer
                    </button>
                    <button
                      onClick={() => handleStatusTransition("REJECTED")}
                      className="nb-btn nb-btn-white px-3.5 py-2 text-xs font-black uppercase"
                    >
                      Cancel Quote
                    </button>
                  </>
                )}

                {quotationDetail.status === "SENT" && (
                  <>
                    <button
                      onClick={() => handleStatusTransition("CONFIRMED")}
                      className="nb-btn nb-btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-black uppercase"
                    >
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" /> Confirm / Approve
                    </button>
                    <button
                      onClick={() => handleStatusTransition("REJECTED")}
                      className="nb-btn p-2 bg-nb-coral text-white text-xs font-black uppercase"
                    >
                      Reject
                    </button>
                  </>
                )}

                {quotationDetail.status === "CONFIRMED" && (
                  <button
                    disabled={converting}
                    onClick={handleConvertToSubscription}
                    className="nb-btn nb-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5 stroke-[2.5]" />
                    {converting ? "Converting..." : "Convert to Subscription"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prepare Quotation Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 sm:border-3 border-nb-dark max-w-xl w-full p-6 shadow-nb-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-nb-dark pb-3">
              <h2 className="text-lg font-black uppercase tracking-tight text-nb-dark">
                Prepare Commercial Quotation
              </h2>
              <button onClick={() => setIsCreateOpen(false)} className="nb-btn nb-btn-white p-1 text-nb-dark">
                <X className="h-5 w-5 stroke-[2.5]" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-nb-coral border-2 border-nb-dark text-white text-xs font-bold shadow-nb-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveQuotation} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1">
                  Customer Organization *
                </label>
                <select
                  required
                  value={formCustomerId}
                  onChange={(e) => setFormCustomerId(e.target.value)}
                  className="nb-input w-full p-2.5 text-xs bg-white font-bold"
                >
                  <option value="">Select customer organization...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.company_name} ({c.contact_email})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Subscription Plan *
                  </label>
                  <select
                    required
                    value={formPlanId}
                    onChange={(e) => setFormPlanId(e.target.value)}
                    className="nb-input w-full p-2.5 text-xs bg-white font-bold"
                  >
                    <option value="">Select plan...</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} (₹{Number(p.base_price).toFixed(2)})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Quotation Template (optional)
                  </label>
                  <select
                    value={formTemplateId}
                    onChange={(e) => handleTemplateSelect(e.target.value)}
                    className="nb-input w-full p-2.5 text-xs bg-white font-bold"
                  >
                    <option value="">No template (custom lines)</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product Lines Section */}
              <div className="space-y-2.5 border-2 border-nb-dark p-3.5 bg-cream shadow-nb-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-nb-dark">
                    Additional Product Lines
                  </span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-xs font-black text-nb-blue uppercase hover:underline"
                  >
                    + Add Product Line
                  </button>
                </div>

                {formLines.map((line, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white p-2 border-2 border-nb-dark shadow-nb-sm">
                    <select
                      value={line.product_id}
                      onChange={(e) => {
                        const updated = [...formLines];
                        updated[idx].product_id = e.target.value;
                        setFormLines(updated);
                      }}
                      className="nb-input flex-1 px-2 py-1 text-xs font-bold"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} (₹{Number(p.base_sales_price).toFixed(2)})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={line.quantity}
                      onChange={(e) => {
                        const updated = [...formLines];
                        updated[idx].quantity = Number(e.target.value);
                        setFormLines(updated);
                      }}
                      className="nb-input w-16 px-2 py-1 text-xs font-mono font-black"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      className="nb-btn p-1 bg-nb-coral text-white text-xs"
                    >
                      <X className="h-3.5 w-3.5 stroke-[2.5]" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Promotional Discount Code (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SUMMER20"
                    value={formDiscountCode}
                    onChange={(e) => setFormDiscountCode(e.target.value.toUpperCase())}
                    className="nb-input w-full p-2.5 text-xs font-mono uppercase font-black bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Validity Duration (Days) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formValidityDays}
                    onChange={(e) => setFormValidityDays(Number(e.target.value))}
                    className="nb-input w-full p-2.5 text-xs font-bold bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1">
                  Notes & Special Commercial Terms
                </label>
                <textarea
                  rows={2}
                  placeholder="Terms agreed with customer..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="nb-input w-full p-2.5 text-xs font-bold bg-white"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t-2 border-nb-dark">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="nb-btn nb-btn-white px-3.5 py-2 text-xs font-black uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="nb-btn nb-btn-primary px-4 py-2 text-xs font-black uppercase disabled:opacity-50"
                >
                  {formSubmitting ? "Generating Quote..." : "Generate Quotation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
