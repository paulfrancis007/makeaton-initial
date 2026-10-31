import React from "react";
import Link from "next/link";
import { Layers } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2 text-indigo-600 font-bold text-2xl tracking-tight">
          <Layers className="w-8 h-8" />
          <span>Brightloop</span>
        </Link>
        <p className="mt-2 text-sm text-slate-600">
          Subscription Management Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-slate-200">
          {children}
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-slate-400">
        &copy; {new Date().getFullYear()} Brightloop Technologies Private Limited. All rights reserved.
      </div>
    </div>
  );
}
