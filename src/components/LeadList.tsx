import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, Phone, Mail, Clock, User, Tag, MoreVertical, Edit2, Trash2, UserPlus, Image as ImageIcon, History, Briefcase, Check, FolderKanban, LayoutGrid, List, MessageSquare, PhoneCall, MessageCircle } from 'lucide-react';
import { Lead, Department, UserProfile, Project } from '../types';
import { createLead, updateLead, assignLead } from '../services/leadService';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Props {
  leads: Lead[];
  departments: Department[];
  user: UserProfile;
  staff: UserProfile[];
  initialProjectId?: string;
}

export const LeadList: React.FC<Props> = ({ leads, departments, user, staff, initialProjectId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showAssignModal, setShowAssignModal] = useState<Lead | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('Tất cả');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '');
  const [showStats, setShowStats] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('leadViewMode');
    return (saved as 'grid' | 'list') || 'grid';
  });
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    localStorage.setItem('leadViewMode', viewMode);
  }, [viewMode]);
  const [newNote, setNewNote] = useState('');
  const [newLead, setNewLead] = useState<Partial<Lead>>({
    customerName: '',
    phone: '',
    email: '',
    status: 'Chưa liên hệ',
    subStatus: '',
    appointmentStatus: '',
    resultStatus: '',
    details: '',
    notes: '',
    departmentId: user.departmentId || '',
    projectId: '',
    assignedToEmail: ''
  });

  // Sync selectedLead with latest leads data
  useEffect(() => {
    if (selectedLead) {
      const updatedLead = leads.find(l => l.id === selectedLead.id);
      if (updatedLead) {
        setSelectedLead(updatedLead);
      }
    }
  }, [leads]);

  useEffect(() => {
    const fetchProjects = async () => {
      const q = query(collection(db, 'projects'), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      const projectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Project[];
      setProjects(projectsData);
    };
    fetchProjects();
  }, []);

  const statuses = ['Tất cả', 'Chưa liên hệ', 'Không liên hệ được', 'Đã liên hệ'];
  const subStatuses = {
    'Không liên hệ được': ['Thuê bao', 'Không bắt máy', 'Bận'],
    'Đã liên hệ': ['Đang tư vấn', 'Rác / Không quan tâm']
  };
  const appointmentOptions = [
    'Chưa gặp khách / Chưa lên nhà mẫu',
    'Đã gặp khách / Chưa lên nhà mẫu',
    'Đã gặp khách / Đã lên nhà mẫu'
  ];
  const resultOptions = [
    'Chưa booking',
    'Đã booking',
    'Đã cọc'
  ];

  const filteredLeads = leads.filter(l => {
    const matchesSearch = 
      l.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.phone.includes(searchTerm) ||
      l.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTab = currentTab === 'Tất cả' || l.status === currentTab;
    const matchesProject = !selectedProjectId || l.projectId === selectedProjectId;
    
    return matchesSearch && matchesTab && matchesProject;
  });

  // Statistics Data
  const statsLeads = selectedProjectId ? leads.filter(l => l.projectId === selectedProjectId) : leads;
  
  const statusData = statuses.filter(s => s !== 'Tất cả').map(status => ({
    name: status,
    value: statsLeads.filter(l => l.status === status).length
  }));

  const resultData = resultOptions.map(result => ({
    name: result,
    value: statsLeads.filter(l => l.resultStatus === result).length
  }));

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  const handleCreate = async () => {
    if (!newLead.customerName || !newLead.phone) return;

    let customerCode = '';
    let finalDepartmentId = newLead.departmentId;

    if (newLead.assignedToEmail) {
      const assignedStaff = staff.find(s => s.email === newLead.assignedToEmail);
      if (assignedStaff && assignedStaff.departmentId) {
        finalDepartmentId = assignedStaff.departmentId;
      }
    }

    if (newLead.projectId) {
      const selectedProject = projects.find(p => p.id === newLead.projectId);
      if (selectedProject) {
        const q = query(collection(db, 'leads'), where('projectId', '==', newLead.projectId));
        const snapshot = await getDocs(q);
        const count = snapshot.size;
        customerCode = `${selectedProject.abbreviation}${(count + 1).toString().padStart(2, '0')}`;
      }
    }

    const history = [];
    if (newLead.details) {
      history.push(`[${new Date().toLocaleString()}] ${user.displayName || user.email}: ${newLead.details}`);
    }

    await createLead({
      customerName: newLead.customerName!,
      phone: newLead.phone!,
      email: newLead.email || '',
      status: newLead.status!,
      subStatus: newLead.subStatus,
      appointmentStatus: newLead.appointmentStatus,
      resultStatus: newLead.resultStatus,
      details: '', // Clear details as we use history now
      notes: newLead.notes,
      departmentId: finalDepartmentId,
      projectId: newLead.projectId,
      customerCode: customerCode,
      assignedToEmail: newLead.assignedToEmail,
      creatorEmail: user.email,
      updatedByEmail: user.email,
      history: history
    });
    setShowAddModal(false);
    setNewLead({ status: 'Chưa liên hệ', subStatus: '', appointmentStatus: '', resultStatus: '', departmentId: user.departmentId || '', projectId: '', assignedToEmail: '' });
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

      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedProjectId ? 'bg-emerald-100' : 'bg-slate-100'}`}>
            <FolderKanban className={`w-5 h-5 ${selectedProjectId ? 'text-emerald-600' : 'text-slate-600'}`} />
          </div>
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${selectedProjectId ? 'text-emerald-600' : 'text-slate-500'}`}>
              {selectedProjectId ? 'Dự án đang xem' : 'Tất cả dự án'}
            </p>
            <h3 className="text-base md:text-lg font-bold text-slate-900">
              {selectedProjectId ? projects.find(p => p.id === selectedProjectId)?.name : 'Hệ thống khách hàng'}
            </h3>
          </div>
        </div>
        
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl mr-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="Dạng lưới"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="Dạng danh sách"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setShowStats(!showStats)}
            className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm ${
              showStats 
                ? 'bg-emerald-600 text-white' 
                : 'bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            {showStats ? 'Xem danh sách' : 'Xem thống kê'}
          </button>
          
          {selectedProjectId ? (
            <button 
              onClick={() => setSelectedProjectId('')}
              className="flex-1 lg:flex-none px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
            >
              Xem tất cả
            </button>
          ) : (
            <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
              <select 
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="text-sm font-medium text-slate-700 bg-transparent outline-none cursor-pointer min-w-[120px]"
              >
                <option value="">Chọn dự án...</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </motion.div>

      {showStats ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Thống kê theo Trạng thái</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    cursor={{ fill: '#f8fafc' }}
                  />
                  <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Thống kê theo Kết quả</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={resultData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {resultData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Tổng quan dự án</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">Tổng khách hàng</p>
                <p className="text-2xl font-bold text-slate-900">{statsLeads.length}</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-xl">
                <p className="text-xs text-emerald-600 mb-1">Đã liên hệ</p>
                <p className="text-2xl font-bold text-emerald-700">
                  {statsLeads.filter(l => l.status === 'Đã liên hệ').length}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl">
                <p className="text-xs text-blue-600 mb-1">Đã booking/cọc</p>
                <p className="text-2xl font-bold text-blue-700">
                  {statsLeads.filter(l => l.resultStatus === 'Đã booking' || l.resultStatus === 'Đã cọc').length}
                </p>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl">
                <p className="text-xs text-amber-600 mb-1">Đang tư vấn</p>
                <p className="text-2xl font-bold text-amber-700">
                  {statsLeads.filter(l => l.subStatus === 'Đang tư vấn').length}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
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

          <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6" : "space-y-3"}>
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
                className={`bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all group ${viewMode === 'grid' ? 'p-4 md:p-6' : 'p-3 md:p-4 flex flex-col md:flex-row md:items-center justify-between gap-4'}`}
              >
                <div className={`flex items-start gap-3 ${viewMode === 'list' ? 'md:w-1/4' : 'mb-3 md:mb-4'}`}>
                  <div className="w-9 h-9 md:w-10 md:h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 md:w-5 md:h-5 text-slate-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 text-sm md:text-base leading-tight truncate">{lead.customerName}</h3>
                    <p className="text-[10px] md:text-xs text-slate-500">
                      {lead.customerCode ? `Mã KH: ${lead.customerCode}` : `ID: ${lead.id.slice(0, 8)}`}
                    </p>
                  </div>
                </div>

                <div className={`${viewMode === 'grid' ? 'space-y-2 md:space-y-3 mb-4 md:mb-6' : 'flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4'}`}>
                  <div className="flex items-center justify-between group/phone">
                    <div className="flex items-center gap-3 text-xs md:text-sm text-slate-600">
                      <Phone className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400" />
                      {lead.phone}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover/phone:opacity-100 transition-opacity">
                      <a href={`tel:${lead.phone}`} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Gọi"><PhoneCall className="w-3.5 h-3.5" /></a>
                      <a href={`https://zalo.me/${lead.phone}`} target="_blank" rel="noreferrer" className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="Zalo"><MessageSquare className="w-3.5 h-3.5" /></a>
                      <a href={`sms:${lead.phone}`} className="p-1 text-slate-600 hover:bg-slate-50 rounded" title="SMS"><MessageCircle className="w-3.5 h-3.5" /></a>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs md:text-sm text-slate-600">
                    <Tag className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400" />
                    <div className="flex flex-wrap gap-1">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-wider ${
                        lead.status === 'Chưa liên hệ' ? 'bg-slate-100 text-slate-600' :
                        lead.status === 'Không liên hệ được' ? 'bg-red-50 text-red-600' :
                        'bg-emerald-50 text-emerald-600'
                      }`}>
                        {lead.status}
                      </span>
                      {lead.subStatus && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600">
                          {lead.subStatus}
                        </span>
                      )}
                    </div>
                  </div>

                  {viewMode === 'grid' && lead.email && (
                    <div className="flex items-center gap-3 text-xs md:text-sm text-slate-600">
                      <Mail className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400" />
                      <span className="truncate">{lead.email}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-xs md:text-sm text-slate-600">
                    <Briefcase className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400" />
                    <span className="truncate">{departments.find(d => d.id === lead.departmentId)?.name || 'Chưa có phòng ban'}</span>
                  </div>

                  {lead.projectId && (
                    <div className="flex items-center gap-3 text-xs md:text-sm text-slate-600">
                      <FolderKanban className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400" />
                      <span className="truncate">{projects.find(p => p.id === lead.projectId)?.name || 'Dự án không tồn tại'}</span>
                    </div>
                  )}

                  {viewMode === 'list' && (
                    <div className="flex items-center gap-3 text-xs md:text-sm text-slate-600">
                      <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400" />
                      {new Date(lead.updatedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div className={`flex items-center justify-between ${viewMode === 'grid' ? 'pt-3 md:pt-4 border-t border-slate-100' : 'md:w-1/4 md:justify-end gap-4'}`}>
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
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setSelectedLead(lead)}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 px-2 py-1 hover:bg-emerald-50 rounded-lg transition-all"
                    >
                      Chi tiết
                    </button>
                    <div className="flex gap-1">
                      {(user.role === 'admin' || user.role === 'manager') && (
                        <button 
                          onClick={() => setShowAssignModal(lead)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Giao khách hàng"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                      )}
                      <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </>
  )}

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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dự án quan tâm *</label>
                  <select 
                    required
                    value={newLead.projectId}
                    onChange={e => setNewLead(prev => ({ ...prev, projectId: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  >
                    <option value="">Chọn dự án</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.abbreviation})</option>
                    ))}
                  </select>
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Trạng thái</label>
                    <select 
                      value={newLead.status}
                      onChange={e => {
                        const status = e.target.value;
                        setNewLead(prev => ({ 
                          ...prev, 
                          status, 
                          subStatus: '', 
                          appointmentStatus: '', 
                          resultStatus: '' 
                        }));
                      }}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    >
                      {statuses.filter(s => s !== 'Tất cả').map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  {newLead.status && subStatuses[newLead.status as keyof typeof subStatuses] && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Chi tiết trạng thái</label>
                      <select 
                        value={newLead.subStatus}
                        onChange={e => {
                          const subStatus = e.target.value;
                          setNewLead(prev => ({ 
                            ...prev, 
                            subStatus,
                            appointmentStatus: '',
                            resultStatus: ''
                          }));
                        }}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      >
                        <option value="">Chọn chi tiết</option>
                        {subStatuses[newLead.status as keyof typeof subStatuses].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {newLead.subStatus === 'Đang tư vấn' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Hẹn khách</label>
                      <select 
                        value={newLead.appointmentStatus}
                        onChange={e => setNewLead(prev => ({ ...prev, appointmentStatus: e.target.value }))}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      >
                        <option value="">Chọn trạng thái hẹn</option>
                        {appointmentOptions.map(o => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Kết quả</label>
                      <select 
                        value={newLead.resultStatus}
                        onChange={e => setNewLead(prev => ({ ...prev, resultStatus: e.target.value }))}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      >
                        <option value="">Chọn kết quả</option>
                        {resultOptions.map(o => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6">
              <label className="block text-sm font-medium text-slate-700 mb-1">Ghi chú ban đầu</label>
              <textarea 
                rows={3}
                value={newLead.details}
                onChange={e => setNewLead(prev => ({ ...prev, details: e.target.value }))}
                placeholder="Nhập ghi chú ban đầu cho khách hàng..."
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
                  <p className="text-slate-500">
                    {selectedLead.customerCode ? `Mã khách hàng: ${selectedLead.customerCode}` : `ID: ${selectedLead.id}`}
                  </p>
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
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-slate-50 p-4 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Điện thoại</p>
                        <p className="font-semibold text-slate-900">{selectedLead.phone}</p>
                      </div>
                      <div className="flex gap-2">
                        <a href={`tel:${selectedLead.phone}`} className="w-10 h-10 flex items-center justify-center bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-200 transition-all" title="Gọi"><PhoneCall className="w-5 h-5" /></a>
                        <a href={`https://zalo.me/${selectedLead.phone}`} target="_blank" rel="noreferrer" className="w-10 h-10 flex items-center justify-center bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 transition-all" title="Zalo"><MessageSquare className="w-5 h-5" /></a>
                        <a href={`sms:${selectedLead.phone}`} className="w-10 h-10 flex items-center justify-center bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-300 transition-all" title="SMS"><MessageCircle className="w-5 h-5" /></a>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl">
                      <p className="text-xs text-slate-500 mb-1">Email</p>
                      <p className="font-semibold text-slate-900">{selectedLead.email || 'N/A'}</p>
                    </div>
                  </div>
                  {selectedLead.notes && (
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                      <p className="text-xs text-amber-600 font-bold uppercase tracking-wider mb-1">Ghi chú ban đầu</p>
                      <p className="text-sm text-slate-700 leading-relaxed">{selectedLead.notes}</p>
                    </div>
                  )}
                </section>

                <section>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Cập nhật thông tin</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Trạng thái</label>
                      <select 
                        value={selectedLead.status}
                        onChange={async (e) => {
                          const status = e.target.value;
                          const updates = { 
                            status, 
                            subStatus: '', 
                            appointmentStatus: '', 
                            resultStatus: '' 
                          };
                          await updateLead(selectedLead.id, updates, user.email);
                          setSelectedLead({ ...selectedLead, ...updates });
                        }}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      >
                        {statuses.filter(s => s !== 'Tất cả').map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    {selectedLead.status && subStatuses[selectedLead.status as keyof typeof subStatuses] && (
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Chi tiết trạng thái</label>
                        <select 
                          value={selectedLead.subStatus || ''}
                          onChange={async (e) => {
                            const subStatus = e.target.value;
                            const updates = { 
                              subStatus,
                              appointmentStatus: '',
                              resultStatus: ''
                            };
                            await updateLead(selectedLead.id, updates, user.email);
                            setSelectedLead({ ...selectedLead, ...updates });
                          }}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        >
                          <option value="">Chọn chi tiết</option>
                          {subStatuses[selectedLead.status as keyof typeof subStatuses].map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {selectedLead.subStatus === 'Đang tư vấn' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Hẹn khách</label>
                        <select 
                          value={selectedLead.appointmentStatus || ''}
                          onChange={async (e) => {
                            const appointmentStatus = e.target.value;
                            await updateLead(selectedLead.id, { appointmentStatus }, user.email);
                            setSelectedLead({ ...selectedLead, appointmentStatus });
                          }}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        >
                          <option value="">Chọn trạng thái hẹn</option>
                          {appointmentOptions.map(o => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Kết quả</label>
                        <select 
                          value={selectedLead.resultStatus || ''}
                          onChange={async (e) => {
                            const resultStatus = e.target.value;
                            await updateLead(selectedLead.id, { resultStatus }, user.email);
                            setSelectedLead({ ...selectedLead, resultStatus });
                          }}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        >
                          <option value="">Chọn kết quả</option>
                          {resultOptions.map(o => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-slate-500 mb-2">Thêm ghi chú mới (Timeline)</label>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          value={newNote}
                          onChange={e => setNewNote(e.target.value)}
                          onKeyPress={async (e) => {
                            if (e.key === 'Enter' && newNote.trim()) {
                              const timestamp = new Date().toLocaleString();
                              const entry = `[${timestamp}] ${user.displayName || user.email}: ${newNote}`;
                              const updatedHistory = [...selectedLead.history, entry];
                              await updateLead(selectedLead.id, { history: updatedHistory }, user.email);
                              setSelectedLead({ ...selectedLead, history: updatedHistory });
                              setNewNote('');
                            }
                          }}
                          placeholder="Nhập nội dung trao đổi..."
                          className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                        />
                        <button 
                          onClick={async () => {
                            if (!newNote.trim()) return;
                            const timestamp = new Date().toLocaleString();
                            const entry = `[${timestamp}] ${user.displayName || user.email}: ${newNote}`;
                            const updatedHistory = [...selectedLead.history, entry];
                            await updateLead(selectedLead.id, { history: updatedHistory }, user.email);
                            setSelectedLead({ ...selectedLead, history: updatedHistory });
                            setNewNote('');
                          }}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-all"
                        >
                          Gửi
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <History className="w-4 h-4" /> Lịch sử trao đổi
                  </h4>
                  <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                    {selectedLead.history.slice().reverse().map((entry, i) => {
                      const parts = entry.match(/^\[(.*?)\] (.*?): (.*)$/);
                      if (parts) {
                        return (
                          <div key={i} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{parts[2]}</span>
                              <span className="text-[10px] text-slate-400">{parts[1]}</span>
                            </div>
                            <p className="text-sm text-slate-700 leading-relaxed">{parts[3]}</p>
                          </div>
                        );
                      }
                      return (
                        <div key={i} className="flex gap-3 text-sm bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <p className="text-slate-600">{entry}</p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <section>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Trạng thái & Giao việc</h4>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Trạng thái hiện tại</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium border border-emerald-100">
                          {selectedLead.status}
                        </span>
                        {selectedLead.subStatus && (
                          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-100">
                            {selectedLead.subStatus}
                          </span>
                        )}
                      </div>
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
