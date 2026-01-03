"""
LOT - Lottery Ticket Management System
Portable Application with Native Window
"""
import sys
import os

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

# Now import Flask app and FlaskUI
from app import app, db
from flaskwebgui import FlaskUI

if __name__ == '__main__':
    # Create database tables if they don't exist
    with app.app_context():
        db.create_all()
    
    # Create and run the native window
    FlaskUI(
        app=app,
        server="flask",
        width=1200,
        height=800,
        fullscreen=False
    ).run()
    webview.start()
