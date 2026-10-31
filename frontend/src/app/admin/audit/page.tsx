"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  ShieldAlert,
  RefreshCw,
  FileCode,
} from "lucide-react";
import { auditApi, AuditLog } from "@/lib/api";

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await auditApi.listLogs({
        action: actionFilter || undefined,
        entity_name: entityFilter || undefined,
        page,
        page_size: 15,
      });
      setLogs(res.items);
      setTotalPages(res.pages || 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [actionFilter, entityFilter, page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border-2 sm:border-3 border-nb-dark p-6 shadow-nb flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-nb-dark text-white border-2 border-nb-dark text-[10px] font-black uppercase tracking-wider shadow-nb-sm mb-2">
            Tamper-Evident Trail
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-2.5 text-nb-dark">
            <ShieldAlert className="h-7 w-7 stroke-[2.5]" />
            System Audit Trail
          </h1>
          <p className="text-xs font-bold text-zinc-600 mt-1">
            Immutable security log recording financial transactions, billing runs, authorizations and administrative actions.
          </p>
        </div>
        <button
          onClick={() => loadLogs()}
          className="nb-btn nb-btn-white p-2.5 text-nb-dark self-start sm:self-auto"
          title="Refresh logs"
        >
          <RefreshCw className={`h-4 w-4 stroke-[2.5] ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 border-2 sm:border-3 border-nb-dark shadow-nb flex flex-wrap gap-3 items-center">
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="nb-input text-xs py-2 px-3 bg-white font-bold"
        >
          <option value="">All Actions</option>
          <option value="PAYMENT_RECORDED">PAYMENT_RECORDED</option>
          <option value="PAYMENT_VOIDED">PAYMENT_VOIDED</option>
          <option value="INVOICE_GENERATED">INVOICE_GENERATED</option>
          <option value="INVOICE_CANCELLED">INVOICE_CANCELLED</option>
          <option value="INVOICE_EMAIL_SENT">INVOICE_EMAIL_SENT</option>
          <option value="BATCH_BILLING_RUN">BATCH_BILLING_RUN</option>
          <option value="SUBSCRIPTION_ACTIVATED">SUBSCRIPTION_ACTIVATED</option>
        </select>
        <select
          value={entityFilter}
          onChange={(e) => {
            setEntityFilter(e.target.value);
            setPage(1);
          }}
          className="nb-input text-xs py-2 px-3 bg-white font-bold"
        >
          <option value="">All Entities</option>
          <option value="invoice">invoice</option>
          <option value="payment">payment</option>
          <option value="subscription">subscription</option>
          <option value="quotation">quotation</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border-2 sm:border-3 border-nb-dark shadow-nb overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs font-black uppercase tracking-wider text-nb-dark flex flex-col items-center gap-3">
            <RefreshCw className="h-7 w-7 animate-spin stroke-[2.5] text-nb-dark" />
            Loading audit records...
          </div>
        ) : error ? (
          <div className="p-6 text-center text-white bg-nb-coral text-xs font-bold">{error}</div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center text-nb-dark flex flex-col items-center">
            <ShieldAlert className="h-12 w-12 stroke-[2] mb-3 text-zinc-400" />
            <p className="font-black uppercase tracking-wide text-base">No audit events found</p>
            <p className="text-xs font-bold text-zinc-500 mt-1">
              Events will be appended automatically as system operations take place.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold">
              <thead className="bg-nb-dark text-white font-black uppercase tracking-wider border-b-2 border-nb-dark text-[11px]">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Actor ID</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-nb-dark text-nb-dark">
                {logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-cream transition-colors">
                        <td className="py-3 px-4 font-mono text-zinc-600 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 text-[11px] font-mono font-black uppercase bg-nb-yellow text-nb-dark border border-nb-dark shadow-nb-sm">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-black">
                          {log.entity_name}
                          {log.entity_id && (
                            <span className="block text-[10px] text-zinc-500 font-normal">
                              {log.entity_id}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-600 text-[11px]">
                          {log.actor_user_id ? log.actor_user_id.slice(0, 8) + "..." : "SYSTEM"}
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-600">
                          {log.ip_address || "—"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() =>
                              setExpandedLogId(isExpanded ? null : log.id)
                            }
                            className="nb-btn nb-btn-white inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-black uppercase"
                          >
                            <FileCode className="h-3.5 w-3.5 stroke-[2.5]" />
                            {isExpanded ? "Hide" : "Payload"}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-cream">
                          <td colSpan={6} className="p-4 border-b-2 border-nb-dark">
                            <pre className="p-4 bg-nb-dark text-nb-green border-2 border-nb-dark shadow-nb-sm text-xs font-mono overflow-x-auto max-h-60 font-bold">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
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
