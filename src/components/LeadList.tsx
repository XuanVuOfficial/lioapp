import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, Phone, Mail, Clock, User, Tag, MoreVertical, Edit2, Trash2, UserPlus, Image as ImageIcon, History, Briefcase, Check } from 'lucide-react';
import { Lead, Department, UserProfile } from '../types';
import { createLead, updateLead, assignLead } from '../services/leadService';

interface Props {
  leads: Lead[];
  departments: Department[];
  user: UserProfile;
  staff: UserProfile[];
}

export const LeadList: React.FC<Props> = ({ leads, departments, user, staff }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showAssignModal, setShowAssignModal] = useState<Lead | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('Tất cả');
  const [newLead, setNewLead] = useState<Partial<Lead>>({
    customerName: '',
    phone: '',
    email: '',
    status: 'Chưa Liên Hệ',
    interestLevel: 'Chưa Lên Nhà Mẫu',
    details: '',
    notes: '',
    departmentId: user.departmentId || '',
    assignedToEmail: ''
  });

  const statuses = ['Tất cả', 'Chưa Liên Hệ', 'Đã Liên Hệ', 'Đang Tư Vấn', 'Tiềm Năng', 'Đã Chốt', 'Tạm Hoãn', 'Hủy'];
  const interestLevels = ['Chưa Lên Nhà Mẫu', 'Đã Lên Nhà Mẫu', 'Đã Đặt Cọc', 'Đã Ký Hợp Đồng'];

  const filteredLeads = leads.filter(l => {
    const matchesSearch = 
      l.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.phone.includes(searchTerm) ||
      l.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTab = currentTab === 'Tất cả' || l.status === currentTab;
    
    return matchesSearch && matchesTab;
  });

  const handleCreate = async () => {
    if (!newLead.customerName || !newLead.phone || !newLead.email) return;
    await createLead({
      customerName: newLead.customerName!,
      phone: newLead.phone!,
      email: newLead.email!,
      status: newLead.status!,
      interestLevel: newLead.interestLevel,
      details: newLead.details,
      notes: newLead.notes,
      departmentId: newLead.departmentId,
      assignedToEmail: newLead.assignedToEmail,
      creatorEmail: user.email,
      updatedByEmail: user.email,
      history: []
    });
    setShowAddModal(false);
    setNewLead({ status: 'Chưa Liên Hệ', interestLevel: 'Chưa Lên Nhà Mẫu', departmentId: user.departmentId || '', assignedToEmail: '' });
  };

  const handleUpdateStatus = async (lead: Lead, status: string) => {
    await updateLead(lead.id, { status }, user.email);
    if (selectedLead && selectedLead.id === lead.id) {
      setSelectedLead({ ...selectedLead, status });
    }
  };

  const handleAssign = async (lead: Lead, staffEmail?: string, deptId?: string) => {
    await assignLead(lead.id, staffEmail, deptId, user.email);
    setShowAssignModal(null);
  };

  const getSubDepartments = (parentId: string) => {
    return departments.filter(d => d.parentId === parentId);
  };

  const subDepts = user.departmentId ? getSubDepartments(user.departmentId) : [];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-xl md:text-2xl font-bold text-slate-900">Khách hàng tiềm năng</h2>
        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-2 md:gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm kiếm..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-emerald-100"
          >
            <Plus className="w-4 h-4" />
            Thêm mới
          </button>
        </div>
      </div>

      <div className="mb-2 md:mb-6 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
        <div className="flex space-x-1 md:space-x-2 border-b border-slate-200 min-w-max">
          {statuses.map(status => (
            <button
              key={status}
              onClick={() => setCurrentTab(status)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${
                currentTab === status
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <AnimatePresence mode="popLayout">
          {filteredLeads.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-12 md:py-20 text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <User className="w-10 h-10 md:w-12 md:h-12 mb-4 opacity-20" />
              <p className="text-sm px-4 text-center">Không tìm thấy khách hàng nào. Hãy tạo mới để bắt đầu.</p>
            </div>
          ) : (
            filteredLeads.map(lead => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={lead.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-start mb-3 md:mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 md:w-10 md:h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                      <User className="w-4 h-4 md:w-5 md:h-5 text-slate-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm md:text-base leading-tight">{lead.customerName}</h3>
                      <p className="text-[10px] md:text-xs text-slate-500">Mã: {lead.id.slice(0, 8)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {(user.role === 'admin' || user.role === 'manager') && (
                      <button 
                        onClick={() => setShowAssignModal(lead)}
                        className="p-1.5 md:p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Giao khách hàng"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    )}
                    <button className="p-1.5 md:p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 md:space-y-3 mb-4 md:mb-6">
                  <div className="flex items-center gap-3 text-xs md:text-sm text-slate-600">
                    <Phone className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400" />
                    {lead.phone}
                  </div>
                  {lead.email && (
                    <div className="flex items-center gap-3 text-xs md:text-sm text-slate-600">
                      <Mail className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400" />
                      <span className="truncate">{lead.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-xs md:text-sm text-slate-600">
                    <Tag className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400" />
                    <span className={`px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-wider ${
                      lead.status === 'Chưa Liên Hệ' ? 'bg-slate-100 text-slate-600' :
                      lead.status === 'Đã Liên Hệ' ? 'bg-blue-50 text-blue-600' :
                      'bg-emerald-50 text-emerald-600'
                    }`}>
                      {lead.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs md:text-sm text-slate-600">
                    <Briefcase className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400" />
                    <span className="truncate">{departments.find(d => d.id === lead.departmentId)?.name || 'Chưa có phòng ban'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs md:text-sm text-slate-600">
                    <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400" />
                    {new Date(lead.updatedAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 md:pt-4 border-t border-slate-100">
                  <div className="flex flex-col gap-1">
                    <div className="flex -space-x-2">
                      <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[8px] md:text-[10px] font-bold" title={`Tạo bởi: ${lead.creatorEmail}`}>
                        {lead.creatorEmail[0].toUpperCase()}
                      </div>
                      {lead.assignedToEmail && (
                        <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-emerald-200 border-2 border-white flex items-center justify-center text-[8px] md:text-[10px] font-bold" title={`Giao cho: ${lead.assignedToEmail}`}>
                          {lead.assignedToEmail[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <p className="text-[9px] md:text-[10px] text-slate-400 font-medium">
                      {lead.creatorEmail === user.email ? 'Tôi tạo' : `Từ: ${lead.creatorEmail.split('@')[0]}`}
                      {lead.assignedToEmail && lead.assignedToEmail !== lead.creatorEmail && (
                        <> • {lead.assignedToEmail === user.email ? 'Giao cho tôi' : `Giao: ${lead.assignedToEmail.split('@')[0]}`}</>
                      )}
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedLead(lead)}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                  >
                    Xem chi tiết
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 border border-slate-200 overflow-y-auto max-h-[90vh]">
            <h3 className="text-2xl font-bold text-slate-900 mb-6">Tạo khách hàng mới</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tên khách hàng *</label>
                  <input 
                    type="text" 
                    required
                    value={newLead.customerName}
                    onChange={e => setNewLead(prev => ({ ...prev, customerName: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Số điện thoại *</label>
                  <input 
                    type="text" 
                    required
                    value={newLead.phone}
                    onChange={e => setNewLead(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Địa chỉ Email *</label>
                  <input 
                    type="email" 
                    required
                    value={newLead.email}
                    onChange={e => setNewLead(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Chia cho nhân viên</label>
                  <select 
                    value={newLead.assignedToEmail}
                    onChange={e => setNewLead(prev => ({ ...prev, assignedToEmail: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  >
                    <option value="">Chọn nhân viên</option>
                    {staff.map(s => (
                      <option key={s.uid} value={s.email}>{s.displayName} ({s.email})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Chia cho phòng ban</label>
                  <select 
                    value={newLead.departmentId}
                    onChange={e => setNewLead(prev => ({ ...prev, departmentId: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  >
                    <option value="">Chọn phòng ban</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Trạng thái</label>
                    <select 
                      value={newLead.status}
                      onChange={e => setNewLead(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    >
                      {statuses.filter(s => s !== 'Tất cả').map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Mức độ quan tâm</label>
                    <select 
                      value={newLead.interestLevel}
                      onChange={e => setNewLead(prev => ({ ...prev, interestLevel: e.target.value }))}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    >
                      {interestLevels.map(i => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <label className="block text-sm font-medium text-slate-700 mb-1">Chi tiết / Ghi chú</label>
              <textarea 
                rows={3}
                value={newLead.details}
                onChange={e => setNewLead(prev => ({ ...prev, details: e.target.value }))}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>
            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold transition-all"
              >
                Hủy
              </button>
              <button 
                onClick={handleCreate}
                className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all shadow-lg shadow-emerald-100"
              >
                Tạo khách hàng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-6">Giao khách hàng: {showAssignModal.customerName}</h3>
            
            <div className="space-y-6">
              {/* Assign to Sub-Departments */}
              {subDepts.length > 0 && (
                <div>
                  <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Giao cho phòng ban con</label>
                  <div className="grid grid-cols-1 gap-2">
                    {subDepts.map(d => {
                      const isSelected = showAssignModal.departmentId === d.id;
                      return (
                        <button
                          key={d.id}
                          onClick={() => handleAssign(showAssignModal, undefined, d.id)}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${
                            isSelected 
                              ? 'border-emerald-500 bg-emerald-50' 
                              : 'border-slate-100 hover:border-emerald-200 hover:bg-emerald-50'
                          }`}
                        >
                          <div>
                            <p className="font-semibold text-slate-900">{d.name}</p>
                            <p className="text-xs text-slate-500">Trưởng phòng: {d.managerName}</p>
                          </div>
                          {isSelected ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Plus className="w-4 h-4 text-emerald-600" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Assign to Staff */}
              <div>
                <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Giao cho nhân viên</label>
                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                  {staff.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">Không tìm thấy nhân viên nào trong phòng ban này.</p>
                  ) : (
                    staff.map(s => {
                      const isSelected = showAssignModal.assignedToEmail === s.email;
                      return (
                        <button
                          key={s.uid}
                          onClick={() => handleAssign(showAssignModal, s.email, undefined)}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${
                            isSelected 
                              ? 'border-emerald-500 bg-emerald-50' 
                              : 'border-slate-100 hover:border-emerald-200 hover:bg-emerald-50'
                          }`}
                        >
                          <div>
                            <p className="font-semibold text-slate-900">{s.displayName}</p>
                            <p className="text-xs text-slate-500">{s.email}</p>
                          </div>
                          {isSelected ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <UserPlus className="w-4 h-4 text-emerald-600" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <button 
              onClick={() => setShowAssignModal(null)}
              className="w-full mt-6 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold transition-all"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-8 border border-slate-200 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center">
                  <User className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-slate-900">{selectedLead.customerName}</h3>
                  <p className="text-slate-500">Mã khách hàng: {selectedLead.id}</p>
                </div>
              </div>
              <button onClick={() => setSelectedLead(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <Plus className="w-6 h-6 text-slate-400 rotate-45" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-8">
                <section>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Thông tin liên hệ</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl">
                      <p className="text-xs text-slate-500 mb-1">Điện thoại</p>
                      <p className="font-semibold text-slate-900">{selectedLead.phone}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl">
                      <p className="text-xs text-slate-500 mb-1">Email</p>
                      <p className="font-semibold text-slate-900">{selectedLead.email || 'N/A'}</p>
                    </div>
                  </div>
                </section>

                <section>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Cập nhật thông tin</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Trạng thái</label>
                      <select 
                        value={selectedLead.status}
                        onChange={e => handleUpdateStatus(selectedLead, e.target.value)}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      >
                        {statuses.filter(s => s !== 'Tất cả').map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Mức độ quan tâm</label>
                      <select 
                        value={selectedLead.interestLevel}
                        onChange={async (e) => {
                          const interestLevel = e.target.value;
                          await updateLead(selectedLead.id, { interestLevel }, user.email);
                          setSelectedLead({ ...selectedLead, interestLevel });
                        }}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      >
                        {interestLevels.map(i => (
                          <option key={i} value={i}>{i}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Chi tiết / Ghi chú</label>
                      <textarea 
                        rows={4}
                        value={selectedLead.details || ''}
                        onChange={e => setSelectedLead({ ...selectedLead, details: e.target.value })}
                        onBlur={async () => {
                          await updateLead(selectedLead.id, { details: selectedLead.details }, user.email);
                        }}
                        placeholder="Nhập chi tiết hoặc ghi chú mới..."
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <History className="w-4 h-4" /> Lịch sử
                  </h4>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                    {selectedLead.history.map((entry, i) => (
                      <div key={i} className="flex gap-3 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                        <p className="text-slate-600">{entry}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <section>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Trạng thái & Giao việc</h4>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Trạng thái hiện tại</p>
                      <select 
                        value={selectedLead.status}
                        onChange={e => handleUpdateStatus(selectedLead, e.target.value)}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      >
                        <option value="Chưa Liên Hệ">Chưa Liên Hệ</option>
                        <option value="Đã Liên Hệ">Đã Liên Hệ</option>
                        <option value="Đang Tư Vấn">Đang Tư Vấn</option>
                        <option value="Tiềm Năng">Tiềm Năng</option>
                        <option value="Đã Chốt">Đã Chốt</option>
                      </select>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Được giao cho</p>
                      <div className="bg-slate-50 p-4 rounded-xl flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-xs font-bold text-emerald-700">
                          {selectedLead.assignedToEmail ? selectedLead.assignedToEmail[0].toUpperCase() : '?'}
                        </div>
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {selectedLead.assignedToEmail || 'Chưa giao'}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {selectedLead.imageUrl && (
                  <section>
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Tệp đính kèm</h4>
                    <div className="rounded-xl overflow-hidden border border-slate-200">
                      <img src={selectedLead.imageUrl} alt="Tệp đính kèm khách hàng" className="w-full h-auto" />
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
