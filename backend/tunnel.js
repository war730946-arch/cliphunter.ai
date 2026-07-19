const localtunnel = require('localtunnel');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5000;
const OUTPUT = path.join(__dirname, '.tunnel-url.txt');

(async () => {
  try {
    const tunnel = await localtunnel({ 
      port: PORT,
      subdomain: 'cliphunter-api-' + Date.now().toString(36)
    });
    
    const url = tunnel.url;
    console.log('✅ TUNNEL_URL=' + url);
    fs.writeFileSync(OUTPUT, url);
    
    console.log('🌍 Public URL: ' + url);
    console.log('🔌 Forwarding to: localhost:' + PORT);
    
    tunnel.on('close', () => {
      console.log('❌ Tunnel closed');
      fs.unlinkSync(OUTPUT);
    });
  } catch (err) {
    console.error('❌ Tunnel error:', err.message);
    process.exit(1);
  }
})();
