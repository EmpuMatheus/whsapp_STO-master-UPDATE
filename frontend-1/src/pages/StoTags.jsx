import React, { useEffect, useState } from "react";
import api from "../api";
import Navbar from "../components/Navbar";
import { generateTagPDF } from "../utils/generateTagPDF";
import { generateSerahTerimaPDF } from "../utils/generateSerahTerimaPDF";
import SearchableSelect from "../components/SearchableSelect";

export default function StoTags() {
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  const isAdmin = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "ADMIN";

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ total: 0, completed: 0, pending: 0, percentage: 0 });
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(isAdmin ? "" : String(currentUser?.id || ""));
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);

  /* ================= SERAH TERIMA STATE ================= */
  const [showSerahTerima, setShowSerahTerima] = useState(false);
  const [stVerificatorId, setStVerificatorId] = useState("");
  const [stCounterId, setStCounterId] = useState("");
  const [stWhsCode, setStWhsCode] = useState("");
  const [stStatus, setStStatus] = useState("OPEN");
  const [serahTerimaData, setSerahTerimaData] = useState(null);
  const [serahTerimaLoading, setSerahTerimaLoading] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [countersByVerificator, setCountersByVerificator] = useState([]);

  useEffect(() => {
    if (isAdmin) {
      api.get("/verifiers").then(res => setUsers(res.data || [])).catch(() => {});
      api.get("/warehouses").then(res => setWarehouses(res.data || [])).catch(() => {});
    }
    api.get("/located").then(res => setLocations(res.data || [])).catch(() => {});
  }, [isAdmin]);

  const buildUrl = () => {
    const params = new URLSearchParams();
    if (selectedUserId) params.set("verificator_id", selectedUserId);
    if (selectedStatus) params.set("status", selectedStatus);
    if (selectedLocationId) params.set("located_id", selectedLocationId);
    const qs = params.toString();
    return qs ? `/list-tags?${qs}` : "/list-tags";
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(buildUrl());
      const data = res.data || {};
      setRows(Array.isArray(data.tags) ? data.tags : []);
      setSummary(data.summary || { total: 0, completed: 0, pending: 0, percentage: 0 });
    } catch {
      setRows([]);
      setSummary({ total: 0, completed: 0, pending: 0, percentage: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [selectedUserId, selectedStatus, selectedLocationId]);

  /* ================= SELECT ALL ================= */
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      const allIds = filteredRows.map(r => r.id);
      setSelectedIds(new Set(allIds));
      setSelectAll(true);
    }
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
    setSelectAll(false);
  };

  /* ================= MULTI PRINT (Admin Only) ================= */
  const handleMultiPrint = async () => {
    if (selectedIds.size === 0) {
      alert("Silakan pilih minimal 1 tag untuk dicetak.");
      return;
    }
    const selectedTags = rows.filter(r => selectedIds.has(r.id));
    const tagsData = selectedTags.map(r => ({
      tag_qr: r.tag_qr,
      whs_code: r.whs_code,
      item_code: r.item_code,
      description: r.description,
      counter_name: r.counter_name,
      verificator_name: r.verificator_name,
      location_name: r.location_name,
      location_detail: r.location_detail
    }));
    await generateTagPDF({ tags: tagsData });
  };

  /* ================= SERAH TERIMA HANDLERS ================= */
  const handleOpenSerahTerima = () => {
    setStVerificatorId("");
    setStCounterId("");
    setStWhsCode("");
    setStStatus("OPEN");
    setSerahTerimaData(null);
    setCountersByVerificator([]);
    setShowSerahTerima(true);
  };

  const handleStVerificatorChange = async (vid) => {
    setStVerificatorId(vid);
    setStCounterId("");
    setSerahTerimaData(null);
    if (vid) {
      try {
        const res = await api.get(`/counters?verificator_id=${vid}`);
        setCountersByVerificator(res.data || []);
      } catch {
        setCountersByVerificator([]);
      }
    } else {
      setCountersByVerificator([]);
    }
  };

  const handleSerahTerimaPreview = async () => {
    if (!stVerificatorId) {
      alert("Silakan pilih Verificator terlebih dahulu.");
      return;
    }
    setSerahTerimaLoading(true);
    setSerahTerimaData(null);
    try {
      const params = new URLSearchParams({ verificator_id: stVerificatorId });
      if (stCounterId) params.set("counter_id", stCounterId);
      if (stWhsCode) params.set("whs_code", stWhsCode);
      params.set("status", stStatus);
      const res = await api.get(`/serah-terima?${params.toString()}`);
      setSerahTerimaData(res.data);
    } catch (err) {
      alert(err.response?.data?.error || "Gagal mengambil data");
    } finally {
      setSerahTerimaLoading(false);
    }
  };

  const handleSerahTerimaDownload = async () => {
    try {
      if (!serahTerimaData || !serahTerimaData.tags || serahTerimaData.tags.length === 0) {
        alert("Tidak ada data untuk dicetak.");
        return;
      }
      console.log("[Download] Starting PDF generation with", serahTerimaData.tags.length, "tags");
      await generateSerahTerimaPDF(serahTerimaData);
      console.log("[Download] PDF generation completed");
    } catch (err) {
      console.error("[Download] Error generating PDF:", err);
      alert("Gagal membuat PDF: " + (err.message || "Terjadi kesalahan"));
    }
  };

  const filteredRows = rows;

  const total = summary.total || 0;
  const completed = summary.completed || 0;
  const pending = summary.pending || 0;
  const pct = summary.percentage || 0;

  return (
    <div>
      <Navbar />
      <div className="p-4 max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">
          {isAdmin ? "Monitoring Tags" : `List Tags — ${currentUser?.name || ""}`}
        </h2>

        {/* ================= FILTER ROW ================= */}
        <div className="bg-white p-4 rounded shadow mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* USER FILTER */}
            <div className="flex items-center gap-2">
              <label className="font-semibold text-sm whitespace-nowrap">User :</label>
              {isAdmin ? (
                <select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="border p-2 rounded w-full bg-white"
                >
                  <option value="">Semua User</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              ) : (
                <span className="text-sm font-semibold text-gray-700">{currentUser?.name || "-"}</span>
              )}
            </div>

            {/* STATUS FILTER */}
            <div className="flex items-center gap-2">
              <label className="font-semibold text-sm whitespace-nowrap">Status :</label>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="border p-2 rounded w-full bg-white"
              >
              <option value="">Semua Status</option>
              <option value="OPEN">OPEN</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="RECOUNT_REQUEST">RECOUNT REQUEST</option>
              <option value="APPROVAL_SUCCESS">APPROVAL SUCCESS</option>
              <option value="RECOUNT">RECOUNT</option>
              </select>
            </div>

            {/* LOCATION FILTER */}
            <div className="flex items-center gap-2">
              <label className="font-semibold text-sm whitespace-nowrap">Location :</label>
              <select
                value={selectedLocationId}
                onChange={e => setSelectedLocationId(e.target.value)}
                className="border p-2 rounded w-full bg-white"
              >
                <option value="">Semua Location</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.loc_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ================= DASHBOARD CARDS ================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded shadow p-5 border-l-4 border-blue-500">
            <p className="text-sm text-gray-500 uppercase tracking-wide">Total Tags</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{total}</p>
          </div>
          <div className="bg-white rounded shadow p-5 border-l-4 border-green-500">
            <p className="text-sm text-gray-500 uppercase tracking-wide">Completed Tags</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{completed}</p>
          </div>
          <div className="bg-white rounded shadow p-5 border-l-4 border-amber-500">
            <p className="text-sm text-gray-500 uppercase tracking-wide">Pending Tags</p>
            <p className="text-3xl font-bold text-amber-600 mt-1">{pending}</p>
          </div>
          <div className="bg-white rounded shadow p-5 border-l-4 border-orange-500">
            <p className="text-sm text-gray-500 uppercase tracking-wide">Recount Request</p>
            <p className="text-3xl font-bold text-orange-600 mt-1">{summary.recountRequest || 0}</p>
          </div>
          <div className="bg-white rounded shadow p-5 border-l-4 border-purple-500">
            <p className="text-sm text-gray-500 uppercase tracking-wide">Recount Tags</p>
            <p className="text-3xl font-bold text-purple-600 mt-1">{summary.recount || 0}</p>
          </div>
          <div className="bg-white rounded shadow p-5 border-l-4 border-purple-500">
            <p className="text-sm text-gray-500 uppercase tracking-wide">Completion %</p>
            <p className="text-3xl font-bold text-purple-600 mt-1">{pct}%</p>
          </div>
        </div>

        {/* ================= ADMIN BUTTONS ================= */}
        {isAdmin && (
          <div className="flex justify-end gap-2 mb-3">
            <button
              onClick={handleOpenSerahTerima}
              className="bg-blue-700 text-white px-4 py-2 rounded whitespace-nowrap text-sm font-semibold hover:bg-blue-800"
            >
              Serah Terima
            </button>
            <button
              onClick={handleMultiPrint}
              disabled={selectedIds.size === 0}
              className="bg-gray-700 text-white px-4 py-2 rounded whitespace-nowrap disabled:opacity-40 text-sm font-semibold"
            >
              Print Tag ({selectedIds.size})
            </button>
          </div>
        )}

        {/* ================= TABLE ================= */}
        <div className="bg-white rounded shadow overflow-x-auto">
          {loading ? (
            <div className="p-6 text-center">Loading...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Tag QR</th>
                    <th className="p-2 text-left">Description</th>
                    <th className="p-2 text-left">Location</th>
                    <th className="p-2 text-left">Detail Location</th>
                    <th className="p-2 text-left">Counter</th>
                    <th className="p-2 text-left">Verificator</th>
                    <th className="p-2 text-center">Status</th>
                    <th className="p-2 text-left">Scanned At</th>
                    {isAdmin && <th className="p-2 text-center">Action</th>}
                    {isAdmin && (
                      <th className="p-2 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={selectAll && rows.length > 0}
                          onChange={handleSelectAll}
                          className="cursor-pointer w-4 h-4"
                        />
                      </th>
                    )}
                  </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                      <td colSpan={isAdmin ? 11 : 9} className="p-6 text-center text-gray-500">
                      Tidak ada data
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={r.id} className="border-t hover:bg-gray-50">
                      <td className="p-2 text-xs text-gray-400">{r.id}</td>
                      <td className="p-2 font-mono text-xs">{r.tag_qr}</td>
                      <td className="p-2">{r.description || "-"}</td>
                      <td className="p-2">{r.location_name || "-"}</td>
                      <td className="p-2 text-xs">{r.location_detail || "-"}</td>
                      <td className="p-2">{r.counter_name || "-"}</td>
                      <td className="p-2">{r.verificator_name || "-"}</td>
                      <td className="p-2 text-center">
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold ${
                            r.status === "COMPLETED"
                              ? "bg-green-100 text-green-700"
                              : r.status === "RECOUNT_REQUEST"
                              ? "bg-orange-100 text-orange-700"
                              : r.status === "APPROVAL_SUCCESS"
                              ? "bg-blue-100 text-blue-700"
                              : r.status === "RECOUNT"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {r.status === "APPROVAL_SUCCESS" ? "APPROVAL SUCCESS" : r.status}
                        </span>
                        {r.approval_status === "PENDING" && (
                          <span className="block text-xs text-orange-600 mt-0.5">Menunggu Approval</span>
                        )}
                      </td>
                      <td className="p-2 text-xs">
                        {r.scanned_at
                          ? new Date(r.scanned_at).toLocaleString("id-ID")
                          : "-"}
                      </td>
                      {isAdmin && (
                        <td className="p-2 text-center">
                          {r.status === "RECOUNT_REQUEST" && r.approval_status === "PENDING" ? (
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={async () => {
                                  if (!confirm(`Approve recount untuk tag ${r.tag_qr}?`)) return;
                                  try {
                                    await api.post("/sto-tags/approve-recount", { tag_qr: r.tag_qr });
                                    alert("Recount disetujui");
                                    load();
                                  } catch (err) {
                                    alert(err.response?.data?.error || "Gagal approve");
                                  }
                                }}
                                className="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold hover:bg-green-700"
                              >
                                Approve
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm(`Tolak recount untuk tag ${r.tag_qr}?`)) return;
                                  try {
                                    await api.post("/sto-tags/reject-recount", { tag_qr: r.tag_qr });
                                    alert("Permintaan recount ditolak");
                                    load();
                                  } catch (err) {
                                    alert(err.response?.data?.error || "Gagal reject");
                                  }
                                }}
                                className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold hover:bg-red-700"
                              >
                                Reject
                              </button>
                            </div>
                          ) : r.status === "APPROVAL_SUCCESS" ? (
                            <span className="text-xs text-blue-600 font-semibold">Approved</span>
                          ) : r.status === "RECOUNT" && r.approval_status === "APPROVED" ? (
                            <span className="text-xs text-green-600 font-semibold">Approved</span>
                          ) : r.approval_status === "REJECTED" ? (
                            <span className="text-xs text-red-600 font-semibold">Rejected</span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                      )}
                      {isAdmin && (
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(r.id)}
                            onChange={() => toggleSelect(r.id)}
                            className="cursor-pointer w-4 h-4"
                          />
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ================= MODAL SERAH TERIMA ================= */}
      {showSerahTerima && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded shadow-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-blue-800 mb-4">Serah Terima Tag</h3>

            {/* FILTERS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Verificator <span className="text-red-500">*</span></label>
                <SearchableSelect
                  options={users}
                  value={stVerificatorId ? Number(stVerificatorId) : null}
                  onChange={(id) => handleStVerificatorChange(id ? String(id) : "")}
                  placeholder="Cari verificator..."
                  searchKeys={["name", "username"]}
                  renderOption={(o, detailed) => (
                    <div>
                      <span>{o.name}</span>
                      {detailed && (
                        <span className="text-gray-400 text-xs ml-1">
                          ({o.username}{o.tag_count != null ? ` · ${o.tag_count} Tag` : ""})
                        </span>
                      )}
                      {!detailed && o.tag_count != null && (
                        <span className="text-gray-400 text-xs ml-1">· {o.tag_count} Tag</span>
                      )}
                    </div>
                  )}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Counter <span className="text-gray-400">(opsional)</span></label>
                <select
                  value={stCounterId}
                  onChange={e => setStCounterId(e.target.value)}
                  className="border p-2 rounded w-full bg-white"
                  disabled={!stVerificatorId}
                >
                  <option value="">Semua Counter</option>
                  {countersByVerificator.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Warehouse <span className="text-gray-400">(opsional)</span></label>
                <select
                  value={stWhsCode}
                  onChange={e => setStWhsCode(e.target.value)}
                  className="border p-2 rounded w-full bg-white"
                >
                  <option value="">Semua Warehouse</option>
                  {warehouses.map(w => (
                    <option key={w.whs_code} value={w.whs_code}>{w.whs_code} - {w.whs_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Status</label>
                <select
                  value={stStatus}
                  onChange={e => setStStatus(e.target.value)}
                  className="border p-2 rounded w-full bg-white"
                >
                  <option value="ALL">All</option>
                  <option value="OPEN">Open</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="APPROVAL_SUCCESS">Approval Success</option>
                  <option value="RECOUNT">Recount</option>
                </select>
              </div>
            </div>

            {/* BUTTONS */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={handleSerahTerimaPreview}
                disabled={serahTerimaLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-blue-700 disabled:opacity-40"
              >
                {serahTerimaLoading ? "Memuat..." : "Preview"}
              </button>
              <button
                onClick={handleSerahTerimaDownload}
                disabled={!serahTerimaData || serahTerimaData.tags.length === 0}
                className="bg-green-700 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-green-800 disabled:opacity-40"
              >
                Download PDF
              </button>
              <button
                onClick={() => setShowSerahTerima(false)}
                className="bg-gray-400 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-gray-500 ml-auto"
              >
                Tutup
              </button>
            </div>

            {/* PREVIEW */}
            {serahTerimaLoading && (
              <div className="text-center py-8 text-gray-500">Loading data...</div>
            )}

            {serahTerimaData && !serahTerimaLoading && (
              <div className="border rounded overflow-x-auto">
                {serahTerimaData.tags.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">Tidak ada data</div>
                ) : (
                  <>
                    {/* SUMMARY */}
                    <div className="bg-gray-50 p-3 border-b grid grid-cols-4 gap-2 text-xs">
                      <div><span className="font-semibold">Verificator:</span> {serahTerimaData.verifier.name}</div>
                      <div><span className="font-semibold">Total Tag:</span> {serahTerimaData.summary.total}</div>
                      <div><span className="font-semibold">Open:</span> {serahTerimaData.summary.open}</div>
                      <div><span className="font-semibold">Completed:</span> {serahTerimaData.summary.completed}</div>
                      <div><span className="font-semibold">Approval Success:</span> {serahTerimaData.summary.approvalSuccess}</div>
                      <div><span className="font-semibold">Recount:</span> {serahTerimaData.summary.recount}</div>
                      <div><span className="font-semibold">Minus:</span> {serahTerimaData.summary.minus}</div>
                      <div><span className="font-semibold">Over:</span> {serahTerimaData.summary.over}</div>
                    </div>

                    {/* TABLE */}
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-blue-800 text-white">
                          <th className="p-1.5 text-center">No</th>
                          <th className="p-1.5 text-center">Seq</th>
                          <th className="p-1.5 text-center">Tag QR</th>
                          <th className="p-1.5 text-center">Whs</th>
                          <th className="p-1.5 text-center">Item Code</th>
                          <th className="p-1.5">Description</th>
                          <th className="p-1.5">Location</th>
                          <th className="p-1.5">Detail Location</th>
                          <th className="p-1.5">Counter</th>
                          <th className="p-1.5">Verificator</th>
                          <th className="p-1.5 text-center">UOM</th>
                          <th className="p-1.5 text-center">Qty</th>
                          <th className="p-1.5 text-center">1st</th>
                          <th className="p-1.5 text-center">Recount</th>
                          <th className="p-1.5">Batch</th>
                          <th className="p-1.5 text-center">Status</th>
                          <th className="p-1.5">Remark</th>
                        </tr>
                      </thead>
                      <tbody>
                        {serahTerimaData.tags.map((t, i) => (
                          <tr key={t.id} className="border-t hover:bg-gray-50">
                            <td className="p-1.5 text-center">{i + 1}</td>
                            <td className="p-1.5 text-center">{t.seq || "-"}</td>
                            <td className="p-1.5 font-mono text-center">{t.tag_qr}</td>
                            <td className="p-1.5 text-center">{t.whs_code}</td>
                            <td className="p-1.5 text-center">{t.item_code}</td>
                            <td className="p-1.5">{t.description?.substring(0, 20) || "-"}</td>
                            <td className="p-1.5">{t.location_name || "-"}</td>
                            <td className="p-1.5">{t.location_detail || "-"}</td>
                            <td className="p-1.5">{t.counter_name || "-"}</td>
                            <td className="p-1.5">{t.verificator_name || "-"}</td>
                            <td className="p-1.5 text-center">{t.uom || "-"}</td>
                            <td className="p-1.5 text-center">{t.qty_pcs !== null ? t.qty_pcs : "-"}</td>
                            <td className="p-1.5 text-center">{t.first_count_pcs !== null ? t.first_count_pcs : "-"}</td>
                            <td className="p-1.5 text-center">{t.recount_pcs !== null ? t.recount_pcs : "-"}</td>
                            <td className="p-1.5">{t.batch || "-"}</td>
                            <td className="p-1.5 text-center">
                              <span className={`px-1 py-0.5 rounded text-xs font-bold ${
                                t.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                                t.status === "APPROVAL_SUCCESS" ? "bg-blue-100 text-blue-700" :
                                t.status === "RECOUNT" ? "bg-purple-100 text-purple-700" :
                                "bg-yellow-100 text-yellow-700"
                              }`}>
                                {t.status}
                              </span>
                            </td>
                            <td className="p-1.5">{t.remark || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="text-xs text-gray-500 p-2 text-right">
                      Total: {serahTerimaData.tags.length} tag
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
