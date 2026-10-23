import { projectRow, toProject } from './records';
import { supabase } from './supabase';

// RLS-blocked updates and deletes affect 0 rows without an error.
const assertWritten = (rows) => {
    if (!rows || rows.length === 0) throw new Error('Not allowed — sign in as the admin.');
};

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
    const { data, error } = await supabase.from('projects').update(projectRow(form)).eq('id', id).select('id');
    if (error) throw error;
    assertWritten(data);
};

export const deleteProject = async (id) => {
    const { data, error } = await supabase.from('projects').delete().eq('id', id).select('id');
    if (error) throw error;
    assertWritten(data);
};
