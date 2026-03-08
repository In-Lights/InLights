import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, ShieldCheck, Loader2, Pencil, X, Copy, Check } from 'lucide-react';
import { getCustomRoles, saveCustomRole, deleteCustomRole } from '../store';
import { CustomRole } from '../types';
import { setCustomRoles } from '../utils/permissions';

const PERMISSION_GROUPS: {
  group: string;
  color: string;
  perms: { key: keyof CustomRole['permissions']; label: string; desc: string }[];
}[] = [
  {
    group: 'Releases',
    color: 'text-violet-400',
    perms: [
      { key: 'canView',         label: 'View Releases',      desc: 'See the dashboard and all submissions' },
      { key: 'canEditRelease',  label: 'Edit Release',       desc: 'Edit metadata, tracks, links on a release' },
      { key: 'canDelete',       label: 'Delete Releases',    desc: 'Permanently delete submissions' },
      { key: 'canBulkAction',   label: 'Bulk Actions',       desc: 'Select multiple releases and act on them at once' },
    ],
  },
  {
    group: 'Review & Status',
    color: 'text-emerald-400',
    perms: [
      { key: 'canChangeStatus', label: 'Change Status',      desc: 'Approve, reject, schedule, mark as released' },
      { key: 'canAddNotes',     label: 'Add Label Notes',    desc: 'Write notes visible to the team on each release' },
    ],
  },
  {
    group: 'Admin',
    color: 'text-amber-400',
    perms: [
      { key: 'canAccessSettings', label: 'Access Settings',  desc: 'Open the Settings panel (general tabs only)' },
      { key: 'canExport',         label: 'Export Data',      desc: 'Export releases as CSV or PDF' },
      { key: 'canManageTeam',     label: 'Manage Team',      desc: 'Add, edit, remove team members' },
    ],
  },
];

const ALL_PERM_KEYS = PERMISSION_GROUPS.flatMap(g => g.perms.map(p => p.key));

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

const PRESETS: { name: string; label: string; emoji: string; perms: Partial<CustomRole['permissions']> }[] = [
  { name: 'A&R Scout',   label: 'View only',         emoji: '🔍', perms: { canView: true } },
  { name: 'Marketing',   label: 'View + notes',      emoji: '📣', perms: { canView: true, canAddNotes: true, canExport: true } },
  { name: 'Coordinator', label: 'View + edit',       emoji: '📋', perms: { canView: true, canAddNotes: true, canEditRelease: true, canExport: true } },
  { name: 'A&R Manager', label: 'Full review',       emoji: '🎯', perms: { canView: true, canAddNotes: true, canChangeStatus: true, canEditRelease: true, canBulkAction: true, canExport: true } },
];

export default function CustomRoleBuilder() {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CustomRole | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

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

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setEditing(prev => prev ? {
      ...prev,
      name: prev.name || preset.name,
      permissions: { ...DEFAULT_PERMS, ...preset.perms },
    } : null);
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

  const toggleAll = () => {
    if (!editing) return;
    const allOn = ALL_PERM_KEYS.every(k => editing.permissions[k]);
    const newPerms = { ...editing.permissions };
    ALL_PERM_KEYS.forEach(k => { newPerms[k] = !allOn; });
    setEditing(prev => prev ? { ...prev, permissions: newPerms } : null);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { setNameError('Role name is required'); return; }
    const reserved = ['owner', 'admin', 'reviewer'];
    if (reserved.includes(editing.name.trim().toLowerCase())) {
      setNameError('That name is reserved — choose a different name'); return;
    }
    setSaving(true);
    await saveCustomRole({ id: isNew ? undefined : editing.id, name: editing.name.trim(), permissions: editing.permissions });
    await load();
    setEditing(null);
    setIsNew(false);
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete the "${name}" role? Team members with this role will lose access.`)) return;
    await deleteCustomRole(id);
    await load();
  };

  const duplicateRole = async (role: CustomRole) => {
    await saveCustomRole({ name: `${role.name} (copy)`, permissions: { ...role.permissions } });
    setCopied(role.id);
    setTimeout(() => setCopied(null), 2000);
    await load();
  };

  const permCount = (perms: CustomRole['permissions']) => ALL_PERM_KEYS.filter(k => perms[k]).length;
  const totalPerms = ALL_PERM_KEYS.length;

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Built-in roles reference */}
      <div className="rounded-xl border border-white/8 overflow-hidden">
        <div className="px-4 py-3 bg-white/[0.02] border-b border-white/8 flex items-center justify-between">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Built-in Roles</p>
          <span className="text-[10px] text-zinc-600">Read-only — cannot be modified</span>
        </div>
        <div className="divide-y divide-white/5">
          {[
            { name: 'Owner',    color: 'text-amber-400 bg-amber-500/10',   desc: 'Full access — all settings, team management, everything. Cannot be restricted.' },
            { name: 'Admin',    color: 'text-violet-400 bg-violet-500/10', desc: 'Manage releases + settings. Cannot manage team or owner-only tabs.' },
            { name: 'Reviewer', color: 'text-blue-400 bg-blue-500/10',     desc: 'View releases and add notes only. No status changes or edits.' },
          ].map(r => (
            <div key={r.name} className="flex items-center gap-3 px-4 py-3">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${r.color}`}>{r.name}</span>
              <p className="text-xs text-zinc-500 flex-1 leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Custom roles list */}
      {roles.length > 0 && (
        <div className="rounded-xl border border-white/8 overflow-hidden">
          <div className="px-4 py-3 bg-white/[0.02] border-b border-white/8 flex items-center justify-between">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Custom Roles ({roles.length})</p>
          </div>
          <div className="divide-y divide-white/5">
            {roles.map(role => {
              const count = permCount(role.permissions);
              const pct = Math.round((count / totalPerms) * 100);
              return (
                <div key={role.id} className="flex items-center gap-3 px-4 py-3.5 group hover:bg-white/[0.02] transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-200">{role.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1 bg-zinc-800 rounded-full max-w-[80px]">
                        <div className="h-1 bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-zinc-600">{count}/{totalPerms} permissions</span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => duplicateRole(role)}
                      className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-600 hover:text-zinc-300 transition-colors"
                      title="Duplicate"
                    >
                      {copied === role.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => startEdit(role)}
                      className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-600 hover:text-zinc-300 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(role.id, role.name)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create button */}
      {!editing && (
        <button
          onClick={startNew}
          className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-white/15 text-sm text-zinc-500 hover:text-zinc-200 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all w-full justify-center"
        >
          <Plus className="w-4 h-4" /> Create Custom Role
        </button>
      )}

      {/* Role editor */}
      {editing && (
        <div className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.04] p-5 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-violet-300">{isNew ? '✦ New Role' : `Editing — ${editing.name}`}</p>
            <button onClick={cancel} className="text-zinc-600 hover:text-zinc-400 p-1 rounded-lg hover:bg-white/5 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Role Name</label>
            <input
              type="text"
              value={editing.name}
              onChange={e => { setEditing(p => p ? ({ ...p, name: e.target.value }) : null); setNameError(''); }}
              placeholder="e.g. A&R Scout, Marketing, Intern, Legal"
              className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
              autoFocus
            />
            {nameError && <p className="text-xs text-red-400 mt-1.5">{nameError}</p>}
          </div>

          {/* Presets */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Quick Presets</label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(preset => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/8 text-xs text-zinc-400 hover:text-white hover:border-violet-500/40 hover:bg-violet-500/10 transition-all"
                >
                  <span>{preset.emoji}</span>
                  <span className="font-medium">{preset.name}</span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-600">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Permissions by group */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Permissions</label>
              <button
                onClick={toggleAll}
                className="text-[11px] text-zinc-600 hover:text-violet-400 transition-colors"
              >
                {ALL_PERM_KEYS.every(k => editing.permissions[k]) ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="space-y-4">
              {PERMISSION_GROUPS.map(group => (
                <div key={group.group}>
                  <p className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${group.color}`}>{group.group}</p>
                  <div className="space-y-1">
                    {group.perms.map(({ key, label, desc }) => (
                      <label key={key} className="flex items-center gap-3 cursor-pointer group p-2.5 rounded-xl hover:bg-white/[0.03] transition-colors">
                        <div className="relative flex-shrink-0">
                          <input type="checkbox" className="sr-only peer"
                            checked={editing.permissions[key] ?? false}
                            onChange={() => togglePerm(key)} />
                          <div className="w-9 h-5 rounded-full bg-zinc-800 peer-checked:bg-violet-600 transition-colors border border-white/5" />
                          <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-zinc-400 peer-checked:bg-white transition-all peer-checked:translate-x-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-200">{label}</p>
                          <p className="text-xs text-zinc-600 leading-snug">{desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Permission summary */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full">
              <div
                className="h-1.5 bg-gradient-to-r from-violet-600 to-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.round((permCount(editing.permissions) / totalPerms) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-zinc-500 flex-shrink-0">
              {permCount(editing.permissions)}/{totalPerms} permissions enabled
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !editing.name.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold transition-colors"
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
