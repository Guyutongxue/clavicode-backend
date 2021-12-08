import * as pty from "node-pty";
import { GdbController, GdbResponse } from "@gytx/tsgdbmi";
import { WsDebugGdbC2S, WsDebugGdbS2C } from './api';
import ws from "ws";
import path from "path";
import EventEmitter from "events";

export function debugExecution(ws: ws, filename: string) {
  type Stage = 'init' | 'forward' | 'silent';
  let stage: Stage = 'init';
  let deviceName  = "";

  function send(msg: WsDebugGdbS2C) {
    ws.send(Buffer.from(JSON.stringify(msg)));
  }

  // Launch a pseudo-terminal, for gdb debuggee's io.

  // Print current tty device name, and keep terminal open.
  const ptyProcess = pty.spawn(path.join(__dirname, "./utils/bin/pause"), [], {
    cwd: process.cwd(),
    env: process.env as { [key: string]: string },
  });
  ptyProcess.onData(function (data) {
    switch (stage) {
      case 'init': {
        deviceName += data;
        break;
      }
      case 'forward': {
        send({
          type: 'tout',
          content: data,
        });
        break;
      }
      case 'silent': {
        break;
      }
      default: {
        const _: never = stage;
      }
    }
  });

  // Launch gdb.
  const gdb = new GdbController();
  const SANDBOX_PATH = path.join(__dirname, './sandbox/bin/sandbox');
  const CWD = path.join(__dirname, './sandbox/bin');

  function onResponse(res: GdbResponse) {
    send({
      type: 'response',
      response: res
    });
  }

  function onClose() {
    ptyProcess.kill();
    send({
      type: 'closed',
      exitCode: 0,
    });
  }

  async function onStart() {
    stage = 'silent';
    gdb.launch('gdb', [], {
      cwd: CWD,
    });
    let pausedEvent: EventEmitter | null = new EventEmitter();
    gdb.onResponse((res) => {
      if (pausedEvent !== null && res.type === 'notify' && res.message === 'stopped') {
        pausedEvent.emit('paused', res);
        pausedEvent = null;
      }
      onResponse(res);
    });
    gdb.onClose(onClose);
    await gdb.sendRequest('-gdb-set follow-fork-mode child');
    await gdb.sendRequest('catch exec');
    await gdb.sendRequest(`-inferior-tty-set ${deviceName.trim()}`);
    await gdb.sendRequest(`-file-exec-and-symbols "${SANDBOX_PATH}"`);
    await gdb.sendRequest(`-gdb-set args --exe_path="${filename}"`);
    await new Promise<void>((resolve) => {
      pausedEvent?.addListener('paused', () => resolve());
      gdb.sendRequest('-exec-run');
    });
    await gdb.sendRequest(`-file-exec-and-symbols "${filename}"`);
    stage = 'forward';
    send({
      type: 'started',
      sourceFilePath: path.join(path.dirname(filename), path.parse(filename).name + '.cpp')
    });
  }

  ws.on('message', async (req: Buffer) => {
    const reqObj: WsDebugGdbC2S = JSON.parse(req.toString());
    console.log(reqObj);
    switch (reqObj.type) {
      case 'start': {
        onStart();
        break;
      }
      case 'request': {
        console.log(await gdb.sendRequest(reqObj.request));
        break;
      }
      case 'tin': {
        ptyProcess.write(reqObj.content);
        break;
      }
      case 'shutdown': {
        // gdb.sendRequest('-gdb-exit');
        gdb.exit();
        break;
      }
      default: {
        const _: never = reqObj;
      }
    }
  });

}
