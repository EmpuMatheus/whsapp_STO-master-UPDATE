import React, { useEffect, useState } from 'react';
import api from '../api';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function UserManagement() {
  const [data, setData] = useState([]);
  const load = async () => {
    const res = await api.get('/verifiers');
    setData(res.data);
  };
  useEffect(() => { load(); }, []);

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

  const roleBadge = (role) => {
    const styles = {
      SUPER_ADMIN: 'bg-red-100 text-red-800',
      ADMIN: 'bg-blue-100 text-blue-800',
      USER: 'bg-green-100 text-green-800'
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${styles[role] || 'bg-gray-100'}`}>
        {role}
      </span>
    );
  };

  return (
    <div>
      <Navbar />
      <div className="p-4 max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl font-bold">User Management</h2>
          <Link to="/user/add" className="bg-blue-600 text-white px-3 py-1 rounded">+ Add User</Link>
        </div>
        <div className="bg-white p-3 rounded shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Username</th>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Role</th>
                <th className="text-left p-2">Parent Admin</th>
                <th className="text-center p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map(v => (
                <tr key={v.id} className="border-t hover:bg-gray-50">
                  <td className="p-2">{v.username}</td>
                  <td className="p-2">{v.name}</td>
                  <td className="p-2">{roleBadge(v.role)}</td>
                  <td className="p-2 text-gray-600">{v.parent_admin_name || '-'}</td>
                  <td className="p-2 text-center">
                    <Link className="text-green-600 mr-2 hover:underline" to={`/user/edit/${v.id}`}>Edit</Link>
                    <button className="text-red-600 hover:underline" onClick={() => del(v.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
