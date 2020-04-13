import { WorkDoneProgressReport, ProgressToken, WorkDoneProgressEnd } from 'vscode-languageserver-protocol'
export type Progress = WorkDoneProgressReport | WorkDoneProgressEnd;
export type CallbackResult = IteratorResult<(() => WorkDoneProgressReport) | void, (() => WorkDoneProgressReport | WorkDoneProgressEnd) | void>;
export type ProgressOptions = { cancel: boolean };
export namespace ProgressOptions {
  export const Default = Object.freeze({ cancel: false });
}

export interface Task {
  callback: (options: ProgressOptions) => CallbackResult;
  progressToken?: ProgressToken;
}
