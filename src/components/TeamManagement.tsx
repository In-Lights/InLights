import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Shield, Eye, Crown, Loader2, KeyRound, Check, X, Edit2, ShieldCheck } from 'lucide-react';
import { AdminUser, AdminRole, CustomRole } from '../types';
import { getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser, getAdminSession, getCustomRoles } from '../store';
import CustomRoleBuilder from './CustomRoleBuilder';

const ROLE_META: Record<AdminRole, { label: string; icon: React.FC<{ className?: string }>; color: string; bg: string; desc: string }> = {
  owner:    { label: 'Owner',    icon: Crown,   color: 'text-amber-400',   bg: 'bg-amber-500/10',   desc: 'Full access, manage team & settings' },
  admin:    { label: 'Admin',    icon: Shield,  color: 'text-violet-400',  bg: 'bg-violet-500/10',  desc: 'Approve/reject releases, edit submissions' },
  reviewer: { label: 'Reviewer', icon: Eye,     color: 'text-blue-400',    bg: 'bg-blue-500/10',    desc: 'View and comment only, no status changes' },
};

function timeAgo(iso?: string): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function TeamManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [customRoles, setCustomRolesList] = useState<CustomRole[]>([]);

  // Add user form
  const [showAdd, setShowAdd] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('reviewer');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // Edit user
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState<AdminRole>('reviewer');
  const [editPassword, setEditPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const session = getAdminSession();
  const currentRole = session.role;
  const canManage = currentRole === 'owner' || !currentRole; // only owners (or legacy) can add/delete/change roles
  const canEditOwn = currentRole === 'admin'; // admins can only edit their own password

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [u, cr] = await Promise.all([getAdminUsers(), getCustomRoles()]);
      setUsers(u);
      setCustomRolesList(cr);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load team');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newUsername.trim() || !newPassword.trim()) return;
    if (newPassword.length < 6) { setAddError('Password must be at least 6 characters'); return; }
    setAdding(true); setAddError('');
    try {
      await createAdminUser(newUsername.trim(), newPassword, newRole);
      setNewUsername(''); setNewPassword(''); setNewRole('reviewer');
      setShowAdd(false);
      await load();
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : 'Failed to create user');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (user: AdminUser) => {
    setEditingId(user.id);
    setEditUsername(user.username);
    setEditRole(user.role);
    setEditPassword('');
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    try {
      await updateAdminUser(id, {
        username: editUsername,
        role: editRole,
        ...(editPassword ? { password: editPassword } : {}),
      });
      setEditingId(null);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (!confirm(`Remove @${username} from the team? They will no longer be able to log in.`)) return;
    try {
      await deleteAdminUser(id);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to remove user');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold flex items-center gap-2">
            <Users className="w-4 h-4 accent-text" /> Team Members
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">Manage who can access the admin panel</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm btn-primary"
          >
            <Plus className="w-3.5 h-3.5" /> Add Member
          </button>
        )}
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-3 gap-2">
        {(Object.entries(ROLE_META) as [AdminRole, typeof ROLE_META[AdminRole]][]).map(([role, meta]) => {
          const Icon = meta.icon;
          return (
            <div key={role} className={`rounded-xl px-3 py-2.5 ${meta.bg} border border-white/5`}>
              <div className={`flex items-center gap-1.5 mb-1 ${meta.color}`}>
                <Icon className="w-3.5 h-3.5" />
                <span className="text-xs font-bold">{meta.label}</span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-snug">{meta.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Add user form */}
      {showAdd && canManage && (
        <div className="glass-card rounded-2xl p-5 border border-violet-500/20 space-y-4 fade-in">
          <h4 className="text-sm font-bold flex items-center gap-2">
            <Plus className="w-3.5 h-3.5 accent-text" /> New Team Member
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Username</label>
              <input
                type="text"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="e.g. sarah"
                className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="input-dark w-full px-3 py-2.5 rounded-xl text-sm"
                autoComplete="new-password"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-zinc-500 mb-2 block">Role</label>
            <div className="flex flex-wrap gap-2">
              {(['reviewer', 'admin', 'owner'] as AdminRole[]).map(r => {
                const meta = ROLE_META[r];
                const Icon = meta.icon;
                return (
                  <button
                    key={r}
                    onClick={() => setNewRole(r)}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                      newRole === r
                        ? `${meta.bg} ${meta.color} border-current`
                        : 'border-white/8 text-zinc-500 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {meta.label}
                  </button>
                );
              })}
              {customRoles.map(cr => (
                <button
                  key={cr.id}
                  onClick={() => setNewRole(cr.name as AdminRole)}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                    newRole === cr.name
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                      : 'border-white/8 text-zinc-500 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> {cr.name}
                </button>
              ))}
            </div>
          </div>
          {addError && <p className="text-xs text-red-400">{addError}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowAdd(false); setAddError(''); }} className="px-4 py-2 rounded-xl text-sm border border-white/8 text-zinc-400 hover:text-white transition-all">
              Cancel
            </button>
            <button onClick={handleAdd} disabled={adding || !newUsername.trim() || !newPassword.trim()} className="btn-primary px-4 py-2 rounded-xl text-sm flex items-center gap-2 disabled:opacity-50">
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Add Member
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
          {error} — <button onClick={load} className="underline">retry</button>
        </div>
      )}

      {/* User list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-8 text-zinc-600">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No team members yet</p>
          <p className="text-xs mt-1 opacity-60">Add your first team member above</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(user => {
            const meta = ROLE_META[user.role];
            const Icon = meta.icon;
            const isEditing = editingId === user.id;
            const isSelf = session.username === user.username;

            return (
              <div key={user.id} className={`glass-card rounded-xl p-4 transition-all ${isEditing ? 'border border-violet-500/25' : ''}`}>
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-zinc-500 mb-1 block">Username</label>
                        <input type="text" value={editUsername} onChange={e => setEditUsername(e.target.value)}
                          className="input-dark w-full px-3 py-2 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="text-[11px] text-zinc-500 mb-1 block">New password (optional)</label>
                        <input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)}
                          placeholder="Leave blank to keep" className="input-dark w-full px-3 py-2 rounded-lg text-sm" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(['reviewer', 'admin', 'owner'] as AdminRole[]).map(r => {
                        const m = ROLE_META[r];
                        const I = m.icon;
                        return (
                          <button key={r} onClick={() => setEditRole(r)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-all ${
                              editRole === r ? `${m.bg} ${m.color} border-current` : 'border-white/8 text-zinc-500 hover:text-white'
                            }`}>
                            <I className="w-3 h-3" /> {m.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg text-zinc-600 hover:text-white border border-white/8 transition-all">
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleSaveEdit(user.id)} disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs btn-primary disabled:opacity-50">
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm ${meta.bg} ${meta.color}`}>
                      {user.username.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">@{user.username}</p>
                        {isSelf && <span className="text-[10px] text-zinc-600 border border-white/10 px-1.5 py-0.5 rounded-full">You</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className={`flex items-center gap-1 text-[11px] font-medium ${meta.color}`}>
                          <Icon className="w-3 h-3" /> {meta.label}
                        </div>
                        <span className="text-zinc-700 text-[11px]">·</span>
                        <span className="text-[11px] text-zinc-600">Last login: {timeAgo(user.lastLogin)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    {canManage && !isSelf && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(user)}
                          className="p-2 rounded-lg text-zinc-600 hover:text-white hover:bg-white/5 transition-all" title="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(user.id, user.username)}
                          className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Remove">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {(canManage || canEditOwn) && isSelf && (
                      <button onClick={() => startEdit(user)}
                        className="p-2 rounded-lg text-zinc-600 hover:text-white hover:bg-white/5 transition-all" title="Edit your account">
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Custom Roles ── */}
      {canManage && (
        <div className="mt-6 pt-6 border-t border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 accent-text" />
            <div>
              <h3 className="font-bold text-sm">Custom Roles</h3>
              <p className="text-xs text-zinc-500">Create roles with specific permission sets and assign them to team members</p>
            </div>
          </div>
          <CustomRoleBuilder />
        </div>
      )}
    </div>
  );
}
