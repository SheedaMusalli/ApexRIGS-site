import React, { useEffect, useState } from 'react';
import { actions, moduleActions, permissionModules, permissionPresets, Permissions, PermissionModule } from '../../utils/permissions';
import { authFetch } from '../../utils/apiClient';
export function AccessControl() {
  const [users, setUsers] = useState<any[]>([]), [id, setId] = useState(''), [permissions, setPermissions] = useState<Permissions>({});
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { authFetch('/api/admin/users').then(async r => { if (!r.ok) throw new Error('Could not load administrators.'); return r.json(); }).then(u => setUsers(u.filter((a: any) => a.role === 'admin' && !a.isOwner))).catch(e => setError(e.message)); }, []);
  const save = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const r = await authFetch(`/api/admin/users/${encodeURIComponent(id)}/permissions`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permissions }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error);
      setUsers(users.map(u => u.id === id ? d.user : u)); setMessage('Access saved. New permissions apply immediately on the server.');
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  return <section className="space-y-5 text-slate-200">
    <div><h2 className="text-2xl font-bold text-white">Administrator access</h2><p className="text-sm text-slate-400 mt-2">Choose exactly what each administrator can view, enter, post and delete. Only the owner can change access or manage user accounts.</p></div>
    {error && <p role="alert" className="text-red-300">{error}</p>}{message && <p role="status" className="text-emerald-300">{message}</p>}
    <label className="block">Administrator<select aria-label="Administrator" className="block mt-2 p-3 bg-slate-950 rounded-lg w-full" value={id} onChange={e => { setId(e.target.value); setPermissions(users.find(u => u.id === e.target.value)?.permissions || {}); setMessage(''); }}><option value="">Choose an administrator</option>{users.map(u => <option key={u.id} value={u.id}>{u.fullName} — {u.email}</option>)}</select></label>
    {!users.length && <p className="p-4 border border-white/10 rounded-xl">Create a staff account in the Users tab first. New administrators start with read-only access.</p>}
    {id && <><div className="flex flex-wrap gap-2">{Object.keys(permissionPresets).map(p => <button className="px-3 py-2 bg-slate-800 rounded-lg hover:bg-slate-700" key={p} onClick={() => setPermissions(structuredClone(permissionPresets[p]))}>{p}</button>)}</div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-3 text-left">Module</th>{actions.map(a => <th className="p-3 capitalize" key={a}>{a === 'write' ? 'Create / edit' : a === 'post' ? 'Approve / post' : a}</th>)}</tr></thead><tbody>{Object.entries(permissionModules).map(([m, label]) => <tr key={m} className="border-t border-white/10"><td className="p-3">{label}</td>{actions.map(a => <td className="p-3 text-center" key={a}><input disabled={!moduleActions[m as PermissionModule].includes(a)} type="checkbox" aria-label={`${label}: ${a}`} checked={permissions[m as PermissionModule]?.includes(a) || false} onChange={e => setPermissions(old => {
      const current = old[m as PermissionModule] || [];
      const next = e.target.checked ? [...new Set([...current, 'view' as const, a])] : a === 'view' ? [] : current.filter(x => x !== a);
      return { ...old, [m]: next };
    })} className="accent-amber-500 w-4 h-4" /></td>)}</tr>)}</tbody></table></div>
    <p className="text-xs text-slate-400">Reports can reveal financial information across sales, purchases and banks. Posting receipts and supplier payments requires both the relevant sales/purchase posting right and Banking posting. Full administrator access does not transfer ownership.</p>
    <button disabled={busy} onClick={save} className="bg-amber-500 text-slate-950 font-bold px-5 py-3 rounded-xl disabled:opacity-50">{busy ? 'Saving…' : 'Save access'}</button></>}
  </section>;
}
