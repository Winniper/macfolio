import { skillRow, toSkill } from './records';
import { supabase } from './supabase';

// Read for Terminal and Spotlight; written by the admin panel.
export const fetchSkills = async () => {
    const { data, error } = await supabase
        .from('skills')
        .select('id, category, items, position')
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data.map(toSkill);
};

export const createSkill = async (form, position) => {
    const { error } = await supabase.from('skills').insert({ ...skillRow(form), position });
    if (error) throw error;
};

export const updateSkill = async (id, form) => {
    const { error } = await supabase.from('skills').update(skillRow(form)).eq('id', id);
    if (error) throw error;
};

export const deleteSkill = async (id) => {
    const { error } = await supabase.from('skills').delete().eq('id', id);
    if (error) throw error;
};
