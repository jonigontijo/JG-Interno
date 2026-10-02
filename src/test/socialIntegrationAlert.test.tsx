import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import SocialIntegrationAlert from "@/components/social/SocialIntegrationAlert";
const state = vi.hoisted(() => ({ admin: true, data: undefined as any, error: false }));
vi.mock("@/store/useAuthStore", () => ({ useAuthStore: (select: any) => select({ currentUser: { id: "admin", isAdmin: state.admin } }) }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: state.data, isError: state.error }) }));
vi.mock("@/lib/socialIntegration", () => ({ socialAction: vi.fn() }));
function show() { render(<MemoryRouter><SocialIntegrationAlert /></MemoryRouter>); }
afterEach(() => { cleanup(); state.admin = true; state.error = false; state.data = undefined; });
describe("integration alert", () => {
  it("shows external failures even when local queue is healthy", () => {
    state.data = { local_attention: 0, remote: { failed: 11, pending: 1 } }; show();
    expect(screen.getByRole("alert").textContent).toContain("11 envio(s) com falha e 1 pendente(s)");
  });
  it("shows local manual retries", () => {
    state.data = { local_attention: 2, remote: { failed: 0, pending: 0 } }; show();
    expect(screen.getByRole("alert").textContent).toContain("2 envio(s) do JG Interno");
  });
  it("does not treat an unavailable remote as healthy", () => {
    state.data = { local_attention: 0, remote: null }; show(); expect(screen.getByRole("alert")).toBeTruthy();
  });
  it("warns when the health request fails", () => { state.error = true; show(); expect(screen.getByRole("alert")).toBeTruthy(); });
  it("clears when both queues are healthy", () => {
    state.data = { local_attention: 0, remote: { failed: 0, pending: 0 } }; show(); expect(screen.queryByRole("alert")).toBeNull();
  });
  it("hides administrative data from other users", () => { state.admin = false; state.error = true; show(); expect(screen.queryByRole("alert")).toBeNull(); });
});
