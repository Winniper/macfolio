import { skillRow, toSkill } from './records';
import { supabase } from './supabase';

// RLS-blocked updates and deletes affect 0 rows without an error.
const assertWritten = (rows) => {
    if (!rows || rows.length === 0) throw new Error('Not allowed — sign in as the admin.');
};

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
    const { data, error } = await supabase.from('skills').update(skillRow(form)).eq('id', id).select('id');
    if (error) throw error;
    assertWritten(data);
};

export const deleteSkill = async (id) => {
    const { data, error } = await supabase.from('skills').delete().eq('id', id).select('id');
    if (error) throw error;
    assertWritten(data);
};
