import React, {useState} from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function AddVerificator(){
  const [form,setForm]=useState({username:'',password:'',name:''});
  const nav = useNavigate();
  const submit = async (e)=>{ e.preventDefault(); await api.post('/verifiers', form); alert('Added'); nav('/verificator'); };
  return (
    <div>
      <Navbar />
      <div className="p-4 max-w-md mx-auto bg-white rounded shadow">
        <h2 className="text-xl mb-3">Add Verificator</h2>
        <form onSubmit={submit} className="space-y-2">
          <input name="username" placeholder="username" className="w-full p-2 border rounded" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} required />
          <input name="name" placeholder="name" className="w-full p-2 border rounded" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required />
          <input name="password" type="password" placeholder="password" className="w-full p-2 border rounded" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required />
          <button className="w-full bg-blue-600 text-white p-2 rounded">Save</button>
        </form>
      </div>
    </div>
  )
}
