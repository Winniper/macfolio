import { projectRow, toProject } from './records';
import { supabase } from './supabase';

// Read for Finder, Safari, About and Spotlight; written by the admin panel.
export const fetchProjects = async () => {
    const { data, error } = await supabase
        .from('projects')
        .select('id, title, github, website, position')
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data.map(toProject);
};

export const createProject = async (form, position) => {
    const { error } = await supabase.from('projects').insert({ ...projectRow(form), position });
    if (error) throw error;
};

export const updateProject = async (id, form) => {
    const { error } = await supabase.from('projects').update(projectRow(form)).eq('id', id);
    if (error) throw error;
};

export const deleteProject = async (id) => {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
};
