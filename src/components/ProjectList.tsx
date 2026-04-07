import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Project, UserProfile, OperationType, Lead } from '../types';
import { Plus, Trash2, FolderKanban, Users, CheckCircle2, TrendingUp } from 'lucide-react';

interface ProjectListProps {
  user: UserProfile;
  leads: Lead[];
  onProjectClick?: (projectId: string) => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({ user, leads, onProjectClick }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAbbreviation, setNewAbbreviation] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(projectsData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching projects:', JSON.stringify({
        error: error.message,
        operationType: OperationType.LIST,
        path: 'projects',
        authInfo: { userId: user.uid, email: user.email, providerInfo: [] }
      }));
    });

    return () => unsubscribe();
  }, [user]);

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newAbbreviation.trim()) return;

    try {
      await addDoc(collection(db, 'projects'), {
        name: newName.trim(),
        abbreviation: newAbbreviation.trim().toLowerCase(),
        createdAt: new Date().toISOString(),
        createdByEmail: user.email
      });
      setNewName('');
      setNewAbbreviation('');
      setIsAdding(false);
    } catch (error) {
      console.error('Error adding project:', error);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa dự án này?')) return;
    try {
      await deleteDoc(doc(db, 'projects', id));
    } catch (error) {
      console.error('Error deleting project:', error);
    }
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FolderKanban className="w-6 h-6 text-emerald-600" />
          Quản lý Dự án
        </h2>
        {(user.role === 'admin' || user.role === 'tp') && (
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Thêm Dự án
          </button>
        )}
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-top-4 duration-200">
          <form onSubmit={handleAddProject} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tên dự án</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                placeholder="VD: The Prive"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tên viết tắt</label>
              <input
                type="text"
                value={newAbbreviation}
                onChange={(e) => setNewAbbreviation(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                placeholder="VD: tp"
                required
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg transition-colors shadow-sm"
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
                {(user.role === 'admin' || user.role === 'tp') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project.id);
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
