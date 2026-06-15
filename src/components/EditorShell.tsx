import { useNavigate, Link } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import CanvasEngine from '@/components/CanvasEngine';
import BlueprintCanvas from '@/components/BlueprintCanvas';
import Toolbar from '@/components/Toolbar';
import LeftToolbar from '@/components/LeftToolbar';
import BlueprintToolbar from '@/components/BlueprintToolbar';
import KicadSymbolBrowser from '@/components/KicadSymbolBrowser';
import ComponentProperties from '@/components/ComponentProperties';
import Minimap from '@/components/Minimap';
import StatusBar from '@/components/StatusBar';
import DRCPanel from '@/components/DRCPanel';
import RecognitionPanel from '@/components/RecognitionPanel';
import OnboardingOverlay from '@/components/OnboardingOverlay';
import ConvertOverlay from '@/components/ConvertOverlay';
import { useOnboardingStore } from '@/store/onboardingStore';
import useDrawingStore from '@/store/drawingStore';
import { useCanvasStore } from '@/store/canvasStore';
import useSchematicStore from '@/store/schematicStore';
import { useProjectStore } from '@/store/projectStore';
import { useHistoryStore } from '@/store/historyStore';
import { useSimulationStore } from '@/store/simulationStore';
import { downloadSVG, downloadPNG, downloadJSON } from '@/lib/export';
import { useStore } from '@/store/useStore';
import useEditorModeStore from '@/store/editorModeStore';
import useBlueprintStore from '@/store/blueprintStore';
import { useEditorTransition } from '@/hooks/useEditorTransition';

export default function EditorShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const mode = useEditorModeStore((s) => s.mode);
  const setMode = useEditorModeStore((s) => s.setMode);

  const setTool = useDrawingStore((s) => s.setTool);
  const setSpacePan = useCanvasStore((s) => s.setSpacePan);
  const selectedComponentId = useSchematicStore((s) => s.selectedComponentId);
  const rotateComponent = useSchematicStore((s) => s.rotateComponent);
  const clearSelection = useSchematicStore((s) => s.clearSelection);
  const isDirty = useSchematicStore((s) => s.isDirty);
  const historyStore = useHistoryStore;
  const runSimulation = useSimulationStore((s) => s.runSimulation);

  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const saving = useProjectStore((s) => s.saving);
  const lastSavedAt = useProjectStore((s) => s.lastSavedAt);
  const saveCurrentProject = useProjectStore((s) => s.saveCurrentProject);

  const projects = useProjectStore((s) => s.projects);
  const projectName = projects.find((p) => p.id === currentProjectId)?.name ?? 'Untitled';

  const autoSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showConvert, setShowConvert] = useState(false);

  const { phase, isTransitioning, startTransition } = useEditorTransition();

  const [isMobile, setIsMobile] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);

  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  // Mobile detection
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setLeftPanelOpen(false);
        setRightPanelOpen(false);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Auto-open/close right panel on component selection (desktop only)
  useEffect(() => {
    if (mode !== 'cad' || isMobile) return;
    if (selectedComponentId) {
      setRightPanelOpen(true);
    } else {
      setRightPanelOpen(false);
    }
  }, [selectedComponentId, mode, isMobile]);

  const handleModeChange = useCallback(
    (newMode: 'cad' | 'blueprint') => {
      startTransition(newMode);
    },
    [startTransition]
  );

  useEffect(() => {
    if (!currentProjectId) return;
    autoSaveIntervalRef.current = setInterval(() => {
      if (useSchematicStore.getState().isDirty) {
        saveCurrentProject();
        useSchematicStore.getState().setDirty?.(false);
      }
    }, 30000);
    return () => {
      if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
    };
  }, [currentProjectId, saveCurrentProject]);

  useEffect(() => {
    const dismissed = useOnboardingStore.getState().dismissed;
    if (!dismissed) useOnboardingStore.getState().start();
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useSchematicStore.getState().isDirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const handleSave = async () => {
    if (!currentProjectId) return;
    await saveCurrentProject();
    useSchematicStore.getState().setDirty?.(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // CAD keyboard
  useEffect(() => {
    if (mode !== 'cad') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = document.activeElement as HTMLElement | null;
      const editing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (editing) return;
      if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); setSpacePan(true); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) historyStore.getState().redo(); else historyStore.getState().undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); historyStore.getState().redo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); handleSave(); return; }
      if (e.key === 'Escape') { setLeftPanelOpen(false); setRightPanelOpen(false); return; }
      const k = e.key.toLowerCase();
      if (k === 'v') setTool('select');
      if (k === 'w') setTool('wire');
      if (k === 'h') setTool('pan');
      if (k === 'b') setLeftPanelOpen((p) => !p);
      if (k === 'i') setRightPanelOpen((p) => !p);
      if (k === 'r' && selectedComponentId) { rotateComponent(selectedComponentId); runSimulation(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedComponentId) {
        useSchematicStore.getState().removeComponentById(selectedComponentId);
        clearSelection();
        runSimulation();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') setSpacePan(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [mode, setTool, setSpacePan, selectedComponentId, rotateComponent, clearSelection, historyStore, runSimulation]);

  const handleExportSVG = useCallback(() => {
    downloadSVG(useSchematicStore.getState().components, useDrawingStore.getState().strokes);
    setExportOpen(false);
  }, []);
  const handleExportPNG = useCallback(() => {
    downloadPNG(useSchematicStore.getState().components, useDrawingStore.getState().strokes);
    setExportOpen(false);
  }, []);
  const handleExportJSON = useCallback(() => {
    const cam = useCanvasStore.getState();
    downloadJSON(useDrawingStore.getState().strokes, useSchematicStore.getState().components, { offset: cam.offset, zoom: cam.zoom });
    setExportOpen(false);
  }, []);
  const handleNameSave = useCallback(() => {
    if (currentProjectId && editNameValue.trim()) {
      useProjectStore.getState().renameProject(currentProjectId, editNameValue.trim());
    }
    setEditingName(false);
  }, [currentProjectId, editNameValue]);
  const formatTime = (date: string | null) => date ? new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  const handleClearBlueprint = () => useBlueprintStore.getState().clearAll();

  const btnBase = 'flex items-center justify-center border-subtle bg-surface/80 text-text-tertiary backdrop-blur-sm transition hover:text-accent';

  return (
    <div className="flex min-h-screen flex-col bg-base text-text-primary">
      {/* ==================== HEADER (48px) ==================== */}
      <header className="flex h-12 items-center justify-between border-b border-subtle bg-base px-4">
        {/* Left: toggle + logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLeftPanelOpen((p) => !p)}
            title="Component Browser (B)"
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition hover:bg-hover hover:text-accent"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={leftPanelOpen ? '' : 'rotate-180'}>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          <Link to="/" className="text-base font-bold tracking-tight text-text-primary transition-colors hover:text-accent">
            Volt
          </Link>
          <span className="text-xs text-text-tertiary hidden sm:inline">{'//'}</span>
          <button
            onClick={() => { setEditNameValue(projectName); setEditingName(true); }}
            className="truncate max-w-[160px] text-sm font-medium text-text-primary transition-colors hover:text-accent"
          >
            {projectName}
          </button>
          {isDirty && <span className="h-2 w-2 rounded-full bg-accent" title="Unsaved changes" />}
          {!isDirty && currentProjectId && <span className="h-2 w-2 rounded-full bg-green/60" title="Saved" />}
        </div>

        {/* Center: mode toggle with sliding indicator */}
        <div className="flex items-center gap-4">
          <span className="text-xs text-text-tertiary hidden sm:inline">{'//'}</span>
          <div className="relative flex items-center rounded-full border border-default bg-base p-0.5">
            <div
              className="absolute top-0.5 bottom-0.5 rounded-full bg-accent transition-all duration-200 ease-out"
              style={{ width: 'calc(50% - 2px)', left: mode === 'cad' ? '2px' : 'calc(50% + 0px)' }}
            />
            <button
              onClick={() => handleModeChange('cad')}
              disabled={isTransitioning}
              className={`relative z-10 rounded-full px-5 py-1 text-xs font-medium transition-colors duration-150 ${mode === 'cad' ? 'text-black' : 'text-text-primary hover:text-white'} ${isTransitioning ? 'cursor-default opacity-50' : ''}`}
            >
              CAD
            </button>
            <button
              onClick={() => handleModeChange('blueprint')}
              disabled={isTransitioning}
              className={`relative z-10 rounded-full px-5 py-1 text-xs font-medium transition-colors duration-150 ${mode === 'blueprint' ? 'text-black' : 'text-text-primary hover:text-white'} ${isTransitioning ? 'cursor-default opacity-50' : ''}`}
            >
              Blueprint
            </button>
          </div>
          <span className="text-xs text-text-tertiary hidden sm:inline">{'//'}</span>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setExportOpen(!exportOpen)}
              className="rounded-md border border-default bg-base px-3 py-1.5 text-xs text-text-secondary transition hover:border-accent hover:text-accent"
            >
              Export
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-28 rounded-md border border-default bg-surface shadow-md py-1 z-50 backdrop-blur-lg">
                <button onClick={handleExportSVG} className="block w-full px-3 py-1.5 text-left text-xs text-text-secondary transition hover:bg-hover hover:text-accent">SVG</button>
                <button onClick={handleExportPNG} className="block w-full px-3 py-1.5 text-left text-xs text-text-secondary transition hover:bg-hover hover:text-accent">PNG</button>
                <button onClick={handleExportJSON} className="block w-full px-3 py-1.5 text-left text-xs text-text-secondary transition hover:bg-hover hover:text-accent">JSON</button>
              </div>
            )}
          </div>
          {mode === 'cad' && (
            <button
              onClick={runSimulation}
              className="rounded-md bg-accent px-4 py-1.5 text-xs font-semibold text-black transition hover:brightness-110"
            >
              Simulate
            </button>
          )}
          <button
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition hover:text-accent"
          >
            {theme === 'dark' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
            )}
          </button>
          <div className="relative">
            <button
              aria-label="User menu"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition hover:text-accent"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/></svg>
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-32 rounded-md border border-default bg-surface shadow-md py-1 z-50 backdrop-blur-lg">
                <div className="px-3 py-1.5 text-xs text-text-tertiary truncate">{user?.email ?? 'Guest'}</div>
                <div className="mx-2 h-px bg-border-subtle" />
                <button onClick={handleSignOut} className="block w-full px-3 py-1.5 text-left text-xs text-text-secondary transition hover:bg-hover hover:text-accent">Sign out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ==================== BODY — full-bleed canvas ==================== */}
      <div className="flex flex-1 overflow-hidden relative bg-base">

        {/* Black overlay for fade-out */}
        <div
          className="absolute inset-0 z-[1] bg-black transition-opacity duration-200 ease-out"
          style={{
            opacity: phase === 'outgoing' ? 1 : (phase === 'incoming' ? 0 : 0),
            pointerEvents: phase !== 'idle' ? 'all' : 'none',
          }}
        />

        {/* CAD canvas + UI */}
        <div
          className="absolute inset-0 z-0"
          style={{
            opacity: (mode === 'cad' && phase === 'idle') || (mode === 'cad' && phase === 'incoming') ? 1 : (mode === 'cad' && phase === 'outgoing' ? 0 : 0),
            transition: 'opacity 250ms ease-out',
            pointerEvents: mode === 'cad' && phase === 'idle' ? 'auto' : 'none',
          }}
        >
          <div className="absolute inset-0">
            <CanvasEngine />
          </div>

          {/* Left panel */}
          <div
            className={`absolute left-0 top-0 bottom-0 z-20 w-[280px] overflow-y-auto border-r border-subtle bg-surface/95 backdrop-blur-xl transition-transform duration-200 ease-out will-change-transform ${
              (phase === 'outgoing' && mode === 'cad') ? '-translate-x-full' :
              (phase === 'incoming' && mode === 'cad') ? 'translate-x-0' :
              leftPanelOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-0">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">Components</span>
              <button onClick={() => setLeftPanelOpen(false)} className="text-text-tertiary transition hover:text-accent">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-5">
              <KicadSymbolBrowser />
            </div>
          </div>

          {/* Right panel */}
          <div
            className={`absolute right-0 top-0 bottom-0 z-20 w-[280px] overflow-y-auto border-l border-subtle bg-surface/95 backdrop-blur-xl transition-transform duration-200 ease-out will-change-transform ${
              (phase === 'outgoing' && mode === 'cad') ? 'translate-x-full' :
              (phase === 'incoming' && mode === 'cad') ? 'translate-x-0' :
              rightPanelOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-0">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">Properties</span>
              <button onClick={() => setRightPanelOpen(false)} className="text-text-tertiary transition hover:text-accent">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="px-4 pt-3 pb-4">
              <ComponentProperties />
            </div>
          </div>

          {/* Right edge toggle */}
          <button
            onClick={() => setRightPanelOpen((p) => !p)}
            title="Properties (I)"
            className={`${btnBase} absolute right-0 top-1/2 -translate-y-1/2 z-20 h-12 w-6 rounded-l-md border border-r-0`}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={rightPanelOpen ? '' : 'rotate-180'}>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          {/* Other floating panels */}
          <RecognitionPanel />
          <DRCPanel />
          <Minimap rightPanelOpen={rightPanelOpen} />

          {/* Floating toolbar */}
          <div className={`absolute top-4 z-30 transition-all duration-200 ease-out ${leftPanelOpen ? 'left-[296px]' : 'left-4'}`}>
            <LeftToolbar />
          </div>
        </div>

        {/* Blueprint canvas + UI */}
        <div
          className="absolute inset-0 z-0"
          style={{
            opacity: (mode === 'blueprint' && phase === 'idle') || (mode === 'blueprint' && phase === 'incoming') ? 1 : (mode === 'blueprint' && phase === 'outgoing' ? 0 : 0),
            transition: 'opacity 250ms ease-out',
            pointerEvents: mode === 'blueprint' && phase === 'idle' ? 'auto' : 'none',
          }}
        >
          <div className="absolute inset-0">
            <BlueprintCanvas />
          </div>

          {/* Blueprint toolbar */}
          <div
            className="absolute left-4 top-4 z-10 transition-all duration-150 ease-out"
            style={{
              transform: phase === 'outgoing' ? 'translateX(-20px)' : 'translateX(0)',
              opacity: phase === 'outgoing' ? 0 : 1,
            }}
          >
            <BlueprintToolbar />
          </div>

          {/* Convert + Clear buttons */}
          <div
            className="absolute right-4 top-4 z-10 flex items-center gap-2 transition-all duration-150 ease-out"
            style={{
              transform: phase === 'outgoing' ? 'translateX(20px)' : 'translateX(0)',
              opacity: phase === 'outgoing' ? 0 : 1,
            }}
          >
            <button
              onClick={() => setShowConvert(true)}
              className="rounded-md bg-accent px-5 py-2 text-sm font-semibold text-black transition hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]"
            >
              Convert to Circuit
            </button>
            <button
              onClick={handleClearBlueprint}
              className="rounded-md border border-default bg-surface/80 px-3 py-2 text-xs text-text-secondary backdrop-blur-lg transition hover:border-red/50 hover:text-red"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <StatusBar />
      {showConvert && <ConvertOverlay onClose={() => setShowConvert(false)} />}
      <OnboardingOverlay />
    </div>
  );
}
