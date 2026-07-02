import React, { useEffect, useState } from "react";
import api from "../api";
import { generateTagPDF } from "../utils/generateTagPDF";

export default function PrintAssignStoTagModal({
  open,
  onClose,
  item
}) {
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

    setVerificatorId("");
    setCounterId("");
    setLocatedId("");
    setDetailLocation("");

    api.get("/verifiers")
      .then(r => setVerificators(Array.isArray(r.data) ? r.data : []))
      .catch(() => setVerificators([]));

    api.get("/counters")
      .then(r => setCounters(Array.isArray(r.data) ? r.data : []))
      .catch(() => setCounters([]));

    api.get("/located")
      .then(r => setLocations(Array.isArray(r.data) ? r.data : []))
      .catch(() => setLocations([]));
  }, [open]);

  /* ================= FILTER COUNTERS ================= */
  const filteredCounters = counters.filter(
    c => String(c.verificator_id) === String(verificatorId)
  );

  /* ================= GENERATE ================= */
  const generate = async () => {
    if (!item) {
      alert("Item tidak valid");
      return;
    }

    if (!verificatorId || !counterId) {
      alert("Verificator & Counter wajib dipilih");
      return;
    }

    if (!jumlahTag || jumlahTag < 1) {
      alert("Jumlah tag tidak valid");
      return;
    }

    try {
      setLoading(true);

      /* ================= SAVE STO TAGS ================= */
      const res = await api.post("/sto-tags/generate", {
        whs_code: item.whs_code,
        item_code: item.item_code,
        jumlah_tag: jumlahTag,
        verificator_id: Number(verificatorId),
        counter_id: Number(counterId),
        located_id: locatedId ? Number(locatedId) : null,
        location_detail: detailLocation || null
      });

      const createdTags = res.data.tags || [];

      /* ================= PRINT PDF ================= */
      const verificatorName =
        verificators.find((v) => v.id == verificatorId)?.name || "-";

      const counterName =
        counters.find((c) => c.id == counterId)?.name || "-";

      const locationName =
        locations.find((l) => l.id == locatedId)?.loc_name || "-";

      const pdfTags = createdTags.map(t => ({
        ...t,
        whs_code: item.whs_code,
        item_code: item.item_code,
        description: item.description,
        counter_name: counterName,
        verificator_name: verificatorName,
        location_name: locationName,
        location_detail: detailLocation,
      }));

      await generateTagPDF({ tags: pdfTags });

      onClose();

    } catch (err) {
      alert(
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.message
      );
    } finally {
      setLoading(false);
    }
  };

  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* BACKDROP */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* MODAL */}
      <div className="relative bg-white w-full max-w-md rounded shadow p-5">
        <h3 className="text-lg font-bold mb-4">
          Print & Assign STO Tag
        </h3>

        {/* JUMLAH TAG */}
        <div className="mb-3">
          <input
            type="number"
            min="1"
            value={jumlahTag}
            onChange={e => setJumlahTag(Number(e.target.value))}
            className="border p-2 rounded w-full"
            placeholder="Jumlah Tag"
          />
        </div>

        {/* VERIFICATOR */}
        <select
          value={verificatorId}
          onChange={e => {
            setVerificatorId(e.target.value);
            setCounterId("");
          }}
          className="border p-2 rounded w-full mb-3 bg-white"
        >
          <option value="">-- Pilih Verificator --</option>
          {verificators.map(v => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>

        {/* COUNTER */}
        <select
          value={counterId}
          onChange={e => setCounterId(e.target.value)}
          disabled={!verificatorId}
          className="border p-2 rounded w-full mb-3 bg-white disabled:bg-gray-100"
        >
          <option value="">
            {verificatorId
              ? "-- Pilih Counter --"
              : "Pilih verificator dulu"}
          </option>
          {filteredCounters.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* LOCATED */}
        <select
          value={locatedId}
          onChange={e => setLocatedId(e.target.value)}
          className="border p-2 rounded w-full mb-3 bg-white"
        >
          <option value="">-- Pilih Lokasi (Opsional) --</option>
          {locations.map(l => (
            <option key={l.id} value={l.id}>
              {l.loc_code} - {l.loc_name}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={detailLocation}
          maxLength="30"
          onChange={e => setDetailLocation(e.target.value)}
          className="border p-2 rounded w-full mb-1"
          placeholder="Detail Location (opsional, contoh: Rak A Blok 1)"
        />
        <p className="text-xs text-gray-400 text-right mb-4">{detailLocation.length} / 30</p>

        {/* ACTION */}
        <div className="flex gap-3">
          <button
            disabled={loading}
            onClick={generate}
            className="flex-1 bg-green-600 text-white py-2 rounded disabled:opacity-50"
          >
            {loading ? "Processing..." : "Generate & Print"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-red-600 text-white py-2 rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
