"""
LOT - Lottery Ticket Management System
Portable Application with Native Window (using Chrome/Edge app mode)
"""
import sys
import os
import threading
import time
import subprocess
import webbrowser
import socket

# Unique port for LOT app (uncommon port to avoid conflicts)
# Avoids: 3000, 5000, 5173, 8000, 8080, 4200 etc.
APP_PORT = 52741

# Get the base path for bundled app
if getattr(sys, 'frozen', False):
    # Running as compiled exe
    BASE_DIR = sys._MEIPASS
    # Set the working directory to where the exe is located for database
    APP_DIR = os.path.dirname(sys.executable)
else:
    # Running as script
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    APP_DIR = BASE_DIR

# Change to app directory for database access
os.chdir(APP_DIR)

# Now import Flask app
from app import app, db

def find_free_port(start_port):
    """Find a free port starting from start_port"""
    port = start_port
    max_attempts = 100
    
    for _ in range(max_attempts):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', port))
                return port
        except OSError:
            port += 1
    
    return start_port  # Fallback

def find_browser():
    """Find Chrome or Edge browser path"""
    browsers = [
        # Chrome paths
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        # Edge paths
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]
    
    for browser in browsers:
        if os.path.exists(browser):
            return browser
    
    return None

def start_flask(port):
    """Start Flask server on specified port"""
    app.run(host='127.0.0.1', port=port, debug=False, use_reloader=False, threaded=True)

def open_app_window(url):
    """Open browser in app mode (no toolbar/address bar)"""
    browser_path = find_browser()
    
    if browser_path:
        # Open in app mode - creates a window without browser UI
        # Disable autofill, password manager, and other browser features
        try:
            subprocess.Popen([
                browser_path,
                f'--app={url}',
                '--new-window',
                '--window-size=1200,800',
                '--disable-extensions',
                '--disable-features=AutofillAddressProfileSave,AutofillCreditCardAuthentication,AutofillCreditCardUploadFeedback',
                '--disable-autofill-keyboard-accessory-view',
                '--disable-save-password-bubble',
                '--disable-translate',
                '--disable-sync',
                '--no-first-run',
                '--incognito',
            ])
            return True
        except Exception as e:
            print(f"Error opening browser: {e}")
    
    # Fallback to default browser
    webbrowser.open(url)
    return False

if __name__ == '__main__':
    # Create database tables if they don't exist
    with app.app_context():
        db.create_all()
    
    # Find a free port (starts with APP_PORT, increments if busy)
    port = find_free_port(APP_PORT)
    
    # Start Flask server in background thread
    server_thread = threading.Thread(target=start_flask, args=(port,), daemon=True)
    server_thread.start()
    
    # Wait for server to start
    time.sleep(1.5)
    
    # Open the app in a native-like window
    open_app_window(f'http://127.0.0.1:{port}')
    
    # Keep the main thread alive
    print("LOT is running. Close the browser window to exit.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Shutting down...")
    webview.start()
