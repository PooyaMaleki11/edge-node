const http = require('http');
const net = require('net');
const { WebSocketServer } = require('ws');

const port = process.env.PORT || 8080;
// شناسه کاربری اختصاصی شما
const userID = (process.env.UUID || '0b567b0c-23d3-428b-9cee-f488828894db').replaceAll('-', '').toLowerCase();

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('System Online');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    let isFirst = true;
    let remoteSocket = null;

    ws.on('message', (msg) => {
        if (isFirst) {
            isFirst = false;
            if (msg.length < 18) {
                ws.close();
                return;
            }

            const version = msg[0];
            const clientUUID = msg.subarray(1, 17).toString('hex').toLowerCase();
            if (clientUUID !== userID) {
                ws.close();
                return;
            }

            let cursor = 17;
            const optLen = msg[cursor];
            cursor += 1 + optLen;

            const command = msg[cursor];
            cursor += 1;

            if (command !== 1) {
                ws.close();
                return;
            }

            const targetPort = msg.readUInt16BE(cursor);
            cursor += 2;

            const addrType = msg[cursor];
            cursor += 1;

            let targetHost = '';
            if (addrType === 1) {
                targetHost = msg.subarray(cursor, cursor + 4).join('.');
                cursor += 4;
            } else if (addrType === 2) {
                const domainLen = msg[cursor];
                cursor += 1;
                targetHost = msg.subarray(cursor, cursor + domainLen).toString();
                cursor += domainLen;
            } else if (addrType === 3) {
                const parts = [];
                for (let i = 0; i < 8; i++) {
                    parts.push(msg.readUInt16BE(cursor + i * 2).toString(16));
                }
                targetHost = parts.join(':');
                cursor += 16;
            } else {
                ws.close();
                return;
            }

            const initialPayload = msg.subarray(cursor);
            ws.send(Buffer.from([version, 0]));

            remoteSocket = net.connect(targetPort, targetHost, () => {
                if (initialPayload.length > 0) {
                    remoteSocket.write(initialPayload);
                }
            });

            remoteSocket.on('data', (chunk) => {
                if (ws.readyState === ws.OPEN) {
                    ws.send(chunk);
                }
            });

            remoteSocket.on('error', () => ws.close());
            remoteSocket.on('close', () => ws.close());
        } else {
            if (remoteSocket && !remoteSocket.destroyed) {
                remoteSocket.write(msg);
            }
        }
    });

    ws.on('close', () => {
        if (remoteSocket) remoteSocket.destroy();
    });

    ws.on('error', () => {
        if (remoteSocket) remoteSocket.destroy();
    });
});

server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
