import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import api from "../api";
import Navbar from "../components/Navbar";
import { generateTagPDF } from "../utils/generateTagPDF";

export default function GenerateTags() {
  const [step, setStep] = useState("upload"); // upload | preview | result
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [allValid, setAllValid] = useState(false);
  const [totalRow, setTotalRow] = useState(0);
  const [totalTag, setTotalTag] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    api.get("/generate/history").then(res => setHistory(res.data || [])).catch(() => {});
  }, []);

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Warehouse", "Item Code", "Description", "Location", "Detail Location", "Counter", "Verificator", "Jumlah Tag"],
      ["FGOD", "FGD00136", "FG DOORCORE MRE", "KEDI A", "Rak A Blok 1", "Counter A", "Theo Admin", 10],
      ["DSTOCK", "FGD00175", "FG DOORCORE", "QC", "", "Counter B", "Andre", 5]
    ]);
    ws["!cols"] = [
      { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 12 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_Generate_Tag.xlsx");
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setStep("upload");
    setPreview([]);
    setAllValid(false);
    setResult(null);
  };

  const uploadAndPreview = async () => {
    if (!file) return alert("Pilih file terlebih dahulu");
    setLoading(true);

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (json.length === 0) {
        alert("File kosong atau format tidak sesuai");
        setLoading(false);
        return;
      }

      const res = await api.post("/generate/preview", { rows: json });
      setPreview(res.data.preview || []);
      setAllValid(res.data.allValid);
      setTotalRow(res.data.totalRow);
      setTotalTag(res.data.totalTag);
      setStep("preview");
    } catch (err) {
      alert(err.response?.data?.error || "Gagal membaca file");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!allValid) return alert("Ada data yang tidak valid");
    setGenerating(true);

    try {
      const data = preview.map(p => ({
        whs_code: p.whs_code,
        item_code: p.item_code,
        description: p.description,
        location_name: p.location_name,
        detail_location: p.detail_location,
        counter_name: p.counter_name,
        verificator_name: p.verificator_name,
        jumlah_tag: p.jumlah_tag
      }));

      console.log("=== GENERATE DATA SENT ===", data);

      const res = await api.post("/generate/bulk", {
        rows: data,
        filename: file?.name || "upload.xlsx"
      });

      console.log("=== GENERATE RESULT ===", res.data);

      setResult(res.data);
      setStep("result");

      // refresh history
      const hist = await api.get("/generate/history");
      setHistory(hist.data || []);
    } catch (err) {
      alert(err.response?.data?.error || "Gagal generate tag");
    } finally {
      setGenerating(false);
    }
  };

  const downloadPDF = async () => {
    if (!result?.tags || result.tags.length === 0) return;
    console.log("=== PDF DATA ===", result.tags.slice(0, 3));
    await generateTagPDF({ tags: result.tags });
  };

  const resetAll = () => {
    setStep("upload");
    setFile(null);
    setPreview([]);
    setAllValid(false);
    setResult(null);
    document.getElementById("file-input").value = "";
  };

  return (
    <div>
      <Navbar />
      <div className="p-4 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Generated Tag</h2>

        {/* ================= DOWNLOAD TEMPLATE ================= */}
        <div className="bg-white rounded shadow p-4 mb-4">
          <button
            onClick={downloadTemplate}
            className="bg-green-600 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-green-700"
          >
            Download Template
          </button>
        </div>

        {/* ================= UPLOAD ================= */}
        <div className="bg-white rounded shadow p-4 mb-4">
          <h3 className="font-semibold text-gray-800 mb-3">Upload Excel</h3>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFile}
              className="border p-2 rounded text-sm flex-1 w-full sm:w-auto"
            />
            <button
              onClick={uploadAndPreview}
              disabled={!file || loading}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-blue-700 disabled:opacity-40"
            >
              {loading ? "Memproses..." : "Upload & Preview"}
            </button>
          </div>
        </div>

        {/* ================= PREVIEW ================= */}
        {step === "preview" && (
          <div className="bg-white rounded shadow p-4 mb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <h3 className="font-semibold text-gray-800">
                Preview Data ({totalRow} baris, {totalTag} tag)
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={resetAll}
                  className="bg-gray-500 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-600"
                >
                  Batal
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!allValid || generating}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-semibold hover:bg-blue-700 disabled:opacity-40"
                >
                  {generating ? "Generating..." : "Generate Tag"}
                </button>
              </div>
            </div>

            {/* SUMMARY */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-gray-50 rounded p-3 border border-gray-200">
                <p className="text-xs text-gray-500">Total Baris</p>
                <p className="text-xl font-bold">{totalRow}</p>
              </div>
              <div className="bg-green-50 rounded p-3 border border-green-200">
                <p className="text-xs text-green-600">✔ Valid Row</p>
                <p className="text-xl font-bold text-green-700">{preview.filter(p => p.valid).length}</p>
              </div>
              <div className="bg-red-50 rounded p-3 border border-red-200">
                <p className="text-xs text-red-600">✖ Invalid Row</p>
                <p className="text-xl font-bold text-red-700">{preview.filter(p => !p.valid).length}</p>
              </div>
            </div>

            {/* ERROR DETAILS */}
            {!allValid && (
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                <p className="text-sm font-semibold text-red-700 mb-2">Daftar Error:</p>
                {preview.filter(p => !p.valid).map(p => (
                  <div key={p.row} className="text-xs text-red-600 mb-1">
                    <span className="font-semibold">Row {p.row}:</span>
                    <ul className="list-disc list-inside ml-2">
                      {p.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {/* MOBILE CARDS */}
            <div className="block md:hidden space-y-3">
              {preview.map((p) => (
                <div key={p.row} className={`border rounded p-3 ${p.valid ? "border-gray-200" : "border-red-300 bg-red-50"}`}>
                  <div className="text-xs space-y-1">
                    <p><b>Row {p.row}</b> {!p.valid && <span className="text-red-600 font-bold">(Invalid)</span>}</p>
                    <p>WH: {p.whs_code} | Item: {p.item_code}</p>
                    <p>{p.description}</p>
                    <p>Loc: {p.location_name} | Detail: {p.detail_location || "-"} | Counter: {p.counter_name} | Ver: {p.verificator_name}</p>
                    <p>Jumlah: {p.jumlah_tag}</p>
                    {p.errors.length > 0 && (
                      <ul className="text-red-600 list-disc list-inside mt-1">
                        {p.errors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP TABLE */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Warehouse</th>
                    <th className="p-2 text-left">Item Code</th>
                    <th className="p-2 text-left">Description</th>
                    <th className="p-2 text-left">Location</th>
                    <th className="p-2 text-left">Detail Location</th>
                    <th className="p-2 text-left">Counter</th>
                    <th className="p-2 text-left">Verificator</th>
                    <th className="p-2 text-center">Jml Tag</th>
                    <th className="p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((p) => (
                    <tr key={p.row} className={`border-t ${p.valid ? "" : "bg-red-50"}`}>
                      <td className="p-2">{p.row}</td>
                      <td className="p-2">{p.whs_code}</td>
                      <td className="p-2 font-mono">{p.item_code}</td>
                      <td className="p-2">{p.description}</td>
                      <td className="p-2">{p.location_name}</td>
                      <td className="p-2">{p.detail_location || "-"}</td>
                      <td className="p-2">{p.counter_name}</td>
                      <td className="p-2">{p.verificator_name}</td>
                      <td className="p-2 text-center">{p.jumlah_tag}</td>
                      <td className="p-2 text-center">
                        {p.valid ? (
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold">Valid</span>
                        ) : (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold" title={p.errors.join("; ")}>Error</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= RESULT ================= */}
        {step === "result" && result && (
          <div className="bg-white rounded shadow p-4 mb-4">
            <div className="bg-green-50 border border-green-200 rounded p-4 mb-4">
              <p className="text-green-800 font-semibold">✅ Berhasil generate {result.totalTag} tag dari {result.totalRow} baris data.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={downloadPDF}
                className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-indigo-700"
              >
                Download Generated Tag PDF
              </button>
              <button
                onClick={resetAll}
                className="bg-gray-500 text-white px-4 py-2 rounded text-sm hover:bg-gray-600"
              >
                Generate Lagi
              </button>
            </div>
          </div>
        )}

        {/* ================= HISTORY ================= */}
        <div className="bg-white rounded shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Riwayat Generate</h3>
          {history.length === 0 ? (
            <p className="text-gray-400 text-sm">Belum ada riwayat generate.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-2 text-left">Tanggal</th>
                    <th className="p-2 text-left">Nama File</th>
                    <th className="p-2 text-center">Total Row</th>
                    <th className="p-2 text-center">Total Tag</th>
                    <th className="p-2 text-left">Generated By</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-t">
                      <td className="p-2 text-xs">{new Date(h.created_at).toLocaleString("id-ID")}</td>
                      <td className="p-2">{h.filename}</td>
                      <td className="p-2 text-center">{h.total_row}</td>
                      <td className="p-2 text-center font-semibold">{h.total_tag}</td>
                      <td className="p-2">{h.generated_by_name || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
