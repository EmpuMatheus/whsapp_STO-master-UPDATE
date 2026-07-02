import React, {useEffect, useState} from 'react';
import api from '../api';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function VerificatorList(){
  const [data,setData]=useState([]);
  const load = async ()=> {
    const res = await api.get('/verifiers');
    setData(res.data);
  };
  useEffect(()=>{ load(); }, []);
  const del = async (id) => {
  if (!confirm('Yakin hapus?')) return;
  try {
    await api.delete('/verifiers/' + id);
    alert('Deleted');
    load();
  } catch (err) {
    console.error(err);
    alert('Gagal menghapus: ' + (err.response?.data?.error || err.message));
  }
};

  return (
    <div>
      <Navbar />
      <div className="p-4 max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl font-bold">Verificators</h2>
          <Link to="/verificator/add" className="bg-blue-600 text-white px-3 py-1 rounded">+ Add</Link>
        </div>
        <div className="bg-white p-3 rounded shadow">
          <table className="w-full">
            <thead><tr><th className="text-left">Name</th><th>Username</th><th>Aksi</th></tr></thead>
            <tbody>
              {data.map(v=>(
                <tr key={v.id} className="border-t">
                  <td className="py-2">{v.name}</td>
                  <td>{v.username}</td>
                  <td><Link className="text-green-600 mr-2" to={`/verificator/edit/${v.id}`}>Edit</Link>
                  <button className="text-red-600" onClick={()=>del(v.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
