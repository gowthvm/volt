import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useProjectStore, type ProjectMeta } from '@/store/projectStore';
import Logo from '@/components/Logo';
import { ProjectGridSkeleton } from '@/components/PageSkeleton';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
  const {
    projects,
    loading,
    loadProjects,
    createProject,
    duplicateProject,
    deleteProject,
    renameProject,
  } = useProjectStore();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const startRename = useCallback((p: ProjectMeta) => {
    setEditingId(p.id);
    setEditName(p.name);
  }, []);

  const commitRename = useCallback(async () => {
    if (editingId && editName.trim()) {
      await renameProject(editingId, editName.trim());
    }
    setEditingId(null);
  }, [editingId, editName, renameProject]);

  const handleCreate = useCallback(async () => {
    const id = await createProject();
    navigate(`/editor?project=${id}`);
  }, [createProject, navigate]);

  const handleOpen = useCallback((id: string) => {
    navigate(`/editor?project=${id}`);
  }, [navigate]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate('/login');
  }, [signOut, navigate]);

  return (
    <div className="min-h-screen bg-base text-text-primary">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <header className="mb-10 flex items-center justify-between rounded-xl border border-default bg-surface px-6 py-4 shadow-md">
          <Logo />
          <div className="flex items-center gap-4 text-sm text-text-secondary">
            <span>{user?.email}</span>
            <button
              onClick={handleSignOut}
              className="rounded-full border border-default bg-elevated px-4 py-2 text-sm text-text-primary transition hover:border-accent hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <button
            onClick={handleCreate}
            className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-black transition hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent"
          >
            New project
          </button>
        </div>

        {loading && projects.length === 0 ? (
          <ProjectGridSkeleton count={6} />
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-default bg-surface py-24 shadow-md">
            <p className="text-lg text-text-secondary">No projects yet</p>
            <p className="mt-2 text-sm text-text-secondary/60">Create your first circuit project to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="group relative rounded-lg border border-default bg-surface p-5 shadow-md transition hover:border-accent/40"
              >
                {editingId === p.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="mb-3 w-full rounded-md border border-default bg-base px-2 py-1 text-sm text-text-primary outline-none focus:border-accent"
                    aria-label="Project name"
                  />
                ) : (
                  <h3
                    className="mb-1 cursor-pointer text-base font-medium text-text-primary transition hover:text-accent"
                    onClick={() => handleOpen(p.id)}
                    onDoubleClick={() => startRename(p)}
                  >
                    {p.name}
                  </h3>
                )}

                <div className="mb-4 h-28 rounded-lg bg-surface border border-default flex items-center justify-center text-[32px] text-text-secondary/20 select-none">
                  ⚡
                </div>

                <div className="text-xs text-text-secondary/60">
                  {formatDate(p.updated_at)}
                </div>

                <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    title="Duplicate"
                    aria-label={`Duplicate ${p.name}`}
                    onClick={async () => { await duplicateProject(p.id); }}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-default bg-base text-xs text-text-secondary transition hover:border-accent hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="2" y="2" width="7" height="7" rx="1" />
                      <path d="M4 4V2.5A1.5 1.5 0 0 1 5.5 1H9.5A1.5 1.5 0 0 1 11 2.5V6.5A1.5 1.5 0 0 1 9.5 8H8" />
                    </svg>
                  </button>
                  <button
                    title="Rename"
                    aria-label={`Rename ${p.name}`}
                    onClick={() => startRename(p)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-default bg-base text-xs text-text-secondary transition hover:border-accent hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M8.5 1.5L10.5 3.5L3.5 10.5L1 11L1.5 8.5L8.5 1.5Z" />
                    </svg>
                  </button>
                  {deleteConfirm === p.id ? (
                    <button
                      title="Confirm delete"
                      aria-label={`Confirm delete ${p.name}`}
                      onClick={async () => {
                        await deleteProject(p.id);
                        setDeleteConfirm(null);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-red-500 bg-red-500/10 text-xs text-red-400 transition focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      ✓
                    </button>
                  ) : (
                    <button
                      title="Delete"
                      aria-label={`Delete ${p.name}`}
                      onClick={() => setDeleteConfirm(p.id)}
                      onBlur={() => setTimeout(() => setDeleteConfirm(null), 2000)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-default bg-base text-xs text-text-secondary transition hover:border-red-500 hover:text-red-400 focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M1.5 3H10.5" /><path d="M4 3V1.5A0.5 0.5 0 0 1 4.5 1H7.5A0.5 0.5 0 0 1 8 1.5V3" /><path d="M2.5 3L3.5 10.5H8.5L9.5 3" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
