import { create } from 'zustand';

interface HistoryCommand {
  id: string;
  label: string;
  execute: () => void;
  undo: () => void;
}

interface HistoryState {
  commands: HistoryCommand[];
  future: HistoryCommand[];
  maxLen: number;
  push: (cmd: HistoryCommand) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  commands: [],
  future: [],
  maxLen: 100,

  push: (cmd) => {
    set((s) => ({
      commands: [...s.commands.slice(-(s.maxLen - 1)), cmd],
      future: [],
    }));
  },

  undo: () => {
    const { commands } = get();
    if (commands.length === 0) return;
    const cmd = commands[commands.length - 1];
    try {
      cmd.undo();
    } catch (e) {
      console.warn('Undo failed:', e);
      return;
    }
    set((s) => ({
      commands: s.commands.slice(0, -1),
      future: [...s.future, cmd],
    }));
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0) return;
    const cmd = future[future.length - 1];
    try {
      cmd.execute();
    } catch (e) {
      console.warn('Redo failed:', e);
      return;
    }
    set((s) => ({
      future: s.future.slice(0, -1),
      commands: [...s.commands, cmd],
    }));
  },

  clear: () => set({ commands: [], future: [] }),
}));

export default useHistoryStore;
