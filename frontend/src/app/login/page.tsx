"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Lock, Mail, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../../lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await login(email.trim(), password);
      if (user.role === "CUSTOMER") {
        router.push("/portal/dashboard");
      } else {
        router.push("/admin/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-nb-dark selection:bg-nb-yellow selection:text-nb-dark">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-16 w-16 bg-nb-yellow border-2 sm:border-3 border-nb-dark flex items-center justify-center text-nb-dark shadow-nb">
            <Building2 className="h-9 w-9 stroke-[2.5]" />
          </div>
        </div>
        <h2 className="mt-5 text-center text-3xl font-black uppercase tracking-tight">
          Sign in to Brightloop
        </h2>
        <p className="mt-1 text-center text-xs font-bold uppercase tracking-wider text-zinc-600">
          Enterprise Subscription & Ledger Console
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white border-2 sm:border-3 border-nb-dark p-6 sm:p-8 shadow-nb-xl">
          {error && (
            <div className="mb-5 p-3.5 bg-nb-coral border-2 border-nb-dark text-white flex items-start gap-2.5 text-xs font-bold shadow-nb-sm">
              <AlertCircle className="h-4 w-4 shrink-0 stroke-[2.5] mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-1.5">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-nb-dark">
                  <Mail className="h-4 w-4 stroke-[2.5]" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="nb-input block w-full pl-9 pr-3 py-2.5 text-xs font-bold bg-white"
                  placeholder="user@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-nb-dark">
                  <Lock className="h-4 w-4 stroke-[2.5]" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="nb-input block w-full pl-9 pr-3 py-2.5 text-xs font-bold bg-white"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full nb-btn nb-btn-primary flex justify-center items-center gap-2 py-3 px-4 text-xs font-black uppercase tracking-wider mt-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin stroke-[2.5]" />
                  Authenticating...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Launchpad */}
          <div className="mt-8 pt-6 border-t-2 border-nb-dark">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-600 block mb-3">
              One-Click Demo Credentials:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => handleQuickFill("admin@example.com", "AdminPass123!")}
                className="nb-btn px-2 py-2 bg-nb-purple text-nb-dark text-[11px] font-black uppercase tracking-wider"
              >
                ADMIN
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("staff1@example.com", "StaffPass123!")}
                className="nb-btn px-2 py-2 bg-nb-blue text-white text-[11px] font-black uppercase tracking-wider"
              >
                STAFF
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("customer.acme@example.com", "CustomerPass123!")}
                className="nb-btn px-2 py-2 bg-nb-green text-nb-dark text-[11px] font-black uppercase tracking-wider"
              >
                CUST (ACME)
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("customer.global@example.com", "CustomerPass123!")}
                className="nb-btn px-2 py-2 bg-nb-yellow text-nb-dark text-[11px] font-black uppercase tracking-wider text-center"
              >
                CUST (GLOBAL)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
