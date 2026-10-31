"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Receipt,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit2,
  Trash2,
  X,
  Globe,
  RefreshCw,
} from "lucide-react";
import {
  catalogApi,
  TaxRule,
} from "@/lib/api";

export default function TaxesPage() {
  const [taxes, setTaxes] = useState<TaxRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [scopeFilter, setScopeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<TaxRule | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formRate, setFormRate] = useState("18.0000");
  const [formType, setFormType] = useState("PERCENTAGE");
  const [formIsCompound, setFormIsCompound] = useState(false);
  const [formCountry, setFormCountry] = useState("IN");
  const [formState, setFormState] = useState("");
  const [formScope, setFormScope] = useState<
    "STANDARD" | "INTRASTATE_CGST" | "INTRASTATE_SGST" | "INTERSTATE_IGST" | "VAT" | "EXEMPT"
  >("STANDARD");
  const [formValidFrom, setFormValidFrom] = useState("");
  const [formValidUntil, setFormValidUntil] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadTaxes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await catalogApi.listTaxRules({
        search: searchTerm || undefined,
        tax_scope: scopeFilter || undefined,
        is_active: statusFilter === "" ? undefined : statusFilter === "true",
        page,
        page_size: 10,
      });
      setTaxes(res.items);
      setTotalPages(res.pages || 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load tax rules");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, scopeFilter, statusFilter, page]);

  useEffect(() => {
    loadTaxes();
  }, [loadTaxes]);

  const openCreateModal = () => {
    setFormName("");
    setFormRate("18.0000");
    setFormType("PERCENTAGE");
    setFormIsCompound(false);
    setFormCountry("IN");
    setFormState("");
    setFormScope("STANDARD");
    setFormValidFrom("");
    setFormValidUntil("");
    setFormError(null);
    setEditingTax(null);
    setIsModalOpen(true);
  };

  const openEditModal = (t: TaxRule) => {
    setFormName(t.name);
    setFormRate(t.rate);
    setFormType(t.tax_type);
    setFormIsCompound(t.is_compound);
    setFormCountry(t.jurisdiction_country);
    setFormState(t.jurisdiction_state);
    setFormScope(t.tax_scope);
    setFormValidFrom(t.valid_from ? t.valid_from.substring(0, 16) : "");
    setFormValidUntil(t.valid_until ? t.valid_until.substring(0, 16) : "");
    setFormError(null);
    setEditingTax(t);
    setIsModalOpen(true);
  };

  const handleSaveTax = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    try {
      const payload: Partial<TaxRule> = {
        name: formName,
        rate: formRate,
        tax_type: formType,
        is_compound: formIsCompound,
        jurisdiction_country: formCountry.toUpperCase(),
        jurisdiction_state: formState,
        tax_scope: formScope,
        valid_from: formValidFrom ? new Date(formValidFrom).toISOString() : undefined,
        valid_until: formValidUntil ? new Date(formValidUntil).toISOString() : null,
      };

      if (editingTax) {
        await catalogApi.updateTaxRule(editingTax.id, payload);
      } else {
        await catalogApi.createTaxRule(payload);
      }
      setIsModalOpen(false);
      loadTaxes();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save tax rule");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeactivateTax = async (t: TaxRule) => {
    if (!confirm(`Are you sure you want to deactivate tax rule "${t.name}"?`)) return;
    try {
      await catalogApi.deactivateTaxRule(t.id);
      loadTaxes();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to deactivate");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border-2 sm:border-3 border-nb-dark p-6 shadow-nb flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-nb-coral text-white border-2 border-nb-dark text-[10px] font-black uppercase tracking-wider shadow-nb-sm mb-2">
            Tax Snapshot Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-2.5 text-nb-dark">
            <Receipt className="h-7 w-7 stroke-[2.5]" />
            Tax Configuration
          </h1>
          <p className="text-xs font-bold text-zinc-600 mt-1">
            Define statutory GST/VAT rates, jurisdiction boundaries, compound rules, and validity timelines with PostgreSQL GiST exclusion enforcement.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="nb-btn nb-btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          New Tax Rule
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 border-2 sm:border-3 border-nb-dark shadow-nb flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-nb-dark stroke-[2.5]" />
          <input
            type="text"
            placeholder="Search by tax rule name..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="nb-input w-full pl-9 pr-4 py-2 text-xs bg-white font-bold"
          />
        </div>
        <select
          value={scopeFilter}
          onChange={(e) => {
            setScopeFilter(e.target.value);
            setPage(1);
          }}
          className="nb-input px-3 py-2 text-xs bg-white font-bold"
        >
          <option value="">All Scopes</option>
          <option value="STANDARD">STANDARD</option>
          <option value="INTRASTATE_CGST">INTRASTATE_CGST</option>
          <option value="INTRASTATE_SGST">INTRASTATE_SGST</option>
          <option value="INTERSTATE_IGST">INTERSTATE_IGST</option>
          <option value="VAT">VAT</option>
          <option value="EXEMPT">EXEMPT</option>
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

      {/* Tax Table */}
      <div className="bg-white border-2 sm:border-3 border-nb-dark shadow-nb overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs font-black uppercase tracking-wider text-nb-dark flex flex-col items-center gap-3">
            <RefreshCw className="h-7 w-7 animate-spin stroke-[2.5] text-nb-dark" />
            Loading tax rules...
          </div>
        ) : taxes.length === 0 ? (
          <div className="py-20 text-center text-nb-dark flex flex-col items-center">
            <Receipt className="h-12 w-12 stroke-[2] mb-3 text-zinc-400" />
            <h3 className="font-black uppercase tracking-wide text-base">No tax rules found</h3>
            <p className="text-xs font-bold text-zinc-500 mt-1">Configure your statutory GST/VAT rules above.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs font-bold">
            <thead className="bg-nb-dark text-white font-black uppercase tracking-wider border-b-2 border-nb-dark text-[11px]">
              <tr>
                <th className="px-5 py-3 text-left">Tax Rule</th>
                <th className="px-5 py-3 text-left">Scope</th>
                <th className="px-5 py-3 text-left">Jurisdiction</th>
                <th className="px-5 py-3 text-right">Rate (%)</th>
                <th className="px-5 py-3 text-center">Compound</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-nb-dark text-nb-dark">
              {taxes.map((t) => (
                <tr key={t.id} className="hover:bg-cream transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-black text-sm text-nb-dark">{t.name}</div>
                    <div className="text-[10px] text-zinc-500 font-mono font-bold mt-0.5">
                      {t.valid_from ? new Date(t.valid_from).toLocaleDateString() : "Now"} →{" "}
                      {t.valid_until ? new Date(t.valid_until).toLocaleDateString() : "Indefinite"}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider font-mono bg-cream border border-nb-dark shadow-nb-sm">
                      {t.tax_scope}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-nb-dark">
                      <Globe className="h-3.5 w-3.5 stroke-[2.5] text-zinc-600" />
                      <span>{t.jurisdiction_country}</span>
                      {t.jurisdiction_state && (
                        <span className="text-zinc-600">/ {t.jurisdiction_state}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right font-mono font-black text-nb-blue">
                    {Number(t.rate).toFixed(2)}%
                  </td>
                  <td className="px-5 py-4 text-center text-xs">
                    {t.is_compound ? (
                      <span className="text-nb-purple font-black uppercase text-[10px] bg-cream px-1.5 py-0.5 border border-nb-dark">Yes</span>
                    ) : (
                      <span className="text-zinc-500 font-bold uppercase text-[10px]">No</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {t.is_active ? (
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
                      onClick={() => openEditModal(t)}
                      className="nb-btn nb-btn-white p-1.5"
                      title="Edit Tax Rule"
                    >
                      <Edit2 className="h-3.5 w-3.5 stroke-[2.5]" />
                    </button>
                    {t.is_active && (
                      <button
                        onClick={() => handleDeactivateTax(t)}
                        className="nb-btn p-1.5 bg-nb-coral text-white"
                        title="Deactivate Tax Rule"
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

      {/* Tax Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 sm:border-3 border-nb-dark max-w-lg w-full p-6 shadow-nb-xl space-y-4">
            <div className="flex items-center justify-between border-b-2 border-nb-dark pb-3">
              <h2 className="text-lg font-black uppercase tracking-tight text-nb-dark">
                {editingTax ? "Edit Tax Rule" : "Create Statutory Tax Rule"}
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

            <form onSubmit={handleSaveTax} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1">
                  Tax Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. GST Intra-State CGST 9%"
                  className="nb-input w-full p-2.5 text-xs bg-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Rate (%) *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    max="100"
                    required
                    value={formRate}
                    onChange={(e) => setFormRate(e.target.value)}
                    className="nb-input w-full p-2.5 text-xs font-mono font-black bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Tax Scope *
                  </label>
                  <select
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value as any)}
                    className="nb-input w-full p-2.5 text-xs font-mono font-bold bg-white"
                  >
                    <option value="STANDARD">STANDARD</option>
                    <option value="INTRASTATE_CGST">INTRASTATE_CGST</option>
                    <option value="INTRASTATE_SGST">INTRASTATE_SGST</option>
                    <option value="INTERSTATE_IGST">INTERSTATE_IGST</option>
                    <option value="VAT">VAT</option>
                    <option value="EXEMPT">EXEMPT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Country Code (2 letters) *
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    required
                    value={formCountry}
                    onChange={(e) => setFormCountry(e.target.value.toUpperCase())}
                    className="nb-input w-full p-2.5 text-xs font-mono uppercase font-black bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    State / Jurisdiction (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Karnataka"
                    value={formState}
                    onChange={(e) => setFormState(e.target.value)}
                    className="nb-input w-full p-2.5 text-xs bg-white font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Valid From (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formValidFrom}
                    onChange={(e) => setFormValidFrom(e.target.value)}
                    className="nb-input w-full p-2.5 text-xs font-mono font-bold bg-white"
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
                    className="nb-input w-full p-2.5 text-xs font-mono font-bold bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2.5 bg-cream p-3 border-2 border-nb-dark shadow-nb-sm">
                <input
                  type="checkbox"
                  id="chkCompound"
                  checked={formIsCompound}
                  onChange={(e) => setFormIsCompound(e.target.checked)}
                  className="accent-nb-dark h-4 w-4 rounded-none border-2 border-nb-dark"
                />
                <label htmlFor="chkCompound" className="text-xs font-black uppercase text-nb-dark cursor-pointer">
                  Compound Tax (applied on cumulative amount including previous taxes)
                </label>
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
                  {formSubmitting ? "Saving..." : editingTax ? "Update Tax Rule" : "Create Tax Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
