'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchWithAuth } from '@/lib/api';
import { 
  Users, 
  UserCheck, 
  UserPlus, 
  Clock, 
  Sparkles, 
  ShieldCheck, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  Search, 
  Send, 
  RefreshCw, 
  Trash2, 
  Ban, 
  Check, 
  Mail, 
  Filter,
  ArrowRight,
  Copy,
  Link as LinkIcon,
  ExternalLink
} from 'lucide-react';

interface AccessRequest {
  id: string;
  name: string;
  email: string;
  goals: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'user';
  status: 'active' | 'invited' | 'suspended';
  terms_agreed: boolean;
  terms_agreed_at?: string;
  created_at: string;
  cv_count: number;
  is_admin: boolean;
}

interface AdminStats {
  total_users: number;
  active_users: number;
  pending_requests: number;
  total_altered_cvs: number;
  terms_agreed_count: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'requests' | 'users'>('requests');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Direct Link Modal
  const [copiedLink, setCopiedLink] = useState(false);
  const [directLinkModalData, setDirectLinkModalData] = useState<{ email: string; link: string } | null>(null);

  // Invite Modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState<string | null>(null);

  // Loading indicator for resending invite
  const [resendingId, setResendingId] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  const loadAdminData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      // Verify admin role
      const profile = await fetchWithAuth('/api/user/profile');
      if (profile.role !== 'admin' && profile.email !== 'isnan.rizqikurniawan@gmail.com') {
        router.push('/dashboard');
        return;
      }

      const [statsData, reqsData, usersData] = await Promise.all([
        fetchWithAuth('/api/admin/stats'),
        fetchWithAuth('/api/admin/requests'),
        fetchWithAuth('/api/admin/users'),
      ]);

      setStats(statsData);
      setRequests(reqsData.requests || []);
      setUsers(usersData.users || []);
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
      setErrorMsg(err.message || 'Access denied or error loading admin portal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleApproveRequest = async (requestId: string) => {
    try {
      const res = await fetchWithAuth(`/api/admin/requests/${requestId}/approve`, {
        method: 'POST',
      });
      setActionSuccessMsg(res.message || 'Access request approved!');
      if (res.direct_link) {
        setDirectLinkModalData({ email: res.email, link: res.direct_link });
      }
      loadAdminData();
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to approve request.');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to reject this access request?')) return;
    try {
      await fetchWithAuth(`/api/admin/requests/${requestId}/reject`, {
        method: 'POST',
      });
      setActionSuccessMsg('Access request rejected.');
      loadAdminData();
      setTimeout(() => setActionSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to reject request.');
    }
  };

  const handleResendActivationLink = async (userId: string, userEmail: string) => {
    setResendingId(userId);
    try {
      const res = await fetchWithAuth(`/api/admin/users/${userId}/resend-invite`, {
        method: 'POST',
      });
      setActionSuccessMsg(res.message || `Password setup link generated for ${userEmail}!`);
      if (res.direct_link) {
        setDirectLinkModalData({ email: userEmail, link: res.direct_link });
      }
      loadAdminData();
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to resend activation link.');
    } finally {
      setResendingId(null);
    }
  };

  const handleDirectInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    setInviteSuccessMsg(null);

    try {
      const res = await fetchWithAuth('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inviteName.trim(),
          email: inviteEmail.trim(),
        }),
      });

      setInviteSuccessMsg(`Invitation registered for ${inviteEmail}!`);
      if (res.direct_link) {
        setDirectLinkModalData({ email: inviteEmail.trim(), link: res.direct_link });
      }
      setInviteName('');
      setInviteEmail('');
      loadAdminData();
      setTimeout(() => {
        setIsInviteModalOpen(false);
        setInviteSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Failed to send invite.');
    } finally {
      setIsInviting(false);
    }
  };

  const copyDirectLinkToClipboard = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to permanently delete user "${userEmail}"? All their tailored CVs and application histories will be removed.`)) {
      return;
    }

    try {
      await fetchWithAuth(`/api/admin/users/${userId}`, { method: 'DELETE' });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setActionSuccessMsg(`User ${userEmail} deleted.`);
      loadAdminData();
      setTimeout(() => setActionSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete user.');
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    try {
      await fetchWithAuth(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: nextStatus as any } : u))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to update user status.');
    }
  };

  const filteredRequests = requests.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.goals.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = users.filter(
    (u) =>
      (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm text-slate-500">Loading admin portal...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Administrator Control Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1.5">
            Invitation & User Management
          </h1>
          <p className="text-sm text-slate-500">
            Manage access requests, send activation links, track user CV quotas, and inspect terms agreement
          </p>
        </div>

        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-md shadow-indigo-500/25 transition-all self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Direct Invite User</span>
        </button>
      </div>

      {actionSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-xs text-emerald-700 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="flex-1">{errorMsg}</p>
        </div>
      )}

      {/* Overview Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
          <div className="glass-card p-4 rounded-2xl">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Users</span>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total_users}</p>
          </div>

          <div className="glass-card p-4 rounded-2xl">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active</span>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.active_users}</p>
          </div>

          <div className="glass-card p-4 rounded-2xl">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Reqs</span>
            <p className="text-2xl font-bold text-amber-600 mt-1">{stats.pending_requests}</p>
          </div>

          <div className="glass-card p-4 rounded-2xl">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total CVs</span>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{stats.total_altered_cvs}</p>
          </div>

          <div className="glass-card p-4 rounded-2xl col-span-2 sm:col-span-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">T&C Agreed</span>
            <p className="text-2xl font-bold text-teal-600 mt-1">{stats.terms_agreed_count}</p>
          </div>
        </div>
      )}

      {/* Tabs & Search Bar */}
      <div className="glass-card p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'requests'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Access Requests</span>
            {stats && stats.pending_requests > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'requests' ? 'bg-indigo-800 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                {stats.pending_requests}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'users'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>User Accounts & Usage</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'users' ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {users.length}
            </span>
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email..."
            className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50/50 focus:bg-white"
          />
        </div>
      </div>

      {/* Tab Content */}
      <div className="glass-card rounded-2xl p-4 sm:p-6">
        {activeTab === 'requests' ? (
          /* TAB 1: Access Requests */
          <div className="space-y-4">
            {filteredRequests.length === 0 ? (
              <div className="text-center py-10 text-slate-400 space-y-2">
                <Mail className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-sm">No access requests matching your query.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                      <th className="p-3.5 rounded-l-xl">Applicant</th>
                      <th className="p-3.5">Goals / Intended Usage</th>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right rounded-r-xl">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRequests.map((req) => {
                      const dateStr = new Date(req.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      });

                      return (
                        <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5">
                            <div className="font-semibold text-slate-900">{req.name}</div>
                            <div className="text-xs text-slate-500">{req.email}</div>
                          </td>
                          <td className="p-3.5 text-xs text-slate-600 max-w-xs truncate" title={req.goals}>
                            {req.goals}
                          </td>
                          <td className="p-3.5 text-xs text-slate-500 whitespace-nowrap">
                            {dateStr}
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            {req.status === 'pending' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                <Clock className="w-3 h-3" />
                                Pending
                              </span>
                            )}
                            {req.status === 'approved' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3" />
                                Approved
                              </span>
                            )}
                            {req.status === 'rejected' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                Rejected
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right whitespace-nowrap">
                            {req.status === 'pending' ? (
                              <div className="inline-flex items-center gap-2">
                                <button
                                  onClick={() => handleApproveRequest(req.id)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>Approve & Invite</span>
                                </button>
                                <button
                                  onClick={() => handleRejectRequest(req.id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition-colors"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : req.status === 'approved' ? (
                              <button
                                onClick={() => handleApproveRequest(req.id)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 inline-flex items-center gap-1"
                                title="Resend invitation link or get setup link"
                              >
                                <Send className="w-3 h-3" />
                                <span>Resend Invite</span>
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">Rejected</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* TAB 2: User Management & Usage */
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                    <th className="p-3.5 rounded-l-xl">User</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">T&C Agreement</th>
                    <th className="p-3.5">CVs Altered</th>
                    <th className="p-3.5 text-right rounded-r-xl">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((user) => {
                    const isRootAdmin = user.email === 'isnan.rizqikurniawan@gmail.com';

                    return (
                      <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <span>{user.name || user.email.split('@')[0]}</span>
                            {user.is_admin && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                ADMIN
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                        </td>

                        <td className="p-3.5 text-xs font-medium text-slate-700 capitalize">
                          {user.role || 'user'}
                        </td>

                        <td className="p-3.5 whitespace-nowrap">
                          {user.status === 'active' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <UserCheck className="w-3 h-3" />
                              Active
                            </span>
                          )}
                          {user.status === 'invited' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                              <Mail className="w-3 h-3" />
                              Invited
                            </span>
                          )}
                          {user.status === 'suspended' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                              <Ban className="w-3 h-3" />
                              Suspended
                            </span>
                          )}
                        </td>

                        <td className="p-3.5 whitespace-nowrap">
                          {user.terms_agreed ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full" title={user.terms_agreed_at || 'Agreed'}>
                              <CheckCircle2 className="w-3 h-3" />
                              Agreed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                              Pending
                            </span>
                          )}
                        </td>

                        <td className="p-3.5">
                          <div className="inline-flex items-center gap-1 font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg text-xs">
                            <FileText className="w-3 h-3 text-indigo-600" />
                            <span>{user.cv_count} CVs</span>
                          </div>
                        </td>

                        <td className="p-3.5 text-right whitespace-nowrap">
                          {!isRootAdmin ? (
                            <div className="inline-flex items-center gap-2">
                              {/* Resend Activation Link Button */}
                              <button
                                onClick={() => handleResendActivationLink(user.id, user.email)}
                                disabled={resendingId === user.id}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/70 transition-colors inline-flex items-center gap-1 shadow-2xs"
                                title="Resend password setup / activation link"
                              >
                                {resendingId === user.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                                ) : (
                                  <Send className="w-3.5 h-3.5" />
                                )}
                                <span>Resend Link</span>
                              </button>

                              {/* Suspend / Activate Toggle */}
                              <button
                                onClick={() => handleToggleUserStatus(user.id, user.status)}
                                className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                                  user.status === 'suspended'
                                    ? 'text-emerald-700 hover:bg-emerald-50'
                                    : 'text-amber-700 hover:bg-amber-50'
                                }`}
                                title={user.status === 'suspended' ? 'Activate User' : 'Suspend User'}
                              >
                                {user.status === 'suspended' ? <UserCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                              </button>

                              {/* Delete User */}
                              <button
                                onClick={() => handleDeleteUser(user.id, user.email)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Delete User"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Root Admin</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Direct Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Direct User Invitation</h3>
                  <p className="text-xs text-slate-500">Send password setup invite link</p>
                </div>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {inviteSuccessMsg && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{inviteSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleDirectInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50/50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50/50 focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={isInviting}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isInviting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Invite...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Activation Invite</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Direct Setup Link Modal (Bypasses email rate limit) */}
      {directLinkModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <LinkIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Direct Activation Link</h3>
                  <p className="text-xs text-slate-500">For {directLinkModalData.email}</p>
                </div>
              </div>
              <button
                onClick={() => setDirectLinkModalData(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed space-y-1">
              <p className="font-bold flex items-center gap-1">
                <span>⚡ Direct Setup Link Generated</span>
              </p>
              <p>
                If Supabase free tier email rate limits are reached, you can directly copy this link and send it to the candidate via Slack, WhatsApp, or private message.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Direct Password Setup URL
              </label>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 font-mono break-all max-h-24 overflow-y-auto select-all">
                {directLinkModalData.link}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => copyDirectLinkToClipboard(directLinkModalData.link)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-500/25 transition-all flex items-center justify-center gap-2"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Copied Link to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Setup Link</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setDirectLinkModalData(null)}
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
