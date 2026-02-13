import { createEmptyState } from "./types";

describe("createEmptyState", () => {
  it("uses connecting as initial sync status", () => {
    const state = createEmptyState();
    expect(state.status).toEqual({ status: "connecting" });
  });

  it("initializes empty collections", () => {
    const state = createEmptyState();
    expect(state.agents).toEqual([]);
    expect(state.sessions).toEqual([]);
    expect(state.message).toEqual({});
    expect(state.part).toEqual({});
    expect(state.permission).toEqual({});
    expect(state.sessionStatus).toEqual({});
  });
});
