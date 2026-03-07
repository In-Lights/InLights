import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, ShieldCheck, Loader2, Pencil, X } from 'lucide-react';
import { getCustomRoles, saveCustomRole, deleteCustomRole } from '../store';
import { CustomRole } from '../types';
import { setCustomRoles } from '../utils/permissions';

const PERMISSION_LABELS: { key: keyof CustomRole['permissions']; label: string; desc: string }[] = [
  { key: 'canView',           label: 'View Releases',    desc: 'Can see the dashboard and release list' },
  { key: 'canAddNotes',       label: 'Add Label Notes',  desc: 'Can write internal notes on releases' },
  { key: 'canChangeStatus',   label: 'Change Status',    desc: 'Can approve, reject, schedule releases' },
  { key: 'canEditRelease',    label: 'Edit Release',     desc: 'Can edit release details and tracks' },
  { key: 'canDelete',         label: 'Delete Releases',  desc: 'Can permanently delete submissions' },
  { key: 'canBulkAction',     label: 'Bulk Actions',     desc: 'Can select and act on multiple releases' },
  { key: 'canAccessSettings', label: 'Access Settings',  desc: 'Can open the Settings panel' },
  { key: 'canExport',         label: 'Export Data',      desc: 'Can export CSV and PDF reports' },
];

const DEFAULT_PERMS: CustomRole['permissions'] = {
  canView: true,
  canAddNotes: false,
  canChangeStatus: false,
  canEditRelease: false,
  canDelete: false,
  canBulkAction: false,
  canAccessSettings: false,
  canManageTeam: false,
  canExport: false,
};

export default function CustomRoleBuilder() {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CustomRole | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  const load = async () => {
    setLoading(true);
    const r = await getCustomRoles();
    setRoles(r);
    setCustomRoles(r);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startNew = () => {
    setEditing({ id: '', name: '', permissions: { ...DEFAULT_PERMS } });
    setIsNew(true);
    setNameError('');
  };

  const startEdit = (role: CustomRole) => {
    setEditing({ ...role, permissions: { ...role.permissions } });
    setIsNew(false);
    setNameError('');
  };

  const cancel = () => { setEditing(null); setIsNew(false); };

  const togglePerm = (key: keyof CustomRole['permissions']) => {
    if (!editing) return;
    setEditing(prev => prev ? ({
      ...prev,
      permissions: { ...prev.permissions, [key]: !prev.permissions[key] }
    }) : null);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { setNameError('Role name is required'); return; }
    const reserved = ['owner', 'admin', 'reviewer'];
    if (reserved.includes(editing.name.trim().toLowerCase())) {
      setNameError('That name is reserved for built-in roles'); return;
    }
    setSaving(true);
    await saveCustomRole({ id: isNew ? undefined : editing.id, name: editing.name.trim(), permissions: editing.permissions });
    await load();
    setEditing(null);
    setIsNew(false);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this role? Team members with this role will lose access.')) return;
    await deleteCustomRole(id);
    await load();
  };

  const permCount = (perms: CustomRole['permissions']) =>
    Object.values(perms).filter(Boolean).length;

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Built-in roles reference */}
      <div className="rounded-xl border border-white/8 overflow-hidden">
        <div className="px-4 py-3 bg-white/[0.02] border-b border-white/8">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Built-in Roles (read-only)</p>
        </div>
        <div className="divide-y divide-white/5">
          {[
            { name: 'Owner', color: 'text-amber-400 bg-amber-500/10', desc: 'Full access — all settings, team management, everything' },
            { name: 'Admin', color: 'text-violet-400 bg-violet-500/10', desc: 'Can manage releases, settings and integrations. Cannot manage team.' },
            { name: 'Reviewer', color: 'text-blue-400 bg-blue-500/10', desc: 'Read-only. Can view releases and add label notes only.' },
          ].map(r => (
            <div key={r.name} className="flex items-center gap-3 px-4 py-3">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${r.color}`}>{r.name}</span>
              <p className="text-xs text-zinc-500 flex-1">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Custom roles list */}
      {roles.length > 0 && (
        <div className="rounded-xl border border-white/8 overflow-hidden">
          <div className="px-4 py-3 bg-white/[0.02] border-b border-white/8">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Custom Roles</p>
          </div>
          <div className="divide-y divide-white/5">
            {roles.map(role => (
              <div key={role.id} className="flex items-center gap-3 px-4 py-3 group">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-200">{role.name}</p>
                  <p className="text-xs text-zinc-600">{permCount(role.permissions)} permission{permCount(role.permissions) !== 1 ? 's' : ''} enabled</p>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(role)} className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-zinc-300">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(role.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add new role button */}
      {!editing && (
        <button
          onClick={startNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-white/15 text-sm text-zinc-500 hover:text-zinc-300 hover:border-white/25 transition-all w-full justify-center"
        >
          <Plus className="w-4 h-4" /> Create Custom Role
        </button>
      )}

      {/* Role editor */}
      {editing && (
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5 space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-violet-300">{isNew ? 'New Role' : `Edit — ${editing.name}`}</p>
            <button onClick={cancel} className="text-zinc-600 hover:text-zinc-400"><X className="w-4 h-4" /></button>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Role Name</label>
            <input
              type="text"
              value={editing.name}
              onChange={e => { setEditing(p => p ? ({ ...p, name: e.target.value }) : null); setNameError(''); }}
              placeholder="e.g. A&R Scout, Marketing, Intern"
              className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
            />
            {nameError && <p className="text-xs text-red-400 mt-1">{nameError}</p>}
          </div>

          {/* Permissions grid */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-3">Permissions</label>
            <div className="space-y-2">
              {PERMISSION_LABELS.map(({ key, label, desc }) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer group p-2.5 rounded-xl hover:bg-white/3 transition-colors">
                  <div className="relative mt-0.5 flex-shrink-0">
                    <input type="checkbox" className="sr-only peer"
                      checked={editing.permissions[key] ?? false}
                      onChange={() => togglePerm(key)} />
                    <div className="w-9 h-5 rounded-full bg-zinc-700 peer-checked:bg-violet-600 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{label}</p>
                    <p className="text-xs text-zinc-500">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Save */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-sm font-semibold transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isNew ? 'Create Role' : 'Save Changes'}
            </button>
            <button onClick={cancel} className="px-5 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white text-sm transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
