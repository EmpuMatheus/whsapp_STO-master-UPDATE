import React, { useEffect, useState } from "react";
import api from "../api";
import Navbar from "../components/Navbar";

export default function Items() {
  const [items, setItems] = useState([]);
  const [file, setFile] = useState(null);
  const [clearFirst, setClearFirst] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadItems = async () => {
    try {
      setLoading(true);
      const res = await api.get("/items");
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const uploadCSV = async () => {
    if (!file) return alert("Pilih file CSV terlebih dahulu");
    if (!confirm("Upload CSV items?")) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("clear", clearFirst ? "true" : "false");

      const res = await api.post("/items/import-csv", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      alert(`Imported ${res.data.inserted} rows`);
      setFile(null);
      document.getElementById("itemfile").value = "";
      loadItems();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    } finally {
      setUploading(false);
    }
  };

  const clearItems = async () => {
    if (!confirm("Hapus semua item?")) return;
    try {
      await api.post("/items/clear");
      loadItems();
    } catch (e) {
      alert("Gagal clear items");
    }
  };

  return (
    <div>
      <Navbar />

      <div className="p-4 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Items</h2>

        {/* UPLOAD BOX */}
        <div className="bg-white p-4 rounded shadow mb-4">
          <input
            id="itemfile"
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files[0])}
          />

          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              checked={clearFirst}
              onChange={(e) => setClearFirst(e.target.checked)}
            />
            <span className="text-sm">Clear items before import</span>
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={uploadCSV}
              disabled={uploading}
              className="bg-blue-600 text-white px-4 py-1 rounded"
            >
              Upload CSV
            </button>
            <button
              onClick={clearItems}
              className="bg-red-600 text-white px-4 py-1 rounded"
            >
              Clear Items
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded shadow overflow-x-auto">
          {loading ? (
            <div className="p-4">Loading...</div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="p-2 border">Item Code</th>
                  <th className="p-2 border">Description</th>
                  <th className="p-2 border">Item Group</th>
                  <th className="p-2 border">Warehouse</th>
                  <th className="p-2 border">UOM</th>
                  <th className="p-2 border">Vol/Pcs</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-gray-500">
                      No data
                    </td>
                  </tr>
                ) : (
                  items.map((i) => (
                    <tr key={i.id} className="hover:bg-gray-50">
                      <td className="p-2 border font-mono">{i.item_code}</td>
                      <td className="p-2 border">{i.description}</td>
                      <td className="p-2 border">{i.item_group}</td>
                      <td className="p-2 border">{i.warehouse}</td>
                      <td className="p-2 border">{i.uom}</td>
                      <td className="p-2 border text-right">{i.bvolume}</td>
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
