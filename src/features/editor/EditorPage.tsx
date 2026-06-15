import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import EditorShell from '@/components/EditorShell';
import { useProjectStore } from '@/store/projectStore';

export default function EditorPage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project');
  const loadProjectIntoEditor = useProjectStore((s) => s.loadProjectIntoEditor);
  const setCurrentProjectId = useProjectStore((s) => s.setCurrentProjectId);

  useEffect(() => {
    if (projectId) {
      loadProjectIntoEditor(projectId);
    } else {
      setCurrentProjectId(null);
    }
  }, [projectId, loadProjectIntoEditor, setCurrentProjectId]);

  return <EditorShell />;
}
