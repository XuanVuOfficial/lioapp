import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, Phone, Mail, Clock, User, Tag, MoreVertical, Edit2, Edit3, Trash2, UserPlus, Image as ImageIcon, History, Briefcase, Check, CheckCircle2, ChevronRight, ChevronDown, FolderKanban, LayoutGrid, List, MessageSquare, PhoneCall, MessageCircle, BarChart3, Download, Calendar, X, Loader2, Info } from 'lucide-react';
import { Lead, Department, UserProfile, Project } from '../types';
import { createLead, updateLead, assignLead, deleteLead, getLeadById, fetchLeadStats, fetchPaginatedLeads, LeadStatsSummary, subscribeToLeadChanges } from '../services/leadService';
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

  const handleSelectLead = async (lead: Lead) => {
    setSelectedLead(lead);
    try {
      const fullLead = await getLeadById(lead.id);
      if (fullLead) {
        setSelectedLead(fullLead);
      }
    } catch (e) {
      console.error('Error fetching full lead details', e);
    }
  };

  const [showAssignModal, setShowAssignModal] = useState<Lead | null>(null);
  const [assignSearchTerm, setAssignSearchTerm] = useState('');
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
  
  // Paginated Leads & JSON Stats States
  const [displayedLeads, setDisplayedLeads] = useState<Lead[]>([]);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoadingLeads, setIsLoadingLeads] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [statsSummary, setStatsSummary] = useState<LeadStatsSummary | null>(null);

  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  // Export Excel Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStartDate, setExportStartDate] = useState<string>('');
  const [exportEndDate, setExportEndDate] = useState<string>('');
  const [presetSelected, setPresetSelected] = useState<string>('month');

  // Stats Date Filter State
  const [statsStartDate, setStatsStartDate] = useState<string>('');
  const [statsEndDate, setStatsEndDate] = useState<string>('');
  const [statsPresetSelected, setStatsPresetSelected] = useState<string>('all');

  // Search Picker Modal State
  const [searchPickerModal, setSearchPickerModal] = useState<{
    type: 'project' | 'department' | 'staff' | null;
    searchTerm: string;
  }>({ type: null, searchTerm: '' });

  // Status Update Modal State
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [expandedHistoryIndices, setExpandedHistoryIndices] = useState<Record<number, boolean>>({});
  const [statusForm, setStatusForm] = useState({
    status: '',
    subStatus: '',
    appointmentStatus: '',
    resultStatus: '',
    note: ''
  });
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  const handleOpenStatusModal = () => {
    if (!selectedLead) return;
    const initialStatus = (selectedLead.status && selectedLead.status !== 'Chưa liên hệ') ? selectedLead.status : '';
    setStatusForm({
      status: initialStatus,
      subStatus: selectedLead.subStatus || '',
      appointmentStatus: selectedLead.appointmentStatus || '',
      resultStatus: selectedLead.resultStatus || '',
      note: ''
    });
    setShowStatusModal(true);
  };

  const isStatusFormValid = () => {
    if (!statusForm.status) return false;
    if (statusForm.status === 'Không liên hệ được') {
      return Boolean(statusForm.subStatus);
    }
    if (statusForm.status === 'Đã liên hệ') {
      if (!statusForm.subStatus) return false;
      if (statusForm.subStatus === 'Rác / Không quan tâm') return true;
      if (statusForm.subStatus === 'Đang tư vấn') {
        return Boolean(statusForm.appointmentStatus && statusForm.resultStatus);
      }
    }
    return false;
  };

  const getStatusUpdateCount = (history: string[] = []) => {
    return history.filter(entry => 
      entry.toLowerCase().includes('cập nhật trạng thái') || 
      entry.toLowerCase().includes('cập nhật thông tin') ||
      entry.includes('cập nhật Trạng thái')
    ).length;
  };

  const handleSaveStatusModal = async () => {
    if (!selectedLead || !isStatusFormValid() || isSavingStatus) return;
    setIsSavingStatus(true);
    try {
      const parts: string[] = [];
      if (statusForm.status) parts.push(statusForm.status);
      if (statusForm.subStatus) parts.push(statusForm.subStatus);
      if (statusForm.appointmentStatus) parts.push(statusForm.appointmentStatus);
      if (statusForm.resultStatus) parts.push(statusForm.resultStatus);
      const statusChain = parts.join(' > ');

      const nextUpdateNumber = getStatusUpdateCount(selectedLead.history) + 1;
      const timestamp = new Date().toLocaleString('vi-VN');
      const username = user.displayName || user.email;
      const noteText = statusForm.note.trim() ? ` (note: ${statusForm.note.trim()})` : '';
      const entry = `[LOG][${timestamp}] ${username}: cập nhật trạng thái LẦN ${nextUpdateNumber} "${statusChain}"${noteText}`;

      const updates: Partial<Lead> = {
        status: statusForm.status,
        subStatus: statusForm.subStatus || '',
        appointmentStatus: statusForm.appointmentStatus || '',
        resultStatus: statusForm.resultStatus || ''
      };

      const updatedHistory = [...(selectedLead.history || []), entry];
      await updateLead(selectedLead.id, { ...updates, history: updatedHistory }, user.email);
      setSelectedLead(prev => prev ? {
        ...prev,
        ...updates,
        history: updatedHistory,
        isUpdatedByAssignee: true
      } : null);
      setDisplayedLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, ...updates, isUpdatedByAssignee: true } : l));
      setShowStatusModal(false);
    } catch (err: any) {
      alert('Lỗi khi cập nhật trạng thái: ' + (err.message || err));
    } finally {
      setIsSavingStatus(false);
    }
  };

  const [, setTick] = useState(0);

  // Live 1-second ticker for active lead countdown timer
  useEffect(() => {
    if (!selectedLead || !selectedLead.assignedToEmail || selectedLead.isUpdatedByAssignee) return;
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [selectedLead]);

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

  // Sync selectedLead with latest leads data without wiping its history and full fields
  useEffect(() => {
    if (selectedLead) {
      const updatedLead = displayedLeads.find(l => l.id === selectedLead.id);
      if (updatedLead) {
        setSelectedLead(prev => {
          if (!prev || prev.id !== updatedLead.id) return prev;
          return {
            ...prev,
            ...updatedLead,
            history: (prev.history && prev.history.length > 0) ? prev.history : (updatedLead.history || [])
          };
        });
      }
    }
  }, [displayedLeads]);

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

  const formatDateForInput = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const applyPreset = (preset: '3days' | '7days' | '30days' | 'month' | 'all') => {
    setPresetSelected(preset);
    const now = new Date();
    if (preset === '3days') {
      const past = new Date();
      past.setDate(now.getDate() - 2);
      setExportStartDate(formatDateForInput(past));
      setExportEndDate(formatDateForInput(now));
    } else if (preset === '7days') {
      const past = new Date();
      past.setDate(now.getDate() - 6);
      setExportStartDate(formatDateForInput(past));
      setExportEndDate(formatDateForInput(now));
    } else if (preset === '30days') {
      const past = new Date();
      past.setDate(now.getDate() - 29);
      setExportStartDate(formatDateForInput(past));
      setExportEndDate(formatDateForInput(now));
    } else if (preset === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setExportStartDate(formatDateForInput(startOfMonth));
      setExportEndDate(formatDateForInput(endOfMonth));
    } else if (preset === 'all') {
      setExportStartDate('');
      setExportEndDate('');
    }
  };

  const handleOpenExportModal = () => {
    applyPreset('month');
    setShowExportModal(true);
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
    return departments.filter(d => d.id === user.departmentId);
  }, [user, departments]);

  useEffect(() => {
    if (departments.length > 0 && !hasInitializedDept) {
      if (['tgd', 'admin'].includes(user.role)) {
        setSelectedDeptId('');
        setHasInitializedDept(true);
      } else if (allowedDepartments.length > 0) {
        const topDept = [...allowedDepartments].sort((a, b) => a.level - b.level)[0];
        setSelectedDeptId(topDept.id);
        setHasInitializedDept(true);
      }
    }
  }, [departments, allowedDepartments, user.role, hasInitializedDept]);

  const activeSubDeptIds = React.useMemo(() => {
    if (selectedDeptId) {
      return getSubDeptIdsRecursive(selectedDeptId);
    }
    return allowedDepartments.map(d => d.id);
  }, [selectedDeptId, allowedDepartments, getSubDeptIdsRecursive]);

  // 1. Fetch Stats Summary (Lazy loaded ONLY when clicking "Thống kê" or changing stats date filter)
  const loadStats = React.useCallback(async () => {
    try {
      const statsRes = await fetchLeadStats({
        role: user.role,
        userEmail: user.email,
        departmentIds: activeSubDeptIds,
        projectId: selectedProjectId,
        assignFilter,
        searchTerm,
        startDate: statsStartDate || undefined,
        endDate: statsEndDate || undefined
      });
      setStatsSummary(statsRes);
    } catch (e) {
      console.error('Error fetching stats:', e);
    }
  }, [user.role, user.email, activeSubDeptIds, selectedProjectId, assignFilter, searchTerm, statsStartDate, statsEndDate]);

  useEffect(() => {
    if (showStats) {
      loadStats();
    }
  }, [showStats, loadStats]);

  const applyStatsPreset = (preset: string) => {
    setStatsPresetSelected(preset);
    const now = new Date();
    let startStr = '';
    let endStr = '';

    if (preset === '3days') {
      const start = new Date();
      start.setDate(now.getDate() - 2);
      startStr = start.toISOString().split('T')[0];
      endStr = now.toISOString().split('T')[0];
    } else if (preset === '7days') {
      const start = new Date();
      start.setDate(now.getDate() - 6);
      startStr = start.toISOString().split('T')[0];
      endStr = now.toISOString().split('T')[0];
    } else if (preset === '30days') {
      const start = new Date();
      start.setDate(now.getDate() - 29);
      startStr = start.toISOString().split('T')[0];
      endStr = now.toISOString().split('T')[0];
    } else if (preset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      startStr = firstDay.toISOString().split('T')[0];
      endStr = now.toISOString().split('T')[0];
    } else if (preset === 'all') {
      startStr = '';
      endStr = '';
    }

    setStatsStartDate(startStr);
    setStatsEndDate(endStr);
  };

  // 2. Fetch 20 Leads for currently active Tab (FAST: Exactly 1 single 20-item query per tab/filter)
  const loadTabLeads = React.useCallback(async () => {
    setIsLoadingLeads(true);
    setPage(1);
    try {
      const paginatedRes = await fetchPaginatedLeads({
        role: user.role,
        userEmail: user.email,
        departmentIds: activeSubDeptIds,
        projectId: selectedProjectId,
        status: currentTab,
        assignFilter,
        searchTerm,
        page: 1,
        limit: 20
      });

      setDisplayedLeads(paginatedRes.leads);
      setHasMore(paginatedRes.hasMore);
      setTotalCount(paginatedRes.totalCount);
    } catch (e) {
      console.error('Error fetching tab leads:', e);
    } finally {
      setIsLoadingLeads(false);
    }
  }, [user.role, user.email, activeSubDeptIds, selectedProjectId, currentTab, assignFilter, searchTerm]);

  useEffect(() => {
    loadTabLeads();
  }, [loadTabLeads]);

  const activeSubDeptIdsKey = React.useMemo(() => {
    return activeSubDeptIds.sort().join(',');
  }, [activeSubDeptIds]);

  const refreshLeadsAndStats = React.useCallback(() => {
    loadTabLeads();
    if (showStats) {
      loadStats();
    }
  }, [loadTabLeads, loadStats, showStats]);

  const refreshRef = React.useRef(refreshLeadsAndStats);
  useEffect(() => {
    refreshRef.current = refreshLeadsAndStats;
  }, [refreshLeadsAndStats]);

  // Realtime subscription ping (Stable listener - NEVER unmounts/remounts on tab switch)
  useEffect(() => {
    const deptIds = activeSubDeptIdsKey ? activeSubDeptIdsKey.split(',') : undefined;
    const unsub = subscribeToLeadChanges(user.role, user.email, deptIds, () => {
      refreshRef.current();
    });
    return () => unsub();
  }, [user.role, user.email, activeSubDeptIdsKey]);

  // Load next 20 items on scroll
  const loadNextPage = React.useCallback(async () => {
    if (isLoadingMore || isLoadingLeads || !hasMore) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await fetchPaginatedLeads({
        role: user.role,
        userEmail: user.email,
        departmentIds: activeSubDeptIds,
        projectId: selectedProjectId,
        status: currentTab,
        assignFilter,
        searchTerm,
        page: nextPage,
        limit: 20
      });

      setDisplayedLeads(prev => {
        const existingIds = new Set(prev.map(l => l.id));
        const newUnique = res.leads.filter(l => !existingIds.has(l.id));
        return [...prev, ...newUnique];
      });
      setPage(nextPage);
      setHasMore(res.hasMore);
      setTotalCount(res.totalCount);
    } catch (e) {
      console.error('Error loading next page of leads:', e);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, isLoadingLeads, hasMore, page, user.role, user.email, activeSubDeptIds, selectedProjectId, currentTab, assignFilter, searchTerm]);

  // Infinite scroll IntersectionObserver
  useEffect(() => {
    if (!hasMore) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadNextPage();
      }
    }, {
      rootMargin: '200px',
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
  }, [hasMore, loadNextPage]);

  // Export excel handler
  const getLeadsToExport = async (): Promise<Lead[]> => {
    try {
      const res = await fetchPaginatedLeads({
        role: user.role,
        userEmail: user.email,
        departmentIds: activeSubDeptIds,
        projectId: selectedProjectId,
        status: currentTab,
        assignFilter,
        searchTerm,
        page: 1,
        limit: 5000
      });
      let list = res.leads;
      if (exportStartDate) {
        const start = new Date(exportStartDate + 'T00:00:00');
        if (!isNaN(start.getTime())) {
          list = list.filter(l => l.createdAt && new Date(l.createdAt) >= start);
        }
      }
      if (exportEndDate) {
        const end = new Date(exportEndDate + 'T23:59:59.999');
        if (!isNaN(end.getTime())) {
          list = list.filter(l => l.createdAt && new Date(l.createdAt) <= end);
        }
      }
      return list;
    } catch (e) {
      console.error('Error getting leads to export:', e);
      return [];
    }
  };

  const handleConfirmExport = async () => {
    setIsExporting(true);
    try {
      const leadsToExport = await getLeadsToExport();
      if (leadsToExport.length === 0) {
        alert('Không có dữ liệu khách hàng nào phù hợp với khoảng thời gian và bộ lọc đã chọn.');
        return;
      }
      const projName = projects.find(p => p.id === selectedProjectId)?.name;
      await exportLeadsToExcel({
        leads: leadsToExport,
        departments,
        selectedDeptId,
        projectName: projName
      });
      setShowExportModal(false);
    } catch (e: any) {
      alert('Lỗi khi xuất excel: ' + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Statistics Data for showStats
  const statusData = React.useMemo(() => {
    if (statsSummary) {
      return statuses.filter(s => s !== 'Tất cả').map(status => ({
        name: status,
        value: statsSummary.statusCounts[status] || 0
      }));
    }
    return [];
  }, [statsSummary]);

  const resultData = React.useMemo(() => {
    if (statsSummary) {
      return resultOptions.map(result => ({
        name: result,
        value: statsSummary.resultCounts[result] || 0
      }));
    }
    return [];
  }, [statsSummary]);

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

    const history: string[] = [];

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
    if (selectedLead && selectedLead.id === lead.id) {
      try {
        const fullLead = await getLeadById(lead.id);
        if (fullLead) {
          setSelectedLead(fullLead);
        }
      } catch (e) {
        console.error('Error refreshing assigned lead details', e);
      }
    }
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
            onClick={handleOpenExportModal}
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
            onClick={() => {
              const nextShow = !showStats;
              setShowStats(nextShow);
              if (nextShow) {
                loadStats();
              }
            }}
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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Date Filter Bar for Statistics */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Thời gian thống kê:</span>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <input 
                  type="date"
                  value={statsStartDate}
                  onChange={e => {
                    setStatsStartDate(e.target.value);
                    setStatsPresetSelected('');
                  }}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-medium text-slate-700"
                />
                <span className="text-xs text-slate-400 font-medium">đến</span>
                <input 
                  type="date"
                  value={statsEndDate}
                  onChange={e => {
                    setStatsEndDate(e.target.value);
                    setStatsPresetSelected('');
                  }}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-medium text-slate-700"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: '3days', label: '3 ngày' },
                  { id: '7days', label: '7 ngày' },
                  { id: '30days', label: '30 ngày' },
                  { id: 'month', label: 'Tháng này' },
                  { id: 'all', label: 'Tất cả' }
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyStatsPreset(p.id)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                      statsPresetSelected === p.id
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Thống kê theo Trạng thái</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 300, height: 300 }}>
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
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 300, height: 300 }}>
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
                <p className="text-2xl font-bold text-slate-900">{statsSummary?.total || 0}</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-xl">
                <p className="text-xs text-emerald-600 mb-1">Đã liên hệ</p>
                <p className="text-2xl font-bold text-emerald-700">
                  {statsSummary?.statusCounts['Đã liên hệ'] || 0}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl">
                <p className="text-xs text-blue-600 mb-1">Đã booking/cọc</p>
                <p className="text-2xl font-bold text-blue-700">
                  {(statsSummary?.resultCounts['Đã booking'] || 0) + (statsSummary?.resultCounts['Đã cọc'] || 0)}
                </p>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl">
                <p className="text-xs text-amber-600 mb-1">Đang tư vấn</p>
                <p className="text-2xl font-bold text-amber-700">
                  {statsSummary?.subStatusCounts['Đang tư vấn'] || 0}
                </p>
              </div>
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
                      ? 'border-emerald-600 text-emerald-600 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
        {isLoadingLeads ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`skel-lead-${i}`} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm animate-pulse flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full md:w-1/4">
                  <div className="w-10 h-10 bg-slate-200 rounded-xl shrink-0"></div>
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                    <div className="h-3 bg-slate-150 rounded w-1/2"></div>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-1/3">
                  <div className="h-6 bg-slate-200 rounded-full w-24"></div>
                  <div className="h-6 bg-slate-150 rounded-full w-20"></div>
                </div>
                <div className="h-4 bg-slate-200 rounded w-28"></div>
              </div>
            ))}
          </div>
        ) : (
        <AnimatePresence mode="popLayout">
          {displayedLeads.length === 0 ? (
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
                onClick={() => handleSelectLead(lead)}
                className={`rounded-2xl shadow-sm hover:shadow-md transition-all group cursor-pointer p-3 md:p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  !lead.assignedToEmail 
                    ? 'bg-amber-50/90 border-2 border-amber-300 shadow-amber-100/50' 
                    : 'bg-white border border-slate-200'
                }`}
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
                      {!lead.assignedToEmail && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white shadow-xs">
                          Chưa chia cho ai ⚠️
                        </span>
                      )}
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
                                    className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2"
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
        )}
        
        {hasMore && (
          <div ref={sentinelRef} className="flex items-center justify-center py-6 gap-2 text-slate-500 text-sm">
            <svg className="animate-spin h-5 w-5 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Đang tải thêm 20 khách hàng tiếp theo...</span>
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
                  <button
                    type="button"
                    onClick={() => setSearchPickerModal({ type: 'project', searchTerm: '' })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-left focus:ring-2 focus:ring-emerald-500 outline-none transition-all hover:border-emerald-300"
                  >
                    <span className={newLead.projectId ? "text-slate-900 font-semibold text-sm" : "text-slate-400 text-sm"}>
                      {newLead.projectId 
                        ? (projects.find(p => p.id === newLead.projectId)?.name || 'Chọn dự án') 
                        : 'Bấm để tìm & chọn dự án'}
                    </span>
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                {['tgd', 'admin', 'gds', 'tp'].includes(user.role) && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Chọn nhánh phòng ban cần chia *</label>
                      <button
                        type="button"
                        onClick={() => setSearchPickerModal({ type: 'department', searchTerm: '' })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-left focus:ring-2 focus:ring-emerald-500 outline-none transition-all hover:border-emerald-300"
                      >
                        <span className={selectedAssignDeptId ? "text-slate-900 font-semibold text-sm truncate" : "text-slate-400 text-sm"}>
                          {selectedAssignDeptId 
                            ? getDepartmentPath(selectedAssignDeptId) 
                            : 'Bấm để tìm & chọn phòng ban'}
                        </span>
                        <Search className="w-4 h-4 text-slate-400 shrink-0" />
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Chia cho nhân viên</label>
                      <button
                        type="button"
                        onClick={() => setSearchPickerModal({ type: 'staff', searchTerm: '' })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-left focus:ring-2 focus:ring-emerald-500 outline-none transition-all hover:border-emerald-300"
                      >
                        <span className={newLead.assignedToEmail ? "text-slate-900 font-semibold text-sm truncate" : "text-slate-400 text-sm"}>
                          {newLead.assignedToEmail 
                            ? (assignableStaff.find(s => s.email === newLead.assignedToEmail)?.displayName + ` (${newLead.assignedToEmail})`) 
                            : 'Bấm để tìm & chọn nhân viên (Tùy chọn)'}
                        </span>
                        <Search className="w-4 h-4 text-slate-400 shrink-0" />
                      </button>
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

      {/* Searchable Assign Lead Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-md w-full p-4 md:p-5 shadow-2xl border border-slate-100 flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Giao khách hàng</h3>
                  <p className="text-xs text-slate-500 font-semibold">{showAssignModal.customerName}</p>
                </div>
              </div>
              <button onClick={() => { setShowAssignModal(null); setAssignSearchTerm(''); }} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                autoFocus
                placeholder="Gõ tên/email nhân viên hoặc phòng ban..."
                value={assignSearchTerm}
                onChange={e => setAssignSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Content List */}
            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {/* Option to assign to self */}
              {user.role === 'tp' && (!assignSearchTerm || 'bản thân me'.includes(assignSearchTerm.toLowerCase()) || user.displayName.toLowerCase().includes(assignSearchTerm.toLowerCase())) && (
                <button
                  type="button"
                  onClick={() => {
                    handleAssign(showAssignModal, user.email, user.departmentId);
                    setAssignSearchTerm('');
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                    showAssignModal.assignedToEmail === user.email ? 'border-blue-500 bg-blue-50 text-blue-900 font-bold' : 'border-slate-100 hover:border-blue-200 hover:bg-blue-50 text-slate-700'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-sm text-blue-900">Giao cho bản thân (Trưởng phòng)</p>
                    <p className="text-xs text-blue-600">{user.displayName} ({user.email})</p>
                  </div>
                  {showAssignModal.assignedToEmail === user.email && <Check className="w-4 h-4 text-blue-600" />}
                </button>
              )}

              {/* Sub-departments */}
              {subDepts.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">Phòng ban con</p>
                  {subDepts
                    .filter(d => d.name.toLowerCase().includes(assignSearchTerm.toLowerCase()))
                    .map(d => {
                      const isSel = showAssignModal.departmentId === d.id;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            handleAssign(showAssignModal, undefined, d.id);
                            setAssignSearchTerm('');
                          }}
                          className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                            isSel ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold' : 'border-slate-100 hover:border-emerald-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div>
                            <p className="font-semibold text-sm">{d.name}</p>
                            <p className="text-xs text-slate-500">Trưởng phòng: {d.managerName || 'Chưa phân công'}</p>
                          </div>
                          {isSel && <Check className="w-4 h-4 text-emerald-600" />}
                        </button>
                      );
                    })}
                </div>
              )}

              {/* Staff List */}
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">Nhân viên phụ trách</p>
                {staff
                  .filter(s => s.email !== user.email && (s.displayName.toLowerCase().includes(assignSearchTerm.toLowerCase()) || s.email.toLowerCase().includes(assignSearchTerm.toLowerCase())))
                  .map(s => {
                    const isSel = showAssignModal.assignedToEmail === s.email;
                    return (
                      <button
                        key={s.uid}
                        type="button"
                        onClick={() => {
                          handleAssign(showAssignModal, s.email, undefined);
                          setAssignSearchTerm('');
                        }}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                          isSel ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold' : 'border-slate-100 hover:border-emerald-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div>
                          <p className="font-semibold text-sm">{s.displayName}</p>
                          <p className="text-xs text-slate-500">{s.email} • {getRoleName(s.role)}</p>
                        </div>
                        {isSel && <Check className="w-4 h-4 text-emerald-600" />}
                      </button>
                    );
                  })}
              </div>
            </div>
          </motion.div>
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

      {/* Details Modal - Full Screen on Mobile, Centered Modal on Tablet/Desktop */}
      {selectedLead && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-0 md:p-4 z-50">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-3xl md:rounded-2xl shadow-2xl border-0 md:border border-slate-200 overflow-y-auto flex flex-col relative">
            <div className="sticky top-0 bg-white z-20 px-4 py-3 md:px-6 md:py-4 border-b border-slate-100 flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-bold text-slate-900 leading-tight">{selectedLead.customerName}</h3>
                  <p className="text-xs text-slate-500">
                    {selectedLead.customerCode ? `Mã KH: ${selectedLead.customerCode}` : `ID: ${selectedLead.id}`}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedLead(null)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <Plus className="w-5 h-5 text-slate-400 rotate-45" />
              </button>
            </div>

            <div className="p-3.5 md:p-6 space-y-4 md:space-y-6">
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

              {/* 30-Minute Lead Update Countdown Banner */}
              {(() => {
                if (!selectedLead.assignedToEmail || selectedLead.isUpdatedByAssignee || !selectedLead.assignedAt) return null;
                const assignedTime = new Date(selectedLead.assignedAt).getTime();
                if (isNaN(assignedTime)) return null;

                const elapsedSec = Math.floor((Date.now() - assignedTime) / 1000);
                const remainingSec = Math.max(0, 30 * 60 - elapsedSec);
                const mins = Math.floor(remainingSec / 60);
                const secs = remainingSec % 60;
                const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                const isDanger = remainingSec <= 300;

                return (
                  <div className={`p-4 rounded-2xl border flex items-center justify-between mb-6 ${
                    isDanger ? 'bg-rose-50 border-rose-200 text-rose-900 animate-pulse' : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}>
                    <div className="flex items-center gap-3">
                      <Clock className={`w-5 h-5 ${isDanger ? 'text-rose-600' : 'text-amber-600'}`} />
                      <div>
                        <p className="font-bold text-sm">Hạn cập nhật thông tin khách hàng</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
                      isDanger ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
                    }`}>
                      {formatted}
                    </span>
                  </div>
                );
              })()}

              <section>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cập nhật thông tin</h4>
                </div>
                {(() => {
                  const currentChainParts: string[] = [];
                  if (selectedLead.status && selectedLead.status !== 'Chưa liên hệ') {
                    currentChainParts.push(selectedLead.status);
                    if (selectedLead.subStatus) currentChainParts.push(selectedLead.subStatus);
                    if (selectedLead.appointmentStatus) currentChainParts.push(selectedLead.appointmentStatus);
                    if (selectedLead.resultStatus) currentChainParts.push(selectedLead.resultStatus);
                  } else if (selectedLead.subStatus) {
                    currentChainParts.push(selectedLead.status || 'Chưa liên hệ');
                    currentChainParts.push(selectedLead.subStatus);
                    if (selectedLead.appointmentStatus) currentChainParts.push(selectedLead.appointmentStatus);
                    if (selectedLead.resultStatus) currentChainParts.push(selectedLead.resultStatus);
                  }

                  const hasCustomStatus = currentChainParts.length > 0;
                  const updateCount = getStatusUpdateCount(selectedLead.history);
                  const nextUpdateNumber = updateCount + 1;

                  // 1. Nếu chưa từng cập nhật hoặc trạng thái 'Chưa liên hệ'
                  if (!hasCustomStatus || selectedLead.status === 'Chưa liên hệ') {
                    return (
                      <button
                        type="button"
                        onClick={handleOpenStatusModal}
                        className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-xs md:text-sm shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 group mb-4 cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4 transition-transform group-hover:scale-110" />
                        <span>Cập nhật thông tin {updateCount > 0 ? `(Lần ${nextUpdateNumber})` : ''}</span>
                      </button>
                    );
                  }

                  // 2. Nếu trạng thái là 'Không liên hệ được' -> Hiện button Cập nhật trạng thái lần X
                  if (selectedLead.status === 'Không liên hệ được') {
                    return (
                      <button
                        type="button"
                        onClick={handleOpenStatusModal}
                        className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold text-xs md:text-sm shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 group mb-4 cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4 transition-transform group-hover:scale-110" />
                        <span>Cập nhật trạng thái lần {nextUpdateNumber}</span>
                        {selectedLead.subStatus && (
                          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md font-medium">
                            (Hiện tại: {selectedLead.subStatus})
                          </span>
                        )}
                      </button>
                    );
                  }

                  // 3. Nếu trạng thái 'Đã liên hệ' (hoặc đã có các bước chi tiết) -> Thẻ nhỏ gọn trên 1 dòng
                  return (
                    <div 
                      onClick={handleOpenStatusModal}
                      className="w-full px-3 py-2 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 rounded-xl transition-all cursor-pointer group mb-4 flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="flex items-center gap-1 min-w-0 overflow-x-auto scrollbar-hide py-0.5">
                        {currentChainParts.map((part, idx) => (
                          <React.Fragment key={idx}>
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold shrink-0 whitespace-nowrap ${
                              idx === 0 
                                ? 'bg-emerald-600 text-white shadow-2xs' 
                                : idx === 1 
                                ? 'bg-blue-600 text-white shadow-2xs' 
                                : idx === 2 
                                ? 'bg-indigo-600 text-white shadow-2xs' 
                                : 'bg-purple-600 text-white shadow-2xs'
                            }`}>
                              {part}
                            </span>
                            {idx < currentChainParts.length - 1 && (
                              <span className="text-slate-300 font-bold text-[10px] shrink-0">›</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 shrink-0 group-hover:underline pl-1 border-l border-slate-200">
                        <Edit3 className="w-3 h-3" />
                        <span>Thay đổi</span>
                      </div>
                    </div>
                  );
                })()}
              </section>

              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <History className="w-4 h-4" /> Lịch sử trao đổi
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowInfoModal(true)}
                    title="Xem thông tin hệ thống & Người phụ trách"
                    className="p-1 rounded-full text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all cursor-pointer flex items-center justify-center"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>

                {/* Input Trao Đổi Đặt Ở Đầu Danh Sách */}
                <div className="flex gap-2 mb-3">
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
                        setSelectedLead(prev => prev ? { ...prev, history: updatedHistory } : null);
                        setNewNote('');
                      }
                    }}
                    placeholder="Nhập nội dung trao đổi..."
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm shadow-2xs bg-white"
                  />
                  <button 
                    onClick={async () => {
                      if (!newNote.trim()) return;
                      const timestamp = new Date().toLocaleString('vi-VN');
                      const username = user.displayName || user.email;
                      const entry = `[NOTE][${timestamp}] ${username}: ${newNote.trim()}`;
                      const updatedHistory = [...(selectedLead.history || []), entry];
                      await updateLead(selectedLead.id, { history: updatedHistory }, user.email);
                      setSelectedLead(prev => prev ? { ...prev, history: updatedHistory } : null);
                      setNewNote('');
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all cursor-pointer shadow-sm shadow-emerald-200"
                  >
                    Gửi
                  </button>
                </div>

                {/* Danh Sách Timeline */}
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {(selectedLead.history || []).slice().reverse().map((entry, i) => {
                    const isNote = entry.startsWith('[NOTE]');
                    const isLog = entry.startsWith('[LOG]');
                    const cleanEntry = entry.replace(/^\[(NOTE|LOG)\]/, '');
                    
                    const parts = cleanEntry.match(/^\[(.*?)\] (.*?): (.*)$/);
                    const timeStr = parts ? parts[1] : '';
                    const actorStr = parts ? parts[2] : 'Hệ thống';
                    const contentStr = parts ? parts[3] : cleanEntry;

                    const isRevoked = entry.toLowerCase().includes('thu hồi') || entry.toLowerCase().includes('quá hạn');
                    const isAssignee = entry.includes('Người phụ trách:') || entry.includes('Giao khách hàng');
                    const isExpanded = Boolean(expandedHistoryIndices[i]);

                    // 1. Thẻ Đã thu hồi vì quá hạn (Badge xám nhạt nhỏ gọn 1 dòng)
                    if (isRevoked) {
                      return (
                        <div 
                          key={i} 
                          onClick={() => setExpandedHistoryIndices(prev => ({ ...prev, [i]: !prev[i] }))}
                          className="bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-lg px-2.5 py-1.5 transition-all cursor-pointer select-none text-xs text-slate-600 shadow-2xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-medium text-slate-700 truncate">
                                Đã thu hồi
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
                              {timeStr && <span className="text-[10px] opacity-75 font-mono hidden sm:inline">{timeStr}</span>}
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-600 space-y-1">
                              <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium">
                                <span>Thực hiện: <strong>{actorStr}</strong></span>
                                <span>Thời gian: {timeStr}</span>
                              </div>
                              <p className="italic text-slate-700 bg-white p-2 rounded-lg border border-slate-200/60">
                                {contentStr}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    }

                    // 2. Thẻ Người phụ trách (Badge xám nhạt nhỏ gọn 1 dòng)
                    if (isAssignee) {
                      let compactAssigneeText = 'Chưa phân công';
                      const cleanRaw = contentStr.replace(/^Người phụ trách:\s*/i, '').trim();
                      if (cleanRaw && !cleanRaw.toLowerCase().includes('chưa phân công')) {
                        const match = cleanRaw.match(/^([^(]+)(?:\s*\(.*?\))?$/);
                        const name = match ? match[1].trim() : cleanRaw;
                        compactAssigneeText = `${name} phụ trách`;
                      }

                      return (
                        <div 
                          key={i} 
                          onClick={() => setExpandedHistoryIndices(prev => ({ ...prev, [i]: !prev[i] }))}
                          className="bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-lg px-2.5 py-1.5 transition-all cursor-pointer select-none text-xs text-slate-600 shadow-2xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-medium text-slate-700 truncate">
                                {compactAssigneeText}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
                              {timeStr && <span className="text-[10px] opacity-75 font-mono hidden sm:inline">{timeStr}</span>}
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-600 space-y-1">
                              <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium">
                                <span>Người giao: <strong>{actorStr}</strong></span>
                                <span>Thời gian: {timeStr}</span>
                              </div>
                              <p className="italic text-slate-700 bg-white p-2 rounded-lg border border-slate-200/60">
                                {contentStr.startsWith('Người phụ trách:') ? contentStr : `Người phụ trách: ${contentStr}`}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    }

                    // 3. Các thẻ khác (Ghi chú / Cập nhật trạng thái thông thường)
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
                          <p className="text-sm text-slate-700 leading-relaxed italic">{parts[3]}</p>
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
      )}

      {/* Update Status Modal */}
      {showStatusModal && selectedLead && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Cập nhật thông tin</h3>
                  <p className="text-xs text-slate-500 font-medium">{selectedLead.customerName} - {selectedLead.phone}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowStatusModal(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="py-4 space-y-4 overflow-y-auto flex-1 pr-1">
              {/* Select 1: Trạng thái */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  1. Trạng thái <span className="text-rose-500">*</span>
                </label>
                <select
                  value={statusForm.status}
                  onChange={(e) => {
                    const nextStatus = e.target.value;
                    setStatusForm({
                      ...statusForm,
                      status: nextStatus,
                      subStatus: '',
                      appointmentStatus: '',
                      resultStatus: ''
                    });
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-xs text-sm"
                >
                  <option value="">-- Vui lòng chọn trạng thái --</option>
                  <option value="Không liên hệ được">Không liên hệ được</option>
                  <option value="Đã liên hệ">Đã liên hệ</option>
                </select>
              </div>

              {/* Select 2: Chi tiết trạng thái */}
              {statusForm.status && subStatuses[statusForm.status as keyof typeof subStatuses] && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    2. Chi tiết trạng thái <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={statusForm.subStatus}
                    onChange={(e) => {
                      const nextSub = e.target.value;
                      setStatusForm({
                        ...statusForm,
                        subStatus: nextSub,
                        appointmentStatus: '',
                        resultStatus: ''
                      });
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-xs text-sm"
                  >
                    <option value="">-- Vui lòng chọn chi tiết trạng thái --</option>
                    {subStatuses[statusForm.status as keyof typeof subStatuses].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Select 3: Hẹn khách (chỉ khi Đã liên hệ -> Đang tư vấn) */}
              {statusForm.status === 'Đã liên hệ' && statusForm.subStatus === 'Đang tư vấn' && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    3. Hẹn khách <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={statusForm.appointmentStatus}
                    onChange={(e) => {
                      setStatusForm({
                        ...statusForm,
                        appointmentStatus: e.target.value,
                        resultStatus: ''
                      });
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-xs text-sm"
                  >
                    <option value="">-- Vui lòng chọn trạng thái hẹn --</option>
                    {appointmentOptions.map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Select 4: Kết quả (chỉ khi Đã liên hệ -> Đang tư vấn -> đã chọn Hẹn khách) */}
              {statusForm.status === 'Đã liên hệ' && statusForm.subStatus === 'Đang tư vấn' && statusForm.appointmentStatus && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    4. Kết quả <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={statusForm.resultStatus}
                    onChange={(e) => {
                      setStatusForm({
                        ...statusForm,
                        resultStatus: e.target.value
                      });
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-xs text-sm"
                  >
                    <option value="">-- Vui lòng chọn kết quả --</option>
                    {resultOptions.map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Ghi chú Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Ghi chú trao đổi <span className="text-slate-400 font-normal normal-case">(Tùy chọn)</span>
                </label>
                <textarea
                  rows={3}
                  value={statusForm.note}
                  onChange={(e) => setStatusForm({ ...statusForm, note: e.target.value })}
                  placeholder="Nhập nội dung trao đổi hoặc ghi chú cho lần cập nhật này..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm resize-none"
                />
              </div>

              {/* Chuỗi tóm tắt Preview */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Lịch sử sẽ ghi nhận:</p>
                <p className="text-xs font-medium text-slate-700 break-words">
                  Cập nhật trạng thái LẦN {getStatusUpdateCount(selectedLead.history) + 1} "{[
                    statusForm.status,
                    statusForm.subStatus,
                    statusForm.appointmentStatus,
                    statusForm.resultStatus
                  ].filter(Boolean).join(' > ')}"
                  {statusForm.note.trim() ? ` (note: ${statusForm.note.trim()})` : ''}
                </p>
              </div>

              {/* Warning if incomplete */}
              {!isStatusFormValid() && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Vui lòng chọn đầy đủ thông tin của tất cả các bước để có thể lưu.</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={!isStatusFormValid() || isSavingStatus}
                onClick={handleSaveStatusModal}
                className={`px-5 py-2.5 text-sm font-bold text-white rounded-xl shadow-md transition-all flex items-center gap-2 ${
                  !isStatusFormValid() || isSavingStatus
                    ? 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none'
                    : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-emerald-200'
                }`}
              >
                {isSavingStatus ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Xác nhận & Lưu</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* System Info / Assignment Modal */}
      {showInfoModal && selectedLead && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-4"
          >
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Thông tin hệ thống & Giao việc</h3>
                  <p className="text-xs text-slate-500 font-medium">{selectedLead.customerName} • {selectedLead.phone}</p>
                </div>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Content */}
            <div className="space-y-3.5 py-1">
              {/* Người tạo và thời gian tạo */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Người tạo & Thời gian tạo</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                    {selectedLead.creatorEmail ? selectedLead.creatorEmail[0].toUpperCase() : '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {staff.find(s => s.email.toLowerCase() === selectedLead.creatorEmail?.toLowerCase())?.displayName || selectedLead.creatorEmail}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {selectedLead.creatorEmail} • {new Date(selectedLead.createdAt).toLocaleString('vi-VN')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Người phụ trách hiện tại */}
              <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-2">Người phụ trách (hiện tại)</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-200 rounded-full flex items-center justify-center text-xs font-bold text-emerald-800 shrink-0">
                    {selectedLead.assignedToEmail ? selectedLead.assignedToEmail[0].toUpperCase() : '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {selectedLead.assignedToEmail 
                        ? (staff.find(s => s.email.toLowerCase() === selectedLead.assignedToEmail?.toLowerCase())?.displayName || selectedLead.assignedToEmail)
                        : 'Chưa phân công'}
                    </p>
                    <p className="text-xs text-slate-600 truncate">
                      {selectedLead.assignedToEmail 
                        ? `${selectedLead.assignedToEmail}${selectedLead.assignedAt ? ` • Giao lúc: ${new Date(selectedLead.assignedAt).toLocaleString('vi-VN')}` : ''}`
                        : 'Chưa phân công cho nhân viên nào'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Thông tin phụ: Dự án & Phòng ban */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Dự án quan tâm</p>
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    {projects.find(p => p.id === selectedLead.projectId)?.name || 'Chưa gắn dự án'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phòng ban</p>
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    {departments.find(d => d.id === selectedLead.departmentId)?.name || 'Chưa có phòng ban'}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Export Excel Modal with Date Range Selection */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100"
          >
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Xuất báo cáo Excel</h3>
                  <p className="text-xs text-slate-500">Lọc dữ liệu theo thời gian phát hành</p>
                </div>
              </div>
              <button 
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Date Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Từ ngày</label>
                  <input 
                    type="date" 
                    value={exportStartDate}
                    onChange={e => {
                      setExportStartDate(e.target.value);
                      setPresetSelected('');
                    }}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Đến ngày</label>
                  <input 
                    type="date" 
                    value={exportEndDate}
                    onChange={e => {
                      setExportEndDate(e.target.value);
                      setPresetSelected('');
                    }}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Quick Selection Preset Tags */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Chọn nhanh khoảng thời gian:</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applyPreset('3days')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      presetSelected === '3days'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                    }`}
                  >
                    3 ngày
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('7days')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      presetSelected === '7days'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                    }`}
                  >
                    7 ngày
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('30days')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      presetSelected === '30days'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                    }`}
                  >
                    30 ngày
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('month')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      presetSelected === 'month'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                    }`}
                  >
                    Tháng hiện tại
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('all')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      presetSelected === 'all'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                    }`}
                  >
                    Tất cả thời gian
                  </button>
                </div>
              </div>

              {/* Record count preview */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col gap-1 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Phạm vi áp dụng:</span>
                  <span className="font-bold text-emerald-700">
                    Tab: {currentTab} {selectedProjectId ? `· ${projects.find(p => p.id === selectedProjectId)?.abbreviation || 'Dự án'}` : ''}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 italic mt-0.5">
                  Dữ liệu sẽ được lọc đầy đủ theo thời gian, bộ lọc dự án/nhân viên và phân quyền ({getRoleName(user.role)}).
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                disabled={isExporting}
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isExporting}
                onClick={handleConfirmExport}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-semibold text-sm transition-all shadow-md shadow-emerald-100 disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang tạo tệp Excel...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Xác nhận xuất Excel</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Searchable Picker Modal for Create Lead Form */}
      {searchPickerModal.type && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-md w-full p-4 md:p-5 shadow-2xl border border-slate-100 flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Search className="w-4 h-4 text-emerald-600" />
                {searchPickerModal.type === 'project' && 'Chọn dự án quan tâm'}
                {searchPickerModal.type === 'department' && 'Chọn nhánh phòng ban'}
                {searchPickerModal.type === 'staff' && 'Chọn nhân viên phụ trách'}
              </h3>
              <button onClick={() => setSearchPickerModal({ type: null, searchTerm: '' })} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                autoFocus
                placeholder="Gõ từ khóa để tìm kiếm..."
                value={searchPickerModal.searchTerm}
                onChange={e => setSearchPickerModal(prev => ({ ...prev, searchTerm: e.target.value }))}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* List Items */}
            <div className="overflow-y-auto space-y-1.5 flex-1 pr-1">
              {searchPickerModal.type === 'project' && (
                projects
                  .filter(p => p.name.toLowerCase().includes(searchPickerModal.searchTerm.toLowerCase()) || p.abbreviation.toLowerCase().includes(searchPickerModal.searchTerm.toLowerCase()))
                  .map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setNewLead(prev => ({ ...prev, projectId: p.id }));
                        setSearchPickerModal({ type: null, searchTerm: '' });
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                        newLead.projectId === p.id ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold' : 'border-slate-100 hover:border-emerald-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-sm">{p.name}</p>
                        <p className="text-xs text-slate-500">Mã: {p.abbreviation}</p>
                      </div>
                      {newLead.projectId === p.id && <Check className="w-4 h-4 text-emerald-600" />}
                    </button>
                  ))
              )}

              {searchPickerModal.type === 'department' && (
                allowedDepartments
                  .filter(d => {
                    const path = getDepartmentPath(d.id);
                    if (path === 'Tổng sàn' || path === 'Tổng sàn > Admin' || path === 'Tổng sàn > admin') return false;
                    return path.toLowerCase().includes(searchPickerModal.searchTerm.toLowerCase());
                  })
                  .map(d => {
                    const path = getDepartmentPath(d.id);
                    const isSel = selectedAssignDeptId === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setSelectedAssignDeptId(d.id);
                          setNewLead(prev => ({ ...prev, assignedToEmail: '' }));
                          setSearchPickerModal({ type: null, searchTerm: '' });
                        }}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                          isSel ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold' : 'border-slate-100 hover:border-emerald-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <p className="font-medium text-xs leading-relaxed">{path}</p>
                        {isSel && <Check className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />}
                      </button>
                    );
                  })
              )}

              {searchPickerModal.type === 'staff' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setNewLead(prev => ({ ...prev, assignedToEmail: '' }));
                      setSearchPickerModal({ type: null, searchTerm: '' });
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                      !newLead.assignedToEmail ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <p className="font-semibold text-sm italic">Không giao cho ai (Để trống)</p>
                    {!newLead.assignedToEmail && <Check className="w-4 h-4 text-amber-600" />}
                  </button>
                  {assignableStaff
                    .filter(s => s.displayName.toLowerCase().includes(searchPickerModal.searchTerm.toLowerCase()) || s.email.toLowerCase().includes(searchPickerModal.searchTerm.toLowerCase()))
                    .map(s => {
                      const isSel = newLead.assignedToEmail === s.email;
                      return (
                        <button
                          key={s.uid}
                          type="button"
                          onClick={() => {
                            setNewLead(prev => ({ ...prev, assignedToEmail: s.email }));
                            setSearchPickerModal({ type: null, searchTerm: '' });
                          }}
                          className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                            isSel ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold' : 'border-slate-100 hover:border-emerald-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div>
                            <p className="font-semibold text-sm">{s.displayName}</p>
                            <p className="text-xs text-slate-500">{s.email} • {getRoleName(s.role)}</p>
                          </div>
                          {isSel && <Check className="w-4 h-4 text-emerald-600" />}
                        </button>
                      );
                    })}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
