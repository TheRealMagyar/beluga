import { getGitHubAccessToken } from "./github-oauth";

const API = "https://api.github.com";

async function githubFetch<T>(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<T> {
  const token = init?.token ?? (await getGitHubAccessToken());
  if (!token) {
    throw new Error("Not connected to GitHub. Add a token under Settings → GitHub.");
  }

  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const err = data as { message?: string } | null;
    throw new Error(err?.message ?? `GitHub API error (${res.status}).`);
  }

  return data as T;
}

export interface GitHubRepoSummary {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  default_branch: string;
  description: string | null;
}

export async function getGitHubUser(token?: string) {
  return githubFetch<{ login: string; name: string | null; avatar_url: string }>(
    "/user",
    { token },
  );
}

export async function listGitHubRepos(params?: {
  page?: number;
  perPage?: number;
  token?: string;
}) {
  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 30;
  return githubFetch<GitHubRepoSummary[]>(
    `/user/repos?per_page=${perPage}&page=${page}&sort=updated`,
    { token: params?.token },
  );
}

export async function createGitHubRepo(params: {
  name: string;
  description?: string;
  private?: boolean;
  autoInit?: boolean;
  token?: string;
}) {
  return githubFetch<GitHubRepoSummary>("/user/repos", {
    method: "POST",
    token: params.token,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: params.name,
      description: params.description ?? "",
      private: params.private ?? true,
      auto_init: params.autoInit ?? false,
    }),
  });
}

export async function getGitHubRepo(owner: string, repo: string, token?: string) {
  return githubFetch<GitHubRepoSummary>(`/repos/${owner}/${repo}`, { token });
}

export async function updateGitHubRepoVisibility(
  owner: string,
  repo: string,
  isPrivate: boolean,
  token?: string,
) {
  return githubFetch<GitHubRepoSummary>(`/repos/${owner}/${repo}`, {
    method: "PATCH",
    token,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ private: isPrivate }),
  });
}

export function httpsCloneUrl(cloneUrl: string, token: string): string {
  try {
    const url = new URL(cloneUrl);
    url.username = "x-access-token";
    url.password = token;
    return url.toString();
  } catch {
    return cloneUrl;
  }
}