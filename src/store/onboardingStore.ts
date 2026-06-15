import { create } from 'zustand';

export interface WalkthroughStep {
  id: string;
  title: string;
  description: string;
  target?: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const STEPS: WalkthroughStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Volt',
    description: 'Circuit design at the speed of sketching. Let\'s take a quick tour.',
    position: 'center',
  },
  {
    id: 'canvas',
    title: 'Infinite Canvas',
    description: 'Pan with right-click drag, zoom with scroll wheel or Ctrl+scroll. Draw circuits naturally.',
    position: 'center',
  },
  {
    id: 'tools',
    title: 'Drawing Tools',
    description: 'Use the left toolbar to select tools: wire, component, select, and pan.',
    target: '.left-toolbar',
    position: 'right',
  },
  {
    id: 'symbols',
    title: 'Symbol Browser',
    description: 'Search and drag KiCad symbols onto the canvas. Press Ctrl+K to open.',
    position: 'center',
  },
  {
    id: 'connect',
    title: 'Making Connections',
    description: 'Click a terminal dot to start a wire. Click another terminal to complete the connection.',
    position: 'center',
  },
  {
    id: 'properties',
    title: 'Properties Panel',
    description: 'Select a component to edit its properties in the right panel. Change values, rotation, and more.',
    target: '.properties-panel',
    position: 'left',
  },
  {
    id: 'simulate',
    title: 'Simulation',
    description: 'Press Ctrl+R to run simulation. Volt calculates voltage, current, and power in real-time.',
    position: 'center',
  },
  {
    id: 'done',
    title: 'You\'re Ready!',
    description: 'Start sketching your circuit. Use Ctrl+Z to undo, Ctrl+Shift+Z to redo. Happy designing!',
    position: 'center',
  },
];

interface OnboardingState {
  active: boolean;
  currentStep: number;
  steps: WalkthroughStep[];
  dismissed: boolean;
  start: () => void;
  next: () => void;
  prev: () => void;
  dismiss: () => void;
}

const STORAGE_KEY = 'volt_onboarding_dismissed';

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  active: false,
  currentStep: 0,
  steps: STEPS,
  dismissed: localStorage.getItem(STORAGE_KEY) === 'true',
  start: () => set({ active: true, currentStep: 0 }),
  next: () => {
    const { currentStep, steps } = get();
    if (currentStep >= steps.length - 1) {
      set({ active: false, dismissed: true });
      localStorage.setItem(STORAGE_KEY, 'true');
    } else {
      set({ currentStep: currentStep + 1 });
    }
  },
  prev: () => {
    const { currentStep } = get();
    if (currentStep > 0) set({ currentStep: currentStep - 1 });
  },
  dismiss: () => {
    set({ active: false, dismissed: true });
    localStorage.setItem(STORAGE_KEY, 'true');
  },
}));
