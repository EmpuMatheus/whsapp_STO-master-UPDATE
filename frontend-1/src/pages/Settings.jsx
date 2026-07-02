import React, { useEffect, useState } from "react";
import api from "../api";
import Navbar from "../components/Navbar";

export default function Settings() {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/settings/info");
        setInfo(res.data);
      } catch { setInfo(null); }
      setLoading(false);
    })();
  }, []);

  const handleReset = async () => {
    setShowConfirm(false);
    setResetting(true);
    try {
      await api.post("/settings/reset-sto");
      setToast({ type: "success", message: "Stock Opname berhasil di-reset." });
      // Refresh info
      const res = await api.get("/settings/info");
      setInfo(res.data);
    } catch (err) {
      setToast({ type: "error", message: "Gagal: " + (err.response?.data?.error || err.message) });
    } finally {
      setResetting(false);
      setTimeout(() => setToast(null), 5000);
    }
  };

  const StatItem = ({ label, value }) => (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-gray-600 text-sm">{label}</span>
      <span className="font-semibold text-gray-800">{value ?? "-"}</span>
    </div>
  );

  return (
    <div>
      <Navbar />
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        <h2 className="text-2xl font-bold">Settings</h2>

        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : (
          <>
            {/* ==================== CARD 1: Database Info ==================== */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Database Information</h3>
              {info ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Tags</p>
                    <StatItem label="Total Tag" value={info.tags?.total} />
                    <StatItem label="Completed" value={info.tags?.completed} />
                    <StatItem label="Open" value={info.tags?.open} />
                    <StatItem label="Recount" value={info.tags?.recount} />
                    <StatItem label="Approval Pending" value={info.tags?.pending_approval} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Master Data</p>
                    <StatItem label="Users" value={info.users} />
                    <StatItem label="Warehouses" value={info.warehouses} />
                    <StatItem label="Locations" value={info.locations} />
                    <StatItem label="Counters" value={info.counters} />
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 italic">Gagal memuat data</p>
              )}
            </div>

            {/* ==================== CARD 2: Danger Zone ==================== */}
            <div className="bg-white rounded-xl shadow-sm border border-red-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-red-600 text-lg">⚠️</span>
                <h3 className="font-semibold text-red-700">Danger Zone</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Fitur ini akan menghapus seluruh data transaksi STO. Master Data tidak akan terhapus.
              </p>
              <button
                onClick={() => setShowConfirm(true)}
                disabled={resetting}
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                {resetting ? "Resetting database..." : "RESET STOCK OPNAME"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ==================== CONFIRMATION MODAL ==================== */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-xl shadow-xl p-6 mx-4">
            <div className="text-center mb-4">
              <span className="text-4xl">⚠️</span>
            </div>
            <h3 className="text-xl font-bold text-center text-red-700 mb-3">RESET STOCK OPNAME</h3>
            <p className="text-sm text-gray-600 text-center mb-4">
              Seluruh data Stock Opname akan dihapus.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-sm text-gray-700 space-y-1">
              <p>• Semua hasil scan</p>
              <p>• Semua 1st Count</p>
              <p>• Semua Recount</p>
              <p>• Semua Approval</p>
              <p>• Semua Activity Log</p>
              <p>• Semua Request Recount</p>
              <p>• Semua Progress Dashboard</p>
              <p>• Semua Assigned Status</p>
              <p>• Semua Generated Tag</p>
            </div>
            <p className="text-xs text-gray-500 text-center mb-4">
              Sequence Tag akan dimulai kembali dari nomor 00001.<br />
              Master Data <strong>TIDAK</strong> akan dihapus.
            </p>
            <p className="text-sm font-semibold text-center text-gray-800 mb-5">Apakah Anda yakin?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2.5 rounded-lg font-medium transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleReset}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-bold transition-colors"
              >
                Ya, Reset STO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== LOADING OVERLAY ==================== */}
      {resetting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-8 text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-700 font-medium">Resetting database...</p>
          </div>
        </div>
      )}

      {/* ==================== TOAST ==================== */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-white font-medium text-sm transition-all ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
