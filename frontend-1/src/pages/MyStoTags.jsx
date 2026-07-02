import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import QRScanner from "../components/QRScanner";

export default function MyStoTags() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(() => sessionStorage.getItem("myTagsSearch") || "");
  const [statusFilter, setStatusFilter] = useState(() => sessionStorage.getItem("myTagsStatus") || "");
  const [showScanner, setShowScanner] = useState(false);
  const [confirmData, setConfirmData] = useState(null);
  const [ownershipError, setOwnershipError] = useState(null);
  const [recountRequest, setRecountRequest] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [selectedAdminId, setSelectedAdminId] = useState("");

  useEffect(() => {
    sessionStorage.setItem("myTagsSearch", search);
  }, [search]);

  useEffect(() => {
    sessionStorage.setItem("myTagsStatus", statusFilter);
  }, [statusFilter]);

  /* ================= LOAD ================= */
  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/sto-tags/my");
      setRows(res.data || []);
    } catch (err) {
      console.error(err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* ================= SEARCH + FILTER ================= */
  const filteredRows = rows.filter((r) => {
    const keyword = search.toLowerCase();
    const matchSearch = !keyword ||
      r.tag_qr?.toLowerCase().includes(keyword) ||
      r.description?.toLowerCase().includes(keyword);
    const matchStatus = !statusFilter || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  /* ================= SCAN → redirect / warning ================= */
  const loadAdmins = async () => {
    try {
      const res = await api.get("/sto-tags/admins");
      setAdmins(res.data || []);
    } catch {
      setAdmins([]);
    }
  };

  const handleScanResult = async (decodedText) => {
    const qrText = decodedText.trim();
    setShowScanner(false);
    try {
      const tagRes = await api.get(`/sto-tags/by-qr/${qrText}`);
      const tagStatus = tagRes.data?.status;
      if (tagStatus === "OPEN") {
        navigate(`/input-whs-digital?tag=${encodeURIComponent(qrText)}`, { state: { from: '/my-tags' } });
        return;
      }
      if (tagStatus === "RECOUNT" || tagStatus === "APPROVAL_SUCCESS") {
        navigate(`/input-whs-digital?tag=${encodeURIComponent(qrText)}`, { state: { from: '/my-tags' } });
        return;
      }
      if (tagStatus === "RECOUNT_REQUEST") {
        alert("Tag sedang menunggu Approval Admin.");
        return;
      }
      if (tagStatus === "COMPLETED") {
        loadAdmins();
        setRecountRequest({ tagQr: qrText });
        return;
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setOwnershipError({
          ownerName: err.response?.data?.owner_name || "Unknown"
        });
      } else {
        alert("Tag QR tidak ditemukan atau sudah digunakan");
      }
    }
  };

  /* ================= RECOUNT ================= */
  const handleRecount = async (tagQr, status) => {
    if (status === "OPEN") {
      navigate(`/input-whs-digital?tag=${encodeURIComponent(tagQr)}`, { state: { from: '/my-tags' } });
      return;
    }
    if (status === "RECOUNT" || status === "APPROVAL_SUCCESS") {
      navigate(`/input-whs-digital?tag=${encodeURIComponent(tagQr)}`, { state: { from: '/my-tags' } });
      return;
    }
    if (status === "RECOUNT_REQUEST") {
      alert("Tag sedang menunggu Approval Admin.");
      return;
    }
    if (status === "COMPLETED") {
      loadAdmins();
      setRecountRequest({ tagQr });
      return;
    }
  };

  const handleRequestRecount = async () => {
    if (!recountRequest || !selectedAdminId) {
      return alert("Silakan pilih Admin tujuan.");
    }
    try {
      await api.post("/sto-tags/request-recount", {
        tag_qr: recountRequest.tagQr,
        admin_id: parseInt(selectedAdminId)
      });
      alert("Permintaan recount berhasil dikirim ke Admin.");
      setRecountRequest(null);
      setSelectedAdminId("");
      load();
    } catch (err) {
      alert(err.response?.data?.error || "Gagal mengajukan recount");
    }
  };

  /* ================= DERIVED ================= */
  const isCompleted = (status) => status === "COMPLETED";
  const isRecountRequest = (status) => status === "RECOUNT_REQUEST";
  const isRecount = (status) => status === "RECOUNT";
  const canRecount = (status) => status === "COMPLETED" || status === "RECOUNT" || status === "APPROVAL_SUCCESS";
  const getStatusBadge = (status) => {
    if (status === "COMPLETED") return "bg-green-100 text-green-700";
    if (status === "RECOUNT_REQUEST") return "bg-orange-100 text-orange-700";
    if (status === "APPROVAL_SUCCESS") return "bg-blue-100 text-blue-700";
    if (status === "RECOUNT") return "bg-purple-100 text-purple-700";
    return "bg-yellow-100 text-yellow-700";
  };

  return (
    <div>
      <Navbar />

      <div className="p-4 max-w-6xl mx-auto">

        {/* TITLE + COUNT */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
          <h2 className="text-2xl font-bold">My STO Tags</h2>
          {!loading && (
            <span className="text-sm text-gray-500">
              Showing {filteredRows.length} of {rows.length} Tags
            </span>
          )}
        </div>

        {/* HEADER: SEARCH + FILTER STATUS + SCAN QR */}
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            type="text"
            placeholder="Search Tag / Description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border px-3 py-2 rounded w-full sm:w-56 text-sm"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border px-3 py-2 rounded text-sm bg-white w-full sm:w-44"
          >
            <option value="">All Status</option>
            <option value="OPEN">Open</option>
            <option value="COMPLETED">Completed</option>
            <option value="RECOUNT_REQUEST">Recount Request</option>
            <option value="APPROVAL_SUCCESS">Approval Success</option>
            <option value="RECOUNT">Recount</option>
          </select>

          {(search || statusFilter) && (
            <button
              onClick={() => { setSearch(""); setStatusFilter(""); }}
              className="bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-300"
            >
              Reset
            </button>
          )}

          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => setShowScanner(true)}
              className="bg-blue-600 text-white px-3 py-2 rounded whitespace-nowrap text-sm"
            >
              📷 Scan
            </button>
          </div>
        </div>

        {/* QR SCANNER MODAL */}
        {showScanner && (
          <QRScanner
            onResult={handleScanResult}
            onClose={() => setShowScanner(false)}
          />
        )}

        {loading ? (
          <div className="p-6 text-center">Loading...</div>
        ) : filteredRows.length === 0 ? (
          <div className="bg-white rounded shadow p-6 text-center text-gray-500">
            Tidak ada data
          </div>
        ) : (
          <>
            {/* ================= MOBILE: CARD LAYOUT ================= */}
            <div className="block md:hidden space-y-3">
              {filteredRows.map((r) => (
                  <div key={r.id} className="bg-white rounded shadow p-3 border border-gray-100">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs font-bold truncate">{r.tag_qr}</p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {r.description || <span className="text-red-500 italic">(No Description)</span>}
                        </p>
                      </div>
                    </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                    <span>WH: {r.whs_code || "-"}</span>
                    <span>Item: {r.item_code || "-"}</span>
                    <span>Detail Loc: {r.location_detail || "-"}</span>
                    <span>Counter: {r.counter_name || "-"}</span>
                    <span>
                      Status:{' '}
                      <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${getStatusBadge(r.status)}`}>
                        {r.status}
                      </span>
                      {r.approval_status === "PENDING" && (
                        <span className="text-orange-600 ml-1">(Waiting)</span>
                      )}
                      {r.approval_status === "REJECTED" && (
                        <span className="text-red-600 ml-1">(Rejected)</span>
                      )}
                    </span>
                  </div>

                  {r.count_pcs != null && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs">
                      <span>
                        Qty PCS:{' '}
                        <span className="inline-block bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">
                          {r.count_pcs}
                        </span>
                      </span>
                      <span>
                        1st:{' '}
                        <span className="inline-block bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">
                          {r.first_count_pcs}
                        </span>
                      </span>
                      {r.recount_pcs != null && (
                        <span>
                          Recount:{' '}
                          <span className="inline-block bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">
                            {r.recount_pcs}
                          </span>
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                    <span className="text-xs text-gray-400">
                      {r.scanned_at ? new Date(r.scanned_at).toLocaleString("id-ID") : "-"}
                    </span>
                    {canRecount(r.status) ? (
                      <button
                        onClick={() => handleRecount(r.tag_qr, r.status)}
                            className="bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-600"
                      >
                        {r.status === "COMPLETED" ? "Request Recount" : "Recount"}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ================= DESKTOP: TABLE ================= */}
            <div className="hidden md:block bg-white rounded shadow overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="p-2 text-center">Tag QR</th>
                    <th className="p-2 text-center">Warehouse</th>
                    <th className="p-2 text-center">Item Code</th>
                    <th className="p-2 text-center">Description</th>
                    <th className="p-2 text-center">Detail Location</th>
                    <th className="p-2 text-center">Location</th>
                    <th className="p-2 text-center">Counter</th>
                    <th className="p-2 text-center">Status</th>
                    <th className="p-2 text-center">Qty PCS</th>
                    <th className="p-2 text-center">1st Count</th>
                    <th className="p-2 text-center">Recount</th>
                    <th className="p-2 text-center">Scanned At</th>
                    <th className="p-2 text-center">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRows.map((r) => (
                    <tr key={r.id} className="border-t hover:bg-gray-50">
                      <td className="p-2 text-center font-mono">{r.tag_qr}</td>
                      <td className="p-2 text-center">{r.whs_code || "-"}</td>
                      <td className="p-2 text-center">{r.item_code || "-"}</td>
                      <td className="p-2 text-center">
                        {r.description || (
                          <span className="text-red-500 italic">(No Description)</span>
                        )}
                      </td>
                      <td className="p-2 text-center">{r.location_detail || "-"}</td>
                      <td className="p-2 text-center">{r.location_name || "-"}</td>
                      <td className="p-2 text-center">{r.counter_name || "-"}</td>

                      <td className="p-2 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusBadge(r.status)}`}>
                          {r.status}
                        </span>
                        {r.approval_status === "PENDING" && (
                          <span className="block text-xs text-orange-600 mt-0.5">Waiting Approval</span>
                        )}
                        {r.approval_status === "REJECTED" && (
                          <span className="block text-xs text-red-600 mt-0.5">Rejected</span>
                        )}
                        {r.approval_status === "APPROVED" && (
                          <span className="block text-xs text-green-600 mt-0.5">Approved</span>
                        )}
                      </td>

                      <td className="p-2 text-center">
                        {r.count_pcs != null ? (
                          <span className="inline-block bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">
                            {r.count_pcs}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="p-2 text-center">
                        {r.first_count_pcs != null ? (
                          <span className="inline-block bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs">
                            {r.first_count_pcs}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="p-2 text-center">
                        {r.recount_pcs != null ? (
                          <span className="inline-block bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold">
                            {r.recount_pcs}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="p-2 text-center text-xs">
                        {r.scanned_at
                          ? new Date(r.scanned_at).toLocaleString("id-ID")
                          : "-"}
                      </td>

                      <td className="p-2 text-center">
                        {canRecount(r.status) ? (
                          <button
                            onClick={() => handleRecount(r.tag_qr, r.status)}
                            className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-bold hover:bg-blue-600"
                          >
                            {r.status === "COMPLETED" ? "Request Recount" : "Recount"}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ================= RECONFIRM MODAL ================= */}
      {confirmData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded shadow-lg p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">⚠</span>
              <h3 className="font-bold text-lg text-orange-700">
                {confirmData.status === "CLOSED"
                  ? "Tag Sudah Pernah Diinput"
                  : "Tag Sudah Pernah Direcount"}
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {confirmData.status === "CLOSED"
                ? "Tag ini sudah pernah dilakukan stock opname. Jika Anda melanjutkan, hasil count sebelumnya akan diganti dengan data baru."
                : "Tag ini sudah pernah dilakukan Recount sebelumnya. Jika Anda melanjutkan, hasil Recount terakhir akan diganti dengan data baru."}
            </p>
            <p className="text-sm font-semibold mb-3">
              Apakah Anda yakin ingin melanjutkan Recount?
            </p>

            <div className="bg-gray-50 rounded p-3 space-y-1 text-sm mb-4">
              <InfoRow label="Tag QR" value={confirmData.whs.tag_qr} />
              <InfoRow label="Warehouse" value={confirmData.whs.whs_code} />
              <InfoRow label="Item Code" value={confirmData.whs.item_code} />
              <InfoRow label="Description" value={confirmData.whs.description} />
              <InfoRow label="First Count" value={confirmData.whs.first_count_pcs} />
              <InfoRow label="Current Count" value={confirmData.whs.count_pcs} />
              {confirmData.status === "CLOSED" ? (
                <>
                  <InfoRow label="Tanggal Input Terakhir" value={confirmData.whs.created_at ? new Date(confirmData.whs.created_at).toLocaleString("id-ID") : "-"} />
                  <InfoRow label="User Terakhir" value={confirmData.whs.verificator_name || "-"} />
                </>
              ) : (
                <>
                  <InfoRow label="Last Recount Date" value={confirmData.whs.recount_at ? new Date(confirmData.whs.recount_at).toLocaleString("id-ID") : "-"} />
                  <InfoRow label="Last Recount By" value={confirmData.whs.recount_by_name || "-"} />
                </>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setConfirmData(null)}
                className="bg-gray-400 text-white flex-1 py-2 rounded font-semibold hover:bg-gray-500"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmRecount}
                className="bg-red-600 text-white flex-1 py-2 rounded font-semibold hover:bg-red-700"
              >
                Lanjut Recount
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: REQUEST RECOUNT ================= */}
      {recountRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded shadow-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🔄</span>
              <h3 className="font-bold text-lg text-blue-700">Ajukan Recount</h3>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Tag ini sudah dilakukan 1st Count.
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Apakah Anda yakin ingin mengajukan permintaan Recount?
            </p>

            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Pilih Admin tujuan:
            </label>
            <div className="space-y-2 mb-4">
              {admins.length === 0 ? (
                <p className="text-sm text-red-500">Tidak ada Admin tersedia</p>
              ) : (
                admins.map((a) => (
                  <label
                    key={a.id}
                    className={`flex items-center gap-3 p-3 rounded border cursor-pointer ${
                      String(selectedAdminId) === String(a.id)
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="admin"
                      value={a.id}
                      checked={String(selectedAdminId) === String(a.id)}
                      onChange={(e) => setSelectedAdminId(e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">{a.name}</span>
                  </label>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setRecountRequest(null); setSelectedAdminId(""); }}
                className="bg-gray-400 text-white flex-1 py-2 rounded font-semibold hover:bg-gray-500"
              >
                Batal
              </button>
              <button
                onClick={handleRequestRecount}
                disabled={!selectedAdminId}
                className="bg-blue-600 text-white flex-1 py-2 rounded font-semibold hover:bg-blue-700 disabled:opacity-40"
              >
                Kirim Permintaan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: TAG BUKAN MILIK ANDA ================= */}
      {ownershipError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white w-full max-w-sm rounded shadow-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">⚠</span>
              <h3 className="font-bold text-lg text-red-700">Tag Bukan Milik Anda</h3>
            </div>
            <p className="text-sm text-gray-600 mb-2">Tag ini bukan milik Anda.</p>
            <p className="text-sm text-gray-600 mb-2">
              Tag ini ditugaskan kepada:
            </p>
            <p className="font-semibold text-base mb-4">{ownershipError.ownerName}</p>
            <p className="text-xs text-gray-500 mb-4">
              Silakan hubungi Admin atau Verificator terkait apabila terjadi kesalahan pembagian tag.
            </p>
            <button
              onClick={() => setOwnershipError(null)}
              className="w-full bg-red-600 text-white py-2 rounded font-semibold hover:bg-red-700"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-right">{value ?? "-"}</span>
    </div>
  );
}
