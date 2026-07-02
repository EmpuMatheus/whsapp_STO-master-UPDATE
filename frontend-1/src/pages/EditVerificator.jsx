import React, {useEffect, useState} from 'react';
import api from '../api';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function EditVerificator(){
  const {id} = useParams();
  const [form,setForm]=useState({username:'',name:''});
  const nav = useNavigate();
  useEffect(()=>{ (async ()=>{ const res = await api.get('/verifiers/'+id); setForm(res.data); })(); }, [id]);
const submit = async (e) => {
  e.preventDefault();
  try {
    await api.put('/verifiers/' + id, form);
    alert('Updated');
    nav('/verificator');
  } catch (err) {
    alert('Update failed: ' + (err.response?.data?.error || err.message));
  }
};

  return (
    <div>
      <Navbar />
      <div className="p-4 max-w-md mx-auto bg-white rounded shadow">
        <h2 className="text-xl mb-3">Edit Verificator</h2>
        <form onSubmit={submit} className="space-y-2">
          <input name="username" placeholder="username" className="w-full p-2 border rounded" value={form.username||''} onChange={e=>setForm({...form,username:e.target.value})} required />
          <input name="name" placeholder="name" className="w-full p-2 border rounded" value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})} required />
          <input name="password" type="password" placeholder="password (leave blank to keep)" className="w-full p-2 border rounded" onChange={e=>setForm({...form,password:e.target.value})} />
          <button className="w-full bg-green-600 text-white p-2 rounded">Update</button>
        </form>
      </div>
    </div>
  )
}
