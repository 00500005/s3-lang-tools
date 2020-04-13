import { Task, CallbackResult, Progress } from './types'
import { Connection, WorkDoneProgress } from 'vscode-languageserver';
import { DebugConsole } from '../config/log'
import { nanoid } from 'nanoid/non-secure'

export interface TaskQueueOptions {
  debugConsole?: DebugConsole,
  minRunTime?: number
}
interface InternalTask extends Task {
  cancel: boolean;
  id: string;
}
export enum Priority {
  HIGH = 0,
  STANDARD = 1,
  LOW = 2,
}
/**
 * We use a task queue to prevent IO loop blocking.
 * This allows us to respond to various interactions from node.js
 */
export class TaskQueue {
  constructor(connection: Connection, debugConsole: DebugConsole, { minRunTime }: TaskQueueOptions = {}) {
    this.minRunTime = minRunTime ?? 100;
    this.connection = connection;
    this.debugConsole = debugConsole;
    this._run = this._run.bind(this);
  }
  connection: Connection;
  debugConsole: DebugConsole;
  minRunTime: number;
  tasks: Record<string, InternalTask> = {};
  queues: [InternalTask[], InternalTask[], InternalTask[]] = [[], [], []];
  selectedQueue: Priority | null = null;
  currentRun: Promise<any> | null = null;

  get currentQueue(): InternalTask[] | undefined {
    return this.queues[this.selectedQueue || -1]
  }
  public queueTask(task: Task, priority: Priority = Priority.STANDARD): string {
    const id = nanoid();
    const internalTask: InternalTask = {
      ...task,
      id,
      cancel: false
    }
    this.queues[priority].push(internalTask);
    this.tasks[id] = internalTask;
    this.run();
    return id;
  }
  public cancel(id: string) {
    if (!this.tasks[id]) {
      this.debugConsole.error(`Attempting to cancel nonexistant task ${id}`)
      return;
    }
    this.tasks[id].cancel = true;
  }
  public run(): Promise<null> {
    if (!this.currentRun) {
      this.currentRun = new Promise((resolve, reject) => {
        setImmediate(this._run, Date.now(), resolve, reject)
      }).finally(() => this.currentRun = null);
    }
    return this.currentRun;
  }
  public tick() {
    const progress: Record<string, () => Progress> = {}
    const startTime: number = Date.now()
    const queue = this.currentQueue!;
    do {
      if (queue.length === 0) { break; }
      const nextTask: InternalTask = queue[0];
      const result: CallbackResult = nextTask.callback({ cancel: !!nextTask.cancel });
      if (nextTask.progressToken && result.value) {
        progress[nextTask.progressToken] = result.value;
      }
      if (result.done) {
        queue.shift()
        delete this.tasks[nextTask.id]
      }
    } while (Date.now() - startTime < this.minRunTime)
    Object.keys(progress).forEach(token => {
      this.connection.sendProgress(WorkDoneProgress.type, token, progress[token]())
    });
    this.debugConsole.trace(`tick (${Date.now() - startTime}ms)`)
  }
  private _run(startTime: number, resolve: () => void, reject: (e: any) => void) {
    this.selectedQueue =
      this.queues[Priority.HIGH].length ? Priority.HIGH :
        this.queues[Priority.STANDARD].length ? Priority.STANDARD :
          this.queues[Priority.LOW].length ? Priority.LOW :
            null;
    if (this.selectedQueue) {
      try {
        this.tick()
      } catch (e) {
        this.debugConsole.error(`Got tick error: ${e}`)
        return reject(e)
      }
      setImmediate(this._run, startTime, resolve, reject)
    } else {
      this.debugConsole.trace(`Finished all task queues (${Date.now() - startTime}ms)`)
      return resolve()
    }
  }
}
