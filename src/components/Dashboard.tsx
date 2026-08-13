import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { Users, UserPlus, TrendingUp, CheckCircle, Clock, AlertCircle, BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon } from 'lucide-react';
import { Lead, Department, UserProfile } from '../types';
import { fetchDashboardData, DashboardData, subscribeToLeadChanges } from '../services/leadService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';

interface Props {
  leads: Lead[];
  departments: Department[];
  user: UserProfile;
}

const COLORS = ['#10b981', '#3b82f6', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const Dashboard: React.FC<Props> = ({ leads, departments, user }) => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  const deptIdsKey = useMemo(() => {
    return (user.managedDeptIds || []).slice().sort().join(',');
  }, [user.managedDeptIds]);

  const loadData = useCallback(() => {
    const departmentIds = deptIdsKey ? deptIdsKey.split(',') : undefined;
    fetchDashboardData({
      role: user.role,
      userEmail: user.email,
      departmentIds
    }).then(res => {
      setDashboardData(res);
    }).catch(e => console.error('fetchDashboardData error', e));
  }, [user.role, user.email, deptIdsKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime ping check for Dashboard (Runs every 5s, re-fetches dashboardData on changes)
  useEffect(() => {
    const departmentIds = deptIdsKey ? deptIdsKey.split(',') : undefined;
    const unsub = subscribeToLeadChanges(user.role, user.email, departmentIds, () => {
      loadData();
    });
    return () => unsub();
  }, [user.role, user.email, deptIdsKey, loadData]);

  const statsSummary = dashboardData?.statsSummary;
  const recentLeads = dashboardData?.recentLeads || leads.slice(0, 5);

  const stats = useMemo(() => {
    if (statsSummary) {
      return [
        { label: 'Tổng số khách hàng', value: statsSummary.total, icon: UserPlus, color: 'bg-blue-50 text-blue-600' },
        { label: 'Đã liên hệ', value: statsSummary.statusCounts['Đã liên hệ'] || 0, icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
        { label: 'Đã booking/cọc', value: (statsSummary.resultCounts['Đã booking'] || 0) + (statsSummary.resultCounts['Đã cọc'] || 0), icon: CheckCircle, color: 'bg-indigo-50 text-indigo-600' },
        { label: 'Chưa liên hệ', value: statsSummary.statusCounts['Chưa liên hệ'] || 0, icon: Clock, color: 'bg-amber-50 text-amber-600' },
      ];
    }
    return [
      { label: 'Tổng số khách hàng', value: leads.length, icon: UserPlus, color: 'bg-blue-50 text-blue-600' },
      { label: 'Đã liên hệ', value: leads.filter(l => l.status === 'Đã liên hệ').length, icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
      { label: 'Đã booking/cọc', value: leads.filter(l => l.resultStatus === 'Đã booking' || l.resultStatus === 'Đã cọc').length, icon: CheckCircle, color: 'bg-indigo-50 text-indigo-600' },
      { label: 'Chưa liên hệ', value: leads.filter(l => l.status === 'Chưa liên hệ').length, icon: Clock, color: 'bg-amber-50 text-amber-600' },
    ];
  }, [leads, statsSummary]);

  // Data for Bar Chart: Leads by Status
  const leadsByStatusData = useMemo(() => {
    if (statsSummary) {
      return Object.entries(statsSummary.statusCounts)
        .filter(([name]) => name !== 'Tất cả')
        .map(([name, value]) => ({ name, value }));
    }
    const statusCounts: Record<string, number> = {};
    leads.forEach(lead => {
      const status = lead.status || 'Khác';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  }, [leads, statsSummary]);

  // Data for Pie Chart: Leads by Department
  const leadsByDeptData = useMemo(() => {
    if (statsSummary && statsSummary.deptCounts) {
      return Object.entries(statsSummary.deptCounts).map(([deptId, count]) => {
        const deptName = departments.find(d => d.id === deptId)?.name || 'Chưa phân bổ';
        return { name: deptName, value: count };
      });
    }
    const deptCounts: Record<string, number> = {};
    leads.forEach(lead => {
      const dept = departments.find(d => d.id === lead.departmentId)?.name || 'Chưa phân bổ';
      deptCounts[dept] = (deptCounts[dept] || 0) + 1;
    });
    return Object.entries(deptCounts).map(([name, value]) => ({ name, value }));
  }, [leads, departments, statsSummary]);

  // Data for Line Chart: Leads over time (last 7 days)
  const leadsOverTimeData = useMemo(() => {
    if (statsSummary && statsSummary.dailyCounts) {
      return statsSummary.dailyCounts;
    }
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const dateCounts: Record<string, number> = {};
    leads.forEach(lead => {
      const date = lead.createdAt.split('T')[0];
      if (last7Days.includes(date)) {
        dateCounts[date] = (dateCounts[date] || 0) + 1;
      }
    });

    return last7Days.map(date => ({
      date: date.split('-').slice(1).reverse().join('/'),
      count: dateCounts[date] || 0
    }));
  }, [leads, statsSummary]);

  return (
    <div className="space-y-4 md:space-y-6">
      <header className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">Chào mừng trở lại, {user.displayName}</h1>
        <p className="text-slate-500 mt-1 text-xs md:text-sm">Đây là những gì đang diễn ra trong quy trình bán hàng của bạn hôm nay.</p>
      </header>

      {!dashboardData ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={`d-skel-${i}`} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm animate-pulse flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-200 rounded-xl"></div>
                <div className="space-y-2 flex-1">
                  <div className="h-3 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-6 bg-slate-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-pulse h-[360px]">
              <div className="h-6 bg-slate-200 rounded w-1/3 mb-6"></div>
              <div className="h-[260px] bg-slate-100 rounded-xl"></div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-pulse h-[360px]">
              <div className="h-6 bg-slate-200 rounded w-1/3 mb-6"></div>
              <div className="h-[260px] bg-slate-100 rounded-xl"></div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-3.5 md:p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className={`w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center mb-2.5 md:mb-3 ${stat.color}`}>
                  <stat.icon className="w-4 h-4 md:w-5 md:h-5" />
                </div>
                <p className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
                <p className="text-lg md:text-2xl font-bold text-slate-900 mt-0.5">{stat.value}</p>
              </motion.div>
            ))}
          </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900">Trạng thái khách hàng</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 300, height: 300 }}>
              <BarChart data={leadsByStatusData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-6">
            <LineChartIcon className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900">Khách hàng mới (7 ngày qua)</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 300, height: 300 }}>
              <LineChart data={leadsOverTimeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-6">
            <PieChartIcon className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900">Phân bổ theo phòng ban</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 300, height: 300 }}>
              <PieChart>
                <Pie
                  data={leadsByDeptData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {leadsByDeptData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900">Hoạt động gần đây</h3>
              <button className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">Xem tất cả</button>
            </div>
            <div className="divide-y divide-slate-50">
              {recentLeads.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="text-sm">Không tìm thấy hoạt động gần đây.</p>
                </div>
              ) : (
                recentLeads.map(lead => (
                  <div key={lead.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">
                        {lead.customerName[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-base font-semibold text-slate-900">{lead.customerName}</p>
                        <p className="text-xs text-slate-500">{lead.status} · {new Date(lead.updatedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-slate-400">ID: {lead.id.slice(0, 8)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )}
</div>
);
};
