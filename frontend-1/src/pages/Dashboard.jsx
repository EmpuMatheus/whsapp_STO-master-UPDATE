import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Navbar from "../components/Navbar";
import * as XLSX from "xlsx";

const PAGE_SIZE = 100;

export default function Dashboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");

  /* ================= LOAD DATA ================= */
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/dashboard/sto");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      alert("Gagal load dashboard STO");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /* ================= LIST WAREHOUSE ================= */
  const warehouses = useMemo(() => {
    return Array.from(
      new Set(rows.map(r => r.whs_code).filter(Boolean))
    );
  }, [rows]);

  /* ================= FILTER ================= */
  const filteredRows = useMemo(() => {
    if (!selectedWarehouse) return rows;
    return rows.filter(r => r.whs_code === selectedWarehouse);
  }, [rows, selectedWarehouse]);

  /* reset page jika filter berubah */
  useEffect(() => {
    setPage(1);
  }, [selectedWarehouse]);

  /* ================= PAGINATION ================= */
  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  /* ================= EXPORT EXCEL ================= */
  const exportExcel = () => {
    if (filteredRows.length === 0) {
      alert("Tidak ada data untuk diexport");
      return;
    }

    const data = filteredRows.map(r => ({
      Warehouse: r.whs_code,
      "Item Code": r.item_code,
      Description: r.description,
      "On Hand PCS": r.onhand_qty_pcs,
      "STO PCS": r.sto_pcs,
      Selisih: r.selisih
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "STO Dashboard");

    XLSX.writeFile(
      wb,
      `STO_DASHBOARD_${selectedWarehouse || "ALL"}_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
    );
  };

  /* ================= UI ================= */
  return (
    <div>
      <Navbar />

      <div className="p-4 max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Dashboard STO</h2>

        {/* ================= FILTER BAR ================= */}
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <select
            value={selectedWarehouse}
            onChange={e => setSelectedWarehouse(e.target.value)}
            className="border rounded p-2 min-w-[220px]"
          >
            <option value="">-- Semua Gudang --</option>
            {warehouses.map(w => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>

          <button
            onClick={exportExcel}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            ⬇ Export Excel
          </button>
        </div>

        {/* ================= TABLE ================= */}
        <div className="bg-white rounded shadow overflow-x-auto">
          {loading ? (
            <div className="p-6 text-center">Loading...</div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50">
                  <tr className="text-left">
                    <th className="p-2">Warehouse</th>
                    <th className="p-2">Item Code</th>
                    <th className="p-2">Description</th>
                    <th className="p-2 text-right">On Hand PCS</th>
                    <th className="p-2 text-right">STO PCS</th>
                    <th className="p-2 text-right">Selisih</th>
                  </tr>
                </thead>

                <tbody>
                  {pagedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-6 text-center text-gray-500"
                      >
                        Tidak ada data
                      </td>
                    </tr>
                  ) : (
                    pagedRows.map((r, i) => (
                      <tr key={i} className="border-t hover:bg-gray-50">
                        <td className="p-2 font-medium">{r.whs_code}</td>
                        <td className="p-2">{r.item_code}</td>
                        <td className="p-2">{r.description}</td>
                        <td className="p-2 text-right">
                          {r.onhand_qty_pcs}
                        </td>
                        <td className="p-2 text-right font-semibold">
                          {r.sto_pcs}
                        </td>
                        <td
                          className={`p-2 text-right font-bold ${
                            r.selisih > 0
                              ? "text-green-600"
                              : r.selisih < 0
                              ? "text-red-600"
                              : "text-gray-600"
                          }`}
                        >
                          {r.selisih}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* ================= PAGINATION ================= */}
              <div className="flex justify-between items-center p-3 text-sm">
                <div>
                  Showing {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, filteredRows.length)} of{" "}
                  {filteredRows.length}
                </div>

                <div className="flex gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="px-3 py-1 border rounded disabled:opacity-50"
                  >
                    Prev
                  </button>

                  <span>
                    Page {page} / {totalPages || 1}
                  </span>

                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1 border rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
