"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Package,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Layers,
  Receipt,
  Edit2,
  Trash2,
  X,
  RefreshCw,
} from "lucide-react";
import {
  catalogApi,
  Product,
  ProductVariant,
  TaxRule,
} from "@/lib/api";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [productTypeFilter, setProductTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProductForVariants, setSelectedProductForVariants] = useState<Product | null>(null);
  const [selectedProductForTaxes, setSelectedProductForTaxes] = useState<Product | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"SERVICE" | "SOFTWARE" | "ADDON">("SERVICE");
  const [formDesc, setFormDesc] = useState("");
  const [formBasePrice, setFormBasePrice] = useState("0.0000");
  const [formCostPrice, setFormCostPrice] = useState("0.0000");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Variants state
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variantName, setVariantName] = useState("");
  const [variantPriceAdj, setVariantPriceAdj] = useState("0.0000");
  const [variantSku, setVariantSku] = useState("");
  const [variantError, setVariantError] = useState<string | null>(null);

  // Taxes state
  const [allTaxRules, setAllTaxRules] = useState<TaxRule[]>([]);
  const [assignedTaxIds, setAssignedTaxIds] = useState<string[]>([]);
  const [taxesLoading, setTaxesLoading] = useState(false);
  const [taxesSaving, setTaxesSaving] = useState(false);

  // Load products
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await catalogApi.listProducts({
        search: searchTerm || undefined,
        product_type: productTypeFilter || undefined,
        is_active: statusFilter === "" ? undefined : statusFilter === "true",
        page,
        page_size: 10,
      });
      setProducts(res.items);
      setTotalPages(res.pages || 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, productTypeFilter, statusFilter, page]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Load variants for selected product
  const loadVariants = useCallback(async (productId: string) => {
    setVariantsLoading(true);
    setVariantError(null);
    try {
      const res = await catalogApi.listVariants(productId);
      setVariants(res);
    } catch (err: unknown) {
      setVariantError(err instanceof Error ? err.message : "Failed to load variants");
    } finally {
      setVariantsLoading(false);
    }
  }, []);

  // Load taxes for selected product
  const loadTaxesForProduct = useCallback(async (productId: string) => {
    setTaxesLoading(true);
    try {
      const [taxRulesRes, assignedTaxes] = await Promise.all([
        catalogApi.listTaxRules({ is_active: true, page_size: 100 }),
        catalogApi.getProductTaxes(productId),
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
    setFormType("SERVICE");
    setFormDesc("");
    setFormBasePrice("0.0000");
    setFormCostPrice("0.0000");
    setFormError(null);
    setEditingProduct(null);
    setIsCreateOpen(true);
  };

  const openEditModal = (p: Product) => {
    setFormName(p.name);
    setFormType(p.product_type);
    setFormDesc(p.description || "");
    setFormBasePrice(p.base_sales_price);
    setFormCostPrice(p.cost_price);
    setFormError(null);
    setEditingProduct(p);
    setIsCreateOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    try {
      if (editingProduct) {
        await catalogApi.updateProduct(editingProduct.id, {
          name: formName,
          product_type: formType,
          description: formDesc || null,
          base_sales_price: formBasePrice,
          cost_price: formCostPrice,
        });
      } else {
        await catalogApi.createProduct({
          name: formName,
          product_type: formType,
          description: formDesc || undefined,
          base_sales_price: formBasePrice,
          cost_price: formCostPrice,
        });
      }
      setIsCreateOpen(false);
      loadProducts();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeactivateProduct = async (p: Product) => {
    if (!confirm(`Are you sure you want to deactivate product "${p.name}"?`)) return;
    try {
      await catalogApi.deactivateProduct(p.id);
      loadProducts();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to deactivate");
    }
  };

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForVariants) return;
    setVariantError(null);
    try {
      await catalogApi.createVariant(selectedProductForVariants.id, {
        name: variantName,
        price_adjustment: variantPriceAdj,
        sku: variantSku ? variantSku.trim() : undefined,
      });
      setVariantName("");
      setVariantPriceAdj("0.0000");
      setVariantSku("");
      loadVariants(selectedProductForVariants.id);
    } catch (err: unknown) {
      setVariantError(err instanceof Error ? err.message : "Failed to add variant");
    }
  };

  const handleDeactivateVariant = async (variantId: string) => {
    if (!selectedProductForVariants) return;
    try {
      await catalogApi.deactivateVariant(selectedProductForVariants.id, variantId);
      loadVariants(selectedProductForVariants.id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to deactivate variant");
    }
  };

  const handleSaveTaxes = async () => {
    if (!selectedProductForTaxes) return;
    setTaxesSaving(true);
    try {
      await catalogApi.setProductTaxes(selectedProductForTaxes.id, assignedTaxIds);
      setSelectedProductForTaxes(null);
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
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-nb-blue text-white border-2 border-nb-dark text-[10px] font-black uppercase tracking-wider shadow-nb-sm mb-2">
            Catalog Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-2.5 text-nb-dark">
            <Package className="h-7 w-7 stroke-[2.5]" />
            Product Catalogue
          </h1>
          <p className="text-xs font-bold text-zinc-600 mt-1">
            Manage billable goods, services, software packages, variants, and tax classifications.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="nb-btn nb-btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          New Product
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 border-2 sm:border-3 border-nb-dark shadow-nb flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-nb-dark stroke-[2.5]" />
          <input
            type="text"
            placeholder="Search by product name or description..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="nb-input w-full pl-9 pr-4 py-2 text-xs bg-white font-bold"
          />
        </div>
        <select
          value={productTypeFilter}
          onChange={(e) => {
            setProductTypeFilter(e.target.value);
            setPage(1);
          }}
          className="nb-input px-3 py-2 text-xs bg-white font-bold"
        >
          <option value="">All Types</option>
          <option value="SERVICE">Service</option>
          <option value="SOFTWARE">Software</option>
          <option value="ADDON">Addon</option>
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

      {/* Table */}
      <div className="bg-white border-2 sm:border-3 border-nb-dark shadow-nb overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs font-black uppercase tracking-wider text-nb-dark flex flex-col items-center gap-3">
            <RefreshCw className="h-7 w-7 animate-spin stroke-[2.5] text-nb-dark" />
            Loading product catalogue...
          </div>
        ) : products.length === 0 ? (
          <div className="py-20 text-center text-nb-dark flex flex-col items-center">
            <Package className="h-12 w-12 stroke-[2] mb-3 text-zinc-400" />
            <h3 className="font-black uppercase tracking-wide text-base">No products found</h3>
            <p className="text-xs font-bold text-zinc-500 mt-1">Try adjusting your filters or create a new product.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs font-bold">
            <thead className="bg-nb-dark text-white font-black uppercase tracking-wider border-b-2 border-nb-dark text-[11px]">
              <tr>
                <th className="px-5 py-3 text-left">Product Name</th>
                <th className="px-5 py-3 text-left">Type</th>
                <th className="px-5 py-3 text-right">Base Sales Price</th>
                <th className="px-5 py-3 text-right">Cost Price</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-nb-dark text-nb-dark">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-cream transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-black text-sm text-nb-dark">{p.name}</div>
                    {p.description && (
                      <div className="text-[11px] text-zinc-600 line-clamp-1 font-normal mt-0.5">{p.description}</div>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-cream border border-nb-dark shadow-nb-sm">
                      {p.product_type}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-mono font-black text-nb-dark">
                    ₹{Number(p.base_sales_price).toFixed(2)}
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-zinc-600">
                    ₹{Number(p.cost_price).toFixed(2)}
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
                        setSelectedProductForVariants(p);
                        loadVariants(p.id);
                      }}
                      className="nb-btn nb-btn-white inline-flex items-center gap-1 text-[11px] px-2.5 py-1 font-black uppercase"
                      title="Manage Product Variants"
                    >
                      <Layers className="h-3.5 w-3.5 stroke-[2.5]" /> Variants
                    </button>
                    <button
                      onClick={() => {
                        setSelectedProductForTaxes(p);
                        loadTaxesForProduct(p.id);
                      }}
                      className="nb-btn nb-btn-white inline-flex items-center gap-1 text-[11px] px-2.5 py-1 font-black uppercase"
                      title="Assign Tax Rules"
                    >
                      <Receipt className="h-3.5 w-3.5 stroke-[2.5]" /> Taxes
                    </button>
                    <button
                      onClick={() => openEditModal(p)}
                      className="nb-btn nb-btn-white p-1.5"
                      title="Edit Product"
                    >
                      <Edit2 className="h-3.5 w-3.5 stroke-[2.5]" />
                    </button>
                    {p.is_active && (
                      <button
                        onClick={() => handleDeactivateProduct(p)}
                        className="nb-btn p-1.5 bg-nb-coral text-white"
                        title="Deactivate Product"
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

      {/* Create / Edit Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 sm:border-3 border-nb-dark max-w-md w-full p-6 shadow-nb-xl space-y-4">
            <div className="flex items-center justify-between border-b-2 border-nb-dark pb-3">
              <h2 className="text-lg font-black uppercase tracking-tight text-nb-dark">
                {editingProduct ? "Edit Product" : "Create New Product"}
              </h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="nb-btn nb-btn-white p-1 text-nb-dark"
              >
                <X className="h-5 w-5 stroke-[2.5]" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-nb-coral border-2 border-nb-dark text-white text-xs font-bold shadow-nb-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Dedicated Cloud VM"
                  className="nb-input w-full p-2.5 text-xs bg-white font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1">
                  Product Type *
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as "SERVICE" | "SOFTWARE" | "ADDON")}
                  className="nb-input w-full p-2.5 text-xs bg-white font-bold"
                >
                  <option value="SERVICE">SERVICE</option>
                  <option value="SOFTWARE">SOFTWARE</option>
                  <option value="ADDON">ADDON</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Brief summary of product features..."
                  rows={2}
                  className="nb-input w-full p-2.5 text-xs bg-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Base Sales Price (₹) *
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
                    Cost Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    required
                    value={formCostPrice}
                    onChange={(e) => setFormCostPrice(e.target.value)}
                    className="nb-input w-full p-2.5 text-xs font-mono font-black bg-white"
                  />
                </div>
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
                  {formSubmitting ? "Saving..." : editingProduct ? "Update Product" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Variants Drawer / Modal */}
      {selectedProductForVariants && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 sm:border-3 border-nb-dark max-w-xl w-full p-6 shadow-nb-xl space-y-4">
            <div className="flex items-center justify-between border-b-2 border-nb-dark pb-3">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight text-nb-dark">
                  Variants: {selectedProductForVariants.name}
                </h2>
                <p className="text-xs font-bold text-zinc-600">
                  Base Price: ₹{Number(selectedProductForVariants.base_sales_price).toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => setSelectedProductForVariants(null)}
                className="nb-btn nb-btn-white p-1 text-nb-dark"
              >
                <X className="h-5 w-5 stroke-[2.5]" />
              </button>
            </div>

            {variantError && (
              <div className="p-3 bg-nb-coral border-2 border-nb-dark text-white text-xs font-bold shadow-nb-sm">
                {variantError}
              </div>
            )}

            {/* Existing Variants Table */}
            <div className="max-h-56 overflow-y-auto border-2 border-nb-dark shadow-nb-sm">
              {variantsLoading ? (
                <div className="p-4 text-center text-xs font-black uppercase tracking-wider text-zinc-500">Loading variants...</div>
              ) : variants.length === 0 ? (
                <div className="p-4 text-center text-xs font-bold text-zinc-500">
                  No variants defined yet. Use the form below to add one.
                </div>
              ) : (
                <table className="w-full text-left text-xs font-bold">
                  <thead className="bg-nb-dark text-white font-black uppercase tracking-wider border-b-2 border-nb-dark text-[11px]">
                    <tr>
                      <th className="px-3 py-2 text-left">Variant</th>
                      <th className="px-3 py-2 text-left">SKU</th>
                      <th className="px-3 py-2 text-right">Adjustment</th>
                      <th className="px-3 py-2 text-center">Status</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-nb-dark">
                    {variants.map((v) => (
                      <tr key={v.id} className="hover:bg-cream">
                        <td className="px-3 py-2 font-black text-nb-dark">{v.name}</td>
                        <td className="px-3 py-2 font-mono text-zinc-600">{v.sku || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono font-black">
                          {Number(v.price_adjustment) >= 0 ? "+" : ""}
                          ₹{Number(v.price_adjustment).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {v.is_active ? (
                            <span className="text-[10px] font-black uppercase bg-nb-green px-2 py-0.5 border border-nb-dark shadow-nb-sm">Active</span>
                          ) : (
                            <span className="text-[10px] font-black uppercase bg-zinc-200 text-zinc-700 px-2 py-0.5 border border-nb-dark">Inactive</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {v.is_active && (
                            <button
                              onClick={() => handleDeactivateVariant(v.id)}
                              className="text-xs font-black text-nb-coral hover:underline"
                              title="Deactivate"
                            >
                              Deactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Add Variant Form */}
            <form onSubmit={handleAddVariant} className="bg-cream p-4 border-2 border-nb-dark shadow-nb-sm space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-nb-dark">
                Add New Variant
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Variant Name *"
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                  className="nb-input px-2.5 py-1.5 text-xs bg-white font-bold"
                />
                <input
                  type="text"
                  placeholder="Unique SKU (optional)"
                  value={variantSku}
                  onChange={(e) => setVariantSku(e.target.value)}
                  className="nb-input px-2.5 py-1.5 text-xs bg-white font-mono font-bold"
                />
                <input
                  type="number"
                  step="0.0001"
                  required
                  placeholder="Price Adj (₹)"
                  value={variantPriceAdj}
                  onChange={(e) => setVariantPriceAdj(e.target.value)}
                  className="nb-input px-2.5 py-1.5 text-xs bg-white font-mono font-bold"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="nb-btn nb-btn-primary px-3 py-1.5 text-xs font-black uppercase"
                >
                  Add Variant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tax Assignment Modal */}
      {selectedProductForTaxes && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 sm:border-3 border-nb-dark max-w-md w-full p-6 shadow-nb-xl space-y-4">
            <div className="flex items-center justify-between border-b-2 border-nb-dark pb-3">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight text-nb-dark">
                  Assign Taxes
                </h2>
                <p className="text-xs font-bold text-zinc-600">
                  Product: {selectedProductForTaxes.name}
                </p>
              </div>
              <button
                onClick={() => setSelectedProductForTaxes(null)}
                className="nb-btn nb-btn-white p-1 text-nb-dark"
              >
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
                onClick={() => setSelectedProductForTaxes(null)}
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
