import { Task, CallbackResult, Progress } from './types'
import { Connection, WorkDoneProgress } from 'vscode-languageserver';
import { nanoid } from 'nanoid/non-secure'

export interface TaskQueueOptions {
  minRunTime ?: number
}
interface InternalTask extends Task {
  cancel : boolean;
  id : string;
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
  constructor(connection : Connection, { minRunTime } : TaskQueueOptions = {}) {
    this.minRunTime = minRunTime ?? 100;
    this.connection = connection;
    this._run = this._run.bind(this);
  }
  connection : Connection;
  minRunTime : number;
  tasks : Record<string, InternalTask> = {};
  queues : [InternalTask[], InternalTask[], InternalTask[]] = [[], [], []];
  selectedQueue : Priority | null = null;
  currentRun : Promise<null> | null = null;

  get currentQueue() : InternalTask[] | undefined {
    return this.queues[this.selectedQueue || -1]
  }
  public queueTask(task : Task, priority : Priority = Priority.STANDARD) : string {
    const id = nanoid();
    const internalTask : InternalTask = {
      ...task,
      id,
      cancel: false
    }
    this.queues[priority].push(internalTask);
    this.tasks[id] = internalTask;
    this.run();
    return id;
  }
  public cancel(id : string) {
    this.tasks[id].cancel = true;
  }
  public run() : Promise<null> {
    if (!this.currentRun) {
      this.currentRun = new Promise((resolve, reject) => {
        this._run(resolve, reject)
      }).then(() => this.currentRun = null);
    }
    return this.currentRun;
  }
  public tick() {
    const progress : Record<string,Progress> = {}
    const startTime : number = Date.now()
    do {
      const queue = this.currentQueue;
      if (!queue) { break; }
      const nextTask : InternalTask = queue[0];
      const result : CallbackResult = nextTask.callback({ cancel: !!nextTask.cancel });
      if (nextTask.progressToken && result.value) {
        progress[nextTask.progressToken] = result.value;
      }
      if (result.done) {
        queue.shift()
        delete this.tasks[nextTask.id]
      }
    } while (startTime + this.minRunTime < Date.now())
    Object.keys(progress).forEach(token => {
      this.connection.sendProgress(WorkDoneProgress.type, token, progress[token])
    });
  }
  private _run(resolve : () => void, reject : (e : any) => void) {
    this.selectedQueue =
      this.queues[Priority.HIGH].length ? Priority.HIGH :
      this.queues[Priority.STANDARD].length ? Priority.STANDARD :
      this.queues[Priority.LOW].length ? Priority.LOW :
      null;
    if (this.selectedQueue) {
      try {
        this.tick()
      } catch(e) {
        return reject(e)
      }
      setImmediate(this._run, resolve, reject)
    } else {
      return resolve()
    }
  }
}
