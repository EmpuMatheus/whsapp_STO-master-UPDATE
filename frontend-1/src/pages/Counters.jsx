import { useEffect, useState } from "react";
import api from "../api";
import Navbar from "../components/Navbar";

export default function Counters() {
  const [rows, setRows] = useState([]);
  const [verifiers, setVerifiers] = useState([]);
  const [name, setName] = useState("");
  const [verifierId, setVerifierId] = useState("");
  const [loading, setLoading] = useState(false);

  /* ================= LOAD DATA ================= */
  const load = async () => {
    try {
      setLoading(true);

      const [countersRes, verRes] = await Promise.all([
        api.get("/counters"),
        api.get("/verifiers") // ✅ FIX PATH
      ]);

      setRows(Array.isArray(countersRes.data) ? countersRes.data : []);
      setVerifiers(Array.isArray(verRes.data) ? verRes.data : []);

    } catch (err) {
      console.error("Failed load counters", err);
      alert("Gagal load counters");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* ================= ADD ================= */
  const add = async () => {
    if (!name.trim()) return alert("Nama counter kosong");
    if (!verifierId) return alert("Verificator wajib dipilih");

    await api.post("/counters", {
      name: name.trim(),
      verificator_id: Number(verifierId)
    });

    setName("");
    setVerifierId("");
    load();
  };

  /* ================= DELETE ================= */
  const del = async (id) => {
    if (!confirm("Delete counter?")) return;
    await api.delete(`/counters/${id}`);
    load();
  };

  return (
    <>
      <Navbar />

      <div className="p-4 max-w-lg mx-auto">
        <h2 className="text-xl font-bold mb-4">Counters</h2>

        {/* ================= ADD FORM ================= */}
        <div className="border rounded p-4 mb-4 bg-white shadow-sm">
          <div className="mb-2">
            <input
              className="border px-2 py-1 w-full"
              placeholder="Counter name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="mb-3">
            <select
              className="border px-2 py-1 w-full"
              value={verifierId}
              onChange={(e) => setVerifierId(e.target.value)}
            >
              <option value="">-- pilih verificator --</option>
              {verifiers.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={add}
            className="bg-blue-600 text-white px-3 py-2 rounded w-full"
          >
            Add Counter
          </button>
        </div>

        {/* ================= LIST ================= */}
        {loading ? (
          <div>Loading...</div>
        ) : rows.length === 0 ? (
          <div className="text-gray-500">No counters</div>
        ) : (
          <ul className="border rounded bg-white shadow-sm">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex justify-between items-center px-3 py-2 border-b last:border-b-0"
              >
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-gray-500">
                    Verificator: {r.verificator_name || "-"}
                  </div>
                </div>

                <button
                  onClick={() => del(r.id)}
                  className="text-red-600 text-sm"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
