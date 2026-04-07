import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, UserPlus, Mail, User, Briefcase, Shield, Trash2, Edit2, X, Check, Lock } from 'lucide-react';
import { UserProfile, Department, UserRole } from '../types';
import { createStaffAccount, updateUserRole, deleteUser } from '../services/userService';

interface Props {
  users: UserProfile[];
  departments: Department[];
  currentUser: UserProfile;
}

export const StaffList: React.FC<Props> = ({ users, departments, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    displayName: '',
    password: '',
    role: 'staff' as UserRole,
    departmentId: ''
  });

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = async () => {
    if (!newUser.email || !newUser.displayName || !newUser.password) {
      alert('Vui lòng điền đầy đủ thông tin và mật khẩu');
      return;
    }
    
    setIsLoading(true);
    try {
      await createStaffAccount({
        email: newUser.email,
        displayName: newUser.displayName,
        role: newUser.role,
        departmentId: newUser.departmentId || undefined
      }, newUser.password);
      
      setShowAddModal(false);
      setNewUser({ email: '', displayName: '', password: '', role: 'staff', departmentId: '' });
    } catch (error: any) {
      alert('Lỗi khi tạo tài khoản: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    await updateUserRole(editingUser.uid, editingUser.role, editingUser.departmentId);
    setEditingUser(null);
  };

  const getDeptName = (id?: string) => {
    return departments.find(d => d.id === id)?.name || 'Chưa phân phối';
  };

  const getDetailedRole = (user: UserProfile) => {
    if (user.role === 'admin') return 'Admin';

    const roles: string[] = [];
    
    // Tìm các phòng ban mà user là trưởng phòng (dựa trên email)
    const managedDepts = departments.filter(d => d.managerEmail === user.email);
    managedDepts.forEach(d => {
      roles.push(`Trưởng phòng ${d.name}`);
    });

    // Tìm phòng ban mà user là nhân viên (nếu chưa được liệt kê là trưởng phòng của phòng đó)
    const staffDept = departments.find(d => d.id === user.departmentId);
    if (staffDept && !managedDepts.some(d => d.id === staffDept.id)) {
      roles.push(`Nhân viên ${staffDept.name}`);
    }

    return roles.length > 0 ? roles.join(', ') : 'Chưa phân phối';
  };

  const canEdit = (targetUser: UserProfile) => {
    if (currentUser.role === 'admin') {
      // Admin cannot edit other Admins
      return targetUser.role !== 'admin';
    }
    // TP can edit staff in their department
    return targetUser.role === 'staff';
  };

  const canDelete = (targetUser: UserProfile) => {
    if (targetUser.uid === currentUser.uid) return false;
    if (currentUser.role === 'admin') {
      return targetUser.role !== 'admin';
    }
    // Managers can delete staff in their department
    if (currentUser.role === 'tp' && currentUser.departmentId) {
      return targetUser.departmentId === currentUser.departmentId && targetUser.role === 'staff';
    }
    return false;
  };

  const handleShowAddModal = () => {
    setNewUser({
      email: '',
      displayName: '',
      password: '',
      role: 'staff' as UserRole,
      departmentId: currentUser.role === 'tp' ? (currentUser.departmentId || '') : ''
    });
    setShowAddModal(true);
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
                <th className="px-6 py-4 font-semibold">Vai trò đang tham gia</th>
                <th className="px-6 py-4 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map(user => (
                <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                        {user.displayName[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{user.displayName}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                      user.role === 'admin' ? 'bg-purple-50 text-purple-700' :
                      user.role === 'tp' ? 'bg-amber-50 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      <Shield className="w-3 h-3" />
                      {getDetailedRole(user)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {canEdit(user) && (
                        <button 
                          onClick={() => setEditingUser(user)}
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete(user) && (
                        <button 
                          onClick={() => deleteUser(user.uid)}
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
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold shrink-0">
                    {user.displayName[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{user.displayName}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {canEdit(user) && (
                    <button 
                      onClick={() => setEditingUser(user)}
                      className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {canDelete(user) && (
                    <button 
                      onClick={() => deleteUser(user.uid)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium ${
                  user.role === 'admin' ? 'bg-purple-50 text-purple-700' :
                  user.role === 'tp' ? 'bg-amber-50 text-amber-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  <Shield className="w-3 h-3" />
                  {getDetailedRole(user)}
                </span>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu truy cập</label>
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
                  <p className="text-sm font-medium text-slate-500">Phòng ban</p>
                  <p className="font-semibold text-slate-900">{getDeptName(newUser.departmentId)}</p>
                </div>
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
                <div>
                  <p className="text-sm font-medium text-slate-500">Nhân viên</p>
                  <p className="font-semibold text-slate-900">{editingUser.displayName}</p>
                  <p className="text-xs text-slate-500">{editingUser.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Phòng ban</p>
                  <p className="font-semibold text-slate-900">{getDeptName(editingUser.departmentId)}</p>
                </div>
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
    </div>
  );
};
