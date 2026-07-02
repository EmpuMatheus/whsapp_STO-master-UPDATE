import React, {useEffect, useState} from 'react';
import api from '../api';
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';

export default function Warehouses(){
  const [data,setData]=useState([]);
  const [file,setFile]=useState(null);
  const [clearFirst,setClearFirst]=useState(false);
  const [loading,setLoading]=useState(false);
  const nav = useNavigate();

  const load = async () => {
    try {
      const res = await api.get('/warehouses');
      setData(res.data);
    } catch (e) {
      alert('Failed to load warehouses');
    }
  };

  useEffect(()=>{ load(); }, []);

  const handleFile = (e) => setFile(e.target.files[0]);

  const uploadCSV = async () => {
    if (!file) return alert('Pilih file CSV terlebih dahulu');
    if (!confirm(`Upload ${file.name}? ${clearFirst ? 'This will CLEAR existing warehouses first.' : ''}`)) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('clear', clearFirst ? 'true' : 'false');
      const res = await api.post('/warehouses/import-csv', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000
      });
      alert(`Imported: ${res.data.inserted} / ${res.data.total} (skipped: ${res.data.skipped})`);
      setFile(null);
      document.getElementById('whsfile').value = '';
      await load();
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.error || err.message));
    } finally { setLoading(false); }
  };

  const clearWarehouses = async () => {
    if (!confirm('Are you sure clear ALL warehouses?')) return;
    try {
      await api.post('/warehouses/clear');
      alert('Warehouses cleared');
      load();
    } catch (e) {
      alert('Clear failed');
    }
  };

  const del = async (id) => {
    if (!confirm('Yakin hapus?')) return;
    try {
      await api.delete('/warehouses/' + id);
      alert('Deleted');
      load();
    } catch (e) {
      alert('Delete failed: ' + (e.response?.data?.error || e.message));
    }
  };

  const edit = (id) => {
    // simple inline prompt for name — you can make a nicer form
    const newName = prompt('New warehouse name:');
    if (!newName) return;
    api.put('/warehouses/' + id, { whs_name: newName })
      .then(()=> { alert('Updated'); load(); })
      .catch(err => alert('Update failed: ' + (err.response?.data?.error || err.message)));
  };

  return (
    <div>
      <Navbar />
      <div className="p-4 max-w-3xl mx-auto">
        <h2 className="text-xl mb-3">Warehouses</h2>

        <div className="bg-white p-3 rounded shadow mb-4">
          <div className="mb-2">
            <input id="whsfile" type="file" accept=".csv,text/csv" onChange={handleFile} />
          </div>
          <div className="mb-2">
            <label className="mr-2">
              <input type="checkbox" checked={clearFirst} onChange={e=>setClearFirst(e.target.checked)} /> Clear warehouses before import
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={uploadCSV} disabled={loading} className="bg-blue-600 text-white px-3 py-1 rounded">{loading ? 'Uploading...' : 'Upload CSV'}</button>
            <button onClick={clearWarehouses} className="bg-red-600 text-white px-3 py-1 rounded">Clear Warehouses</button>
          </div>
        </div>

        <div className="bg-white p-3 rounded shadow">
          <table className="w-full">
            <thead><tr><th>Code</th><th>Name</th><th>Aksi</th></tr></thead>
            <tbody>
              {data.map(w=>(
                <tr key={w.id} className="border-t">
                  <td className="py-2">{w.whs_code}</td>
                  <td>{w.whs_name}</td>
                  <td>
                    <button onClick={()=>edit(w.id)} className="text-green-600 mr-2">Edit</button>
                    <button onClick={()=>del(w.id)} className="text-red-600">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
