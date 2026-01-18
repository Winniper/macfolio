import React, { useState, useEffect } from 'react';
import {
    AppWindow,
    Cloud,
    Download,
    FileText,
    HardDrive,
    Home,
    Monitor,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

import WindowWrapper from '../hoc/WindowWrapper';
import WindowControls from '../components/WindowControl';

// Desktop level items
const desktopItems = [
    {
        id: 'projects-folder',
        title: 'Projects',
        type: 'folder',
        image: '/images/folder.png',
    },
    {
        id: 'resume-file',
        title: 'Resume.pdf',
        type: 'file',
        image: '/images/pdf.png',
    },
];

const SidebarItem = ({ icon: Icon, label, active = false, onClick }) => (
    <div
        onClick={onClick}
        className={`flex w-full items-center gap-2 rounded px-2 py-1 text-xs font-medium cursor-pointer ${active ? 'bg-blue-600/30 text-blue-300' : 'text-gray-400 hover:bg-[#333333]'
            }`}
    >
        <Icon size={14} />
        <span>{label}</span>
    </div>
);

const Finder = () => {
    const [selectedItem, setSelectedItem] = useState(null);
    const [currentPath, setCurrentPath] = useState(['Desktop']);
    const [currentFolder, setCurrentFolder] = useState(null);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch projects from Firestore
    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const q = query(collection(db, 'projects'), orderBy('order', 'asc'));
                const snapshot = await getDocs(q);
                const projectsList = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setProjects(projectsList);
            } catch (error) {
                console.error('Error fetching projects:', error);
                // Fallback to empty array if Firebase not configured
                setProjects([]);
            } finally {
                setLoading(false);
            }
        };
        fetchProjects();
    }, []);

    // Get current items based on folder level
    const getCurrentItems = () => {
        if (currentFolder === null) {
            return desktopItems;
        } else if (currentFolder === 'projects') {
            if (loading) return [];
            return projects.map(p => ({
                id: p.id,
                title: p.title,
                type: 'folder',
                image: '/images/folder.png',
            }));
        } else {
            const project = projects.find(p => p.id === currentFolder);
            if (!project) return [];
            const items = [
                {
                    id: 'github',
                    title: 'Github.pages',
                    type: 'link',
                    image: '/images/plain.png',
                    url: project.github,
                },
            ];
            // Only add website if it exists
            if (project.website) {
                items.push({
                    id: 'website',
                    title: 'Website.pages',
                    type: 'link',
                    image: '/images/plain.png',
                    url: project.website,
                });
            }
            return items;
        }
    };

    const handleItemClick = (item) => {
        setSelectedItem(item.id);
    };

    const handleItemDoubleClick = (item) => {
        if (item.type === 'folder') {
            if (item.id === 'projects-folder') {
                setCurrentFolder('projects');
                setCurrentPath(['Desktop', 'Projects']);
            } else if (projects.find(p => p.id === item.id)) {
                setCurrentFolder(item.id);
                setCurrentPath(['Desktop', 'Projects', item.title]);
            }
            setSelectedItem(null);
        } else if (item.type === 'link' && item.url) {
            window.open(item.url, '_blank', 'noopener,noreferrer');
        }
    };

    const goBack = () => {
        if (currentFolder === null) return;

        if (currentFolder === 'projects') {
            setCurrentFolder(null);
            setCurrentPath(['Desktop']);
        } else if (projects.find(p => p.id === currentFolder)) {
            setCurrentFolder('projects');
            setCurrentPath(['Desktop', 'Projects']);
        }
        setSelectedItem(null);
    };

    const canGoBack = currentFolder !== null;
    const currentItems = getCurrentItems();

    return (
        <>
            <div id="window-header">
                <WindowControls target="finder" />
                <div className="flex items-center gap-2">
                    <button
                        onClick={goBack}
                        disabled={!canGoBack}
                        className={`${canGoBack ? 'text-gray-300 hover:text-white cursor-pointer' : 'text-gray-600 cursor-default'}`}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-gray-600 cursor-default">
                        <ChevronRight size={16} />
                    </span>
                    <span className="font-semibold text-gray-300 ml-2">
                        {currentPath[currentPath.length - 1]}
                    </span>
                </div>
                <div></div>
            </div>

            <div className="flex overflow-hidden h-[min(400px,60vh)]">
                <div className="w-44 bg-[#252525] p-3 border-r border-[#1a1a1a]">
                    <div className="space-y-4">
                        <div>
                            <p className="mb-2 ml-1 text-[10px] font-bold text-gray-500 uppercase">Favorites</p>
                            <div className="space-y-0.5">
                                <SidebarItem icon={Home} label="Recents" />
                                <SidebarItem icon={AppWindow} label="Applications" />
                                <SidebarItem
                                    icon={Monitor}
                                    label="Desktop"
                                    active={currentFolder === null}
                                    onClick={() => {
                                        setCurrentFolder(null);
                                        setCurrentPath(['Desktop']);
                                        setSelectedItem(null);
                                    }}
                                />
                                <SidebarItem icon={FileText} label="Documents" />
                                <SidebarItem icon={Download} label="Downloads" />
                            </div>
                        </div>

                        <div>
                            <p className="mb-2 ml-1 text-[10px] font-bold text-gray-500 uppercase">iCloud</p>
                            <div className="space-y-0.5">
                                <SidebarItem icon={Cloud} label="iCloud Drive" />
                            </div>
                        </div>

                        <div>
                            <p className="mb-2 ml-1 text-[10px] font-bold text-gray-500 uppercase">Locations</p>
                            <div className="space-y-0.5">
                                <SidebarItem icon={HardDrive} label="Macintosh HD" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 bg-[#1e1e1e] p-4" onClick={() => setSelectedItem(null)}>
                    {loading && currentFolder === 'projects' ? (
                        <div className="flex items-center justify-center h-full text-gray-400">
                            Loading projects...
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 gap-4">
                            {currentItems.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleItemClick(item);
                                    }}
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        handleItemDoubleClick(item);
                                    }}
                                    className={`flex flex-col items-center justify-center gap-1 rounded-lg p-3 transition-colors cursor-pointer ${selectedItem === item.id ? 'bg-blue-600/20 ring-1 ring-blue-500' : 'hover:bg-[#333333]'
                                        }`}
                                >
                                    <img
                                        src={item.image}
                                        alt={item.title}
                                        className="w-12 h-12 object-contain"
                                    />
                                    <span className={`text-xs text-center max-w-[80px] truncate ${selectedItem === item.id ? 'bg-blue-500 text-white rounded px-1' : 'text-gray-300'
                                        }`}>
                                        {item.title}
                                    </span>
                                </div>
                            ))}
                            {currentItems.length === 0 && currentFolder === 'projects' && !loading && (
                                <div className="col-span-4 text-center text-gray-500 py-8">
                                    No projects yet. Add them in the admin panel.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default WindowWrapper(Finder, 'finder');
