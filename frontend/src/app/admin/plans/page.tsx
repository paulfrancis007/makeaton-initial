"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Layers,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Receipt,
  Edit2,
  Trash2,
  X,
  RefreshCw,
} from "lucide-react";
import {
  catalogApi,
  Plan,
  TaxRule,
} from "@/lib/api";

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [intervalFilter, setIntervalFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [selectedPlanForTaxes, setSelectedPlanForTaxes] = useState<Plan | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formInterval, setFormInterval] = useState<"DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY">("MONTHLY");
  const [formIntervalCount, setFormIntervalCount] = useState(1);
  const [formBasePrice, setFormBasePrice] = useState("0.0000");
  const [formMinQty, setFormMinQty] = useState(1);
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formAutoRenew, setFormAutoRenew] = useState(true);
  const [formAutoClose, setFormAutoClose] = useState(false);
  const [formAllowPause, setFormAllowPause] = useState(true);
  const [formAllowEarlyClose, setFormAllowEarlyClose] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Taxes state
  const [allTaxRules, setAllTaxRules] = useState<TaxRule[]>([]);
  const [assignedTaxIds, setAssignedTaxIds] = useState<string[]>([]);
  const [taxesLoading, setTaxesLoading] = useState(false);
  const [taxesSaving, setTaxesSaving] = useState(false);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await catalogApi.listPlans({
        search: searchTerm || undefined,
        billing_interval: intervalFilter || undefined,
        is_active: statusFilter === "" ? undefined : statusFilter === "true",
        page,
        page_size: 10,
      });
      setPlans(res.items);
      setTotalPages(res.pages || 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, intervalFilter, statusFilter, page]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const loadTaxesForPlan = useCallback(async (planId: string) => {
    setTaxesLoading(true);
    try {
      const [taxRulesRes, assignedTaxes] = await Promise.all([
        catalogApi.listTaxRules({ is_active: true, page_size: 100 }),
        catalogApi.getPlanTaxes(planId),
      ]);
      setAllTaxRules(taxRulesRes.items);
      setAssignedTaxIds(assignedTaxes.map((t) => t.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load taxes");
    } finally {
      setTaxesLoading(false);
    }
  }, []);

  const openCreateModal = () => {
    setFormName("");
    setFormDesc("");
    setFormInterval("MONTHLY");
    setFormIntervalCount(1);
    setFormBasePrice("0.0000");
    setFormMinQty(1);
    setFormStartDate("");
    setFormEndDate("");
    setFormAutoRenew(true);
    setFormAutoClose(false);
    setFormAllowPause(true);
    setFormAllowEarlyClose(true);
    setFormError(null);
    setEditingPlan(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Plan) => {
    setFormName(p.name);
    setFormDesc(p.description || "");
    setFormInterval(p.billing_interval);
    setFormIntervalCount(p.interval_count);
    setFormBasePrice(p.base_price);
    setFormMinQty(p.minimum_quantity);
    setFormStartDate(p.availability_start_date || "");
    setFormEndDate(p.availability_end_date || "");
    setFormAutoRenew(p.auto_renew);
    setFormAutoClose(p.auto_close_on_expiry);
    setFormAllowPause(p.allow_pause);
    setFormAllowEarlyClose(p.allow_early_closure);
    setFormError(null);
    setEditingPlan(p);
    setIsModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formAutoRenew && formAutoClose) {
      setFormError("Auto-Renew and Auto-Close on Expiry cannot both be enabled simultaneously.");
      return;
    }
    setFormSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        name: formName,
        description: formDesc || null,
        billing_interval: formInterval,
        interval_count: Number(formIntervalCount),
        base_price: formBasePrice,
        minimum_quantity: Number(formMinQty),
        availability_start_date: formStartDate || null,
        availability_end_date: formEndDate || null,
        auto_renew: formAutoRenew,
        auto_close_on_expiry: formAutoClose,
        allow_pause: formAllowPause,
        allow_early_closure: formAllowEarlyClose,
      };

      if (editingPlan) {
        await catalogApi.updatePlan(editingPlan.id, payload);
      } else {
        await catalogApi.createPlan(payload);
      }
      setIsModalOpen(false);
      loadPlans();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save plan");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeactivatePlan = async (p: Plan) => {
    if (!confirm(`Are you sure you want to deactivate plan "${p.name}"?`)) return;
    try {
      await catalogApi.deactivatePlan(p.id);
      loadPlans();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to deactivate");
    }
  };

  const handleSaveTaxes = async () => {
    if (!selectedPlanForTaxes) return;
    setTaxesSaving(true);
    try {
      await catalogApi.setPlanTaxes(selectedPlanForTaxes.id, assignedTaxIds);
      setSelectedPlanForTaxes(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to save taxes");
    } finally {
      setTaxesSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border-2 sm:border-3 border-nb-dark p-6 shadow-nb flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-nb-green border-2 border-nb-dark text-[10px] font-black uppercase tracking-wider shadow-nb-sm mb-2">
            Pricing Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-2.5 text-nb-dark">
            <Layers className="h-7 w-7 stroke-[2.5]" />
            Subscription Plans
          </h1>
          <p className="text-xs font-bold text-zinc-600 mt-1">
            Configure recurring billing plans, intervals, renewal rules, pause limits, and tax mappings.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="nb-btn nb-btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          New Plan
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 border-2 sm:border-3 border-nb-dark shadow-nb flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-nb-dark stroke-[2.5]" />
          <input
            type="text"
            placeholder="Search by plan name or description..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="nb-input w-full pl-9 pr-4 py-2 text-xs bg-white font-bold"
          />
        </div>
        <select
          value={intervalFilter}
          onChange={(e) => {
            setIntervalFilter(e.target.value);
            setPage(1);
          }}
          className="nb-input px-3 py-2 text-xs bg-white font-bold"
        >
          <option value="">All Intervals</option>
          <option value="DAILY">Daily</option>
          <option value="WEEKLY">Weekly</option>
          <option value="MONTHLY">Monthly</option>
          <option value="YEARLY">Yearly</option>
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

      {/* Plans Table */}
      <div className="bg-white border-2 sm:border-3 border-nb-dark shadow-nb overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs font-black uppercase tracking-wider text-nb-dark flex flex-col items-center gap-3">
            <RefreshCw className="h-7 w-7 animate-spin stroke-[2.5] text-nb-dark" />
            Loading subscription plans...
          </div>
        ) : plans.length === 0 ? (
          <div className="py-20 text-center text-nb-dark flex flex-col items-center">
            <Layers className="h-12 w-12 stroke-[2] mb-3 text-zinc-400" />
            <h3 className="font-black uppercase tracking-wide text-base">No plans found</h3>
            <p className="text-xs font-bold text-zinc-500 mt-1">Try adjusting your filters or create a new plan.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs font-bold">
            <thead className="bg-nb-dark text-white font-black uppercase tracking-wider border-b-2 border-nb-dark text-[11px]">
              <tr>
                <th className="px-5 py-3 text-left">Plan Name</th>
                <th className="px-5 py-3 text-left">Interval</th>
                <th className="px-5 py-3 text-right">Base Price</th>
                <th className="px-5 py-3 text-center">Renewal Policy</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-nb-dark text-nb-dark">
              {plans.map((p) => (
                <tr key={p.id} className="hover:bg-cream transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-black text-sm text-nb-dark">{p.name}</div>
                    {p.description && (
                      <div className="text-[11px] text-zinc-600 line-clamp-1 font-normal mt-0.5">{p.description}</div>
                    )}
                  </td>
                  <td className="px-5 py-4 font-mono font-bold text-zinc-700">
                    {p.interval_count > 1 ? `${p.interval_count} ` : ""}
                    {p.billing_interval}
                  </td>
                  <td className="px-5 py-4 text-right font-mono font-black text-nb-dark">
                    ₹{Number(p.base_price).toFixed(2)}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {p.auto_renew ? (
                      <span className="text-[10px] font-black uppercase bg-nb-yellow text-nb-dark px-2 py-0.5 border border-nb-dark shadow-nb-sm">
                        Auto-Renew
                      </span>
                    ) : p.auto_close_on_expiry ? (
                      <span className="text-[10px] font-black uppercase bg-cream text-nb-dark px-2 py-0.5 border border-nb-dark shadow-nb-sm">
                        Auto-Close
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">Manual</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {p.is_active ? (
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
                      onClick={() => {
                        setSelectedPlanForTaxes(p);
                        loadTaxesForPlan(p.id);
                      }}
                      className="nb-btn nb-btn-white inline-flex items-center gap-1 text-[11px] px-2.5 py-1 font-black uppercase"
                      title="Assign Tax Rules"
                    >
                      <Receipt className="h-3.5 w-3.5 stroke-[2.5]" /> Taxes
                    </button>
                    <button
                      onClick={() => openEditModal(p)}
                      className="nb-btn nb-btn-white p-1.5"
                      title="Edit Plan"
                    >
                      <Edit2 className="h-3.5 w-3.5 stroke-[2.5]" />
                    </button>
                    {p.is_active && (
                      <button
                        onClick={() => handleDeactivatePlan(p)}
                        className="nb-btn p-1.5 bg-nb-coral text-white"
                        title="Deactivate Plan"
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

      {/* Plan Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 sm:border-3 border-nb-dark max-w-lg w-full p-6 shadow-nb-xl space-y-4">
            <div className="flex items-center justify-between border-b-2 border-nb-dark pb-3">
              <h2 className="text-lg font-black uppercase tracking-tight text-nb-dark">
                {editingPlan ? "Edit Plan" : "Create Subscription Plan"}
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

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1">
                  Plan Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Enterprise Monthly"
                  className="nb-input w-full p-2.5 text-xs bg-white font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={2}
                  className="nb-input w-full p-2.5 text-xs bg-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Billing Interval *
                  </label>
                  <select
                    value={formInterval}
                    onChange={(e) => setFormInterval(e.target.value as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY")}
                    className="nb-input w-full p-2.5 text-xs bg-white font-bold"
                  >
                    <option value="DAILY">DAILY</option>
                    <option value="WEEKLY">WEEKLY</option>
                    <option value="MONTHLY">MONTHLY</option>
                    <option value="YEARLY">YEARLY</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Interval Count *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formIntervalCount}
                    onChange={(e) => setFormIntervalCount(Number(e.target.value))}
                    className="nb-input w-full p-2.5 text-xs bg-white font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Base Recurring Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    required
                    value={formBasePrice}
                    onChange={(e) => setFormBasePrice(e.target.value)}
                    className="nb-input w-full p-2.5 text-xs font-mono font-black bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Min Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formMinQty}
                    onChange={(e) => setFormMinQty(Number(e.target.value))}
                    className="nb-input w-full p-2.5 text-xs bg-white font-bold"
                  />
                </div>
              </div>

              {/* Renewal Invariant Policy */}
              <div className="bg-cream p-3.5 border-2 border-nb-dark shadow-nb-sm space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-nb-dark block">
                  Renewal Constraints (Mutually Exclusive)
                </span>
                <div className="flex items-center gap-6 text-xs font-black uppercase">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAutoRenew}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setFormAutoRenew(val);
                        if (val) setFormAutoClose(false);
                      }}
                      className="accent-nb-dark h-4 w-4 rounded-none border-2 border-nb-dark"
                    />
                    <span className="text-nb-dark">Auto-Renew</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAutoClose}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setFormAutoClose(val);
                        if (val) setFormAutoRenew(false);
                      }}
                      className="accent-nb-dark h-4 w-4 rounded-none border-2 border-nb-dark"
                    />
                    <span className="text-nb-dark">Auto-Close on Expiry</span>
                  </label>
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
                  {formSubmitting ? "Saving..." : editingPlan ? "Update Plan" : "Create Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tax Assignment Modal */}
      {selectedPlanForTaxes && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 sm:border-3 border-nb-dark max-w-md w-full p-6 shadow-nb-xl space-y-4">
            <div className="flex items-center justify-between border-b-2 border-nb-dark pb-3">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight text-nb-dark">
                  Assign Plan Taxes
                </h2>
                <p className="text-xs font-bold text-zinc-600">
                  Plan: {selectedPlanForTaxes.name}
                </p>
              </div>
              <button onClick={() => setSelectedPlanForTaxes(null)} className="nb-btn nb-btn-white p-1 text-nb-dark">
                <X className="h-5 w-5 stroke-[2.5]" />
              </button>
            </div>

            {taxesLoading ? (
              <div className="p-6 text-center text-xs font-black uppercase tracking-wider text-zinc-500">Loading taxes...</div>
            ) : allTaxRules.length === 0 ? (
              <div className="p-4 text-center text-xs font-bold text-zinc-500">
                No active tax rules configured. Create tax rules in the Tax Rules menu first.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto border-2 border-nb-dark p-3 shadow-nb-sm">
                {allTaxRules.map((tr) => {
                  const isChecked = assignedTaxIds.includes(tr.id);
                  return (
                    <label
                      key={tr.id}
                      className="flex items-center justify-between p-2.5 hover:bg-cream text-xs font-bold cursor-pointer border border-nb-dark bg-white transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAssignedTaxIds([...assignedTaxIds, tr.id]);
                            } else {
                              setAssignedTaxIds(assignedTaxIds.filter((id) => id !== tr.id));
                            }
                          }}
                          className="accent-nb-dark h-4 w-4 rounded-none border-2 border-nb-dark"
                        />
                        <span className="font-black text-nb-dark">{tr.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-black text-nb-blue">
                          {Number(tr.rate).toFixed(2)}%
                        </span>
                        <span className="text-[10px] text-zinc-500 block uppercase font-bold">
                          {tr.tax_scope}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-3 border-t-2 border-nb-dark">
              <button
                type="button"
                onClick={() => setSelectedPlanForTaxes(null)}
                className="nb-btn nb-btn-white px-3.5 py-2 text-xs font-black uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={taxesSaving}
                onClick={handleSaveTaxes}
                className="nb-btn nb-btn-primary px-4 py-2 text-xs font-black uppercase disabled:opacity-50"
              >
                {taxesSaving ? "Saving..." : "Save Taxes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
