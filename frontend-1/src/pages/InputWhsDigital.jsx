import React, { useEffect, useState } from "react";
import api from "../api";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";

export default function InputWhsDigital() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/whs';
  const [searchParams] = useSearchParams();
  const tagFromUrl = searchParams.get("tag");

  const emptyForm = {
    tag_qr: "",
    whs_code: "",
    item_code: "",
    item_group: "",
    description: "",
    qty_pcs: "",
    batch: "",
    remark: "",
    kualitas: "",
    counter_id: "",
    counter_name: "",
    located_id: "",
    located_name: "",
    verificator_name: ""
  };

  const [form, setForm] = useState(emptyForm);
  const [showScanner, setShowScanner] = useState(false);
  const [loadingScan, setLoadingScan] = useState(false);
  const [isRecount, setIsRecount] = useState(false);
  const [tagStatus, setTagStatus] = useState(null);
  const [ownershipError, setOwnershipError] = useState(null);

  /* ================= LOAD DATA BY QR ================= */
  const loadByQR = async (qrText) => {
    setLoadingScan(true);

    try {
      const stoRes = await api.get(`/sto-tags/by-qr/${qrText}`);
      const sto = stoRes.data;

      const itemRes = await api.get(
        `/item-on-hand/by-qr/${sto.whs_code}/${sto.item_code}`
      );

      // 🔥 RESET FORM TOTAL (ANTI BUG)
      setForm(emptyForm);

      // 🔥 CEK STATUS — block jika COMPLETED atau RECOUNT_REQUEST
      if (sto.status === "COMPLETED") {
        alert("Tag sudah selesai dihitung. Ajukan Recount terlebih dahulu.");
        setLoadingScan(false);
        return;
      }

      if (sto.status === "RECOUNT_REQUEST") {
        alert("Tag sedang menunggu Approval Admin.");
        setLoadingScan(false);
        return;
      }

      // 🔥 CEK APAKAH INI RECOUNT
      let existingData = {};
      if (sto.status === "RECOUNT" || sto.status === "APPROVAL_SUCCESS") {
        try {
          const whsRes = await api.get(`/whs/by-tag/${qrText}`);
          existingData = whsRes.data || {};
        } catch {
          // belum ada data whs_digital
        }
      }

      setIsRecount(sto.status === "RECOUNT" || sto.status === "APPROVAL_SUCCESS");
      setTagStatus(sto.status);

      // 🔥 SET DATA BARU (QTY TETAP KOSONG)
      setForm({
        tag_qr: qrText,
        whs_code: sto.whs_code,
        item_code: sto.item_code,
        item_group: itemRes.data.item_group,
        description: itemRes.data.description,

        qty_pcs: "", // ❗ WAJIB KOSONG

        batch: existingData.batch || "",
        remark: existingData.remark || "",
        kualitas: existingData.kualitas || "",

        counter_id: sto.counter_id,
        counter_name: sto.counter_name,
        located_id: sto.located_id,
        located_name: sto.loc_name || "-",
        verificator_name: sto.verificator_name
      });

    } catch (err) {
      if (err.response?.status === 403) {
        setOwnershipError({
          ownerName: err.response?.data?.owner_name || "Unknown"
        });
      } else {
        alert(
          err.response?.data?.error ||
          "Tag QR tidak terdaftar / sudah dipakai"
        );
      }
    } finally {
      setLoadingScan(false);
    }
  };

  /* ================= AUTO LOAD DARI URL ================= */
  useEffect(() => {
    if (tagFromUrl) {
      loadByQR(tagFromUrl);
    }
  }, [tagFromUrl]);

  /* ================= QR SCANNER ================= */
  useEffect(() => {
    if (!showScanner) return;

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scanner.render(
      async (text) => {
        scanner.clear();
        setShowScanner(false);

        const qrText = text.trim();
        loadByQR(qrText);
      },
      () => {}
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [showScanner]);

  /* ================= SAVE ================= */
  const save = async () => {
    if (!form.tag_qr) return alert("QR belum discan");

    if (form.qty_pcs === "" || form.qty_pcs === null || form.qty_pcs === undefined) {
      return alert("Qty PCS wajib diisi");
    }

    if (!form.kualitas) {
      return alert("Kualitas wajib dipilih");
    }

    try {
      await api.post("/whs", {
        tag_qr: form.tag_qr,
        whs_code: form.whs_code,
        item_code: form.item_code,
        count_pcs: Number(form.qty_pcs),
        batch: form.batch || "",
        remark: form.remark || "",
        kualitas: form.kualitas,
        counter_id: form.counter_id,
        located_id: form.located_id
      });

      alert("Berhasil disimpan");
      navigate(from, { replace: true });

    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  /* ================= UI ================= */
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[900px] mx-auto px-4 py-6">
        {/* HEADER */}
        <div className="mb-4">
          <button
            onClick={() => navigate(from, { replace: true })}
            className="text-blue-700 hover:text-blue-800 mb-2 inline-flex items-center gap-1 text-sm"
          >
            ← Kembali
          </button>
          <h2 className="text-2xl font-bold">
            Input WHS Digital
            {isRecount && (
              <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold">
                RECOUNT
              </span>
            )}
          </h2>
        </div>

        {/* APPROVAL SUCCESS INFO */}
        {tagStatus === "APPROVAL_SUCCESS" && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 font-semibold">
              ✅ Approval Recount telah disetujui. Silakan lakukan Recount.
            </p>
          </div>
        )}

        {/* OWNERSHIP ERROR */}
        {ownershipError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-5">
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
        )}

        {/* SCAN BUTTON */}
        <button
          onClick={() => setShowScanner(true)}
          className="w-full bg-blue-700 text-white py-2 rounded mb-3"
        >
          📷 Scan QR
        </button>

        {showScanner && <div id="qr-reader" className="mb-3" />}

        {loadingScan && (
          <div className="text-sm text-blue-600 mb-2">
            Memuat data...
          </div>
        )}

        {/* AUTO FIELDS */}
        {[
          ["Tag QR", "tag_qr"],
          ["Warehouse", "whs_code"],
          ["Item Code", "item_code"],
          ["Item Group", "item_group"],
          ["Description", "description"],
          ["Verificator", "verificator_name"],
          ["Counter", "counter_name"],
          ["Lokasi", "located_name"]
        ].map(([label, key]) => (
          <input
            key={key}
            value={form[key] || ""}
            disabled
            placeholder={label}
            className="border p-2 w-full mb-2 bg-gray-100"
          />
        ))}

        {/* QTY (MANUAL INPUT) */}
        <input
          type="number"
          min={0}
          step={1}
          placeholder="Masukkan Qty PCS"
          value={form.qty_pcs}
          onChange={(e) =>
            setForm({ ...form, qty_pcs: e.target.value })
          }
          className="border p-2 w-full mb-2"
        />

        {/* BATCH */}
        <input
          placeholder="Batch"
          value={form.batch}
          onChange={(e) =>
            setForm({ ...form, batch: e.target.value })
          }
          className="border p-2 w-full mb-2"
        />

        {/* KUALITAS */}
        <select
          value={form.kualitas}
          onChange={(e) =>
            setForm({ ...form, kualitas: e.target.value })
          }
          className="border p-2 w-full mb-2"
        >
          <option value="">-- pilih kualitas --</option>
          <option value="OK">OK</option>
          <option value="REVISI">REVISI</option>
          <option value="REJECT">REJECT</option>
        </select>

        {/* REMARK */}
        <textarea
          placeholder="Remark"
          value={form.remark}
          onChange={(e) =>
            setForm({ ...form, remark: e.target.value })
          }
          className="border p-2 w-full mb-3"
        />

        {/* BUTTON */}
        <div className="flex gap-2">
          <button
            onClick={save}
            className="bg-green-600 text-white flex-1 py-2 rounded"
          >
            Simpan
          </button>

          <button
            onClick={() => navigate(from, { replace: true })}
            className="bg-red-600 text-white flex-1 py-2 rounded"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
