/* hooks/skills.ts — React Query hooks for the Skills page + the import flow (L02).
   Every skill read/write in the UI goes through here; components never fetch. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Skill, SkillImportPreview, SkillType, SkillVersion } from "@devdigest/shared";

export function useSkills() {
  return useQuery({
    queryKey: ["skills"],
    queryFn: () => api.get<Skill[]>("/skills"),
  });
}

export function useSkill(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill", id],
    queryFn: () => api.get<Skill>(`/skills/${id}`),
    enabled: !!id,
  });
}

export function useSkillVersions(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill-versions", id],
    queryFn: () => api.get<SkillVersion[]>(`/skills/${id}/versions`),
    enabled: !!id,
  });
}

export interface CreateSkillInput {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  enabled?: boolean;
}

export function useCreateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSkillInput) => api.post<Skill>("/skills", input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.setQueryData(["skill", data.id], data);
    },
  });
}

export interface UpdateSkillInput {
  id: string;
  patch: Partial<Pick<Skill, "name" | "description" | "type" | "body" | "enabled">>;
}

export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateSkillInput) => api.put<Skill>(`/skills/${id}`, patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.setQueryData(["skill", data.id], data);
      // A changed body minted a new version; the history list is now stale.
      qc.invalidateQueries({ queryKey: ["skill-versions", data.id] });
    },
  });
}

export interface DeleteSkillResult {
  ok: boolean;
  /** How many agents lost the skill — the delete cascades `agent_skills`. */
  unlinked_from: number;
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<DeleteSkillResult>(`/skills/${id}`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.removeQueries({ queryKey: ["skill", id] });
      // Any agent may have been attached to it.
      qc.invalidateQueries({ queryKey: ["agent-skills"] });
    },
  });
}

/** The upload as the API takes it: markdown as text, an archive as base64. */
export type ImportUpload =
  | { kind: "markdown"; filename: string; text: string }
  | { kind: "archive"; filename: string; base64: string };

/**
 * Parse an upload and return what WOULD be stored. Writes nothing, so there is
 * nothing to invalidate. A mutation rather than a query on purpose: it is a POST
 * with a body, it must not be cached, and it must not re-run on a refocus.
 */
export function useImportPreview() {
  return useMutation({
    mutationFn: (upload: ImportUpload) =>
      api.post<SkillImportPreview>("/skills/import/preview", upload),
  });
}

/** The confirm call: the same upload, the preview's token, and the edited fields. */
export type ConfirmImportInput = ImportUpload & {
  token: string;
  name: string;
  description: string;
  type: SkillType;
};

export function useConfirmImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ConfirmImportInput) => api.post<Skill>("/skills/import", input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.setQueryData(["skill", data.id], data);
    },
  });
}
