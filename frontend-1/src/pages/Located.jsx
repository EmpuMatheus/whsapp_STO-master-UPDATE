import React, { useEffect, useState } from "react";
import api from "../api";
import Navbar from "../components/Navbar";

export default function Located() {
  const [rows, setRows] = useState([]);
  const [locCode, setLocCode] = useState("");
  const [locName, setLocName] = useState("");
  const [loading, setLoading] = useState(false);

  /* ================= LOAD DATA ================= */
  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get("/located");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      alert("Gagal load located");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* ================= GENERATE DEFAULT ================= */
  const generateDefault = async () => {
    try {
      const res = await api.post("/located/generate-default");
      alert(res.data?.message || "OK");
      load();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  };

  /* ================= ADD ================= */
  const addLocated = async () => {
    if (!locCode || !locName) {
      alert("Kode & Nama lokasi wajib diisi");
      return;
    }

    try {
      await api.post("/located", {
        loc_code: locCode,
        loc_name: locName
      });

      setLocCode("");
      setLocName("");
      load();
    } catch (e) {
      alert(
        e.response?.data?.error ||
        e.message
      );
    }
  };

  /* ================= DELETE ================= */
  const remove = async (id) => {
    if (!window.confirm("Hapus lokasi ini?")) return;
    await api.delete(`/located/${id}`);
    load();
  };

  return (
    <div>
      <Navbar />

      <div className="p-4 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">
          Master Location
        </h2>

        {/* ADD FORM */}
        <div className="bg-white p-4 rounded shadow mb-4 flex gap-3">
          <input
            className="border p-2 rounded w-32"
            placeholder="Code"
            value={locCode}
            onChange={e => setLocCode(e.target.value)}
          />
          <input
            className="border p-2 rounded flex-1"
            placeholder="Name"
            value={locName}
            onChange={e => setLocName(e.target.value)}
          />
          <button
            onClick={addLocated}
            className="bg-green-600 text-white px-4 rounded"
          >
            Add
          </button>
          <button
            onClick={generateDefault}
            className="bg-blue-600 text-white px-4 rounded"
          >
            Generate Default Location
          </button>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded shadow overflow-x-auto">
          {loading ? (
            <div className="p-6 text-center">Loading...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Code</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 w-24">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-6 text-center">
                      Tidak ada data
                    </td>
                  </tr>
                ) : (
                  rows.map(r => (
                    <tr key={r.id} className="border-t">
                      <td className="p-2">{r.loc_code}</td>
                      <td className="p-2">{r.loc_name}</td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => remove(r.id)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
