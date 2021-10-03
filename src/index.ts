// Copyright (C) 2021 Clavicode Team
// 
// This file is part of clavicode-backend.
// 
// clavicode-backend is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// clavicode-backend is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// 
// You should have received a copy of the GNU General Public License
// along with clavicode-backend.  If not, see <http://www.gnu.org/licenses/>.

import express from 'express';
import expressWs from 'express-ws';
import { Request, Response } from 'express';
import sandbox from './sandbox';

console.log(sandbox('hello', {
  arguments: ["abc", "def"],
  max_cpu_time: 2000,
  max_memory: 1024 * 1024 * 1024,
}));

const app = expressWs(express()).app;
const {
  PORT = "3000",
} = process.env;

app.get('/', (req: Request, res: Response) => {
  res.send({
    message: 'hello world',
  });
});
app.ws('/socketTest', function (ws, req) {
  ws.send(`{"message": "hello"}`);
  ws.on('message', function (msg) {
    const str = msg.toString();
    ws.send(`{"message": "received ${str.length} bytes"}`);
  });
  ws.on('close', function(){
    console.log('closed');
  })
})
app.listen(PORT, () => {
  console.log('server started at http://localhost:' + PORT);
});
