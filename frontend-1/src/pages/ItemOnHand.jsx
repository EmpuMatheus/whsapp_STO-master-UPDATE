import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Navbar from "../components/Navbar";
import PrintTagModal from "../components/PrintTagModal";
import PrintAssignStoTagModal from "../components/PrintAssignStoTagModal";

const PAGE_SIZE = 100;

export default function ItemOnHand() {
  const [rows, setRows] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWhs, setSelectedWhs] = useState([]);
  const [search, setSearch] = useState("");
  const [showWhsFilter, setShowWhsFilter] = useState(false);
  const filterRef = useRef(null);

  const [file, setFile] = useState(null);
  const [clearFirst, setClearFirst] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [page, setPage] = useState(1);
  const [showPrint, setShowPrint] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  // ⬇️ PRINT TAG MODAL STATE
  const [printRow, setPrintRow] = useState(null);

  /* ================= LOAD DATA ================= */
  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/item-on-hand");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api.get("/warehouses").then((r) => setWarehouses(r.data || []));
  }, []);

  /* ================= CLICK OUTSIDE FILTER ================= */
  useEffect(() => {
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setShowWhsFilter(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ================= FILTER ================= */
  const filteredRows = useMemo(() => {
    setPage(1);
    const q = search.toLowerCase();

    return rows.filter((r) => {
      const matchWhs =
        selectedWhs.length === 0 || selectedWhs.includes(r.whs_code);

      const matchSearch =
        !q ||
        r.item_code?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.item_group?.toLowerCase().includes(q);

      return matchWhs && matchSearch;
    });
  }, [rows, selectedWhs, search]);

  /* ================= PAGINATION ================= */
  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  /* ================= CSV UPLOAD ================= */
  const uploadCSV = async () => {
    if (!file) {
      alert("Pilih file CSV terlebih dahulu");
      return;
    }

    if (!window.confirm("Upload CSV Item On Hand?")) return;

    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("clear", clearFirst ? "true" : "false");

      const res = await api.post("/item-on-hand/import-csv", fd);

      alert(
        `Upload CSV berhasil\n\n` +
          `Delimiter : ${res.data.delimiter}\n` +
          `Total     : ${res.data.total}\n` +
          `Inserted  : ${res.data.inserted}\n` +
          `Skipped   : ${res.data.skipped}`
      );

      setFile(null);
      load();
    } catch (err) {
      alert(
        "Upload gagal:\n" +
          (err.response?.data?.error ||
            err.response?.data?.detail ||
            err.message)
      );
    } finally {
      setUploading(false);
    }
  };

  /* ================= CLEAR DATA ================= */
  const clearData = async () => {
    if (!window.confirm("Hapus SEMUA data Item On Hand?")) return;
    await api.post("/item-on-hand/clear");
    load();
  };

  /* ================= TOGGLE WAREHOUSE ================= */
  const toggleWhs = (code) => {
    setSelectedWhs((prev) =>
      prev.includes(code) ? prev.filter((w) => w !== code) : [...prev, code]
    );
  };

  /* ================= UI ================= */
  return (
    <div>
      <Navbar />

      <div className="p-4 max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Item On Hand</h2>

        {/* ================= UPLOAD ================= */}
        <div className="bg-white p-4 rounded shadow mb-4 flex flex-wrap gap-3 items-center">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files[0])}
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={clearFirst}
              onChange={(e) => setClearFirst(e.target.checked)}
            />
            Clear before import
          </label>

          <button
            disabled={uploading}
            onClick={uploadCSV}
            className="bg-blue-600 text-white px-3 py-1 rounded"
          >
            {uploading ? "Uploading..." : "Upload CSV"}
          </button>

          <button
            onClick={clearData}
            className="bg-red-600 text-white px-3 py-1 rounded"
          >
            Clear Data
          </button>
        </div>

        {/* ================= FILTER ================= */}
        <div className="bg-white p-4 rounded shadow mb-4 flex gap-4 items-center">
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setShowWhsFilter(!showWhsFilter)}
              className="border px-3 py-2 rounded bg-gray-100"
            >
              Filter Warehouse
              {selectedWhs.length > 0 && (
                <span className="ml-2 text-green-600">
                  ({selectedWhs.length})
                </span>
              )}
            </button>

            {showWhsFilter && (
              <div className="absolute z-20 mt-2 bg-white border rounded shadow w-64 p-3 max-h-64 overflow-auto">
                {warehouses.map((w) => (
                  <label key={w.id} className="flex gap-2 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedWhs.includes(w.whs_code)}
                      onChange={() => toggleWhs(w.whs_code)}
                    />
                    {w.whs_code} - {w.whs_name}
                  </label>
                ))}
              </div>
            )}
          </div>

          <input
            type="text"
            placeholder="Search item / group / description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded p-2 flex-1"
          />
        </div>

        {/* ================= TABLE ================= */}
        <div className="bg-white p-4 rounded shadow overflow-x-auto">
          {loading ? (
            <div className="text-center py-6">Loading...</div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th>Item Code</th>
                    <th>Description</th>
                    <th>Item Group</th>
                    <th>Warehouse</th>
                    <th>UOM</th>
                    <th className="text-right">On Hand PCS</th>
                    <th className="text-right">On Hand m³</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-6">
                        Tidak ada data
                      </td>
                    </tr>
                  ) : (
                    pagedRows.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td>{r.item_code}</td>
                        <td>{r.description}</td>
                        <td>{r.item_group}</td>
                        <td>{r.whs_code}</td>
                        <td>{r.uom}</td>
                        <td className="text-right">{r.onhand_qty_pcs}</td>
                        <td className="text-right">
                          {Number(r.onhand_qty_m3 || 0).toFixed(3)}
                        </td>
                        <td>
                          <button
                            onClick={() => {
                              setSelectedItem(r);
                              setShowPrint(true);
                            }}
                            className="text-green-700 hover:underline"
                          >
                            Print Tag
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* ================= PAGINATION ================= */}
              <div className="flex justify-between items-center mt-4 text-sm">
                <div>
                  Showing {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, filteredRows.length)} of{" "}
                  {filteredRows.length}
                </div>

                <div className="flex gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1 border rounded"
                  >
                    Prev
                  </button>
                  <span>
                    Page {page} / {totalPages || 1}
                  </span>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1 border rounded"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ================= PRINT TAG MODAL ================= */}
      {printRow && (
        <PrintTagModal row={printRow} onClose={() => setPrintRow(null)} />
      )}
      <PrintAssignStoTagModal
        open={showPrint}
        item={selectedItem}
        onClose={() => setShowPrint(false)}
      />
    </div>
  );
}
