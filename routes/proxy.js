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

    // Resolve IPv4 first to avoid IPv6 issues; then request using the IP with proper SNI/Host
    dns.lookup(parsedUrl.hostname, { family: 4 }, (err, address) => {
      if (err) {
        console.error('TMDB proxy DNS error:', err);
        return res.status(502).json({ success: false, error: 'DNS lookup failed' });
      }

      const requestOptions = {
        protocol: 'https:',
        hostname: address, // use IPv4 address
        servername: parsedUrl.hostname, // SNI
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BookNView-Server/1.0',
          'Host': parsedUrl.hostname
        },
        timeout: 30000
      };

      const reqUpstream = https.request(requestOptions, (proxyRes) => {
        // Forward status and content-type
        res.status(proxyRes.statusCode || 500);
        const contentType = proxyRes.headers['content-type'] || 'application/json; charset=utf-8';
        res.setHeader('Content-Type', contentType);

        let data = '';
        proxyRes.on('data', (chunk) => (data += chunk));
        proxyRes.on('end', () => {
          // If JSON, try to pass through as JSON; else send raw
          if (contentType.includes('application/json')) {
            try {
              const json = JSON.parse(data || '{}');
              return res.send(JSON.stringify(json));
            } catch (_) {
              // fallthrough
            }
          }
          res.send(data);
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
    });
  } catch (error) {
    console.error('Proxy route error:', error);
    res.status(500).json({ success: false, error: 'Proxy error' });
  }
});

module.exports = router;

