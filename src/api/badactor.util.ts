import { TaskQueue } from "../manager";
import { Connection } from "vscode-languageserver";

const BAD_ACTOR_COUNT = Math.pow(2, 30) - 1
const MIN_WAIT_TIME = 1000 //ms
export function badActor(connection: Connection) {
  let sum = 0;
  const startTime = Date.now();
  for (let i = 0; i < BAD_ACTOR_COUNT; i++) {
    if (((i % Math.pow(2, 26)) === 0) && (Date.now() - startTime) > MIN_WAIT_TIME) {
      connection.console.log(`Bad actor progress: ${(sum / BAD_ACTOR_COUNT * 100).toFixed(2)}%`)
    }
    sum += 1;
  }
  connection.console.log(`Bad actor ${sum} (took ${Date.now() - startTime}ms)`);
}
let cancelToken: string | null;
export function badActorAsync(connection: Connection, taskQueue: TaskQueue) {
  if (cancelToken) {
    connection.console.log(`Found cancel token ${cancelToken}. Cancelling`)
    taskQueue.cancel(cancelToken);
  }
  const generator = badActorGenerator(connection);
  const myCancelToken = cancelToken = taskQueue.queueTask({
    callback: options => {
      // connection.console.log(`Running badactor ${JSON.stringify(options)}`)
      const r = generator.next(options)
      // connection.console.log(`Returning badactor ${JSON.stringify(r)}`)
      if (r.done) {
        if (cancelToken === myCancelToken) {
          connection.console.log(`Finished badactor, clearing token ${cancelToken}`)
          cancelToken = null;
        }
      }
      return r;
    }
  })
}
export function badActorCancel(taskQueue: TaskQueue) {
  if (cancelToken) {
    taskQueue.cancel(cancelToken);
  }
}
export function* badActorGenerator(connection: Connection) {
  let sum = 0;
  const startTime = Date.now();
  for (let i = 0; i < BAD_ACTOR_COUNT; i++) {
    if (i % Math.pow(2, 26) === 0) {
      connection.console.log(`Bad actor (async) progress: ${(sum / BAD_ACTOR_COUNT * 100).toFixed(2)}%`)
      let options = yield;
      if (options.cancel) {
        connection.console.log(`cancelling @${sum} (took ${Date.now() - startTime}ms)`)
        return;
      }
    }
    sum += 1;
  }
  connection.console.log(`Bad actor (async) ${sum} (took ${Date.now() - startTime}ms)`);
}
