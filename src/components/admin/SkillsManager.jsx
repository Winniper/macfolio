import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const SkillsManager = () => {
    const [skills, setSkills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ category: '', items: '' });

    const fetchSkills = async () => {
        try {
            const snapshot = await getDocs(collection(db, 'skills'));
            const skillsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSkills(skillsList);
        } catch (error) {
            console.error('Error fetching skills:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSkills();
    }, []);

    const handleAdd = async () => {
        if (!formData.category || !formData.items) return;
        try {
            await addDoc(collection(db, 'skills'), {
                category: formData.category,
                items: formData.items.split(',').map(item => item.trim()).filter(Boolean),
                createdAt: new Date()
            });
            setFormData({ category: '', items: '' });
            setShowForm(false);
            fetchSkills();
        } catch (error) {
            console.error('Error adding skill:', error);
        }
    };

    const handleUpdate = async (id) => {
        try {
            await updateDoc(doc(db, 'skills', id), {
                category: formData.category,
                items: formData.items.split(',').map(item => item.trim()).filter(Boolean)
            });
            setEditing(null);
            setFormData({ category: '', items: '' });
            fetchSkills();
        } catch (error) {
            console.error('Error updating skill:', error);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this skill category?')) return;
        try {
            await deleteDoc(doc(db, 'skills', id));
            fetchSkills();
        } catch (error) {
            console.error('Error deleting skill:', error);
        }
    };

    const startEdit = (skill) => {
        setEditing(skill.id);
        setFormData({
            category: skill.category,
            items: Array.isArray(skill.items) ? skill.items.join(', ') : skill.items
        });
    };

    if (loading) {
        return <div className="text-gray-400">Loading skills...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">Skills</h2>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                    <Plus size={18} />
                    Add Category
                </button>
            </div>

            {/* Add Form */}
            {showForm && (
                <div className="bg-[#252525] rounded-lg p-4 space-y-4">
                    <h3 className="text-white font-medium">New Skill Category</h3>
                    <input
                        type="text"
                        placeholder="Category (e.g., Frontend)"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3d3d3d] rounded text-white placeholder-gray-500"
                    />
                    <input
                        type="text"
                        placeholder="Skills (comma separated: React, Next.js, TypeScript)"
                        value={formData.items}
                        onChange={(e) => setFormData({ ...formData, items: e.target.value })}
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
                            onClick={() => { setShowForm(false); setFormData({ category: '', items: '' }); }}
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Skills List */}
            <div className="space-y-3">
                {skills.length === 0 && !showForm && (
                    <p className="text-gray-500 text-center py-8">No skills yet. Add your first skill category!</p>
                )}
                {skills.map((skill) => (
                    <div key={skill.id} className="bg-[#252525] rounded-lg p-4">
                        {editing === skill.id ? (
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3d3d3d] rounded text-white"
                                />
                                <input
                                    type="text"
                                    value={formData.items}
                                    onChange={(e) => setFormData({ ...formData, items: e.target.value })}
                                    className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3d3d3d] rounded text-white"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleUpdate(skill.id)}
                                        className="p-2 bg-green-600 hover:bg-green-700 text-white rounded"
                                    >
                                        <Save size={16} />
                                    </button>
                                    <button
                                        onClick={() => { setEditing(null); setFormData({ category: '', items: '' }); }}
                                        className="p-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-cyan-400 font-medium">{skill.category}</h3>
                                    <p className="text-gray-400 text-sm">
                                        {Array.isArray(skill.items) ? skill.items.join(', ') : skill.items}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => startEdit(skill)}
                                        className="p-2 hover:bg-[#3d3d3d] text-gray-400 hover:text-white rounded transition-colors"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(skill.id)}
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

export default SkillsManager;
