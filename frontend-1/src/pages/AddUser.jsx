import React, { useEffect, useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function AddUser() {
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'USER', parent_admin_id: '' });
  const [admins, setAdmins] = useState([]);
  const nav = useNavigate();

  useEffect(() => {
    api.get('/verifiers/admins/list').then(r => setAdmins(r.data)).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/verifiers', form);
      alert('User added');
      nav('/user');
    } catch (err) {
      alert('Gagal: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div>
      <Navbar />
      <div className="p-4 max-w-md mx-auto">
        <div className="bg-white rounded shadow p-6">
          <h2 className="text-xl font-bold mb-4">Add User</h2>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input name="username" placeholder="username" className="w-full p-2 border rounded" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input name="name" placeholder="full name" className="w-full p-2 border rounded" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input name="password" type="password" placeholder="password" className="w-full p-2 border rounded" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select name="role" className="w-full p-2 border rounded bg-white" value={form.role} onChange={e => setForm({ ...form, role: e.target.value, parent_admin_id: '' })}>
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="SUPER_ADMIN">SUPER ADMIN</option>
              </select>
            </div>
            {form.role === 'USER' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Admin <span className="text-red-500">*</span></label>
                <select name="parent_admin_id" className="w-full p-2 border rounded bg-white" value={form.parent_admin_id} onChange={e => setForm({ ...form, parent_admin_id: e.target.value })} required>
                  <option value="">-- Pilih Admin --</option>
                  {admins.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
            <button className="w-full bg-blue-600 text-white p-2 rounded font-medium hover:bg-blue-700">Save</button>
          </form>
        </div>
      </div>
    </div>
  );
}
