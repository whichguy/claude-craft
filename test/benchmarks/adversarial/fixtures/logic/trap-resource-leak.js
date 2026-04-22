const fs = require('fs');
const { processStream } = require('./stream-processor');


const activeConnections = new Map();

async function handleUpload(req, res) {
    const connectionId = req.headers['x-connection-id'];
    activeConnections.set(connectionId, Date.now());

    const filePath = `/tmp/upload_${connectionId}.dat`;
    const writeStream = fs.createWriteStream(filePath);

    req.pipe(writeStream);

    return new Promise((resolve, reject) => {
        writeStream.on('finish', async () => {
            try {


                const result = await processStream(filePath);

                fs.unlinkSync(filePath);
                activeConnections.delete(connectionId);
                
                res.status(200).json(result);
                resolve();
            } catch (err) {

                console.error("Stream processing failed");
                res.status(500).send("Internal Error");

                reject(err);
            }
        });

        writeStream.on('error', (err) => {
            res.status(500).send("Upload failed");
            reject(err);
        });
    });
}

module.exports = { handleUpload };
