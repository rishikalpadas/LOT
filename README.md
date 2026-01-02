# Lottery Ticket Stock Management System

A complete web-based application for managing lottery ticket inventory with user authentication, admin controls, and CSV export functionality.

## Features

- **User Authentication**: Secure login and registration system
- **Admin Panel**: Define and manage lottery ticket categories
- **Stock Tracking**: Record lottery tickets by series (M/D/E) and denomination
- **Date-based Entries**: Track stock for specific dates with start/end ticket numbers
- **CSV Export**: Export stock data to CSV format for reporting
- **Offline Support**: Uses SQLite database - works completely offline
- **Responsive UI**: Works on desktop and mobile devices

## Installation

### Prerequisites
- Python 3.7+
- pip (Python package manager)

### Setup

1. Navigate to the project directory:
```bash
cd c:\Users\rishikalpa\Desktop\LOT
```

2. Create a virtual environment (recommended):
```bash
python -m venv venv
venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the application:
```bash
python app.py
```

5. Open your browser and navigate to:
```
http://localhost:5000
```

## Usage

### First Time Setup

1. **Register**: Create a new account
2. **Login**: Sign in with your credentials
3. **Become Admin**: The first user should be manually promoted to admin. Edit the database or:
   - Have another admin user promote you via the Admin Panel

### For Admin Users

**Managing Categories:**
- Go to "Admin Panel" → "Manage Categories"
- Add categories like:
  - M-5 (Morning, Denomination 5)
  - M-10 (Morning, Denomination 10)
  - D-25 (Day, Denomination 25)
  - E-50 (Evening, Denomination 50)
  - etc.

**Promoting Users to Admin:**
- Go to "Admin Panel" → "Make User Admin"
- Enter the username to promote

### For All Users

**Adding Stock Entries:**
1. Go to "Add Stock Entry"
2. Select date and category
3. Enter start and end ticket numbers (e.g., 29460 to 29500)
4. Add optional notes
5. Submit

**Viewing Stock:**
- Go to "View Stock Entries"
- Filter by date or view all entries
- Delete entries as needed

**Exporting Data:**
- Go to "Export Data"
- Optionally select a specific date
- Click "Export to CSV"
- A CSV file will be downloaded with all stock data

## Database

The application uses SQLite, which stores data in `lottery.db`. This file is created automatically on first run and doesn't require any external database setup.

## Project Structure

```
LOT/
├── app.py                 # Flask application and database models
├── requirements.txt       # Python dependencies
├── templates/
│   ├── index.html        # Landing page
│   ├── login.html        # Login page
│   ├── register.html     # Registration page
│   └── dashboard.html    # Main application dashboard
├── static/
│   ├── style.css         # Application styling
│   └── script.js         # Frontend JavaScript
└── lottery.db            # SQLite database (created on first run)
```

## API Endpoints

- `POST /register` - Register new user
- `POST /login` - User login
- `GET /logout` - User logout
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create new category (admin only)
- `DELETE /api/categories/<id>` - Delete category (admin only)
- `GET /api/stock-entries` - Get stock entries
- `POST /api/stock-entries` - Create stock entry
- `DELETE /api/stock-entries/<id>` - Delete stock entry
- `GET /api/export-csv` - Export data to CSV
- `POST /api/admin/make-admin` - Promote user to admin

## Troubleshooting

**Port 5000 already in use:**
- Modify the port in `app.py`: Change `app.run(debug=True, port=5000)` to a different port

**Database errors:**
- Delete `lottery.db` and restart the application to reset

**Module not found errors:**
- Ensure virtual environment is activated
- Run `pip install -r requirements.txt` again

## Support

For issues or questions, please check the console output for error messages and ensure all dependencies are properly installed.
