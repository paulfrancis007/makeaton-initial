"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Percent,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit2,
  Trash2,
  X,
  Calculator,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import {
  catalogApi,
  DiscountEvaluationResponse,
  DiscountRule,
  Product,
} from "@/lib/api";

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<DiscountRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [scopeFilter, setScopeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountRule | null>(null);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);

  // Form states
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"PERCENTAGE" | "FIXED_AMOUNT">("PERCENTAGE");
  const [formValue, setFormValue] = useState("10.0000");
  const [formScope, setFormScope] = useState<"ORDER" | "PRODUCT_SELECTION">("ORDER");
  const [formFrequency, setFormFrequency] = useState<
    "FIRST_INVOICE_ONLY" | "RECURRING_ALL_CYCLES" | "FINITE_CYCLES"
  >("FIRST_INVOICE_ONLY");
  const [formMaxCycles, setFormMaxCycles] = useState<string>("");
  const [formMinPurchase, setFormMinPurchase] = useState("0.0000");
  const [formMinQty, setFormMinQty] = useState(1);
  const [formValidFrom, setFormValidFrom] = useState("");
  const [formValidUntil, setFormValidUntil] = useState("");
  const [formMaxUses, setFormMaxUses] = useState<string>("");
  const [formEligibleProductIds, setFormEligibleProductIds] = useState<string[]>([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Discount Evaluator State
  const [evalCode, setEvalCode] = useState("");
  const [evalSubtotal, setEvalSubtotal] = useState("1000.0000");
  const [evalCycle, setEvalCycle] = useState(1);
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<DiscountEvaluationResponse | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  const loadDiscounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await catalogApi.listDiscountRules({
        search: searchTerm || undefined,
        discount_type: typeFilter || undefined,
        scope: scopeFilter || undefined,
        is_active: statusFilter === "" ? undefined : statusFilter === "true",
        page,
        page_size: 10,
      });
      setDiscounts(res.items);
      setTotalPages(res.pages || 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load discount rules");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, typeFilter, scopeFilter, statusFilter, page]);

  useEffect(() => {
    loadDiscounts();
  }, [loadDiscounts]);

  // Load available products for selection scope
  useEffect(() => {
    catalogApi.listProducts({ is_active: true, page_size: 100 }).then((res) => {
      setAvailableProducts(res.items);
    }).catch(() => {});
  }, []);

  const openCreateModal = () => {
    setFormCode("");
    setFormName("");
    setFormType("PERCENTAGE");
    setFormValue("10.0000");
    setFormScope("ORDER");
    setFormFrequency("FIRST_INVOICE_ONLY");
    setFormMaxCycles("");
    setFormMinPurchase("0.0000");
    setFormMinQty(1);
    setFormValidFrom("");
    setFormValidUntil("");
    setFormMaxUses("");
    setFormEligibleProductIds([]);
    setFormError(null);
    setEditingDiscount(null);
    setIsModalOpen(true);
  };

  const openEditModal = (d: DiscountRule) => {
    setFormCode(d.code);
    setFormName(d.name);
    setFormType(d.discount_type);
    setFormValue(d.discount_value);
    setFormScope(d.scope);
    setFormFrequency(d.application_frequency);
    setFormMaxCycles(d.max_cycles ? String(d.max_cycles) : "");
    setFormMinPurchase(d.minimum_purchase_amount);
    setFormMinQty(d.minimum_quantity);
    setFormValidFrom(d.valid_from ? d.valid_from.substring(0, 16) : "");
    setFormValidUntil(d.valid_until ? d.valid_until.substring(0, 16) : "");
    setFormMaxUses(d.max_uses ? String(d.max_uses) : "");
    setFormEligibleProductIds(d.eligible_product_ids || []);
    setFormError(null);
    setEditingDiscount(d);
    setIsModalOpen(true);
  };

  const handleSaveDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    try {
      const payload: Partial<DiscountRule> = {
        code: formCode.trim().toUpperCase(),
        name: formName.trim(),
        discount_type: formType,
        discount_value: formValue,
        scope: formScope,
        application_frequency: formFrequency,
        max_cycles: formMaxCycles ? Number(formMaxCycles) : null,
        minimum_purchase_amount: formMinPurchase,
        minimum_quantity: Number(formMinQty),
        valid_from: formValidFrom ? new Date(formValidFrom).toISOString() : null,
        valid_until: formValidUntil ? new Date(formValidUntil).toISOString() : null,
        max_uses: formMaxUses ? Number(formMaxUses) : null,
        eligible_product_ids: formScope === "PRODUCT_SELECTION" ? formEligibleProductIds : [],
      };

      if (editingDiscount) {
        await catalogApi.updateDiscountRule(editingDiscount.id, payload);
      } else {
        await catalogApi.createDiscountRule(payload);
      }
      setIsModalOpen(false);
      loadDiscounts();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save discount rule");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeactivateDiscount = async (d: DiscountRule) => {
    if (!confirm(`Are you sure you want to deactivate discount rule "${d.code}"?`)) return;
    try {
      await catalogApi.deactivateDiscountRule(d.id);
      loadDiscounts();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to deactivate");
    }
  };

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalCode.trim()) return;
    setEvaluating(true);
    setEvalError(null);
    setEvalResult(null);
    try {
      const res = await catalogApi.evaluateDiscount({
        code: evalCode.trim(),
        order_subtotal: evalSubtotal,
        cycle_number: Number(evalCycle),
      });
      setEvalResult(res);
    } catch (err: unknown) {
      setEvalError(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border-2 sm:border-3 border-nb-dark p-6 shadow-nb flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-nb-purple text-nb-dark border-2 border-nb-dark text-[10px] font-black uppercase tracking-wider shadow-nb-sm mb-2">
            Discount Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-2.5 text-nb-dark">
            <Percent className="h-7 w-7 stroke-[2.5]" />
            Discount Rules & Engine
          </h1>
          <p className="text-xs font-bold text-zinc-600 mt-1">
            Configure promotional percentage and fixed discounts, scope boundaries, cycle frequencies, usage quotas, and test calculations.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="nb-btn nb-btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          New Discount Rule
        </button>
      </div>

      {/* Interactive Discount Evaluator Widget */}
      <div className="bg-nb-yellow text-nb-dark border-2 sm:border-3 border-nb-dark p-6 shadow-nb-lg">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 bg-white border-2 border-nb-dark flex items-center justify-center shadow-nb-sm">
            <Calculator className="h-5 w-5 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="font-black text-sm uppercase tracking-tight">Interactive Discount Evaluator</h3>
            <span className="text-[10px] bg-white text-nb-dark font-black uppercase px-2 py-0.5 border border-nb-dark shadow-nb-sm inline-block mt-0.5">
              Real-time Rule Engine Simulator
            </span>
          </div>
        </div>

        <form onSubmit={handleEvaluate} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1">Discount Code</label>
            <input
              type="text"
              required
              placeholder="e.g. SUMMER20"
              value={evalCode}
              onChange={(e) => setEvalCode(e.target.value.toUpperCase())}
              className="nb-input w-full px-3 py-2 text-xs font-mono uppercase font-black bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1">Order Subtotal (₹)</label>
            <input
              type="number"
              step="0.0001"
              required
              value={evalSubtotal}
              onChange={(e) => setEvalSubtotal(e.target.value)}
              className="nb-input w-full px-3 py-2 text-xs font-mono font-black bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1">Billing Cycle #</label>
            <input
              type="number"
              min="1"
              required
              value={evalCycle}
              onChange={(e) => setEvalCycle(Number(e.target.value))}
              className="nb-input w-full px-3 py-2 text-xs font-mono font-black bg-white"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={evaluating}
              className="w-full nb-btn nb-btn-white py-2 text-xs font-black uppercase flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {evaluating ? "Evaluating..." : "Evaluate Code"}
              <ArrowRight className="h-4 w-4 stroke-[2.5]" />
            </button>
          </div>
        </form>

        {/* Evaluation Output */}
        {evalResult && (
          <div
            className={`mt-4 p-4 border-2 border-nb-dark shadow-nb-sm text-xs font-bold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              evalResult.is_eligible
                ? "bg-nb-green text-nb-dark"
                : "bg-nb-coral text-white"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {evalResult.is_eligible ? (
                <CheckCircle className="h-6 w-6 stroke-[2.5] shrink-0" />
              ) : (
                <XCircle className="h-6 w-6 stroke-[2.5] shrink-0" />
              )}
              <div>
                <span className="font-black uppercase tracking-wider text-sm">
                  {evalResult.is_eligible ? "Eligible" : "Ineligible"}
                </span>
                {evalResult.rule_name && (
                  <span className="ml-2">({evalResult.rule_name})</span>
                )}
                {evalResult.rejection_reason && (
                  <div className="text-[11px] font-mono mt-1">
                    Reason: {evalResult.rejection_reason}
                  </div>
                )}
              </div>
            </div>

            {evalResult.is_eligible && (
              <div className="flex items-center gap-6 border-t sm:border-t-0 sm:border-l-2 border-nb-dark pt-2 sm:pt-0 sm:pl-6">
                <div>
                  <span className="text-[10px] uppercase font-black block">Discount</span>
                  <span className="font-mono text-base font-black">
                    ₹{Number(evalResult.discount_amount).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-black block">Net Subtotal</span>
                  <span className="font-mono text-base font-black">
                    ₹{(Number(evalSubtotal) - Number(evalResult.discount_amount)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {evalError && (
          <div className="mt-3 p-3 bg-nb-coral border-2 border-nb-dark text-white text-xs font-bold shadow-nb-sm">
            {evalError}
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 border-2 sm:border-3 border-nb-dark shadow-nb flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-nb-dark stroke-[2.5]" />
          <input
            type="text"
            placeholder="Search by discount code or name..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="nb-input w-full pl-9 pr-4 py-2 text-xs bg-white font-bold"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="nb-input px-3 py-2 text-xs bg-white font-bold"
        >
          <option value="">All Types</option>
          <option value="PERCENTAGE">PERCENTAGE</option>
          <option value="FIXED_AMOUNT">FIXED_AMOUNT</option>
        </select>
        <select
          value={scopeFilter}
          onChange={(e) => {
            setScopeFilter(e.target.value);
            setPage(1);
          }}
          className="nb-input px-3 py-2 text-xs bg-white font-bold"
        >
          <option value="">All Scopes</option>
          <option value="ORDER">ORDER</option>
          <option value="PRODUCT_SELECTION">PRODUCT_SELECTION</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="nb-input px-3 py-2 text-xs bg-white font-bold"
        >
          <option value="">All Statuses</option>
          <option value="true">Active Only</option>
          <option value="false">Inactive Only</option>
        </select>
      </div>

      {error && (
        <div className="p-3.5 bg-nb-coral text-white border-2 border-nb-dark shadow-nb flex items-center gap-2.5 text-xs font-bold">
          <AlertCircle className="h-5 w-5 stroke-[2.5] shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Discount Table */}
      <div className="bg-white border-2 sm:border-3 border-nb-dark shadow-nb overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs font-black uppercase tracking-wider text-nb-dark flex flex-col items-center gap-3">
            <RefreshCw className="h-7 w-7 animate-spin stroke-[2.5] text-nb-dark" />
            Loading discount rules...
          </div>
        ) : discounts.length === 0 ? (
          <div className="py-20 text-center text-nb-dark flex flex-col items-center">
            <Percent className="h-12 w-12 stroke-[2] mb-3 text-zinc-400" />
            <h3 className="font-black uppercase tracking-wide text-base">No discount rules found</h3>
            <p className="text-xs font-bold text-zinc-500 mt-1">Create promotional coupons and volume discount rules above.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs font-bold">
            <thead className="bg-nb-dark text-white font-black uppercase tracking-wider border-b-2 border-nb-dark text-[11px]">
              <tr>
                <th className="px-5 py-3 text-left">Code & Name</th>
                <th className="px-5 py-3 text-left">Type & Value</th>
                <th className="px-5 py-3 text-left">Scope & Frequency</th>
                <th className="px-5 py-3 text-center">Usage</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-nb-dark text-nb-dark">
              {discounts.map((d) => (
                <tr key={d.id} className="hover:bg-cream transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-mono font-black text-sm text-nb-dark">{d.code}</div>
                    <div className="text-[11px] text-zinc-600 line-clamp-1 font-normal mt-0.5">{d.name}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-black text-sm text-nb-dark font-mono">
                      {d.discount_type === "PERCENTAGE"
                        ? `${Number(d.discount_value).toFixed(2)}%`
                        : `₹${Number(d.discount_value).toFixed(2)}`}
                    </div>
                    <div className="text-[10px] text-zinc-500 uppercase font-black">{d.discount_type}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-cream border border-nb-dark shadow-nb-sm block w-fit mb-1">
                      {d.scope}
                    </span>
                    <span className="text-[10px] text-zinc-600 block font-bold">
                      {d.application_frequency}
                      {d.max_cycles ? ` (${d.max_cycles} cycles)` : ""}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center font-mono font-bold text-xs">
                    {d.current_uses} / {d.max_uses !== null ? d.max_uses : "∞"}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {d.is_active ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-nb-green text-nb-dark px-2 py-0.5 border border-nb-dark shadow-nb-sm">
                        <CheckCircle className="h-3 w-3 stroke-[2.5]" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-zinc-200 text-zinc-700 px-2 py-0.5 border border-nb-dark shadow-nb-sm">
                        <XCircle className="h-3 w-3 stroke-[2.5]" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right space-x-2">
                    <button
                      onClick={() => openEditModal(d)}
                      className="nb-btn nb-btn-white p-1.5"
                      title="Edit Discount Rule"
                    >
                      <Edit2 className="h-3.5 w-3.5 stroke-[2.5]" />
                    </button>
                    {d.is_active && (
                      <button
                        onClick={() => handleDeactivateDiscount(d)}
                        className="nb-btn p-1.5 bg-nb-coral text-white"
                        title="Deactivate Discount Rule"
                      >
                        <Trash2 className="h-3.5 w-3.5 stroke-[2.5]" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
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

      {/* Discount Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 sm:border-3 border-nb-dark max-w-xl w-full p-6 shadow-nb-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-nb-dark pb-3">
              <h2 className="text-lg font-black uppercase tracking-tight text-nb-dark">
                {editingDiscount ? "Edit Discount Rule" : "Create Discount Rule"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="nb-btn nb-btn-white p-1 text-nb-dark">
                <X className="h-5 w-5 stroke-[2.5]" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-nb-coral border-2 border-nb-dark text-white text-xs font-bold shadow-nb-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveDiscount} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Coupon / Rule Code *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingDiscount}
                    placeholder="e.g. FLASH50"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="nb-input w-full p-2.5 text-xs font-mono uppercase font-black bg-white disabled:bg-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Rule Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 50% Flash Sale"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="nb-input w-full p-2.5 text-xs bg-white font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Discount Type *
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as "PERCENTAGE" | "FIXED_AMOUNT")}
                    className="nb-input w-full p-2.5 text-xs bg-white font-bold"
                  >
                    <option value="PERCENTAGE">PERCENTAGE</option>
                    <option value="FIXED_AMOUNT">FIXED_AMOUNT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Discount Value {formType === "PERCENTAGE" ? "(%)" : "(₹)"} *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    max={formType === "PERCENTAGE" ? "100" : undefined}
                    required
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    className="nb-input w-full p-2.5 text-xs font-mono font-black bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Discount Scope *
                  </label>
                  <select
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value as "ORDER" | "PRODUCT_SELECTION")}
                    className="nb-input w-full p-2.5 text-xs bg-white font-bold"
                  >
                    <option value="ORDER">ORDER (All products)</option>
                    <option value="PRODUCT_SELECTION">PRODUCT_SELECTION (Specific items)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Application Frequency *
                  </label>
                  <select
                    value={formFrequency}
                    onChange={(e) => setFormFrequency(e.target.value as any)}
                    className="nb-input w-full p-2.5 text-xs bg-white font-bold"
                  >
                    <option value="FIRST_INVOICE_ONLY">FIRST_INVOICE_ONLY</option>
                    <option value="RECURRING_ALL_CYCLES">RECURRING_ALL_CYCLES</option>
                    <option value="FINITE_CYCLES">FINITE_CYCLES</option>
                  </select>
                </div>
              </div>

              {formFrequency === "FINITE_CYCLES" && (
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Max Cycles *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 3"
                    value={formMaxCycles}
                    onChange={(e) => setFormMaxCycles(e.target.value)}
                    className="nb-input w-full p-2.5 text-xs font-bold bg-white"
                  />
                </div>
              )}

              {/* Product Selection picker */}
              {formScope === "PRODUCT_SELECTION" && (
                <div className="bg-cream p-3.5 border-2 border-nb-dark shadow-nb-sm space-y-2">
                  <label className="block text-xs font-black uppercase tracking-wider text-nb-dark">
                    Eligible Products (select at least one)
                  </label>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 border-2 border-nb-dark p-2.5 bg-white">
                    {availableProducts.map((p) => {
                      const isChecked = formEligibleProductIds.includes(p.id);
                      return (
                        <label key={p.id} className="flex items-center gap-2 text-xs font-bold text-nb-dark cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormEligibleProductIds([...formEligibleProductIds, p.id]);
                              } else {
                                setFormEligibleProductIds(formEligibleProductIds.filter((id) => id !== p.id));
                              }
                            }}
                            className="accent-nb-dark h-4 w-4 rounded-none border-2 border-nb-dark"
                          />
                          <span>{p.name} ({p.product_type})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Minimum Purchase Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={formMinPurchase}
                    onChange={(e) => setFormMinPurchase(e.target.value)}
                    className="nb-input w-full p-2.5 text-xs font-mono font-black bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Minimum Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formMinQty}
                    onChange={(e) => setFormMinQty(Number(e.target.value))}
                    className="nb-input w-full p-2.5 text-xs font-bold bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Valid From (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formValidFrom}
                    onChange={(e) => setFormValidFrom(e.target.value)}
                    className="nb-input w-full p-2 text-xs font-mono font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Valid Until (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formValidUntil}
                    onChange={(e) => setFormValidUntil(e.target.value)}
                    className="nb-input w-full p-2 text-xs font-mono font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Max Global Uses (optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={formMaxUses}
                    onChange={(e) => setFormMaxUses(e.target.value)}
                    className="nb-input w-full p-2 text-xs font-bold bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t-2 border-nb-dark">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="nb-btn nb-btn-white px-3.5 py-2 text-xs font-black uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="nb-btn nb-btn-primary px-4 py-2 text-xs font-black uppercase disabled:opacity-50"
                >
                  {formSubmitting ? "Saving..." : editingDiscount ? "Update Rule" : "Create Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
