// @ts-ignore
const globalApi = typeof acquireVsCodeApi !== "undefined" ? acquireVsCodeApi : undefined;
const windowApi = typeof window !== "undefined" ? (window as any).acquireVsCodeApi : undefined;
const api = globalApi || windowApi;

export const hasVscodeApi = !!api;

const noopVscode = {
  postMessage: (_message: unknown) => { },
};

export const vscode = api ? api() : noopVscode;
