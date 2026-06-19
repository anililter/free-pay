"use client";

import { useEffect, useState } from "react";

export default function AdminDashboard() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setClients(data);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex justify-between items-center bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Freelance Payment Tracker
            </h1>
            <p className="text-slate-400 mt-2">Manage your clients and payments easily.</p>
          </div>
          <button className="bg-indigo-600 hover:bg-indigo-500 transition-colors px-6 py-3 rounded-lg font-medium shadow-lg shadow-indigo-500/20">
            + Yeni Müşteri
          </button>
        </header>

        <main className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-64 text-indigo-400">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-800/50 text-slate-300 uppercase font-semibold text-xs tracking-wider">
                  <tr>
                    <th className="p-4 rounded-tl-lg">Müşteri</th>
                    <th className="p-4">Proje</th>
                    <th className="p-4">Tutar</th>
                    <th className="p-4">Durum</th>
                    <th className="p-4 rounded-tr-lg">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {clients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        Henüz kayıtlı müşteri yok.
                      </td>
                    </tr>
                  ) : (
                    clients.map((client) => (
                      <tr key={client.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 font-medium">{client.name}</td>
                        <td className="p-4 text-slate-400">{client.projectName}</td>
                        <td className="p-4">
                          <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full font-medium">
                            {client.agreedAmount} {client.currency}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full font-medium text-xs">
                            {client.status}
                          </span>
                        </td>
                        <td className="p-4 text-indigo-400 cursor-pointer hover:text-indigo-300">
                          Detaylar
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
