import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileNode, GitStatus, SearchResult } from '../types';

const API_BASE = '/api';

// Native fetch helper
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    }
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// 1. Filesystem Hooks
export function useDirectoryFiles(path: string | null) {
  return useQuery<FileNode[]>({
    queryKey: ['files', path],
    queryFn: () => request<FileNode[]>(`${API_BASE}/workspace/files?path=${encodeURIComponent(path || '')}`),
    enabled: !!path
  });
}

export function useFileContent(path: string | null) {
  return useQuery<{ content: string }>({
    queryKey: ['fileContent', path],
    queryFn: () => request<{ content: string }>(`${API_BASE}/workspace/file?path=${encodeURIComponent(path || '')}`),
    enabled: !!path,
    staleTime: Infinity // Keep in cache, we will mutate manually
  });
}

export function useSaveFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { path: string; content: string }) =>
      request<{ success: boolean }>(`${API_BASE}/workspace/file`, {
        method: 'POST',
        body: JSON.stringify(variables)
      }),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['fileContent', variables.path], { content: variables.content });
    }
  });
}

export function useCreateFileOrFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { path: string; type: 'file' | 'folder' }) =>
      request<{ success: boolean; path: string }>(`${API_BASE}/workspace/file/create`, {
        method: 'POST',
        body: JSON.stringify(variables)
      }),
    onSuccess: (data, variables) => {
      // Invalidate directories
      queryClient.invalidateQueries({ queryKey: ['files'] });
    }
  });
}

export function useDeleteFileOrFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { path: string }) =>
      request<{ success: boolean }>(`${API_BASE}/workspace/file/delete`, {
        method: 'POST',
        body: JSON.stringify(variables)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
    }
  });
}

export function useRenameFileOrFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { oldPath: string; newPath: string }) =>
      request<{ success: boolean; newPath: string }>(`${API_BASE}/workspace/file/rename`, {
        method: 'POST',
        body: JSON.stringify(variables)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['fileContent'] });
    }
  });
}

export function useCopyPasteFileOrFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { srcPath: string; destPath: string }) =>
      request<{ success: boolean; destPath: string }>(`${API_BASE}/workspace/file/copy-paste`, {
        method: 'POST',
        body: JSON.stringify(variables)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
    }
  });
}

// 2. Git Hooks
export function useGitStatus(folder: string | null) {
  return useQuery<GitStatus>({
    queryKey: ['gitStatus', folder],
    queryFn: () => request<GitStatus>(`${API_BASE}/git/status?folder=${encodeURIComponent(folder || '')}`),
    enabled: !!folder,
    refetchInterval: 10000 // poll Git status every 10s
  });
}

export function useGitDiff(folder: string | null, file?: string | null, staged?: boolean) {
  return useQuery<{ diff: string }>({
    queryKey: ['gitDiff', folder, file, staged],
    queryFn: () =>
      request<{ diff: string }>(
        `${API_BASE}/git/diff?folder=${encodeURIComponent(folder || '')}${
          file ? `&file=${encodeURIComponent(file)}` : ''
        }${staged ? `&staged=true` : ''}`
      ),
    enabled: !!folder
  });
}

export function useGitCommit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { folder: string; message: string; files?: string[] }) =>
      request<{ success: boolean; output: string }>(`${API_BASE}/git/commit`, {
        method: 'POST',
        body: JSON.stringify(variables)
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['gitStatus', variables.folder] });
    }
  });
}

export function useGitSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { folder: string; action: 'push' | 'pull' }) =>
      request<{ success: boolean; output: string }>(`${API_BASE}/git/sync`, {
        method: 'POST',
        body: JSON.stringify(variables)
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['gitStatus', variables.folder] });
    }
  });
}

// 3. Search Hook
export function useSearchWorkspace() {
  return useMutation({
    mutationFn: (variables: {
      folder: string;
      query: string;
      isRegex: boolean;
      matchCase: boolean;
      include?: string;
      exclude?: string;
    }) => {
      const { folder, query, isRegex, matchCase, include, exclude } = variables;
      let url = `${API_BASE}/workspace/search?folder=${encodeURIComponent(folder)}&query=${encodeURIComponent(
        query
      )}&isRegex=${isRegex}&matchCase=${matchCase}`;
      if (include) url += `&include=${encodeURIComponent(include)}`;
      if (exclude) url += `&exclude=${encodeURIComponent(exclude)}`;
      return request<SearchResult[]>(url);
    }
  });
}
