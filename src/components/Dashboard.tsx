import React from 'react';
import { motion } from 'motion/react';
import { Users, UserPlus, TrendingUp, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Lead, Department, UserProfile } from '../types';

interface Props {
  leads: Lead[];
  departments: Department[];
  user: UserProfile;
}

export const Dashboard: React.FC<Props> = ({ leads, departments, user }) => {
  const stats = [
    { label: 'Tổng số khách hàng', value: leads.length, icon: UserPlus, color: 'bg-blue-50 text-blue-600' },
    { label: 'Đã liên hệ', value: leads.filter(l => l.status === 'Đã liên hệ').length, icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Đã booking/cọc', value: leads.filter(l => l.resultStatus === 'Đã booking' || l.resultStatus === 'Đã cọc').length, icon: CheckCircle, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Chưa liên hệ', value: leads.filter(l => l.status === 'Chưa liên hệ').length, icon: Clock, color: 'bg-amber-50 text-amber-600' },
  ];

  const recentLeads = [...leads]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <header className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">Chào mừng trở lại, {user.displayName}</h1>
        <p className="text-slate-500 mt-1 text-sm md:text-base">Đây là những gì đang diễn ra trong quy trình bán hàng của bạn hôm nay.</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm"
          >
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-3 md:mb-4 ${stat.color}`}>
              <stat.icon className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <p className="text-[10px] md:text-sm font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
            <p className="text-xl md:text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 md:px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900">Hoạt động gần đây</h3>
              <button className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">Xem tất cả</button>
            </div>
            <div className="divide-y divide-slate-50">
              {recentLeads.length === 0 ? (
                <div className="p-8 md:p-12 text-center text-slate-400">
                  <AlertCircle className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-4 opacity-20" />
                  <p className="text-sm">Không tìm thấy hoạt động gần đây.</p>
                </div>
              ) : (
                recentLeads.map(lead => (
                  <div key={lead.id} className="px-4 md:px-6 py-3 md:py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-100 rounded-full flex items-center justify-center text-[10px] md:text-xs font-bold text-slate-600">
                        {lead.customerName[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm md:text-base font-semibold text-slate-900">{lead.customerName}</p>
                        <p className="text-[10px] md:text-xs text-slate-500">{lead.status} · {new Date(lead.updatedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className="text-[10px] md:text-xs font-medium text-slate-400">ID: {lead.id.slice(0, 8)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 mb-4">Tổng quan phòng ban</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">Tổng số phòng ban</span>
                </div>
                <span className="font-bold text-slate-900">{departments.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <UserPlus className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">Phòng ban của tôi</span>
                </div>
                <span className="font-bold text-slate-900 truncate max-w-[100px]">
                  {departments.find(d => d.id === user.departmentId)?.name || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-100">
            <h3 className="font-bold mb-2">Mẹo nhỏ</h3>
            <p className="text-emerald-50 text-sm leading-relaxed">
              Cập nhật khách hàng thường xuyên để đảm bảo báo cáo chính xác và phối hợp nhóm tốt hơn.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
