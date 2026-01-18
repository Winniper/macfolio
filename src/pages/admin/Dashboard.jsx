import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, FolderOpen, Cpu, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ProjectsManager from '../../components/admin/ProjectsManager';
import SkillsManager from '../../components/admin/SkillsManager';
import ResumeUploader from '../../components/admin/ResumeUploader';

const tabs = [
    { id: 'projects', label: 'Projects', icon: FolderOpen },
    { id: 'skills', label: 'Skills', icon: Cpu },
    { id: 'resume', label: 'Resume', icon: FileText },
];

const Dashboard = () => {
    const [activeTab, setActiveTab] = useState('projects');
    const { logout, user } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/admin/login');
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'projects':
                return <ProjectsManager />;
            case 'skills':
                return <SkillsManager />;
            case 'resume':
                return <ResumeUploader />;
            default:
                return <ProjectsManager />;
        }
    };

    return (
        <div className="min-h-screen bg-[#1e1e1e]">
            {/* Header */}
            <header className="bg-[#2d2d2d] border-b border-[#3d3d3d] px-6 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-white">Portfolio Admin</h1>
                        <p className="text-gray-400 text-sm">{user?.email}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <a
                            href="/"
                            target="_blank"
                            className="text-gray-400 hover:text-white text-sm transition-colors"
                        >
                            View Portfolio →
                        </a>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded-lg transition-colors"
                        >
                            <LogOut size={18} />
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-6xl mx-auto p-6">
                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${activeTab === tab.id
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-[#2d2d2d] text-gray-400 hover:text-white hover:bg-[#3d3d3d]'
                                }`}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="bg-[#2d2d2d] rounded-xl p-6 border border-[#3d3d3d]">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
