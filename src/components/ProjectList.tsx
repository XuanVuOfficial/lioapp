import React, { useState, useEffect } from 'react';
import { Project, UserProfile, Lead } from '../types';
import { LeadStatsSummary } from '../services/leadService';
import { queryDB, escapeSQL, subscribeDB, generateId, executeMutation, subscribeToMutations } from '../api';
import { Plus, Trash2, FolderKanban, Users, CheckCircle2, TrendingUp } from 'lucide-react';

interface ProjectListProps {
  user: UserProfile;
  leads: Lead[];
  statsSummary?: LeadStatsSummary | null;
  onProjectClick?: (projectId: string) => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({ user, leads, statsSummary, onProjectClick }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAbbreviation, setNewAbbreviation] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    queryDB('SELECT * FROM projects ORDER BY createdAt DESC LIMIT 100').then((data: any[]) => {
      if (isMounted && Array.isArray(data)) {
        setProjects(data as Project[]);
        setLoading(false);
      }
    }).catch(e => console.error('fetch projects error', e));

    const unsubMutations = subscribeToMutations((event) => {
       if (event.entity === 'projects') {
         if (event.type === 'CREATE') {
           setProjects(prev => [event.data, ...prev]);
         } else if (event.type === 'DELETE') {
           if (event.data.rollback) {
              setProjects(prev => [event.data.originalData, ...prev]);
           } else {
              setProjects(prev => prev.filter(p => p.id !== event.data.id));
           }
         }
       }
    });

    return () => {
      isMounted = false;
      unsubMutations();
    };
  }, [user]);

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newAbbreviation.trim()) return;

    const newProj: Project = {
      id: generateId(),
      name: newName.trim(),
      abbreviation: newAbbreviation.trim().toLowerCase(),
      createdAt: new Date().toISOString(),
      createdByEmail: user.email
    };
    const cols = Object.keys(newProj).join(', ');
    const vals = Object.values(newProj).map(v => escapeSQL(v)).join(', ');
    
    await executeMutation('projects', 'CREATE', newProj, `INSERT INTO projects (${cols}) VALUES (${vals})`);
    
    setNewName('');
    setNewAbbreviation('');
    setIsAdding(false);
  };

  const handleDeleteProject = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    if (!window.confirm(`Bạn có chắc chắn muốn xóa dự án "${project.name}"?`)) return;
    await executeMutation('projects', 'DELETE', project, `DELETE FROM projects WHERE id = ${escapeSQL(project.id)} LIMIT 1`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý Dự án</h1>
          <p className="text-slate-500 text-sm mt-1">Danh sách các dự án bất động sản và phân bổ khách hàng.</p>
        </div>
        {(user.role === 'tgd' || user.role === 'admin' || user.role === 'tp') && (
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            <span>Thêm Dự án mới</span>
          </button>
        )}
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-4 duration-200">
          <h3 className="font-bold text-slate-900 mb-4">Tạo Dự án Mới</h3>
          <form onSubmit={handleAddProject} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tên dự án *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Vinhomes Grand Park"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tiền tố mã khách hàng (Viết tắt) *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: vgp"
                  value={newAbbreviation}
                  onChange={(e) => setNewAbbreviation(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono lowercase"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">Mã khách hàng tự động sinh ra sẽ bắt đầu bằng tiền tố này (ví dụ: vgp001, vgp002...)</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
              >
                Lưu Dự án
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => {
          const projectLeads = leads.filter(l => l.projectId === project.id);
          const totalProjectLeads = statsSummary ? (statsSummary.projectCounts[project.id] || 0) : projectLeads.length;
          const contactedLeads = projectLeads.filter(l => l.status === 'Đã liên hệ').length;
          const closedLeads = projectLeads.filter(l => l.resultStatus === 'Đã booking' || l.resultStatus === 'Đã cọc').length;

          return (
            <div
              key={project.id}
              onClick={() => onProjectClick?.(project.id)}
              className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all group cursor-pointer hover:border-emerald-200"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">{project.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                      Mã: {project.abbreviation}
                    </span>
                  </div>
                </div>
                {(user.role === 'tgd' || user.role === 'admin' || user.role === 'tp') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project);
                    }}
                    className="text-slate-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-slate-50 p-2 rounded-lg text-center">
                  <div className="flex justify-center mb-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <p className="text-xs font-bold text-slate-900">{projectLeads.length}</p>
                  <p className="text-[9px] text-slate-500 uppercase font-medium">Khách</p>
                </div>
                <div className="bg-emerald-50 p-2 rounded-lg text-center">
                  <div className="flex justify-center mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <p className="text-xs font-bold text-emerald-700">{contactedLeads}</p>
                  <p className="text-[9px] text-emerald-600 uppercase font-medium">Đã LH</p>
                </div>
                <div className="bg-blue-50 p-2 rounded-lg text-center">
                  <div className="flex justify-center mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <p className="text-xs font-bold text-blue-700">{closedLeads}</p>
                  <p className="text-[9px] text-blue-600 uppercase font-medium">Chốt</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-50 flex justify-between items-center text-[10px] text-slate-400">
                <span>Tạo bởi: {project.createdByEmail.split('@')[0]}</span>
                <span>{new Date(project.createdAt).toLocaleDateString('vi-VN')}</span>
              </div>
            </div>
          );
        })}
        {projects.length === 0 && !isAdding && (
          <div className="col-span-full text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
            <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Chưa có dự án nào được tạo.</p>
          </div>
        )}
      </div>
    </div>
  );
};
