import React, { useEffect, useState } from "react";
import api from "../api";
import { generateTagPDF } from "../utils/generateTagPDF";

export default function PrintAssignStoTagModal({ open, onClose, item }) {
  const [jumlahTag, setJumlahTag] = useState(1);

  const [verificators, setVerificators] = useState([]);
  const [counters, setCounters] = useState([]);
  const [locations, setLocations] = useState([]);

  const [verificatorId, setVerificatorId] = useState("");
  const [counterId, setCounterId] = useState("");
  const [locatedId, setLocatedId] = useState("");
  const [detailLocation, setDetailLocation] = useState("");

  const [loading, setLoading] = useState(false);

  /* ================= LOAD MASTER ================= */
  useEffect(() => {
    if (!open) return;

    loadMaster();
  }, [open]);

  const loadMaster = async () => {
    try {
      const [vRes, cRes, lRes] = await Promise.all([
        api.get("/verifiers"),
        api.get("/counters"),
        api.get("/located"),
      ]);

      setVerificators(vRes.data || []);
      setCounters(cRes.data || []);
      setLocations(lRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  /* ================= GENERATE ================= */
  const handleGenerate = async () => {
    try {
      setLoading(true);

      if (!verificatorId || !counterId) {
        alert("Verificator & Counter wajib");
        return;
      }

      if (!jumlahTag || jumlahTag < 1) {
        alert("Jumlah tag tidak valid");
        return;
      }

      /* ================= INSERT KE DB ================= */
      const res = await api.post("/sto-tags/generate", {
        whs_code: item.whs_code,
        item_code: item.item_code,
        jumlah_tag: jumlahTag,
        verificator_id: verificatorId,
        counter_id: counterId,
        located_id: locatedId || null,
        location_detail: detailLocation || null,
      });

      const createdTags = res.data.tags || [];

      /* ================= AMBIL NAMA ================= */
      const verificatorName =
        verificators.find((v) => v.id == verificatorId)?.name || "-";

      const counterName =
        counters.find((c) => c.id == counterId)?.name || "-";

      const locationName =
        locations.find((l) => l.id == locatedId)?.loc_name || "-";

      /* ================= GENERATE PDF ================= */
      const pdfTags = createdTags.map(t => ({
        tag_qr: t.tag_qr,
        whs_code: item.whs_code,
        item_code: item.item_code,
        description: item.description,
        counter_name: counterName,
        verificator_name: verificatorName,
        location_name: locationName,
        location_detail: detailLocation,
      }));

      console.log('PDF DATA', pdfTags);

      generateTagPDF({ tags: pdfTags });

      onClose();
    } catch (err) {
      console.error("Generate Tag Error:", err);
      alert(err.response?.data?.error || err.message || "Failed generate tag");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
      <div className="bg-white p-6 rounded shadow w-[500px]">
        <h2 className="text-xl font-bold mb-4">Print & Assign STO Tag</h2>

        {/* JUMLAH TAG */}
        <div className="mb-3">
          <input
            type="number"
            min="1"
            value={jumlahTag}
            onChange={(e) => setJumlahTag(Number(e.target.value))}
            className="border p-2 w-full"
            placeholder="Jumlah Tag"
          />
        </div>

        {/* VERIFICATOR */}
        <select
          value={verificatorId}
          onChange={(e) => setVerificatorId(e.target.value)}
          className="border p-2 w-full mb-3"
        >
          <option value="">Pilih Verificator</option>
          {verificators.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>

        {/* COUNTER */}
        <select
          value={counterId}
          onChange={(e) => setCounterId(e.target.value)}
          className="border p-2 w-full mb-3"
        >
          <option value="">Pilih Counter</option>
          {counters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* LOCATION */}
        <select
          value={locatedId}
          onChange={(e) => setLocatedId(e.target.value)}
          className="border p-2 w-full mb-3"
        >
          <option value="">Pilih Location</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.loc_name}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={detailLocation}
          maxLength="30"
          onChange={(e) => setDetailLocation(e.target.value)}
          className="border p-2 w-full mb-1"
          placeholder="Detail Location (opsional)"
        />
        <p className="text-xs text-gray-400 text-right mb-4">{detailLocation.length} / 30</p>

        {/* BUTTON */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="bg-red-500 text-white px-4 py-2 rounded"
          >
            Cancel
          </button>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            {loading ? "Processing..." : "Generate & Print"}
          </button>
        </div>
      </div>
    </div>
  );
}
