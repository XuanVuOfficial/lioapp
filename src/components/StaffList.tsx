import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, UserPlus, Mail, User, Briefcase, Shield, Trash2, Edit2, X, Check, Lock, Info, Upload } from 'lucide-react';
import { UserProfile, Department, UserRole } from '../types';
import { createStaffAccount, updateUserRole, deleteUser, updateUserProfile } from '../services/userService';
import { updateDepartment } from '../services/departmentService';
import { getAppSettings } from '../services/settingsService';

interface Props {
  users: UserProfile[];
  departments: Department[];
  currentUser: UserProfile;
}

export const StaffList: React.FC<Props> = ({ users, departments, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [infoUser, setInfoUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    displayName: '',
    password: '',
    role: 'staff' as UserRole,
    departmentId: '',
    avatarUrl: ''
  });

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const [selectedFloorId, setSelectedFloorId] = useState<string>('');

  const [selectedFloorIdEdit, setSelectedFloorIdEdit] = useState<string>('');

  const floors = departments.filter(d => d.level === 2);
  const rooms = departments.filter(d => d.level === 3 && (selectedFloorId ? d.parentId === selectedFloorId : true));
  const roomsEdit = departments.filter(d => d.level === 3 && (selectedFloorIdEdit ? d.parentId === selectedFloorIdEdit : true));
  const adminDepts = departments.filter(d => d.level === 1);
  const tgdDepts = departments.filter(d => d.level === 0);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Vui lòng chọn ảnh nhỏ hơn 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isEdit) {
          setEditingUser(prev => prev ? ({ ...prev, avatarUrl: reader.result as string }) : null);
        } else {
          setNewUser(prev => ({ ...prev, avatarUrl: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = async () => {
    if (!newUser.email || !newUser.displayName || !newUser.password) {
      alert('Vui lòng điền đầy đủ thông tin và mật khẩu');
      return;
    }

    if (users.some(u => u.email.toLowerCase() === newUser.email.toLowerCase())) {
      alert('Email này đã tồn tại trong hệ thống');
      return;
    }

    if (!newUser.departmentId) {
      let deptName = 'phòng ban';
      if (newUser.role === 'tgd') deptName = 'cấp Tổng sàn';
      if (newUser.role === 'admin') deptName = 'nhóm Admin';
      if (newUser.role === 'gds') deptName = 'sàn';
      if (newUser.role === 'tp' || newUser.role === 'staff') deptName = 'phòng';
      
      alert(`Vui lòng chọn ${deptName} cho nhân viên`);
      return;
    }
    
    setIsLoading(true);
    try {
      const settings = await getAppSettings();
      if (settings.roleLimits && settings.roleLimits[newUser.role]) {
        const limit = settings.roleLimits[newUser.role] as number;
        const currentCount = users.filter(u => u.departmentId === newUser.departmentId && u.role === newUser.role).length;
        if (currentCount >= limit) {
          alert(`Phòng ban này đã đạt giới hạn tối đa ${limit} nhân sự ở vai trò này.`);
          setIsLoading(false);
          return;
        }
      }

      await createStaffAccount({
        email: newUser.email,
        displayName: newUser.displayName,
        role: newUser.role,
        departmentId: newUser.departmentId || undefined,
        createdAt: Date.now(),
        createdBy: currentUser.email,
        updatedAt: Date.now(),
        avatarUrl: newUser.avatarUrl || undefined,
        mustChangePassword: true
      }, newUser.password);
      
      // If a management role was assigned, update the department's manager info
      if (newUser.departmentId && newUser.role !== 'staff') {
        await updateDepartment(newUser.departmentId, {
          managerEmail: newUser.email,
          managerName: newUser.displayName
        });
      }

      setShowAddModal(false);
      setNewUser({ email: '', displayName: '', password: '', role: 'staff', departmentId: '', avatarUrl: '' });
      setSelectedFloorId('');
    } catch (error: any) {
      alert('Lỗi khi tạo tài khoản: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    
    setIsLoading(true);
    try {
      const settings = await getAppSettings();
      
      // Check limits if role or department changed
      if (
        (editingUser.role !== users.find(u => u.uid === editingUser.uid)?.role || 
         editingUser.departmentId !== users.find(u => u.uid === editingUser.uid)?.departmentId) &&
         settings.roleLimits && settings.roleLimits[editingUser.role]
      ) {
        const limit = settings.roleLimits[editingUser.role] as number;
        // count existing users in that department with that role
        // exclude the current user from the count
        const currentCount = users.filter(u => u.departmentId === editingUser.departmentId && u.role === editingUser.role && u.uid !== editingUser.uid).length;
        if (currentCount >= limit) {
          alert(`Phòng ban này đã đạt giới hạn tối đa ${limit} nhân sự ở vai trò này.`);
          setIsLoading(false);
          return;
        }
      }

      const updates: Partial<UserProfile> = {
        displayName: editingUser.displayName,
        role: editingUser.role,
        departmentId: editingUser.departmentId || undefined,
        updatedAt: Date.now(),
        avatarUrl: editingUser.avatarUrl || undefined
      };
      if (editingUser.password) {
        updates.password = editingUser.password;
        updates.mustChangePassword = true;
      }
      
      await updateUserProfile(editingUser.uid, updates);
      
      // If updating a manager, sync department info
      if (editingUser.departmentId && editingUser.role !== 'staff') {
        await updateDepartment(editingUser.departmentId, {
          managerName: editingUser.displayName
        });
      }
      setEditingUser(null);
    } catch (error: any) {
      alert('Lỗi khi cập nhật tài khoản: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getDeptName = (id?: string) => {
    return departments.find(d => d.id === id)?.name || 'Chưa phân phối';
  };

  const getSystemRole = (role: UserRole) => {
    switch (role) {
      case 'tgd': return 'Tổng giám đốc';
      case 'admin': return 'Admin';
      case 'gds': return 'Giám đốc sàn';
      case 'tp': return 'Trưởng phòng';
      case 'staff': return 'Nhân viên';
      default: return 'Không xác định';
    }
  };

  const renderDepartmentPath = (dept: Department) => {
    const path: Department[] = [];
    let currentDept: Department | undefined = dept;
    while (currentDept) {
      path.unshift(currentDept);
      currentDept = departments.find(d => d.id === currentDept?.parentId);
    }

    return (
      <div className="flex flex-wrap items-center gap-1 py-0.5">
        {path.map((p, index) => (
          <React.Fragment key={p.id}>
            {index > 0 && <span className="text-slate-400 font-bold text-[10px]">&gt;</span>}
            <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border ${
              p.level === 0 ? 'bg-red-50 text-red-700 border-red-200' :
              p.level === 1 ? 'bg-purple-50 text-purple-700 border-purple-200' :
              p.level === 2 ? 'bg-blue-50 text-blue-700 border-blue-200' :
              'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {p.name}
            </span>
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderDetailedRoles = (user: UserProfile) => {
    const roleNodes: React.ReactNode[] = [];
    
    // Tìm các phòng ban mà user là quản lý (dựa trên email)
    const managedDepts = departments.filter(d => d.managerEmail === user.email);
    managedDepts.forEach((d, i) => {
      roleNodes.push(
        <div key={`managed-${d.id}-${i}`}>
          {renderDepartmentPath(d)}
        </div>
      );
    });

    // Tìm phòng ban mà user là nhân viên (nếu chưa được liệt kê là quản lý)
    const staffDept = departments.find(d => d.id === user.departmentId);
    if (staffDept && !managedDepts.some(d => d.id === staffDept.id)) {
      roleNodes.push(
        <div key={`staff-${staffDept.id}`}>
          {renderDepartmentPath(staffDept)}
        </div>
      );
    }

    if (roleNodes.length === 0) {
      return <span className="text-sm font-medium text-slate-500 italic">Chưa phân bổ</span>;
    }

    return <div className="flex flex-col gap-1.5">{roleNodes}</div>;
  };

  const canEdit = (targetUser: UserProfile) => {
    if (currentUser.role === 'tgd') return true;
    if (currentUser.role === 'admin') {
      // Admin cannot edit other Admins or TGD
      return !['tgd', 'admin'].includes(targetUser.role);
    }
    return false; // Only TGĐ and Admin can add/edit/delete staff as per request
  };

  const canDelete = (targetUser: UserProfile) => {
    if (targetUser.uid === currentUser.uid) return false;
    if (currentUser.role === 'tgd') return true;
    if (currentUser.role === 'admin') {
      return !['tgd', 'admin'].includes(targetUser.role);
    }
    return false;
  };

  const handleShowAddModal = () => {
    setNewUser({
      email: '',
      displayName: '',
      password: '',
      role: 'staff' as UserRole,
      departmentId: currentUser.role === 'tp' ? (currentUser.departmentId || '') : '',
      avatarUrl: ''
    });
    setShowAddModal(true);
  };

  const handleShowEditModal = (user: UserProfile) => {
    let floorId = '';
    if (['staff', 'tp'].includes(user.role)) {
      const room = departments.find(d => d.id === user.departmentId);
      if (room && room.parentId) {
        floorId = room.parentId;
      }
    } else if (user.role === 'gds') {
      floorId = user.departmentId || '';
    }
    
    setSelectedFloorIdEdit(floorId);
    setEditingUser({ ...user, password: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Danh sách nhân viên</h2>
        <button 
          onClick={handleShowAddModal}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-semibold transition-all shadow-lg shadow-emerald-100"
        >
          <UserPlus className="w-4 h-4" />
          Thêm nhân viên
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-bottom border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm kiếm nhân viên..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Nhân viên</th>
                <th className="px-6 py-4 font-semibold">Vai trò hệ thống</th>
                <th className="px-6 py-4 font-semibold">Vai trò đang tham gia</th>
                <th className="px-6 py-4 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map(user => (
                <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold overflow-hidden shrink-0">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          user.displayName[0]?.toUpperCase() || 'U'
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{user.displayName}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                      user.role === 'tgd' ? 'bg-red-50 text-red-700' :
                      user.role === 'admin' ? 'bg-purple-50 text-purple-700' :
                      user.role === 'gds' ? 'bg-blue-50 text-blue-700' :
                      user.role === 'tp' ? 'bg-amber-50 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      <Shield className="w-3 h-3" />
                      {getSystemRole(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 align-top">
                    {renderDetailedRoles(user)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setInfoUser(user)}
                        title="Thông tin hệ thống"
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                      {canEdit(user) && (
                        <button 
                          onClick={() => handleShowEditModal(user)}
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete(user) && (
                        <button 
                          onClick={() => {
                            if (window.confirm('Bạn có chắc chắn muốn xóa nhân viên này?')) {
                              deleteUser(user.uid);
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile List */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredUsers.map(user => (
            <div key={user.uid} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold shrink-0 overflow-hidden">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      user.displayName[0]?.toUpperCase() || 'U'
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{user.displayName}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => setInfoUser(user)}
                    title="Thông tin hệ thống"
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                  {canEdit(user) && (
                    <button 
                      onClick={() => handleShowEditModal(user)}
                      className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {canDelete(user) && (
                    <button 
                      onClick={() => {
                        if (window.confirm('Bạn có chắc chắn muốn xóa nhân viên này?')) {
                          deleteUser(user.uid);
                        }
                      }}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                    user.role === 'tgd' ? 'bg-red-50 text-red-700' :
                    user.role === 'admin' ? 'bg-purple-50 text-purple-700' :
                    user.role === 'gds' ? 'bg-blue-50 text-blue-700' :
                    user.role === 'tp' ? 'bg-amber-50 text-amber-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    <Shield className="w-3 h-3" />
                    {getSystemRole(user.role)}
                  </span>
                </div>
                <div className="pl-1 mt-2">
                  {renderDetailedRoles(user)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-slate-200"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-900">Thêm nhân viên mới</h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {newUser.avatarUrl ? (
                        <img src={newUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <User className="w-10 h-10 text-slate-300" />
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 w-8 h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full flex items-center justify-center cursor-pointer shadow-sm transition-all border-2 border-white">
                      <Upload className="w-4 h-4" />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, false)} />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Họ và tên</label>
                  <input 
                    type="text" 
                    value={newUser.displayName}
                    onChange={e => setNewUser(prev => ({ ...prev, displayName: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="vd: Nguyễn Văn A"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input 
                    type="email" 
                    value={newUser.email}
                    onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="vd: nhânvien@congty.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu truy cập *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="password" 
                      value={newUser.password}
                      onChange={e => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="Nhập mật khẩu cho nhân viên"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cấp bậc / Phân quyền</label>
                  <select 
                    value={newUser.role}
                    onChange={e => {
                      const role = e.target.value as UserRole;
                      setNewUser(prev => ({ ...prev, role, departmentId: '' }));
                      setSelectedFloorId('');
                    }}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  >
                    <option value="staff">Nhân viên sale</option>
                    <option value="tp">Trưởng phòng kinh doanh</option>
                    <option value="gds">Giám đốc sàn</option>
                    {currentUser.role === 'tgd' && (
                      <>
                        <option value="admin">Admin</option>
                        <option value="tgd">Tổng giám đốc</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Sàn Selection */}
                {['staff', 'tp', 'gds'].includes(newUser.role) && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Thuộc sàn</label>
                    <select 
                      value={selectedFloorId || (newUser.role === 'gds' ? newUser.departmentId : '')}
                      onChange={e => {
                        const floorId = e.target.value;
                        setSelectedFloorId(floorId);
                        if (newUser.role === 'gds') {
                          setNewUser(prev => ({ ...prev, departmentId: floorId }));
                        } else {
                          setNewUser(prev => ({ ...prev, departmentId: '' }));
                        }
                      }}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    >
                      <option value="">Chọn sàn</option>
                      {floors.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Phòng Selection */}
                {['staff', 'tp'].includes(newUser.role) && selectedFloorId && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Thuộc phòng</label>
                    <select 
                      value={newUser.departmentId}
                      onChange={e => setNewUser(prev => ({ ...prev, departmentId: e.target.value }))}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    >
                      <option value="">Chọn phòng</option>
                      {rooms.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Admin Group Selection */}
                {newUser.role === 'admin' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nhóm Admin</label>
                    <select 
                      value={newUser.departmentId}
                      onChange={e => setNewUser(prev => ({ ...prev, departmentId: e.target.value }))}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    >
                      <option value="">Chọn nhóm admin</option>
                      {adminDepts.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* TGD Group Selection */}
                {newUser.role === 'tgd' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cấp Tổng sàn</label>
                    <select 
                      value={newUser.departmentId}
                      onChange={e => setNewUser(prev => ({ ...prev, departmentId: e.target.value }))}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    >
                      <option value="">Chọn cấp tổng sàn</option>
                      {tgdDepts.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}
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
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : null}
                  Tạo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-slate-200"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-900">Chỉnh sửa nhân viên</h3>
                <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {editingUser.avatarUrl ? (
                        <img src={editingUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <User className="w-10 h-10 text-slate-300" />
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 w-8 h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full flex items-center justify-center cursor-pointer shadow-sm transition-all border-2 border-white">
                      <Upload className="w-4 h-4" />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, true)} />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <p className="text-slate-500 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">{editingUser.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Họ và tên</label>
                  <input 
                    type="text" 
                    value={editingUser.displayName}
                    onChange={e => setEditingUser(prev => prev ? ({ ...prev, displayName: e.target.value }) : null)}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="vd: Nguyễn Văn A"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu mới (bỏ trống nếu không đổi)</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="password" 
                      value={editingUser.password || ''}
                      onChange={e => setEditingUser(prev => prev ? ({ ...prev, password: e.target.value }) : null)}
                      className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="Nhập mật khẩu mới"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cấp bậc / Phân quyền</label>
                  <select 
                    value={editingUser.role}
                    onChange={e => {
                      const role = e.target.value as UserRole;
                      setEditingUser(prev => prev ? ({ ...prev, role, departmentId: '' }) : null);
                      setSelectedFloorIdEdit('');
                    }}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  >
                    <option value="staff">Nhân viên sale</option>
                    <option value="tp">Trưởng phòng kinh doanh</option>
                    <option value="gds">Giám đốc sàn</option>
                    {currentUser.role === 'tgd' && (
                      <>
                        <option value="admin">Admin</option>
                        <option value="tgd">Tổng giám đốc</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Sàn Selection */}
                {['staff', 'tp', 'gds'].includes(editingUser.role) && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Thuộc sàn</label>
                    <select 
                      value={selectedFloorIdEdit || (editingUser.role === 'gds' ? editingUser.departmentId : '')}
                      onChange={e => {
                        const floorId = e.target.value;
                        setSelectedFloorIdEdit(floorId);
                        if (editingUser.role === 'gds') {
                          setEditingUser(prev => prev ? ({ ...prev, departmentId: floorId }) : null);
                        } else {
                          setEditingUser(prev => prev ? ({ ...prev, departmentId: '' }) : null);
                        }
                      }}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    >
                      <option value="">Chọn sàn</option>
                      {floors.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Phòng Selection */}
                {['staff', 'tp'].includes(editingUser.role) && selectedFloorIdEdit && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Thuộc phòng</label>
                    <select 
                      value={editingUser.departmentId || ''}
                      onChange={e => setEditingUser(prev => prev ? ({ ...prev, departmentId: e.target.value }) : null)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    >
                      <option value="">Chọn phòng</option>
                      {roomsEdit.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Admin Group Selection */}
                {editingUser.role === 'admin' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nhóm Admin</label>
                    <select 
                      value={editingUser.departmentId || ''}
                      onChange={e => setEditingUser(prev => prev ? ({ ...prev, departmentId: e.target.value }) : null)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    >
                      <option value="">Chọn nhóm admin</option>
                      {adminDepts.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* TGD Group Selection */}
                {editingUser.role === 'tgd' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cấp Tổng sàn</label>
                    <select 
                      value={editingUser.departmentId || ''}
                      onChange={e => setEditingUser(prev => prev ? ({ ...prev, departmentId: e.target.value }) : null)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    >
                      <option value="">Chọn cấp tổng sàn</option>
                      {tgdDepts.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setEditingUser(null)}
                  className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold transition-all"
                >
                  Hủy
                </button>
                <button 
                  onClick={handleUpdate}
                  className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all shadow-lg shadow-emerald-100"
                >
                  Lưu thay đổi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Info Modal */}
      <AnimatePresence>
        {infoUser && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 border border-slate-200"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-900">Thông tin hệ thống</h3>
                <button onClick={() => setInfoUser(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex flex-col items-center mb-6 text-center">
                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold overflow-hidden shrink-0 border-4 border-white shadow-md mb-3">
                  {infoUser.avatarUrl ? (
                    <img src={infoUser.avatarUrl} alt={infoUser.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-2xl">{infoUser.displayName[0]?.toUpperCase() || 'U'}</span>
                  )}
                </div>
                <h4 className="font-bold text-lg text-slate-900">{infoUser.displayName}</h4>
                <p className="text-sm text-slate-500">{infoUser.email}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Ngày tạo</p>
                  <p className="text-slate-900 font-medium">
                    {infoUser.createdAt ? new Date(infoUser.createdAt).toLocaleString('vi-VN') : 'Không có thông tin'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tạo bởi (Email)</p>
                  <p className="text-slate-900 font-medium">
                    {infoUser.createdBy || 'Không có thông tin'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Ngày cập nhật gần nhất</p>
                  <p className="text-slate-900 font-medium">
                    {infoUser.updatedAt ? new Date(infoUser.updatedAt).toLocaleString('vi-VN') : 'Không có thông tin'}
                  </p>
                </div>
              </div>

              <div className="mt-8">
                <button 
                  onClick={() => setInfoUser(null)}
                  className="w-full px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold transition-all"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
