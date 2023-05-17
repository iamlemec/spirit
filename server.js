// spirit server

import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import http from 'http'
import { Server } from 'socket.io'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = 8000;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get('/', (req, res) => {
    res.sendFile('index.html', { root: __dirname });
});

let dist = path.join(__dirname, 'dist');
app.use(express.static(dist));

io.on('connection', socket => {
    console.log('a user connected');
});
  
server.listen(port, () => {
    console.log(`listening on *:${port}`);
});
