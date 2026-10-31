// Central API client for Brightloop Frontend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface Customer {
  id: string;
  company_name: string;
  contact_email: string;
  contact_phone: string | null;
  tax_number: string | null;
  billing_address_line1: string;
  billing_address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  currency: string;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  product_type: "SERVICE" | "SOFTWARE" | "ADDON";
  description: string | null;
  base_sales_price: string;
  cost_price: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  price_adjustment: string;
  sku: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  billing_interval: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval_count: number;
  base_price: string;
  minimum_quantity: number;
  availability_start_date: string | null;
  availability_end_date: string | null;
  auto_renew: boolean;
  auto_close_on_expiry: boolean;
  allow_pause: boolean;
  allow_early_closure: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaxRule {
  id: string;
  name: string;
  rate: string;
  tax_type: string;
  is_compound: boolean;
  jurisdiction_country: string;
  jurisdiction_state: string;
  tax_scope: "STANDARD" | "INTRASTATE_CGST" | "INTRASTATE_SGST" | "INTERSTATE_IGST" | "VAT" | "EXEMPT";
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiscountRule {
  id: string;
  code: string;
  name: string;
  discount_type: "PERCENTAGE" | "FIXED_AMOUNT";
  discount_value: string;
  scope: "ORDER" | "PRODUCT_SELECTION";
  application_frequency: "FIRST_INVOICE_ONLY" | "RECURRING_ALL_CYCLES" | "FINITE_CYCLES";
  max_cycles: number | null;
  minimum_purchase_amount: string;
  minimum_quantity: number;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  eligible_product_ids: string[];
}

export interface DiscountEvaluationRequest {
  code: string;
  order_subtotal: string;
  items?: { product_id: string; quantity: number; unit_price: string }[];
  cycle_number?: number;
}

export interface DiscountEvaluationResponse {
  is_eligible: boolean;
  rejection_reason: string | null;
  discount_code: string;
  discount_type: string | null;
  discount_value: string | null;
  discount_amount: string;
  qualifying_subtotal: string;
  rule_name: string | null;
  rule_id: string | null;
}

// -------------------------------------------------------------
// Quotation Interfaces
// -------------------------------------------------------------
export interface QuotationLineTax {
  id: string;
  quotation_line_id: string;
  tax_rule_id: string | null;
  tax_name_snapshot: string;
  tax_rate_snapshot: string;
  tax_amount: string;
}

export interface QuotationLine {
  id: string;
  quotation_id: string;
  line_type: "PLAN_FEE" | "PRODUCT";
  product_id: string | null;
  variant_id: string | null;
  description_snapshot: string;
  unit_price: string;
  quantity: number;
  tax_rate_snapshot: string;
  tax_amount: string;
  discount_amount: string;
  line_total: string;
  taxes: QuotationLineTax[];
}

export interface Quotation {
  id: string;
  quotation_number: string;
  customer_id: string;
  template_id: string | null;
  plan_id: string;
  status: "DRAFT" | "SENT" | "CONFIRMED" | "EXPIRED" | "REJECTED";
  issue_date: string;
  expiry_date: string;
  plan_price_snapshot: string;
  subtotal_amount: string;
  discount_amount: string;
  tax_amount: string;
  rounding_adjustment: string;
  total_amount: string;
  currency: string;
  notes: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface QuotationDetail extends Quotation {
  lines: QuotationLine[];
  plan_name?: string | null;
  customer_company_name?: string | null;
}

export interface QuotationTemplateLine {
  id: string;
  template_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit_price_override: string | null;
}

export interface QuotationTemplate {
  id: string;
  name: string;
  description: string | null;
  plan_id: string;
  validity_duration_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  lines: QuotationTemplateLine[];
}

// -------------------------------------------------------------
// Subscription Interfaces
// -------------------------------------------------------------
export interface SubscriptionLineTax {
  id: string;
  subscription_line_id: string;
  tax_rule_id: string | null;
  tax_name_snapshot: string;
  tax_rate_snapshot: string;
  tax_amount: string;
}

export interface SubscriptionLine {
  id: string;
  subscription_id: string;
  line_type: "PLAN_FEE" | "PRODUCT";
  product_id: string | null;
  variant_id: string | null;
  description_snapshot: string;
  unit_price_snapshot: string;
  quantity: number;
  tax_rate_snapshot: string;
  line_total: string;
  taxes: SubscriptionLineTax[];
}

export interface SubscriptionPauseHistory {
  id: string;
  subscription_id: string;
  paused_at: string;
  resumed_at: string | null;
  pause_reason: string | null;
  days_extended: number;
  initiated_by_user_id: string;
}

export interface Subscription {
  id: string;
  subscription_number: string;
  customer_id: string;
  quotation_id: string | null;
  plan_id: string;
  status: "DRAFT" | "QUOTATION" | "CONFIRMED" | "ACTIVE" | "PAUSED" | "EXPIRED" | "CLOSED";
  start_date: string;
  expiry_date: string | null;
  current_period_start: string;
  current_period_end: string;
  next_billing_date: string;
  billing_anchor_day: number;
  billing_interval_snapshot: string;
  interval_count_snapshot: number;
  allow_pause_snapshot: boolean;
  allow_early_closure_snapshot: boolean;
  auto_renew_snapshot: boolean;
  auto_close_snapshot: boolean;
  plan_name_snapshot: string;
  plan_price_snapshot: string;
  recurring_subtotal: string;
  recurring_discount: string;
  recurring_tax: string;
  recurring_total_amount: string;
  currency: string;
  payment_terms_days: number;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionDetail extends Subscription {
  lines: SubscriptionLine[];
  pause_history: SubscriptionPauseHistory[];
  customer_company_name?: string | null;
}

export function getStoredToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("brightloop_token") || "";
}

export function setStoredToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("brightloop_token", token);
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = "An unexpected error occurred.";
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || JSON.stringify(errorJson);
    } catch {
      errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

// -------------------------------------------------------------
// Customer API
// -------------------------------------------------------------
export const customerApi = {
  listCustomers: (params?: { search?: string; is_active?: boolean; page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.is_active !== undefined) query.append("is_active", String(params.is_active));
    if (params?.page) query.append("page", String(params.page));
    if (params?.page_size) query.append("page_size", String(params.page_size));
    return request<PaginatedResult<Customer>>(`/customers/?${query.toString()}`);
  },
  getCustomer: (id: string) => request<Customer>(`/customers/${id}`),
};

// -------------------------------------------------------------
// Catalog API
// -------------------------------------------------------------
export const catalogApi = {
  // Products
  listProducts: (params?: { search?: string; product_type?: string; is_active?: boolean; page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.product_type) query.append("product_type", params.product_type);
    if (params?.is_active !== undefined) query.append("is_active", String(params.is_active));
    if (params?.page) query.append("page", String(params.page));
    if (params?.page_size) query.append("page_size", String(params.page_size));
    return request<PaginatedResult<Product>>(`/products/?${query.toString()}`);
  },
  getProduct: (id: string) => request<Product>(`/products/${id}`),
  createProduct: (data: Partial<Product>) =>
    request<Product>("/products/", { method: "POST", body: JSON.stringify(data) }),
  updateProduct: (id: string, data: Partial<Product>) =>
    request<Product>(`/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deactivateProduct: (id: string) =>
    request<Product>(`/products/${id}`, { method: "DELETE" }),
  getProductTaxes: (id: string) => request<TaxRule[]>(`/products/${id}/taxes`),
  setProductTaxes: (id: string, tax_rule_ids: string[]) =>
    request<TaxRule[]>(`/products/${id}/taxes`, { method: "PUT", body: JSON.stringify({ tax_rule_ids }) }),

  // Variants
  listVariants: (productId: string, is_active?: boolean) => {
    const query = is_active !== undefined ? `?is_active=${is_active}` : "";
    return request<ProductVariant[]>(`/products/${productId}/variants${query}`);
  },
  createVariant: (productId: string, data: Partial<ProductVariant>) =>
    request<ProductVariant>(`/products/${productId}/variants`, { method: "POST", body: JSON.stringify(data) }),
  updateVariant: (productId: string, variantId: string, data: Partial<ProductVariant>) =>
    request<ProductVariant>(`/products/${productId}/variants/${variantId}`, { method: "PUT", body: JSON.stringify(data) }),
  deactivateVariant: (productId: string, variantId: string) =>
    request<ProductVariant>(`/products/${productId}/variants/${variantId}`, { method: "DELETE" }),

  // Plans
  listPlans: (params?: { search?: string; billing_interval?: string; is_active?: boolean; page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.billing_interval) query.append("billing_interval", params.billing_interval);
    if (params?.is_active !== undefined) query.append("is_active", String(params.is_active));
    if (params?.page) query.append("page", String(params.page));
    if (params?.page_size) query.append("page_size", String(params.page_size));
    return request<PaginatedResult<Plan>>(`/plans/?${query.toString()}`);
  },
  getPlan: (id: string) => request<Plan>(`/plans/${id}`),
  createPlan: (data: Partial<Plan>) =>
    request<Plan>("/plans/", { method: "POST", body: JSON.stringify(data) }),
  updatePlan: (id: string, data: Partial<Plan>) =>
    request<Plan>(`/plans/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deactivatePlan: (id: string) =>
    request<Plan>(`/plans/${id}`, { method: "DELETE" }),
  getPlanTaxes: (id: string) => request<TaxRule[]>(`/plans/${id}/taxes`),
  setPlanTaxes: (id: string, tax_rule_ids: string[]) =>
    request<TaxRule[]>(`/plans/${id}/taxes`, { method: "PUT", body: JSON.stringify({ tax_rule_ids }) }),

  // Taxes
  listTaxRules: (params?: { search?: string; tax_scope?: string; jurisdiction_country?: string; jurisdiction_state?: string; is_active?: boolean; page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.tax_scope) query.append("tax_scope", params.tax_scope);
    if (params?.jurisdiction_country) query.append("jurisdiction_country", params.jurisdiction_country);
    if (params?.jurisdiction_state) query.append("jurisdiction_state", params.jurisdiction_state);
    if (params?.is_active !== undefined) query.append("is_active", String(params.is_active));
    if (params?.page) query.append("page", String(params.page));
    if (params?.page_size) query.append("page_size", String(params.page_size));
    return request<PaginatedResult<TaxRule>>(`/taxes/?${query.toString()}`);
  },
  getTaxRule: (id: string) => request<TaxRule>(`/taxes/${id}`),
  createTaxRule: (data: Partial<TaxRule>) =>
    request<TaxRule>("/taxes/", { method: "POST", body: JSON.stringify(data) }),
  updateTaxRule: (id: string, data: Partial<TaxRule>) =>
    request<TaxRule>(`/taxes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deactivateTaxRule: (id: string) =>
    request<TaxRule>(`/taxes/${id}`, { method: "DELETE" }),

  // Discounts
  listDiscountRules: (params?: { search?: string; discount_type?: string; scope?: string; is_active?: boolean; page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.discount_type) query.append("discount_type", params.discount_type);
    if (params?.scope) query.append("scope", params.scope);
    if (params?.is_active !== undefined) query.append("is_active", String(params.is_active));
    if (params?.page) query.append("page", String(params.page));
    if (params?.page_size) query.append("page_size", String(params.page_size));
    return request<PaginatedResult<DiscountRule>>(`/discounts/?${query.toString()}`);
  },
  getDiscountRule: (id: string) => request<DiscountRule>(`/discounts/${id}`),
  createDiscountRule: (data: Partial<DiscountRule>) =>
    request<DiscountRule>("/discounts/", { method: "POST", body: JSON.stringify(data) }),
  updateDiscountRule: (id: string, data: Partial<DiscountRule>) =>
    request<DiscountRule>(`/discounts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deactivateDiscountRule: (id: string) =>
    request<DiscountRule>(`/discounts/${id}`, { method: "DELETE" }),
  evaluateDiscount: (data: DiscountEvaluationRequest) =>
    request<DiscountEvaluationResponse>("/discounts/evaluate", { method: "POST", body: JSON.stringify(data) }),
};

// -------------------------------------------------------------
// Quotation API
// -------------------------------------------------------------
export const quotationApi = {
  listTemplates: (params?: { search?: string; is_active?: boolean; page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.is_active !== undefined) query.append("is_active", String(params.is_active));
    if (params?.page) query.append("page", String(params.page));
    if (params?.page_size) query.append("page_size", String(params.page_size));
    return request<PaginatedResult<QuotationTemplate>>(`/quotations/templates?${query.toString()}`);
  },
  getTemplate: (id: string) => request<QuotationTemplate>(`/quotations/templates/${id}`),
  createTemplate: (data: any) =>
    request<QuotationTemplate>("/quotations/templates", { method: "POST", body: JSON.stringify(data) }),

  listQuotations: (params?: { customer_id?: string; status?: string; search?: string; page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params?.customer_id) query.append("customer_id", params.customer_id);
    if (params?.status) query.append("status", params.status);
    if (params?.search) query.append("search", params.search);
    if (params?.page) query.append("page", String(params.page));
    if (params?.page_size) query.append("page_size", String(params.page_size));
    return request<PaginatedResult<Quotation>>(`/quotations/?${query.toString()}`);
  },
  getQuotation: (id: string) => request<QuotationDetail>(`/quotations/${id}`),
  createQuotation: (data: any) =>
    request<Quotation>("/quotations/", { method: "POST", body: JSON.stringify(data) }),
  updateQuotation: (id: string, data: any) =>
    request<QuotationDetail>(`/quotations/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  updateStatus: (id: string, status: string, rejection_reason?: string) =>
    request<Quotation>(`/quotations/${id}/status`, { method: "POST", body: JSON.stringify({ status, rejection_reason }) }),
};

// -------------------------------------------------------------
// Subscription API
// -------------------------------------------------------------
export const subscriptionApi = {
  convertFromQuotation: (quotationId: string, data?: { start_date?: string; payment_terms_days?: number }) =>
    request<Subscription>(`/subscriptions/from-quotation/${quotationId}`, { method: "POST", body: JSON.stringify(data || {}) }),
  listSubscriptions: (params?: { customer_id?: string; status?: string; search?: string; page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params?.customer_id) query.append("customer_id", params.customer_id);
    if (params?.status) query.append("status", params.status);
    if (params?.search) query.append("search", params.search);
    if (params?.page) query.append("page", String(params.page));
    if (params?.page_size) query.append("page_size", String(params.page_size));
    return request<PaginatedResult<Subscription>>(`/subscriptions/?${query.toString()}`);
  },
  getSubscription: (id: string) => request<SubscriptionDetail>(`/subscriptions/${id}`),
  activate: (id: string) =>
    request<Subscription>(`/subscriptions/${id}/activate`, { method: "POST" }),
  pause: (id: string, reason?: string) =>
    request<Subscription>(`/subscriptions/${id}/pause`, { method: "POST", body: JSON.stringify({ reason }) }),
  resume: (id: string) =>
    request<Subscription>(`/subscriptions/${id}/resume`, { method: "POST" }),
  close: (id: string, reason?: string) =>
    request<Subscription>(`/subscriptions/${id}/close`, { method: "POST", body: JSON.stringify({ reason }) }),
};
