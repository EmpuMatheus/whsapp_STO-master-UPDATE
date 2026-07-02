import React, { useEffect, useState } from "react";
import api from "../api";
import Navbar from "../components/Navbar";

export default function StoTagGenerate() {
  const [form, setForm] = useState({
    whs_code: "",
    item_code: "",
    jumlah_tag: 1,
    verifier_id: "",
    counter_id: "",
    located_id: ""
  });

  const [verifiers, setVerifiers] = useState([]);
  const [counters, setCounters] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/verifiers"),
      api.get("/counters"),
      api.get("/located")
    ]).then(([vRes, cRes, lRes]) => {
      setVerifiers(vRes.data || []);
      setCounters(cRes.data || []);
      setLocations(lRes.data || []);
    });
  }, []);

  const filteredCounters = counters.filter(
    c => String(c.verificator_id) === String(form.verifier_id)
  );

  const submit = async () => {
    const { whs_code, item_code, jumlah_tag, verifier_id, counter_id } = form;
    if (!whs_code || !item_code || !jumlah_tag || !verifier_id || !counter_id) {
      return alert("Semua field wajib diisi");
    }

    setLoading(true);
    try {
      const res = await api.post("/sto-tags/generate", {
        whs_code,
        item_code,
        jumlah_tag: Number(jumlah_tag),
        verificator_id: Number(verifier_id),
        counter_id: Number(counter_id),
        located_id: form.located_id ? Number(form.located_id) : null,
        location_detail: form.location_detail || null
      });

      alert(`Berhasil generate ${res.data.total} tag`);
    } catch (e) {
      console.error("Generate Tag Error:", e);
      alert(e.response?.data?.error || e.message || "Gagal generate tag");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Navbar />
      <div className="p-4 max-w-xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Generate STO Tags</h2>

        <input
          placeholder="Warehouse"
          value={form.whs_code}
          onChange={e => setForm({ ...form, whs_code: e.target.value })}
          className="border p-2 w-full mb-2"
        />

        <input
          placeholder="Item Code"
          value={form.item_code}
          onChange={e => setForm({ ...form, item_code: e.target.value })}
          className="border p-2 w-full mb-2"
        />

        <input
          type="number"
          min="1"
          placeholder="Jumlah Tag"
          value={form.jumlah_tag}
          onChange={e => setForm({ ...form, jumlah_tag: e.target.value })}
          className="border p-2 w-full mb-2"
        />

        <select
          value={form.verifier_id}
          onChange={e => setForm({ ...form, verifier_id: e.target.value, counter_id: "" })}
          className="border p-2 w-full mb-3"
        >
          <option value="">-- pilih verifikator --</option>
          {verifiers.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>

        <select
          value={form.counter_id}
          onChange={e => setForm({ ...form, counter_id: e.target.value })}
          disabled={!form.verifier_id}
          className="border p-2 w-full mb-3"
        >
          <option value="">
            {form.verifier_id ? "-- pilih counter --" : "pilih verifikator dulu"}
          </option>
          {filteredCounters.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={form.located_id}
          onChange={e => setForm({ ...form, located_id: e.target.value })}
          className="border p-2 w-full mb-3"
        >
          <option value="">-- pilih lokasi (opsional) --</option>
          {locations.map(l => (
            <option key={l.id} value={l.id}>{l.loc_name}</option>
          ))}
        </select>

        <input
          placeholder="Detail Location (contoh: Rak A Blok 1)"
          value={form.location_detail}
          maxLength="30"
          onChange={e => setForm({ ...form, location_detail: e.target.value })}
          className="border p-2 w-full mb-1"
        />
        <p className="text-xs text-gray-400 text-right mb-3">{(form.location_detail || "").length} / 30</p>

        <button
          disabled={loading}
          onClick={submit}
          className="bg-blue-600 text-white w-full py-2 rounded"
        >
          {loading ? "Processing..." : "Generate Tags"}
        </button>
      </div>
    </div>
  );
}
