import { WorkDoneProgressReport, ProgressToken, WorkDoneProgressEnd } from 'vscode-languageserver-protocol'
export type Progress = WorkDoneProgressReport | WorkDoneProgressEnd;
export type CallbackResult = IteratorResult<WorkDoneProgressReport | void, WorkDoneProgressEnd | void>;
export type ProgressOptions = { cancel: boolean };

export interface Task {
  callback: (options : ProgressOptions) => CallbackResult;
  progressToken ?: ProgressToken;
}
