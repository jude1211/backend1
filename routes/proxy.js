const express = require('express');
const https = require('https');
const dns = require('dns');
const { URL } = require('url');

const router = express.Router();

// Simple read-only proxy to bypass browser CORS for TMDB
// Usage: GET /api/v1/proxy/tmdb?url=<encoded TMDB URL>
// Security: Allow only api.themoviedb.org host and GET method
router.get('/tmdb', async (req, res) => {
  try {
    const target = req.query.url;
    if (!target) {
      return res.status(400).json({ success: false, error: 'Missing url parameter' });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(target);
    } catch (e) {
      return res.status(400).json({ success: false, error: 'Invalid URL' });
    }

    if (parsedUrl.hostname !== 'api.themoviedb.org') {
      return res.status(400).json({ success: false, error: 'Host not allowed' });
    }

    // Force IPv4 DNS lookup to avoid IPv6 connectivity issues (ETIMEDOUT)
    const lookupIPv4 = (hostname, opts, cb) => dns.lookup(hostname, { family: 4 }, cb);

    const requestOptions = {
      protocol: 'https:',
      hostname: parsedUrl.hostname,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      lookup: lookupIPv4,
      timeout: 15000
    };

    const reqUpstream = https.request(requestOptions, (proxyRes) => {
        res.status(proxyRes.statusCode || 500);
        // Forward content type if present
        const contentType = proxyRes.headers['content-type'];
        if (contentType) {
          res.setHeader('Content-Type', contentType);
        }
        let data = '';
        proxyRes.on('data', (chunk) => (data += chunk));
        proxyRes.on('end', () => {
          try {
            // Try to parse JSON to ensure consistent response
            const json = JSON.parse(data);
            res.json(json);
          } catch (_) {
            // Fallback to raw data
            res.send(data);
          }
        });
      });

    reqUpstream.on('timeout', () => {
      reqUpstream.destroy(new Error('Upstream timeout'));
    });

    reqUpstream.on('error', (err) => {
      console.error('TMDB proxy error:', err);
      res.status(502).json({ success: false, error: err.message || 'Upstream fetch failed' });
    });

    reqUpstream.end();
  } catch (error) {
    console.error('Proxy route error:', error);
    res.status(500).json({ success: false, error: 'Proxy error' });
  }
});

module.exports = router;

