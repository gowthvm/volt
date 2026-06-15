import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { serializeState, deserializeState } from '@/lib/serialize';
import { useAuthStore } from '@/store/authStore';
import useDrawingStore from '@/store/drawingStore';
import useSchematicStore from '@/store/schematicStore';
import { useCanvasStore } from '@/store/canvasStore';

export interface ProjectMeta {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface ProjectState {
  projects: ProjectMeta[];
  currentProjectId: string | null;
  loading: boolean;
  saving: boolean;
  lastSavedAt: string | null;
  saveError: string | null;
  loadProjects: () => Promise<void>;
  createProject: (name?: string) => Promise<string>;
  saveCurrentProject: () => Promise<void>;
  saveProjectById: (projectId: string) => Promise<void>;
  duplicateProject: (projectId: string, name?: string) => Promise<string>;
  renameProject: (projectId: string, name: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  loadProjectIntoEditor: (projectId: string) => Promise<void>;
  setCurrentProjectId: (id: string | null) => void;
  generateShareToken: (projectId: string) => Promise<string>;
  getCurrentStateJson: () => string;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProjectId: null,
  loading: false,
  saving: false,
  lastSavedAt: null,
  saveError: null,

  loadProjects: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ loading: true });
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      set({ loading: false, saveError: error.message });
      return;
    }

    set({ projects: data ?? [], loading: false, saveError: null });
  },

  createProject: async (name = 'Untitled') => {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('Not authenticated');

    const stateJson = get().getCurrentStateJson();

    const { data, error } = await supabase
      .from('projects')
      .insert({ user_id: user.id, name, schematic_json: stateJson })
      .select('id, name, created_at, updated_at')
      .single();

    if (error) throw new Error(error.message);

    set((s) => ({ projects: [data, ...s.projects], currentProjectId: data.id }));
    return data.id;
  },

  saveCurrentProject: async () => {
    const pid = get().currentProjectId;
    if (!pid) return;
    await get().saveProjectById(pid);
  },

  saveProjectById: async (projectId: string) => {
    set({ saving: true, saveError: null });
    const stateJson = get().getCurrentStateJson();

    const { error } = await supabase
      .from('projects')
      .update({ schematic_json: stateJson, updated_at: new Date().toISOString() })
      .eq('id', projectId);

    if (error) {
      set({ saving: false, saveError: error.message });
      return;
    }

    set({ saving: false, lastSavedAt: new Date().toISOString() });
  },

  duplicateProject: async (projectId: string, name?: string) => {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('Not authenticated');

    const { data: original } = await supabase
      .from('projects')
      .select('name, schematic_json')
      .eq('id', projectId)
      .single();

    if (!original) throw new Error('Project not found');

    const newName = name ?? `${original.name} (copy)`;

    const { data, error } = await supabase
      .from('projects')
      .insert({ user_id: user.id, name: newName, schematic_json: original.schematic_json })
      .select('id, name, created_at, updated_at')
      .single();

    if (error) throw new Error(error.message);

    set((s) => ({ projects: [data, ...s.projects] }));
    return data.id;
  },

  renameProject: async (projectId: string, name: string) => {
    const { error } = await supabase
      .from('projects')
      .update({ name })
      .eq('id', projectId);

    if (error) throw new Error(error.message);

    set((s) => ({
      projects: s.projects.map((p) => (p.id === projectId ? { ...p, name } : p)),
    }));
  },

  deleteProject: async (projectId: string) => {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) throw new Error(error.message);

    set((s) => ({
      projects: s.projects.filter((p) => p.id !== projectId),
      currentProjectId: s.currentProjectId === projectId ? null : s.currentProjectId,
    }));
  },

  generateShareToken: async (projectId: string): Promise<string> => {
    const token = crypto.randomUUID();
    const { error } = await supabase
      .from('projects')
      .update({ share_token: token, is_public: true })
      .eq('id', projectId);

    if (error) throw new Error(error.message);
    return token;
  },

  loadProjectIntoEditor: async (projectId: string) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('projects')
      .select('schematic_json')
      .eq('id', projectId)
      .single();

    if (error || !data) {
      set({ loading: false, saveError: error?.message ?? 'Project not found' });
      return;
    }

    const state = deserializeState(
      typeof data.schematic_json === 'string'
        ? data.schematic_json
        : JSON.stringify(data.schematic_json)
    );

    if (state) {
      useDrawingStore.getState().loadStrokes(state.strokes as any);
      useSchematicStore.getState().loadComponents(state.components);
      useCanvasStore.getState().setCamera(state.camera.offset, state.camera.zoom);
    }

    set({ currentProjectId: projectId, loading: false, saveError: null });
  },

  setCurrentProjectId: (id) => set({ currentProjectId: id }),

  getCurrentStateJson: () => {
    const strokes = useDrawingStore.getState().strokes;
    const components = useSchematicStore.getState().components;
    const { offset, zoom } = useCanvasStore.getState();
    return serializeState(strokes, components, { offset, zoom });
  },
}));
