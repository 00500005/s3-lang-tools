import { TextDocumentIdentifier } from "vscode-languageserver";
import { Main, SourceIndex } from "../parser";

export enum TaskState {
  NEW = 'NEW',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETE = 'COMPLETE',
}
export interface ParseTaskState {
  version: number;
  type: TaskState;
  text: string;
  sourceIndex?: SourceIndex;
}
export interface ParseTaskNew extends ParseTaskState {
  type: TaskState.NEW;
}
export interface ParseTaskQueued extends ParseTaskState {
  type: TaskState.QUEUED;
  taskId: string;
  cancelled: boolean;
}
export interface ParseTaskRunning extends ParseTaskState {
  type: TaskState.RUNNING;
  taskId: string;
  cancelled: boolean;
}
export interface ParseTaskComplete extends ParseTaskState {
  type: TaskState.COMPLETE;
  ast: Main.Token | null;
}
export interface ManagedSugarcubeDocData extends TextDocumentIdentifier {
  name: string;
  filename: string;
  versions: Record<number, ParseTaskState>;
  latestVersion: number;
  lastSuccessVersion?: number;
}
export interface TextDocumentGroupUpdate {
  id: number,
  count: number,
  progressToken: string
}

