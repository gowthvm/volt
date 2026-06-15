import { create } from 'zustand';

export type EditorMode = 'cad' | 'blueprint';

interface EditorModeState {
  mode: EditorMode;
  setMode: (m: EditorMode) => void;
}

const STORAGE_KEY = 'volt_editor_mode';

function loadMode(): EditorMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'cad' || v === 'blueprint') return v;
  } catch {}
  return 'cad';
}

function saveMode(m: EditorMode) {
  try {
    localStorage.setItem(STORAGE_KEY, m);
  } catch {}
}

const useEditorModeStore = create<EditorModeState>((set) => ({
  mode: loadMode(),
  setMode: (m) => {
    saveMode(m);
    set({ mode: m });
  },
}));

export default useEditorModeStore;
