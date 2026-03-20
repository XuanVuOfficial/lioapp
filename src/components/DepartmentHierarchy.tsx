import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Plus, Trash2, Edit2, Mail, User, Briefcase, UserPlus, X, Search } from 'lucide-react';
import { Department, UserProfile } from '../types';
import { createDepartment, deleteDepartment } from '../services/departmentService';
import { updateUserRole, createUserProfile } from '../services/userService';

interface Props {
  departments: Department[];
  user: UserProfile;
  allUsers: UserProfile[];
}

export const DepartmentHierarchy: React.FC<Props> = ({ departments, user, allUsers }) => {
  const isAdmin = user.role === 'admin';
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [parentId, setParentId] = useState<string | undefined>(undefined);
  const [selectedDeptId, setSelectedDeptId] = useState<string | undefined>(undefined);
  const [newDept, setNewDept] = useState({ name: '', managerEmail: '', managerName: '' });
  const [searchTerm, setSearchTerm] = useState('');

  const toggle = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAdd = async () => {
    if (!newDept.name || !newDept.managerEmail || !newDept.managerName) return;
    
    const parent = departments.find(d => d.id === parentId);
    const level = parent ? parent.level + 1 : 0;
    
    await createDepartment({
      id: Math.random().toString(36).substr(2, 9),
      name: newDept.name,
      managerEmail: newDept.managerEmail,
      managerName: newDept.managerName,
      parentId,
      level
    });
    
    setShowAddModal(false);
    setNewDept({ name: '', managerEmail: '', managerName: '' });
  };

  const handleAddStaff = async (uid: string) => {
    if (!selectedDeptId) return;
    await updateUserRole(uid, 'staff', selectedDeptId);
    setShowAddStaffModal(false);
    setSearchTerm('');
  };

  const renderNode = (node: Department) => {
    const children = departments.filter(d => d.parentId === node.id);
    const isExpanded = expanded[node.id];
    const deptStaff = allUsers.filter(u => u.departmentId === node.id);

    const isManagerOfThisDept = node.managerEmail === user.email;
    const canManage = isAdmin || isManagerOfThisDept;

    return (
      <div key={node.id} className="ml-2 md:ml-4 border-l border-slate-200 pl-2 md:pl-4 py-2">
        <div className="flex items-center gap-2 md:gap-3 group">
          {children.length > 0 ? (
            <button onClick={() => toggle(node.id)} className="p-1 hover:bg-slate-100 rounded shrink-0">
              {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>
          ) : (
            <div className="w-6 shrink-0" />
          )}
          
          <div className="flex-1 bg-white border border-slate-200 p-3 md:p-4 rounded-xl shadow-sm hover:shadow-md transition-all">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 text-sm md:text-base truncate">{node.name}</h3>
                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 mt-1 text-[10px] md:text-xs text-slate-500">
                  <span className="flex items-center gap-1 truncate"><User className="w-3 h-3 shrink-0" /> {node.managerName}</span>
                  <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3 shrink-0" /> {node.managerEmail}</span>
                </div>
                {deptStaff.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1 md:gap-2">
                    {deptStaff.map(s => (
                      <span key={s.uid} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[9px] md:text-[10px] flex items-center gap-1">
                        <User className="w-2 h-2" /> {s.displayName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {canManage && (
                <div className="flex gap-1 self-end sm:self-start md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => { setSelectedDeptId(node.id); setShowAddStaffModal(true); }}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Thêm nhân viên sale"
                  >
                    <UserPlus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </button>
                  <button 
                    onClick={() => { setParentId(node.id); setShowAddModal(true); }}
                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                    title="Thêm phòng ban con"
                  >
                    <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </button>
                  <button 
                    onClick={() => deleteDepartment(node.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Xóa phòng ban"
                  >
                    <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {isExpanded && children.map(child => renderNode(child))}
      </div>
    );
  };

  const filteredUsers = allUsers.filter(u => 
    (u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
     u.email.toLowerCase().includes(searchTerm.toLowerCase())) &&
    u.departmentId !== selectedDeptId
  );

  const rootNodes = isAdmin 
    ? departments.filter(d => !d.parentId)
    : departments.filter(d => d.id === user.departmentId);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-xl md:text-2xl font-bold text-slate-900">Cơ cấu phòng ban</h2>
        {isAdmin && (
          <button 
            onClick={() => { setParentId(undefined); setShowAddModal(true); }}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-emerald-100 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Thêm phòng ban gốc
          </button>
        )}
      </div>

      <div className="bg-slate-50 rounded-2xl p-2 md:p-4 min-h-[400px]">
        {rootNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
            <Briefcase className="w-12 h-12 mb-4 opacity-20" />
            <p>Không tìm thấy phòng ban nào. Hãy tạo một phòng ban để bắt đầu.</p>
          </div>
        ) : (
          rootNodes.map(node => renderNode(node))
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-6">
              {parentId ? 'Thêm phòng ban con' : 'Thêm phòng ban gốc'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tên phòng ban</label>
                <input 
                  type="text" 
                  value={newDept.name}
                  onChange={e => setNewDept(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  placeholder="vd: Phòng kinh doanh A"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tên trưởng phòng</label>
                <input 
                  type="text" 
                  value={newDept.managerName}
                  onChange={e => setNewDept(prev => ({ ...prev, managerName: e.target.value }))}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  placeholder="vd: Nguyễn Văn A"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email trưởng phòng</label>
                <input 
                  type="email" 
                  value={newDept.managerEmail}
                  onChange={e => setNewDept(prev => ({ ...prev, managerEmail: e.target.value }))}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  placeholder="vd: truongphong@congty.com"
                />
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
                onClick={handleAdd}
                className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all shadow-lg shadow-emerald-100"
              >
                Tạo
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddStaffModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900">Thêm nhân viên sale</h3>
              <button onClick={() => setShowAddStaffModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Tìm kiếm nhân viên..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-slate-400 text-sm mb-4">Không tìm thấy nhân viên nào.</p>
                  <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-xs font-medium text-slate-700 mb-2">Tạo nhân viên mới với email này?</p>
                    <button
                      onClick={async () => {
                        const uid = 'pre_' + Math.random().toString(36).substr(2, 9);
                        await createUserProfile({
                          uid,
                          email: searchTerm,
                          displayName: searchTerm.split('@')[0],
                          role: 'staff',
                          departmentId: selectedDeptId
                        });
                        setShowAddStaffModal(false);
                        setSearchTerm('');
                      }}
                      disabled={!searchTerm.includes('@')}
                      className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                      Tạo và thêm vào phòng
                    </button>
                  </div>
                </div>
              ) : (
                filteredUsers.map(u => (
                  <button
                    key={u.uid}
                    onClick={() => handleAddStaff(u.uid)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all text-left group"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{u.displayName}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                    <UserPlus className="w-4 h-4 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))
              )}
            </div>

            <button 
              onClick={() => setShowAddStaffModal(false)}
              className="w-full mt-6 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold transition-all"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
