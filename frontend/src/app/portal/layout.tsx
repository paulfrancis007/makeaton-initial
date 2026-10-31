import React from "react";
import Navbar from "@/components/Navbar";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream flex flex-col text-nb-dark selection:bg-nb-yellow selection:text-nb-dark font-sans">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
      <footer className="border-t-2 sm:border-t-3 border-nb-dark py-6 text-center text-xs font-black uppercase tracking-wider text-nb-dark bg-white">
        Brightloop Subscription Management System • Customer Self-Service Portal
      </footer>
    </div>
  );
}
