#!/usr/bin/env python3
"""Start an ngrok tunnel for the ClipHunter AI backend."""

from pyngrok import ngrok
import os
import time

PORT = 5000
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.ngrok-url.txt')

try:
    # Disable ngrok auth token check
    ngrok.set_auth_token("")
    
    # Start tunnel
    tunnel = ngrok.connect(PORT, "http")
    url = tunnel.public_url
    
    print(f"✅ TUNNEL_URL={url}")
    print(f"🌍 Public URL: {url}")
    print(f"🔌 Forwarding to: localhost:{PORT}")
    
    # Write URL to file
    with open(OUTPUT_FILE, 'w') as f:
        f.write(url)
    
    print(f"📝 URL saved to: {OUTPUT_FILE}")
    print("🔄 Tunnel is running...")
    
    # Keep tunnel alive
    while True:
        time.sleep(10)
        
except Exception as e:
    print(f"❌ Error: {e}")
    # Clean up
    try:
        ngrok.kill()
    except:
        pass
    os._exit(1)
