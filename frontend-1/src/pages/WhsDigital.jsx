import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import ExcelJS from "exceljs";
import api from "../api";
import Navbar from "../components/Navbar";
import LocationMap from "../components/LocationMap";

const PAGE_SIZE = 100;

/* ================= HELPER COMPONENTS ================= */

function StatCard({ label, value, color, icon }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function ProgressBar({ value, label }) {
  const color = value >= 80 ? "bg-green-500" : value >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-32 truncate">{label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-sm font-semibold w-14 text-right">{value}%</span>
    </div>
  );
}

function DoughnutChart({ completed, open }) {
  const total = completed + open || 1;
  const pct = Math.round((completed / total) * 100);
  const conic = `conic-gradient(#10b981 0% ${pct}%, #f59e0b ${pct}% 100%)`;
  return (
    <div className="flex items-center gap-6">
      <div className="relative w-28 h-28">
        <div className="w-28 h-28 rounded-full" style={{ background: conic }} />
        <div className="absolute inset-3 bg-white rounded-full flex items-center justify-center">
          <span className="text-lg font-bold">{pct}%</span>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-green-500" />
          <span>Completed ({completed})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-amber-500" />
          <span>Open ({open})</span>
        </div>
      </div>
    </div>
  );
}

function ConditionBadge({ type }) {
  const styles = {
    PASS: "bg-green-600 text-white",
    OVER: "bg-red-600 text-white",
    MINUS: "bg-yellow-400 text-black"
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold ${styles[type] || "bg-gray-200"}`}>
      {type}
    </span>
  );
}

/* ================= MAIN PAGE ================= */

export default function WhsDigital() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [whsCodeFilter, setWhsCodeFilter] = useState("");

  const [summary, setSummary] = useState(null);
  const [perUser, setPerUser] = useState([]);
  const [perWarehouse, setPerWarehouse] = useState([]);
  const [locationProgress, setLocationProgress] = useState([]);
  const [recent, setRecent] = useState([]);
  const [verifiers, setVerifiers] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(true);

  /* ================= RECENT ACTIVITY FILTERS ================= */
  const [activitySearch, setActivitySearch] = useState("");
  const [activityUser, setActivityUser] = useState("");
  const [activityType, setActivityType] = useState("");
  const [activityDateFrom, setActivityDateFrom] = useState("");
  const [activityDateTo, setActivityDateTo] = useState("");

  useEffect(() => {
    const tagFromUrl = searchParams.get("tag");
    if (tagFromUrl) {
      navigate(`/input-whs-digital?tag=${encodeURIComponent(tagFromUrl)}`, { state: { from: '/whs' } });
    }
  }, [searchParams, navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page);
      params.set("pageSize", pageSize);
      if (search) params.set("search", search);
      if (whsCodeFilter) params.set("whs_code", whsCodeFilter);
      const res = await api.get(`/whs/summary?${params.toString()}`);
      const d = res.data || {};
      setRows(Array.isArray(d.data) ? d.data : []);
      setTotalRows(d.total || 0);
      setTotalPages(d.totalPages || 0);
    } catch {
      setRows([]);
      setTotalRows(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    setLoadingSummary(true);
    try {
      const params = new URLSearchParams();
      if (activitySearch) params.set("search", activitySearch);
      if (activityUser) params.set("user", activityUser);
      if (activityType) params.set("activity_type", activityType);
      if (activityDateFrom) params.set("date_from", activityDateFrom);
      if (activityDateTo) params.set("date_to", activityDateTo);
      const qs = params.toString();
      const [sumRes, locRes] = await Promise.all([
        api.get(`/dashboard/summary${qs ? "?" + qs : ""}`),
        api.get("/dashboard/location-progress")
      ]);
      const d = sumRes.data || {};
      setSummary(d.stats || null);
      setPerUser(d.per_user || []);
      setPerWarehouse(d.per_warehouse || []);
      setVerifiers(d.verifiers || []);
      setRecent(d.recent || []);
      setLocationProgress(Array.isArray(locRes.data) ? locRes.data : []);
    } catch (e) {
      console.error("Dashboard load error:", e);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    loadData();
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [activitySearch, activityUser, activityType, activityDateFrom, activityDateTo]);

  useEffect(() => {
    setPage(1);
    loadData();
  }, [search, whsCodeFilter, pageSize]);

  useEffect(() => {
    loadData();
  }, [page]);

  const stats = summary || {};

  /* condition logic */
  const getCondition = (selisih) => {
    if (selisih === 0) return "PASS";
    if (selisih < 0) return "MINUS";
    return "OVER";
  };

  const condColor = (selisih) => {
    if (selisih === 0) return "text-green-600 bg-green-50";
    if (selisih < 0) return "text-yellow-700 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const displayUom = (uom) => {
    if (!uom) return "PCS";
    const upper = uom.toUpperCase();
    if (upper === "M3" || upper === "CUBIC METER") return "PCS";
    return uom;
  };

  const formatQty = (num) => {
    if (num === 0) return 0;
    if (Number.isInteger(num)) return num;
    return parseFloat(Number(num).toFixed(4));
  };

  const mapStatus = (status) => {
    const map = {
      "OPEN": "OPEN",
      "COMPLETED": "COMPLETED",
      "RECOUNT_REQUEST": "RECOUNT REQUEST",
      "RECOUNT": "RECOUNT",
      "APPROVAL_SUCCESS": "APPROVED"
    };
    return map[status] || status || "-";
  };

  const exportExcel = async () => {
    try {
      const res = await api.get("/whs/export-report");
      const { stockOpnameSummary, recentActivity, detailTags } = res.data;

      if (!stockOpnameSummary || stockOpnameSummary.length === 0) {
        alert("Tidak ada data untuk diexport");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "STO BBP System";
      workbook.company = "PT. Bahana Bhumiphala Persada";
      workbook.title = "Stock Opname Report";

      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const filename = `Stock_Opname_Report_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.xlsx`;

      let userObj = {};
      try { userObj = JSON.parse(localStorage.getItem("user") || "{}"); } catch {}
      const userName = userObj.name || "-";
      const exportDate = now.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const exportDateTime = `${exportDate} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

      const pageSetupLandscape = {
        orientation: "landscape",
        fitToPage: true,
        margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 }
      };

      const headerFont = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Calibri" };
      const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
      const headerAlign = { horizontal: "center", vertical: "middle", wrapText: true };

      const applyHeaderStyle = (row) => {
        row.eachCell((cell) => {
          cell.font = headerFont;
          cell.fill = headerFill;
          cell.alignment = headerAlign;
          cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
        });
        row.height = 22;
      };

      const thinBorder = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };

      /* ==================== SHEET 1 : Stock Opname Summary ==================== */
      const ws1 = workbook.addWorksheet("Stock Opname Summary", { pageSetup: pageSetupLandscape });

      ws1.mergeCells("A1:J1");
      ws1.getCell("A1").value = "PT. Bahana Bhumiphala Persada";
      ws1.getCell("A1").font = { bold: true, size: 14, name: "Calibri" };
      ws1.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };

      ws1.mergeCells("A2:J2");
      ws1.getCell("A2").value = "STOCK OPNAME SUMMARY REPORT";
      ws1.getCell("A2").font = { bold: true, size: 12, name: "Calibri" };
      ws1.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };

      ws1.mergeCells("A3:J3");
      ws1.getCell("A3").value = `Tanggal Export: ${exportDateTime}  |  User Export: ${userName}`;
      ws1.getCell("A3").font = { size: 10, name: "Calibri", italic: true };
      ws1.getCell("A3").alignment = { horizontal: "center", vertical: "middle" };

      const s1Headers = [
        "No", "Warehouse", "Item Code", "Description", "Item Group", "UOM",
        "Qty SAP", "Qty STO", "Selisih", "Status"
      ];
      applyHeaderStyle(ws1.addRow(s1Headers));

      stockOpnameSummary.forEach((r, i) => {
        const qtySap = r.qty_sap || 0;
        const qtySto = r.qty_sto || 0;
        const selisih = qtySto - qtySap;
        let status = "PASS";
        if (selisih < 0) status = "MINUS";
        else if (selisih > 0) status = "OVER";

        const row = ws1.addRow([
          i + 1,
          r.whs_code,
          r.item_code,
          r.description || "-",
          r.item_group || "-",
          displayUom(r.uom),
          qtySap,
          qtySto,
          selisih,
          status
        ]);

        row.eachCell((cell) => { cell.border = thinBorder; });
        row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(9).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(10).alignment = { horizontal: "center", vertical: "middle" };
        [6, 7, 8].forEach(c => { row.getCell(c).alignment = { horizontal: "right", vertical: "middle" }; });
      });

      const s1LastRow = ws1.rowCount;
      ws1.autoFilter = { from: { row: 4, column: 1 }, to: { row: s1LastRow, column: 10 } };
      ws1.views = [{ state: "frozen", ySplit: 4 }];
      ws1.columns = [5, 12, 15, 30, 20, 8, 12, 12, 12, 12].map(w => ({ width: w }));

      /* ==================== SHEET 2 : Recent Activity ==================== */
      const ws2 = workbook.addWorksheet("Recent Activity", { pageSetup: pageSetupLandscape });

      ws2.mergeCells("A1:O1");
      ws2.getCell("A1").value = "PT. Bahana Bhumiphala Persada";
      ws2.getCell("A1").font = { bold: true, size: 14, name: "Calibri" };
      ws2.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };

      ws2.mergeCells("A2:O2");
      ws2.getCell("A2").value = "RECENT ACTIVITY REPORT";
      ws2.getCell("A2").font = { bold: true, size: 12, name: "Calibri" };
      ws2.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };

      ws2.mergeCells("A3:O3");
      ws2.getCell("A3").value = `Tanggal Export: ${exportDateTime}  |  User Export: ${userName}`;
      ws2.getCell("A3").font = { size: 10, name: "Calibri", italic: true };
      ws2.getCell("A3").alignment = { horizontal: "center", vertical: "middle" };

      const s2Headers = [
        "No", "Tanggal", "Jam", "Activity", "Tag QR", "Warehouse",
        "Item Code", "Description", "Location", "Counter",
        "Verificator", "Qty PCS", "Qty M3", "Batch", "Remark"
      ];
      applyHeaderStyle(ws2.addRow(s2Headers));

      recentActivity.forEach((r, i) => {
        const date = r.created_at ? new Date(r.created_at) : null;
        const tgl = date ? date.toLocaleDateString("id-ID") : "-";
        const jam = date ? date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-";

        const row = ws2.addRow([
          i + 1, tgl, jam, r.activity_type || "-", r.tag_qr, r.whs_code,
          r.item_code, r.description || "-", r.location_name || "-",
          "", r.verificator_name || "-", r.pcs ?? 0, r.m3 ?? 0,
          r.batch || "-", r.remark || "-"
        ]);

        row.eachCell((cell) => { cell.border = thinBorder; });
        row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
        [12, 13].forEach(c => { row.getCell(c).alignment = { horizontal: "right", vertical: "middle" }; });
      });

      const s2LastRow = ws2.rowCount;
      ws2.autoFilter = { from: { row: 4, column: 1 }, to: { row: s2LastRow, column: 15 } };
      ws2.views = [{ state: "frozen", ySplit: 4 }];
      ws2.columns = [5, 14, 8, 14, 20, 10, 15, 30, 15, 15, 15, 10, 10, 12, 20].map(w => ({ width: w }));

      /* ==================== SHEET 3 : Detail Tags ==================== */
      const ws3 = workbook.addWorksheet("Detail Tags", { pageSetup: pageSetupLandscape });

      ws3.mergeCells("A1:S1");
      ws3.getCell("A1").value = "PT. Bahana Bhumiphala Persada";
      ws3.getCell("A1").font = { bold: true, size: 14, name: "Calibri" };
      ws3.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };

      ws3.mergeCells("A2:S2");
      ws3.getCell("A2").value = "DETAIL TAGS REPORT";
      ws3.getCell("A2").font = { bold: true, size: 12, name: "Calibri" };
      ws3.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };

      ws3.mergeCells("A3:S3");
      ws3.getCell("A3").value = `Tanggal Export: ${exportDateTime}  |  User Export: ${userName}`;
      ws3.getCell("A3").font = { size: 10, name: "Calibri", italic: true };
      ws3.getCell("A3").alignment = { horizontal: "center", vertical: "middle" };

      const s3Headers = [
        "No", "Seq", "Tag QR", "Warehouse", "Item Code", "Description",
        "Location", "Detail Location", "Counter", "Verificator", "Assigned Date", "Status",
        "Qty PCS", "1st Count", "Recount", "Approval", "Approval By",
        "Approval Date", "Scan Date", "Remark"
      ];
      applyHeaderStyle(ws3.addRow(s3Headers));

      detailTags.forEach((r, i) => {
        const qtyPcs = r.recount_pcs ?? r.first_count_pcs ?? r.count_pcs ?? 0;
        const assignedDate = r.assigned_date ? new Date(r.assigned_date).toLocaleDateString("id-ID") : "-";
        const scanDate = r.scan_date ? new Date(r.scan_date).toLocaleDateString("id-ID") : "-";
        const approvalDate = r.recount_approved_at ? new Date(r.recount_approved_at).toLocaleDateString("id-ID") : "-";

        let approval = "-";
        if (r.approval_status === "RECOUNT_APPROVED") approval = "APPROVED";
        else if (r.approval_status === "RECOUNT_REJECTED") approval = "REJECTED";
        else if (r.status === "APPROVAL_SUCCESS") approval = "APPROVED";

        const row = ws3.addRow([
          i + 1, r.seq ?? "-", r.tag_qr, r.whs_code, r.item_code,
          r.description || "-", r.location_name || "-", r.location_detail || "-",
          r.counter_name || "-", r.verificator_name || "-", assignedDate, mapStatus(r.status),
          qtyPcs, r.first_count_pcs ?? "-", r.recount_pcs ?? "-",
          approval, r.approval_by || "-", approvalDate, scanDate, r.remark || "-"
        ]);

        row.eachCell((cell) => { cell.border = thinBorder; });
        row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(11).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(12).alignment = { horizontal: "right", vertical: "middle" };
        [13, 14].forEach(c => { row.getCell(c).alignment = { horizontal: "right", vertical: "middle" }; });
      });

      const s3LastRow = ws3.rowCount;
      ws3.autoFilter = { from: { row: 4, column: 1 }, to: { row: s3LastRow, column: 20 } };
      ws3.views = [{ state: "frozen", ySplit: 4 }];
      ws3.columns = [5, 6, 22, 10, 15, 30, 15, 20, 15, 15, 14, 16, 10, 10, 10, 14, 15, 14, 14, 20].map(w => ({ width: w }));

      /* ==================== WRITE FILE ==================== */
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error("Export error:", err);
      alert("Gagal export: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div>
      <Navbar />
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">

        {/* ================= HEADER + QUICK ACTIONS ================= */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">Dashboard STO BBP</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate("/onhand")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              Generate Tag
            </button>
            <button
              onClick={exportExcel}
              className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              Export Excel
            </button>
          </div>
        </div>

        {/* ================= 6 SUMMARY CARDS ================= */}
        {loadingSummary ? (
          <div className="text-center py-4 text-gray-400">Loading dashboard...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <StatCard label="Total Tags" value={stats.total_tags} color="bg-blue-500" icon="🏷" />
            <StatCard label="Open Tags" value={stats.open_tags} color="bg-amber-500" icon="📂" />
            <StatCard label="Completed Tags" value={stats.completed_tags} color="bg-green-500" icon="✅" />
            <StatCard label="Recount Tags" value={stats.recount_tags} color="bg-purple-500" icon="🔄" />
            <StatCard label="Progress" value={`${stats.progress_pct}%`} color="bg-purple-500" icon="📊" />
            <StatCard label="Total User" value={stats.total_users} color="bg-cyan-500" icon="👥" />
            <StatCard label="Total Warehouse" value={stats.total_warehouses} color="bg-rose-500" icon="🏭" />
          </div>
        )}

        {/* ================= DOUGHNUT CHART ================= */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Completion Status</h3>
          <DoughnutChart completed={stats.completed_tags || 0} open={stats.open_tags || 0} />
        </div>

        {/* ================= PROGRESS PER USER ================= */}
        {!loadingSummary && perUser.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Progress Per User</h3>
            <div className="space-y-3">
              {perUser.map(u => (
                <ProgressBar key={u.user_id} label={u.user_name} value={u.progress_pct} />
              ))}
            </div>
          </div>
        )}

        {/* ================= PETA PROGRESS LOCATION ================= */}
        <LocationMap />

        {/* ================= PROGRESS PER LOCATION ================= */}
        {!loadingSummary && locationProgress.filter(l => l.total_tags > 0).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Progress Per Location</h3>
            <div className="space-y-2">
              {locationProgress
                .filter(l => l.total_tags > 0)
                .sort((a, b) => {
                  const pA = Math.round((a.completed_tags / a.total_tags) * 100);
                  const pB = Math.round((b.completed_tags / b.total_tags) * 100);
                  return pB - pA;
                })
                .map(l => (
                  <ProgressBar key={l.located_id} label={l.loc_name} value={Math.round((l.completed_tags / l.total_tags) * 100)} />
                ))}
            </div>
          </div>
        )}

        {/* ================= PROGRESS PER WAREHOUSE ================= */}
        {!loadingSummary && perWarehouse.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Progress Per Warehouse</h3>
            <div className="space-y-2">
              {perWarehouse
                .sort((a, b) => b.progress_pct - a.progress_pct)
                .map(w => (
                  <ProgressBar key={w.whs_code} label={w.whs_code} value={w.progress_pct} />
                ))}
            </div>
          </div>
        )}

        {/* ================= RECENT ACTIVITY ================= */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <h3 className="font-semibold text-gray-800">Recent Activity</h3>
            {(activitySearch || activityUser || activityType || activityDateFrom || activityDateTo) && (
              <button
                onClick={() => { setActivitySearch(""); setActivityUser(""); setActivityType(""); setActivityDateFrom(""); setActivityDateTo(""); }}
                className="text-xs text-red-600 hover:text-red-800 border border-red-300 px-3 py-1 rounded"
              >
                ✕ Reset Filter
              </button>
            )}
          </div>

          {/* ================= FILTER ROW ================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
            <input
              type="text"
              placeholder="Cari Tag QR / Item / Deskripsi / User..."
              value={activitySearch}
              onChange={e => setActivitySearch(e.target.value)}
              className="border rounded px-3 py-2 text-xs w-full"
            />
            <select
              value={activityUser}
              onChange={e => setActivityUser(e.target.value)}
              className="border rounded px-3 py-2 text-xs w-full bg-white"
            >
              <option value="">Semua User</option>
              {verifiers.map(v => (
                <option key={v.id} value={v.name}>{v.name}</option>
              ))}
            </select>
            <select
              value={activityType}
              onChange={e => setActivityType(e.target.value)}
              className="border rounded px-3 py-2 text-xs w-full bg-white"
            >
              <option value="">Semua Aktivitas</option>
              <option value="FIRST COUNT">First Count</option>
              <option value="RECOUNT">Recount</option>
            </select>
            <input
              type="date"
              value={activityDateFrom}
              onChange={e => setActivityDateFrom(e.target.value)}
              className="border rounded px-3 py-2 text-xs w-full"
              placeholder="Dari Tanggal"
            />
            <input
              type="date"
              value={activityDateTo}
              onChange={e => setActivityDateTo(e.target.value)}
              className="border rounded px-3 py-2 text-xs w-full"
              placeholder="Sampai Tanggal"
            />
          </div>

          {loadingSummary ? (
            <div className="text-center py-6 text-gray-400">Memuat...</div>
          ) : recent.length === 0 ? (
            <p className="text-center text-gray-400 py-6">Tidak ada aktivitas ditemukan.</p>
          ) : (
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="p-2 text-left whitespace-nowrap">Waktu</th>
                    <th className="p-2 text-left">User</th>
                    <th className="p-2 text-left">Aktivitas</th>
                    <th className="p-2 text-left">Tag QR</th>
                    <th className="p-2 text-left">WH</th>
                    <th className="p-2 text-left">Item Code</th>
                    <th className="p-2 text-left max-w-[150px]">Description</th>
                    <th className="p-2 text-right">PCS</th>
                    <th className="p-2 text-left">Batch</th>
                    <th className="p-2 text-left">Lokasi</th>
                    <th className="p-2 text-left max-w-[120px]">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map(r => (
                    <tr key={r.id} className="border-t hover:bg-gray-50">
                      <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("id-ID")}</td>
                      <td className="p-2">{r.verificator_name || "-"}</td>
                      <td className="p-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                          r.activity_type === "FIRST COUNT"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}>
                          {r.activity_type || "-"}
                        </span>
                      </td>
                      <td className="p-2 font-mono">{r.tag_qr}</td>
                      <td className="p-2">{r.whs_code || "-"}</td>
                      <td className="p-2">{r.item_code}</td>
                      <td className="p-2 max-w-[150px] truncate">{r.description || "-"}</td>
                      <td className="p-2 text-right font-semibold">{r.pcs ?? "-"}</td>
                      <td className="p-2">{r.batch || "-"}</td>
                      <td className="p-2">{r.location_name || "-"}</td>
                      <td className="p-2 max-w-[120px] truncate">{r.remark || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ================= STOCK OPNAME SUMMARY ================= */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Stock Opname Summary</h3>

          {/* SEARCH + FILTERS */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              type="text"
              placeholder="Search warehouse / item code / description..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="border rounded-lg p-2 flex-1 text-sm"
            />
            <select
              value={whsCodeFilter}
              onChange={e => setWhsCodeFilter(e.target.value)}
              className="border rounded-lg p-2 text-sm bg-white w-full sm:w-48"
            >
              <option value="">All Warehouse</option>
              {rows.map(r => r.whs_code).filter((v, i, a) => a.indexOf(v) === i).map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              className="border rounded-lg p-2 text-sm bg-white w-full sm:w-32"
            >
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={200}>200 / page</option>
            </select>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-6 text-center text-gray-400">Loading...</div>
            ) : (
              <>
                <table className="w-full text-xs">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">No</th>
                      <th className="p-2 text-left">Warehouse</th>
                      <th className="p-2 text-left">Item Code</th>
                      <th className="p-2 text-left">Description</th>
                      <th className="p-2 text-left">Item Group</th>
                      <th className="p-2 text-left">UOM</th>
                      <th className="p-2 text-right">Qty SAP</th>
                      <th className="p-2 text-right">Qty STO</th>
                      <th className="p-2 text-right">Selisih</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-6 text-center text-gray-500">Tidak ada data</td>
                      </tr>
                    ) : (
                      rows.map((r, i) => (
                        <tr key={i} className="border-t hover:bg-gray-50">
                          <td className="p-2 text-gray-400">{r.no}</td>
                          <td className="p-2">{r.whs_code}</td>
                          <td className="p-2">{r.item_code}</td>
                          <td className="p-2 max-w-[180px] truncate">{r.description || "-"}</td>
                          <td className="p-2">{r.item_group || "-"}</td>
                          <td className="p-2 text-center">{displayUom(r.uom)}</td>
                          <td className="p-2 text-right font-semibold">{formatQty(r.qty_sap)}</td>
                          <td className="p-2 text-right font-semibold">{formatQty(r.qty_sto)}</td>
                          <td className={`p-2 text-right font-semibold ${r.selisih > 0 ? 'text-red-600' : r.selisih < 0 ? 'text-yellow-700' : 'text-green-600'}`}>{formatQty(r.selisih)}</td>
                          <td className="p-2 text-center">
                            <ConditionBadge type={r.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* PAGINATION */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 p-3 text-sm">
                  <div className="text-gray-500">
                    {totalRows > 0 ? (
                      <>Showing {(page - 1) * pageSize + 1}&ndash;{Math.min(page * pageSize, totalRows)} of {totalRows.toLocaleString()} records</>
                    ) : (
                      "No records"
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                      className="px-3 py-1 border rounded disabled:opacity-30 hover:bg-gray-100"
                    >
                      &laquo; Prev
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                      const p = start + i;
                      if (p > totalPages) return null;
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`px-3 py-1 border rounded ${p === page ? "bg-blue-600 text-white font-bold" : "hover:bg-gray-100"}`}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => p + 1)}
                      className="px-3 py-1 border rounded disabled:opacity-30 hover:bg-gray-100"
                    >
                      Next &raquo;
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
