import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, GripVertical } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const ProjectsManager = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ title: '', github: '', website: '' });

    const fetchProjects = async () => {
        try {
            const q = query(collection(db, 'projects'), orderBy('order', 'asc'));
            const snapshot = await getDocs(q);
            const projectsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProjects(projectsList);
        } catch (error) {
            console.error('Error fetching projects:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    const handleAdd = async () => {
        if (!formData.title) return;
        try {
            await addDoc(collection(db, 'projects'), {
                ...formData,
                order: projects.length,
                createdAt: new Date()
            });
            setFormData({ title: '', github: '', website: '' });
            setShowForm(false);
            fetchProjects();
        } catch (error) {
            console.error('Error adding project:', error);
        }
    };

    const handleUpdate = async (id) => {
        try {
            await updateDoc(doc(db, 'projects', id), formData);
            setEditing(null);
            setFormData({ title: '', github: '', website: '' });
            fetchProjects();
        } catch (error) {
            console.error('Error updating project:', error);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this project?')) return;
        try {
            await deleteDoc(doc(db, 'projects', id));
            fetchProjects();
        } catch (error) {
            console.error('Error deleting project:', error);
        }
    };

    const startEdit = (project) => {
        setEditing(project.id);
        setFormData({ title: project.title, github: project.github, website: project.website });
    };

    if (loading) {
        return <div className="text-gray-400">Loading projects...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">Projects</h2>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                    <Plus size={18} />
                    Add Project
                </button>
            </div>

            {/* Add Form */}
            {showForm && (
                <div className="bg-[#252525] rounded-lg p-4 space-y-4">
                    <h3 className="text-white font-medium">New Project</h3>
                    <input
                        type="text"
                        placeholder="Project Title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3d3d3d] rounded text-white placeholder-gray-500"
                    />
                    <input
                        type="url"
                        placeholder="GitHub URL"
                        value={formData.github}
                        onChange={(e) => setFormData({ ...formData, github: e.target.value })}
                        className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3d3d3d] rounded text-white placeholder-gray-500"
                    />
                    <input
                        type="url"
                        placeholder="Live Website URL"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3d3d3d] rounded text-white placeholder-gray-500"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={handleAdd}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                        >
                            Save
                        </button>
                        <button
                            onClick={() => { setShowForm(false); setFormData({ title: '', github: '', website: '' }); }}
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Projects List */}
            <div className="space-y-3">
                {projects.length === 0 && !showForm && (
                    <p className="text-gray-500 text-center py-8">No projects yet. Add your first project!</p>
                )}
                {projects.map((project) => (
                    <div key={project.id} className="bg-[#252525] rounded-lg p-4">
                        {editing === project.id ? (
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3d3d3d] rounded text-white"
                                />
                                <input
                                    type="url"
                                    value={formData.github}
                                    onChange={(e) => setFormData({ ...formData, github: e.target.value })}
                                    className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3d3d3d] rounded text-white"
                                />
                                <input
                                    type="url"
                                    value={formData.website}
                                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                    className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3d3d3d] rounded text-white"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleUpdate(project.id)}
                                        className="p-2 bg-green-600 hover:bg-green-700 text-white rounded"
                                    >
                                        <Save size={16} />
                                    </button>
                                    <button
                                        onClick={() => { setEditing(null); setFormData({ title: '', github: '', website: '' }); }}
                                        className="p-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <GripVertical size={16} className="text-gray-600" />
                                    <div>
                                        <h3 className="text-white font-medium">{project.title}</h3>
                                        <div className="flex gap-4 text-sm text-gray-400">
                                            {project.github && <span>GitHub ✓</span>}
                                            {project.website && <span>Website ✓</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => startEdit(project)}
                                        className="p-2 hover:bg-[#3d3d3d] text-gray-400 hover:text-white rounded transition-colors"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(project.id)}
                                        className="p-2 hover:bg-red-600/20 text-gray-400 hover:text-red-400 rounded transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProjectsManager;
