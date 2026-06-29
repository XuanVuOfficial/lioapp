import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, Phone, Mail, Clock, User, Tag, MoreVertical, Edit2, Trash2, UserPlus, Image as ImageIcon, History, Briefcase, Check, FolderKanban, LayoutGrid, List, MessageSquare, PhoneCall, MessageCircle, BarChart3, Download } from 'lucide-react';
import { Lead, Department, UserProfile, Project } from '../types';
import { createLead, updateLead, assignLead, deleteLead } from '../services/leadService';
import { queryDB, escapeSQL } from '../api';
import { exportLeadsToExcel } from '../utils/excelExport';

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
  const [leadToEdit, setLeadToEdit] = useState<Lead | null>(null);
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('Tất cả');
  const [assignFilter, setAssignFilter] = useState<'all' | 'mine' | 'assigned_by_me'>(user.role === 'staff' ? 'mine' : 'all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [hasInitializedDept, setHasInitializedDept] = useState(false);
  const [selectedAssignDeptId, setSelectedAssignDeptId] = useState<string>('');
  const [showStats, setShowStats] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [visibleCount, setVisibleCount] = useState(30);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  // Reset visible count when filters or search terms change to keep loading fast
  useEffect(() => {
    setVisibleCount(30);
  }, [searchTerm, currentTab, assignFilter, selectedProjectId, selectedDeptId]);

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
      try {
        const data = await queryDB('SELECT * FROM projects ORDER BY name ASC');
        if (data && Array.isArray(data)) {
           setProjects(data as Project[]);
        }
      } catch(e) { console.error('fetchProjects error', e); }
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

  const handleExportExcel = async () => {
    try {
      const projName = projects.find(p => p.id === selectedProjectId)?.name;
      await exportLeadsToExcel({
        leads: filteredLeads,
        departments,
        selectedDeptId,
        projectName: projName
      });
    } catch (e: any) {
      alert('Lỗi khi xuất excel: ' + e.message);
    }
  };

  const getSubDeptIdsRecursive = React.useCallback((deptId: string): string[] => {
    const ids = [deptId];
    departments.filter(d => d.parentId === deptId).forEach(child => {
      ids.push(...getSubDeptIdsRecursive(child.id));
    });
    return ids;
  }, [departments]);

  const allowedDepartments = React.useMemo(() => {
    if (['tgd', 'admin'].includes(user.role)) return departments;
    if (['gds', 'tp'].includes(user.role)) {
      const baseIds = (user.managedDeptIds && user.managedDeptIds.length > 0) 
        ? user.managedDeptIds 
        : (user.departmentId ? [user.departmentId] : []);
        
      // Get all managed depts and their children
      const getAllSubDeptIds = (deptId: string): string[] => {
        const ids = [deptId];
        departments.filter(d => d.parentId === deptId).forEach(child => {
          ids.push(...getAllSubDeptIds(child.id));
        });
        return ids;
      };
      
      const allAllowedIds = new Set<string>();
      baseIds.forEach(id => {
        getAllSubDeptIds(id).forEach(subId => allAllowedIds.add(subId));
      });
      
      return departments.filter(d => allAllowedIds.has(d.id));
    }
    // Staff only sees their own department
    return departments.filter(d => d.id === user.departmentId);
  }, [user, departments]);

  useEffect(() => {
    if (departments.length > 0 && !hasInitializedDept) {
      if (['tgd', 'admin'].includes(user.role)) {
        setSelectedDeptId('');
        setHasInitializedDept(true);
      } else if (allowedDepartments.length > 0) {
        // Auto-select the highest level department in allowed list
        const topDept = [...allowedDepartments].sort((a, b) => a.level - b.level)[0];
        setSelectedDeptId(topDept.id);
        setHasInitializedDept(true);
      }
    }
  }, [departments, allowedDepartments, user.role, hasInitializedDept]);

  const filteredLeads = leads.filter(l => {
    const matchesSearch = 
      l.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.phone.includes(searchTerm) ||
      l.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTab = currentTab === 'Tất cả' || l.status === currentTab;
    const matchesProject = !selectedProjectId || l.projectId === selectedProjectId;

    let matchesDept = true;
    if (selectedDeptId) {
      const allowedIds = getSubDeptIdsRecursive(selectedDeptId);
      matchesDept = l.departmentId ? allowedIds.includes(l.departmentId) : false;
    } else {
      const allowedIds = allowedDepartments.map(d => d.id);
      matchesDept = l.departmentId ? allowedIds.includes(l.departmentId) : false;
    }

    const matchesAssign = 
      assignFilter === 'all' ? true :
      assignFilter === 'mine' ? l.assignedToEmail === user.email :
      assignFilter === 'assigned_by_me' ? (l.assignedByEmail === user.email && l.assignedToEmail !== user.email) : true;
    
    return matchesSearch && matchesTab && matchesProject && matchesDept && matchesAssign;
  });

  const displayedLeads = React.useMemo(() => {
    return filteredLeads.slice(0, visibleCount);
  }, [filteredLeads, visibleCount]);

  const hasMore = filteredLeads.length > visibleCount;

  const loadMore = React.useCallback(() => {
    setVisibleCount(prev => Math.min(prev + 30, filteredLeads.length));
  }, [filteredLeads.length]);

  // Infinite scroll using IntersectionObserver
  useEffect(() => {
    if (!hasMore) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadMore();
      }
    }, {
      rootMargin: '200px', // start loading before user reaches the bottom
    });

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [hasMore, loadMore]);

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
    if (!newLead.customerName || !newLead.phone) {
      alert('Vui lòng nhập tên và số điện thoại khách hàng.');
      return;
    }

    if (!newLead.projectId) {
      alert('Vui lòng chọn dự án quan tâm.');
      return;
    }

    let finalDepartmentId = newLead.departmentId;

    if (['tgd', 'admin', 'gds', 'tp'].includes(user.role)) {
      if (!selectedAssignDeptId) {
        alert('Vui lòng chọn nhánh phòng ban.');
        return;
      }
      finalDepartmentId = selectedAssignDeptId;
    }

    let customerCode = '';

    if (newLead.assignedToEmail) {
      const assignedStaff = staff.find(s => s.email === newLead.assignedToEmail);
      if (assignedStaff && assignedStaff.departmentId) {
        finalDepartmentId = assignedStaff.departmentId;
      }
    }

    if (newLead.projectId) {
      const selectedProject = projects.find(p => p.id === newLead.projectId);
      if (selectedProject) {
        try {
          const res = await queryDB(`SELECT COUNT(*) as c FROM leads WHERE projectId = ${escapeSQL(newLead.projectId)}`);
          if (res && res.length > 0) {
            const count = parseInt(res[0].c, 10);
            customerCode = `${selectedProject.abbreviation}${(count + 1).toString().padStart(2, '0')}`;
          }
        } catch(e) { console.error('Error counting leads for project', e); }
      }
    }

    const history = [];
    if (newLead.notes) {
      history.push(`[NOTE][${new Date().toLocaleString()}] ${user.displayName || user.email}: ${newLead.notes}`);
    }

    // If staff creates a lead, assign it to them by default if not specified
    const finalAssignedToEmail = newLead.assignedToEmail || (user.role === 'staff' ? user.email : '');

    await createLead({
      customerName: newLead.customerName!,
      phone: newLead.phone!,
      email: newLead.email || '',
      status: newLead.status!,
      subStatus: newLead.subStatus,
      appointmentStatus: newLead.appointmentStatus,
      resultStatus: newLead.resultStatus,
      details: '',
      notes: newLead.notes || '',
      departmentId: finalDepartmentId,
      projectId: newLead.projectId,
      customerCode: customerCode,
      assignedToEmail: finalAssignedToEmail,
      creatorEmail: user.email,
      updatedByEmail: user.email,
      history: history
    });
    setShowAddModal(false);
    setNewLead({ status: 'Chưa liên hệ', subStatus: '', appointmentStatus: '', resultStatus: '', departmentId: user.departmentId || '', projectId: '', assignedToEmail: '' });
    setSelectedAssignDeptId('');
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

  const handleDeleteLead = async (lead: Lead) => {
    if (window.confirm(`Bạn có chắc chắn muốn xoá khách hàng "${lead.customerName}" không?`)) {
      await deleteLead(lead);
      setActionMenuOpenId(null);
      if (selectedLead?.id === lead.id) {
        setSelectedLead(null);
      }
    }
  };

  const getSubDepartments = (parentId: string) => {
    return departments.filter(d => d.parentId === parentId);
  };

  const subDepts = user.departmentId ? getSubDepartments(user.departmentId) : [];

  const getDepartmentPath = (deptId: string): string => {
    const path: string[] = [];
    let currentId: string | null = deptId;
    while (currentId) {
      const dept = departments.find(d => d.id === currentId);
      if (dept) {
        path.unshift(dept.name);
        currentId = dept.parentId;
      } else {
        currentId = null;
      }
    }
    return path.join(' > ');
  };

  const assignableStaff = React.useMemo(() => {
    if (!['tgd', 'admin', 'gds', 'tp'].includes(user.role)) return [];
    
    let validDeptIds: string[];
    if (selectedAssignDeptId) {
      validDeptIds = getSubDeptIdsRecursive(selectedAssignDeptId);
    } else {
      validDeptIds = allowedDepartments.map(d => d.id);
    }
    
    return staff.filter(s => s.departmentId && validDeptIds.includes(s.departmentId));
  }, [staff, selectedAssignDeptId, user.role, getSubDeptIdsRecursive, allowedDepartments]);

  const getRoleName = (role: string) => {
    switch (role) {
      case 'tgd': return 'Tổng giám đốc';
      case 'admin': return 'QTV';
      case 'gds': return 'Giám đốc sàn';
      case 'tp': return 'Trưởng phòng';
      case 'staff': return 'Nhân viên';
      default: return role;
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-xl md:text-2xl font-bold text-slate-900">Khách hàng tiềm năng</h2>
        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-2 md:gap-3">
          {/* Department Filter */}
          <div className="relative flex-1 md:w-48">
            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none bg-white"
            >
              {['tgd', 'admin'].includes(user.role) && (
                <option value="">Tất cả phòng ban</option>
              )}
              {allowedDepartments.map(d => (
                <option key={d.id} value={d.id}>{getDepartmentPath(d.id)}</option>
              ))}
            </select>
          </div>

          {/* Assignment Filter for Managers */}
          <div className="relative flex-1 md:w-48">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={assignFilter}
              onChange={(e) => setAssignFilter(e.target.value as 'all' | 'mine' | 'assigned_by_me')}
              disabled={user.role === 'staff'}
              className={`w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 outline-none transition-all appearance-none bg-white ${
                user.role === 'staff' ? 'bg-slate-50 cursor-not-allowed opacity-70' : 'focus:ring-2 focus:ring-emerald-500'
              }`}
            >
              {user.role !== 'staff' && <option value="all">Tất cả</option>}
              <option value="mine">Tôi đảm nhận</option>
              {user.role !== 'staff' && <option value="assigned_by_me">Tôi đã chia cho nhân viên</option>}
            </select>
          </div>

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
            onClick={handleExportExcel}
            className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-emerald-600 border border-emerald-200 px-4 py-2 rounded-xl font-semibold text-sm transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            Xuất Excel
          </button>
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
        className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm"
      >
        <div className="flex items-center gap-2 w-full flex-1">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <FolderKanban className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="hidden sm:block text-sm text-slate-500 font-medium">Dự án:</p>
          <select 
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="flex-1 text-base font-bold text-slate-800 bg-transparent outline-none cursor-pointer hover:text-emerald-700 transition-colors"
          >
            <option value="">Tất cả dự án</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center w-full sm:w-auto">
          <button
            onClick={() => setShowStats(!showStats)}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm ${
              showStats 
                ? 'bg-emerald-600 text-white' 
                : 'bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            {showStats ? (
              <>
                <List className="w-4 h-4" />
                <span>Danh sách</span>
              </>
            ) : (
              <>
                <BarChart3 className="w-4 h-4" />
                <span>Thống kê</span>
              </>
            )}
          </button>
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

          <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredLeads.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-12 md:py-20 text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <User className="w-10 h-10 md:w-12 md:h-12 mb-4 opacity-20" />
              <p className="text-sm px-4 text-center">Không tìm thấy khách hàng nào. Hãy tạo mới để bắt đầu.</p>
            </div>
          ) : (
            displayedLeads.map(lead => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={lead.id}
                onClick={() => setSelectedLead(lead)}
                className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all group cursor-pointer p-3 md:p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3 md:w-1/4">
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

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
                  <div className="flex items-center gap-3 text-xs md:text-sm text-slate-600">
                    <Phone className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400" />
                    {lead.phone}
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

                  <div className="flex items-center gap-3 text-xs md:text-sm text-slate-600">
                    <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400" />
                    {new Date(lead.updatedAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center justify-between md:w-1/4 md:justify-end gap-4">
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
                    <div className="flex gap-1">
                      {['tgd', 'admin', 'gds', 'tp'].includes(user.role) && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowAssignModal(lead); }}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Giao khách hàng"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                      )}
                      <div className="relative">
                        <button 
                          onClick={e => {
                            e.stopPropagation();
                            setActionMenuOpenId(actionMenuOpenId === lead.id ? null : lead.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {actionMenuOpenId === lead.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setActionMenuOpenId(null); }} />
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 z-50 py-1" onClick={e => e.stopPropagation()}>
                              {['tgd', 'admin'].includes(user.role) ? (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActionMenuOpenId(null);
                                      setLeadToEdit(lead);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                  >
                                    <Edit2 className="w-4 h-4" /> Sửa thông tin
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteLead(lead);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                  >
                                    <Trash2 className="w-4 h-4" /> Xoá khách hàng
                                  </button>
                                </>
                              ) : (
                                <div className="px-4 py-2 text-sm text-slate-500 italic">Không có hành động</div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
        
        {hasMore && (
          <div ref={sentinelRef} className="flex flex-col items-center justify-center py-6 gap-2">
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <svg className="animate-spin h-5 w-5 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Đang tải thêm khách hàng...
            </div>
            <button
              onClick={loadMore}
              className="mt-2 px-5 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-medium text-xs rounded-xl transition-all shadow-sm border border-slate-200"
            >
              Tải thêm ngay ({filteredLeads.length - visibleCount} khách hàng còn lại)
            </button>
          </div>
        )}
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
                {['tgd', 'admin', 'gds', 'tp'].includes(user.role) && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Chọn nhánh phòng ban cần chia *</label>
                      <select
                        value={selectedAssignDeptId}
                        onChange={e => {
                          setSelectedAssignDeptId(e.target.value);
                          setNewLead(prev => ({ ...prev, assignedToEmail: '' })); // reset staff on change
                        }}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all bg-white"
                      >
                        <option value="" disabled hidden>Chọn phòng ban</option>
                        {allowedDepartments
                          .filter(d => {
                            const path = getDepartmentPath(d.id);
                            return path !== 'Tổng sàn' && path !== 'Tổng sàn > Admin' && path !== 'Tổng sàn > admin';
                          })
                          .map(d => (
                          <option key={d.id} value={d.id}>{getDepartmentPath(d.id)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Chia cho nhân viên</label>
                      <select 
                        value={newLead.assignedToEmail}
                        onChange={e => setNewLead(prev => ({ ...prev, assignedToEmail: e.target.value }))}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all bg-white"
                      >
                        <option value="">Chọn nhân viên</option>
                        {assignableStaff.map(s => (
                          <option key={s.uid} value={s.email}>{s.displayName} ({getRoleName(s.role)})</option>
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
                value={newLead.notes}
                onChange={e => setNewLead(prev => ({ ...prev, notes: e.target.value }))}
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
                  {/* Option to assign to self if manager */}
                  {user.role === 'tp' && (
                    <button
                      onClick={() => handleAssign(showAssignModal, user.email, user.departmentId)}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${
                        showAssignModal.assignedToEmail === user.email 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-blue-100 hover:border-blue-200 hover:bg-blue-50'
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-blue-900">Giao cho bản thân (Trưởng phòng)</p>
                        <p className="text-xs text-blue-500">{user.displayName} ({user.email})</p>
                      </div>
                      {showAssignModal.assignedToEmail === user.email ? (
                        <Check className="w-4 h-4 text-blue-600" />
                      ) : (
                        <User className="w-4 h-4 text-blue-600" />
                      )}
                    </button>
                  )}

                  {staff.length === 0 ? (
                    <p className="text-sm text-slate-500 italic mt-2">Không tìm thấy nhân viên nào khác trong phòng ban này.</p>
                  ) : (
                    staff.filter(s => s.email !== user.email).map(s => {
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

      {/* Edit Lead Modal */}
      {leadToEdit && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-6">Sửa thông tin khách hàng</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tên khách hàng *</label>
                <input 
                  type="text" 
                  required
                  value={leadToEdit.customerName}
                  onChange={e => setLeadToEdit(prev => prev ? ({ ...prev, customerName: e.target.value }) : null)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Số điện thoại *</label>
                <input 
                  type="text" 
                  required
                  value={leadToEdit.phone}
                  onChange={e => setLeadToEdit(prev => prev ? ({ ...prev, phone: e.target.value }) : null)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input 
                  type="email" 
                  value={leadToEdit.email || ''}
                  onChange={e => setLeadToEdit(prev => prev ? ({ ...prev, email: e.target.value }) : null)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setLeadToEdit(null)}
                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold transition-all"
              >
                Hủy
              </button>
              <button 
                onClick={async () => {
                  if (!leadToEdit.customerName || !leadToEdit.phone) {
                    alert('Vui lòng nhập tên và số điện thoại.');
                    return;
                  }
                  const timestamp = new Date().toLocaleString('vi-VN');
                  const username = user.displayName || user.email;
                  const entry = `[LOG][${timestamp}] ${username}: cập nhật thông tin (Tên: ${leadToEdit.customerName}, SĐT: ${leadToEdit.phone})`;
                  const updatedHistory = [...(leadToEdit.history || []), entry];
                  await updateLead(leadToEdit.id, { 
                    customerName: leadToEdit.customerName, 
                    phone: leadToEdit.phone,
                    email: leadToEdit.email,
                    history: updatedHistory
                  }, user.email);
                  setLeadToEdit(null);
                }}
                className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all shadow-lg shadow-emerald-100"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-y-auto max-h-[90vh] flex flex-col relative">
            <div className="sticky top-0 bg-white z-20 px-6 py-4 border-b border-slate-100 flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">{selectedLead.customerName}</h3>
                  <p className="text-xs text-slate-500">
                    {selectedLead.customerCode ? `Mã KH: ${selectedLead.customerCode}` : `ID: ${selectedLead.id}`}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedLead(null)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <Plus className="w-5 h-5 text-slate-400 rotate-45" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                <section>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Thông tin liên hệ</h4>
                  <div className="bg-slate-50 p-4 rounded-xl space-y-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">Số điện thoại</p>
                        <p className="text-lg font-bold text-slate-900 tracking-tight">{selectedLead.phone}</p>
                      </div>
                      <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center">
                        <Phone className="w-5 h-5 text-emerald-600" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <a 
                        href={`tel:${selectedLead.phone}`} 
                        className="flex flex-col items-center justify-center gap-1.5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-100"
                      >
                        <PhoneCall className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase">Gọi điện</span>
                      </a>
                      <a 
                        href={`https://zalo.me/${selectedLead.phone}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="flex flex-col items-center justify-center gap-1.5 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all shadow-sm shadow-blue-100"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase">Zalo</span>
                      </a>
                      <a 
                        href={`sms:${selectedLead.phone}`} 
                        className="flex flex-col items-center justify-center gap-1.5 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-all shadow-sm shadow-slate-200"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase">SMS</span>
                      </a>
                    </div>
                  </div>
                </section>

                <section>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Cập nhật thông tin</h4>
                  {(()=>{
                    const isRoleAllowedToEditStatus = ['tgd', 'admin', 'gds'].includes(user.role);
                    const isStatusDisabled = false;
                    const isSubStatusDisabled = false;
                    const isAppointmentStatusDisabled = false;
                    const isResultStatusDisabled = false;
                    
                    return (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Trạng thái</label>
                            <select 
                              value={selectedLead.status}
                              disabled={isStatusDisabled}
                              onChange={async (e) => {
                                const status = e.target.value;
                                const updates: Partial<Lead> = { 
                                  status, 
                                  subStatus: '', 
                                  appointmentStatus: '', 
                                  resultStatus: '' 
                                };
                                const timestamp = new Date().toLocaleString('vi-VN');
                                const username = user.displayName || user.email;
                                const entry = `[LOG][${timestamp}] ${username}: cập nhật Trạng thái là '${status}'`;
                                const updatedHistory = [...(selectedLead.history || []), entry];
                                await updateLead(selectedLead.id, { ...updates, history: updatedHistory }, user.email);
                                setSelectedLead({ ...selectedLead, ...updates, history: updatedHistory });
                              }}
                              className={`w-full px-4 py-2 rounded-xl border border-slate-200 outline-none transition-all ${
                                isStatusDisabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'focus:ring-2 focus:ring-emerald-500'
                              }`}
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
                                disabled={isSubStatusDisabled}
                                onChange={async (e) => {
                                  const subStatus = e.target.value;
                                  const updates: Partial<Lead> = { 
                                    subStatus,
                                    appointmentStatus: '',
                                    resultStatus: ''
                                  };
                                  const timestamp = new Date().toLocaleString('vi-VN');
                                  const username = user.displayName || user.email;
                                  const actionText = subStatus ? `cập nhật Trạng thái là '${selectedLead.status} > ${subStatus}'` : `đã xóa Trạng thái chi tiết (trước đó là '${selectedLead.subStatus}')`;
                                  const entry = `[LOG][${timestamp}] ${username}: ${actionText}`;
                                  const updatedHistory = [...(selectedLead.history || []), entry];
                                  await updateLead(selectedLead.id, { ...updates, history: updatedHistory }, user.email);
                                  setSelectedLead({ ...selectedLead, ...updates, history: updatedHistory });
                                }}
                                className={`w-full px-4 py-2 rounded-xl border border-slate-200 outline-none transition-all ${
                                  isSubStatusDisabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'focus:ring-2 focus:ring-emerald-500 bg-white'
                                }`}
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
                                disabled={isAppointmentStatusDisabled}
                                onChange={async (e) => {
                                  const appointmentStatus = e.target.value;
                                  const timestamp = new Date().toLocaleString('vi-VN');
                                  const username = user.displayName || user.email;
                                  const actionText = appointmentStatus ? `cập nhật Hẹn khách là '${appointmentStatus}'` : `đã xóa Hẹn khách (trước đó là '${selectedLead.appointmentStatus}')`;
                                  const entry = `[LOG][${timestamp}] ${username}: ${actionText}`;
                                  const updatedHistory = [...(selectedLead.history || []), entry];
                                  await updateLead(selectedLead.id, { appointmentStatus, history: updatedHistory }, user.email);
                                  setSelectedLead({ ...selectedLead, appointmentStatus, history: updatedHistory });
                                }}
                                className={`w-full px-4 py-2 rounded-xl border border-slate-200 outline-none transition-all ${
                                  isAppointmentStatusDisabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'focus:ring-2 focus:ring-emerald-500 bg-white'
                                }`}
                              >
                                <option value="">Chọn trạng thái hẹn</option>
                                {appointmentOptions.map(o => (
                                  <option key={o} value={o}>{o}</option>
                                ))}
                              </select>
                            </div>
                            {selectedLead.appointmentStatus && (
                              <div>
                                <label className="block text-xs text-slate-500 mb-1">Kết quả</label>
                                <select 
                                  value={selectedLead.resultStatus || ''}
                                  disabled={isResultStatusDisabled}
                                  onChange={async (e) => {
                                    const resultStatus = e.target.value;
                                    const timestamp = new Date().toLocaleString('vi-VN');
                                    const username = user.displayName || user.email;
                                    const actionText = resultStatus ? `cập nhật Kết quả là '${resultStatus}'` : `đã xóa Kết quả (trước đó là '${selectedLead.resultStatus}')`;
                                    const entry = `[LOG][${timestamp}] ${username}: ${actionText}`;
                                    const updatedHistory = [...(selectedLead.history || []), entry];
                                    await updateLead(selectedLead.id, { resultStatus, history: updatedHistory }, user.email);
                                    setSelectedLead({ ...selectedLead, resultStatus, history: updatedHistory });
                                  }}
                                  className={`w-full px-4 py-2 rounded-xl border border-slate-200 outline-none transition-all ${
                                    isResultStatusDisabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'focus:ring-2 focus:ring-emerald-500 bg-white'
                                  }`}
                                >
                                  <option value="">Chọn kết quả</option>
                                  {resultOptions.map(o => (
                                    <option key={o} value={o}>{o}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
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
                              const timestamp = new Date().toLocaleString('vi-VN');
                              const username = user.displayName || user.email;
                              const entry = `[NOTE][${timestamp}] ${username}: ${newNote.trim()}`;
                              const updatedHistory = [...(selectedLead.history || []), entry];
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
                            const timestamp = new Date().toLocaleString('vi-VN');
                            const username = user.displayName || user.email;
                            const entry = `[NOTE][${timestamp}] ${username}: ${newNote.trim()}`;
                            const updatedHistory = [...(selectedLead.history || []), entry];
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
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                    {(selectedLead.history || []).slice().reverse().map((entry, i) => {
                      const isNote = entry.startsWith('[NOTE]');
                      const isLog = entry.startsWith('[LOG]');
                      const cleanEntry = entry.replace(/^\[(NOTE|LOG)\]/, '');
                      
                      const parts = cleanEntry.match(/^\[(.*?)\] (.*?): (.*)$/);
                      if (parts) {
                        return (
                          <div key={i} className={`p-3 rounded-xl border ${isNote ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="flex justify-between items-start mb-1">
                              <div className="flex items-center gap-1.5">
                                {isNote ? (
                                  <Edit2 className="w-3 h-3 text-amber-600" />
                                ) : (
                                  <History className="w-3 h-3 text-emerald-600" />
                                )}
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isNote ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {parts[2]}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400">{parts[1]}</span>
                            </div>
                            <p className="text-sm text-slate-700 leading-relaxed italic">{isNote ? parts[3] : parts[3]}</p>
                          </div>
                        );
                      }
                      return (
                        <div key={i} className="flex gap-3 text-sm bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <History className="w-4 h-4 text-slate-400 shrink-0" />
                          <p className="text-slate-600">{entry}</p>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {selectedLead.notes && (
                  <section>
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Ghi chú ban đầu</h4>
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedLead.notes}</p>
                    </div>
                  </section>
                )}
              </div>

              <div className="space-y-6">
                <section>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Trạng thái & Giao việc</h4>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Người tạo và thời gian tạo</p>
                      <div className="bg-slate-50 p-4 rounded-xl flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">
                          {selectedLead.creatorEmail ? selectedLead.creatorEmail[0].toUpperCase() : '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {selectedLead.creatorEmail}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {new Date(selectedLead.createdAt).toLocaleString('vi-VN')}
                          </p>
                        </div>
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
