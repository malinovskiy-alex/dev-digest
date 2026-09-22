import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import conventions from "../../../../../../../../../messages/en/conventions.json";
import skills from "../../../../../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";
import { CreateSkillFromConventionsModal } from "./CreateSkillFromConventionsModal";

const DRAFT = {
  name: "repo-conventions",
  description: "2 house conventions extracted from payments-api",
  type: "convention",
  body: "# payments-api-conventions\n\n## async-await-instead\nAlways await.\n",
  convention_ids: ["c1", "c2"],
  evidence_files: ["src/api/users.ts"],
};

const AGENTS = [
  { id: "ag1", name: "General Reviewer" },
  { id: "ag2", name: "API Contract Reviewer" },
];

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status < 400,
    status,
    statusText: "OK",
    json: () => Promise.resolve(body),
  } as Response);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderModal() {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ conventions, skills }}>
        <ToastProvider>
          <CreateSkillFromConventionsModal
            repoId="r1"
            repoName="acme/payments-api"
            onClose={onClose}
            onCreated={onCreated}
          />
        </ToastProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { onClose, onCreated };
}

/** The last POST body the component sent, parsed. */
function postedBody() {
  const call = fetchMock.mock.calls.find(
    ([, init]) => (init as RequestInit | undefined)?.method === "POST",
  );
  return JSON.parse((call?.[1] as RequestInit).body as string);
}

describe("CreateSkillFromConventionsModal", () => {
  it("opens on the server's draft, with every field filled in", async () => {
    fetchMock.mockImplementation((url: string) =>
      url.includes("/agents") ? jsonResponse(AGENTS) : jsonResponse(DRAFT),
    );
    renderModal();

    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue(DRAFT.name));
    expect(screen.getByLabelText("Description")).toHaveValue(DRAFT.description);
    expect(screen.getByRole("textbox", { name: "" })).toBeInTheDocument();
    expect(screen.getByText("repo-conventions.md")).toBeInTheDocument();
  });

  /**
   * The whole point of the modal: the draft is a starting point, and what the
   * user reads is what gets stored. An edited body must not be replaced by the
   * draft on the way out.
   */
  it("stores the edited body, not the draft", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? jsonResponse({ id: "sk1", name: "repo-conventions" }, 201)
        : url.includes("/agents")
          ? jsonResponse(AGENTS)
          : jsonResponse(DRAFT),
    );
    const { onCreated, onClose } = renderModal();
    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue(DRAFT.name));

    const body = screen.getAllByRole("textbox").at(-1)!;
    fireEvent.change(body, { target: { value: "# edited by hand" } });
    fireEvent.click(screen.getByRole("button", { name: /Create skill/ }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(postedBody().body).toBe("# edited by hand");
    expect(postedBody().convention_ids).toEqual(["c1", "c2"]);
    expect(onClose).toHaveBeenCalled();
  });

  it("sends the enabled choice the user made", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? jsonResponse({ id: "sk1", name: "x" }, 201)
        : url.includes("/agents")
          ? jsonResponse(AGENTS)
          : jsonResponse(DRAFT),
    );
    renderModal();
    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue(DRAFT.name));

    // It lands on: the body was just read in full, which is the vetting gate.
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: /Create skill/ }));

    await waitFor(() => expect(postedBody().enabled).toBe(false));
  });

  it("will not submit an empty name", async () => {
    fetchMock.mockImplementation((url: string) =>
      url.includes("/agents") ? jsonResponse(AGENTS) : jsonResponse(DRAFT),
    );
    renderModal();
    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue(DRAFT.name));

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "  " } });
    expect(screen.getByRole("button", { name: /Create skill/ })).toBeDisabled();
  });

  it("keeps the modal open and says why when the write fails", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? jsonResponse({ error: { code: "validation_error", message: "Name is taken." } }, 422)
        : url.includes("/agents")
          ? jsonResponse(AGENTS)
          : jsonResponse(DRAFT),
    );
    const { onClose } = renderModal();
    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue(DRAFT.name));

    fireEvent.click(screen.getByRole("button", { name: /Create skill/ }));

    expect(await screen.findByText("Name is taken.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("offers a retry when the draft itself cannot be built", async () => {
    fetchMock.mockImplementation(() =>
      jsonResponse(
        { error: { code: "no_accepted_conventions", message: "Accept at least one first." } },
        422,
      ),
    );
    renderModal();
    expect(await screen.findByText("Accept at least one first.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
