const express = require('express');
const axios = require('axios');
const { URL } = require('url');

const app = express();
app.use(express.json());

app.post('/api/generate-preview', async (req, res) => {
    const targetUrl = req.body.url;

    try {
        const parsedUrl = new URL(targetUrl);
        
        if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
            return res.status(400).json({ error: 'Only HTTP/HTTPS protocols are supported.' });
        }

        const response = await axios.get(parsedUrl.href, {
            timeout: 5000,
            maxRedirects: 0
        });

        const preview = response.data.toString().substring(0, 500);
        res.json({ success: true, preview });

    } catch (err) {
        console.error(`Preview generation failed: ${err.message}`);
        res.status(500).json({ error: 'Failed to generate preview.' });
    }
});

module.exports = app;
