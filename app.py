from flask import Flask, render_template, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from sqlalchemy import String, Text, TypeDecorator, event
from sqlalchemy.dialects import sqlite
import csv
import io
import os
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Custom type to force TEXT storage in SQLite
class TextString(TypeDecorator):
    """A String type that forces TEXT storage in SQLite by using underscore prefix"""
    impl = Text  # Use Text instead of String
    cache_ok = True
    
    def process_bind_param(self, value, dialect):
        """Add underscore prefix to force TEXT storage"""
        if value is None:
            return None
        # Prefix with underscore to prevent SQLite numeric affinity
        return '_' + str(value)
    
    def process_result_value(self, value, dialect):
        """Remove the underscore prefix when retrieving"""
        if value is None:
            return None
        # Remove the underscore prefix
        if isinstance(value, str) and value.startswith('_'):
            return value[1:]
        return str(value)

app = Flask(__name__)
app.config['SECRET_KEY'] = 'lottery-secret-key-2026'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///lottery.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# Database Models
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)  # M-5, M-10, D-25, E-50, etc.
    series = db.Column(db.String(10), nullable=False)  # M, D, E
    denomination = db.Column(db.String(10), nullable=False)  # 5, 10, 25, 50
    purchase_rate = db.Column(db.Float, nullable=False, default=0)  # Default purchase rate
    sale_rate = db.Column(db.Float, nullable=False, default=0)  # Default sale rate
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    entries = db.relationship('StockEntry', backref='category', lazy=True, cascade='all, delete-orphan')

class Distributor(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    entries = db.relationship('StockEntry', backref='distributor', lazy=True)

class StockEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=False)
    distributor_id = db.Column(db.Integer, db.ForeignKey('distributor.id'), nullable=True)
    entry_date = db.Column(db.Date, nullable=False)
    ticket_code = db.Column(db.String(10), nullable=True)  # Manual code like 61A, 43G
    start_number = db.Column(TextString(20), nullable=False)
    end_number = db.Column(TextString(20), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    rate = db.Column(db.Float, nullable=False, default=0)
    amount = db.Column(db.Float, nullable=False, default=0)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Routes
@app.route('/')
def index():
    if current_user.is_authenticated:
        return render_template('dashboard.html')
    return render_template('index.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if User.query.filter_by(username=username).first():
            return jsonify({'success': False, 'message': 'Username already exists'}), 400
        
        user = User(username=username, password=generate_password_hash(password))
        db.session.add(user)
        db.session.commit()
        
        login_user(user)
        return jsonify({'success': True, 'message': 'Registration successful'})
    
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        user = User.query.filter_by(username=username).first()
        
        if user and check_password_hash(user.password, password):
            login_user(user)
            return jsonify({'success': True, 'message': 'Login successful'})
        
        return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
    
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return jsonify({'success': True})

@app.route('/api/user-info')
@login_required
def user_info():
    return jsonify({
        'username': current_user.username,
        'is_admin': current_user.is_admin
    })

@app.route('/api/categories', methods=['GET', 'POST'])
@login_required
def categories():
    if request.method == 'POST':
        if not current_user.is_admin:
            return jsonify({'success': False, 'message': 'Admin access required'}), 403
        
        data = request.get_json()
        name = data.get('name', '').upper()
        
        # Parse name like M25, D10, E50
        if not name or len(name) < 2:
            return jsonify({'success': False, 'message': 'Invalid format. Use format like M25, D10, E5'}), 400
        
        series = name[0]
        try:
            denomination = name[1:]
            # Validate series
            if series not in ['M', 'D', 'E']:
                return jsonify({'success': False, 'message': 'Series must be M, D, or E'}), 400
        except:
            return jsonify({'success': False, 'message': 'Invalid format. Use format like M25, D10, E5'}), 400
        
        # Check if category already exists
        if Category.query.filter_by(name=name).first():
            return jsonify({'success': False, 'message': 'Category already exists'}), 400
        
        category = Category(
            name=name,
            series=series,
            denomination=denomination,
            purchase_rate=float(data.get('purchase_rate', 0)),
            sale_rate=float(data.get('sale_rate', 0))
        )
        db.session.add(category)
        db.session.commit()
        
        return jsonify({'success': True, 'id': category.id, 'message': 'Category created'})
    
    categories = Category.query.all()
    return jsonify([{
        'id': c.id,
        'name': c.name,
        'series': c.series,
        'denomination': c.denomination,
        'purchase_rate': c.purchase_rate or 0,
        'sale_rate': c.sale_rate or 0
    } for c in categories])

@app.route('/api/categories/<int:category_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def manage_category(category_id):
    category = Category.query.get(category_id)
    if not category:
        return jsonify({'success': False, 'message': 'Category not found'}), 404
    
    if request.method == 'DELETE':
        if not current_user.is_admin:
            return jsonify({'success': False, 'message': 'Admin access required'}), 403
        
        db.session.delete(category)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Category deleted'})
    
    if request.method == 'PUT':
        if not current_user.is_admin:
            return jsonify({'success': False, 'message': 'Admin access required'}), 403
        
        data = request.get_json()
        name = data.get('name', '').upper()
        
        # Parse name like M25, D10, E50
        if not name or len(name) < 2:
            return jsonify({'success': False, 'message': 'Invalid format. Use format like M25, D10, E5'}), 400
        
        series = name[0]
        try:
            denomination = name[1:]
            # Validate series
            if series not in ['M', 'D', 'E']:
                return jsonify({'success': False, 'message': 'Series must be M, D, or E'}), 400
        except:
            return jsonify({'success': False, 'message': 'Invalid format. Use format like M25, D10, E5'}), 400
        
        # Check if new name already exists (excluding current category)
        existing = Category.query.filter_by(name=name).first()
        if existing and existing.id != category_id:
            return jsonify({'success': False, 'message': 'Category already exists'}), 400
        
        category.name = name
        category.series = series
        category.denomination = denomination
        category.purchase_rate = float(data.get('purchase_rate', category.purchase_rate or 0))
        category.sale_rate = float(data.get('sale_rate', category.sale_rate or 0))
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Category updated'})
    
    # GET
    return jsonify({
        'id': category.id,
        'name': category.name,
        'series': category.series,
        'denomination': category.denomination
    })

# Distributor API endpoints
@app.route('/api/distributors', methods=['GET', 'POST'])
@login_required
def distributors():
    if request.method == 'POST':
        if not current_user.is_admin:
            return jsonify({'success': False, 'message': 'Admin access required'}), 403
        
        data = request.get_json()
        name = data.get('name', '').strip()
        
        if not name:
            return jsonify({'success': False, 'message': 'Distributor name is required'}), 400
        
        # Check if distributor already exists
        if Distributor.query.filter_by(name=name).first():
            return jsonify({'success': False, 'message': 'Distributor already exists'}), 400
        
        distributor = Distributor(name=name)
        db.session.add(distributor)
        db.session.commit()
        
        return jsonify({'success': True, 'id': distributor.id, 'message': 'Distributor created'})
    
    distributors = Distributor.query.all()
    return jsonify([{
        'id': d.id,
        'name': d.name
    } for d in distributors])

@app.route('/api/distributors/<int:distributor_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def manage_distributor(distributor_id):
    distributor = Distributor.query.get(distributor_id)
    if not distributor:
        return jsonify({'success': False, 'message': 'Distributor not found'}), 404
    
    if request.method == 'DELETE':
        if not current_user.is_admin:
            return jsonify({'success': False, 'message': 'Admin access required'}), 403
        
        db.session.delete(distributor)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Distributor deleted'})
    
    if request.method == 'PUT':
        if not current_user.is_admin:
            return jsonify({'success': False, 'message': 'Admin access required'}), 403
        
        data = request.get_json()
        name = data.get('name', '').strip()
        
        if not name:
            return jsonify({'success': False, 'message': 'Distributor name is required'}), 400
        
        # Check if new name already exists (excluding current distributor)
        existing = Distributor.query.filter_by(name=name).first()
        if existing and existing.id != distributor_id:
            return jsonify({'success': False, 'message': 'Distributor already exists'}), 400
        
        distributor.name = name
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Distributor updated'})
    
    # GET
    return jsonify({
        'id': distributor.id,
        'name': distributor.name
    })

@app.route('/api/stock-entries', methods=['GET', 'POST'])
@login_required
def stock_entries():
    if request.method == 'POST':
        try:
            data = request.get_json()
            logger.info(f"[STOCK-ENTRY POST] Received data: {data}")
            logger.info(f"[STOCK-ENTRY POST] Start number type: {type(data.get('start_number'))}, value: {repr(data.get('start_number'))}")
            logger.info(f"[STOCK-ENTRY POST] End number type: {type(data.get('end_number'))}, value: {repr(data.get('end_number'))}")
            
            # Handle distributor_id - can be empty string, None, or a number
            distributor_id = data.get('distributor_id')
            if distributor_id == '' or distributor_id is None:
                distributor_id = None
            else:
                distributor_id = int(distributor_id)
            
            rate = float(data.get('rate', 0))
            quantity = int(data.get('quantity', 0))
            amount = rate * quantity
            
            entry = StockEntry(
                category_id=int(data.get('category_id')),
                distributor_id=distributor_id,
                entry_date=datetime.strptime(data.get('entry_date'), '%Y-%m-%d').date(),
                ticket_code=data.get('ticket_code', '').strip().upper() or None,
                start_number=data.get('start_number'),
                end_number=data.get('end_number'),
                quantity=quantity,
                rate=rate,
                amount=amount,
                notes=data.get('notes'),
                created_by=current_user.id
            )
            logger.info(f"[STOCK-ENTRY POST] Before commit - Start: {repr(entry.start_number)}, End: {repr(entry.end_number)}")
            
            db.session.add(entry)
            db.session.commit()
            
            # Verify immediately after commit
            logger.info(f"[STOCK-ENTRY POST] VERIFICATION AFTER COMMIT:")
            logger.info(f"  entry.start_number = {repr(entry.start_number)} (type: {type(entry.start_number).__name__})")
            logger.info(f"  entry.end_number = {repr(entry.end_number)} (type: {type(entry.end_number).__name__})")
            
            # Fetch from database immediately
            fetched = StockEntry.query.get(entry.id)
            logger.info(f"[STOCK-ENTRY POST] FETCHED FROM DATABASE:")
            logger.info(f"  fetched.start_number = {repr(fetched.start_number)} (type: {type(fetched.start_number).__name__})")
            logger.info(f"  fetched.end_number = {repr(fetched.end_number)} (type: {type(fetched.end_number).__name__})")
            
            return jsonify({'success': True, 'id': entry.id, 'message': 'Stock entry created'})
        except Exception as e:
            logger.error(f"[STOCK-ENTRY POST] Error: {str(e)}")
            db.session.rollback()
            return jsonify({'success': False, 'message': str(e)}), 500
    
    # Get all entries or filter by date
    date_filter = request.args.get('date')
    query = StockEntry.query
    
    if date_filter:
        query = query.filter_by(entry_date=datetime.strptime(date_filter, '%Y-%m-%d').date())
    
    entries = query.all()
    logger.info(f"[STOCK-ENTRY GET] Retrieved {len(entries)} entries")
    
    result = []
    for e in entries:
        logger.info(f"[STOCK-ENTRY GET] Entry ID {e.id} - Start: {repr(e.start_number)}, End: {repr(e.end_number)}")
        category = Category.query.get(e.category_id)
        distributor = Distributor.query.get(e.distributor_id) if e.distributor_id else None
        result.append({
            'id': e.id,
            'category': category.name if category else 'Unknown',
            'category_id': e.category_id,
            'distributor': distributor.name if distributor else '',
            'distributor_id': e.distributor_id,
            'date': e.entry_date.strftime('%Y-%m-%d'),
            'ticket_code': e.ticket_code or '',
            'start_number': e.start_number,
            'end_number': e.end_number,
            'quantity': e.quantity,
            'rate': e.rate or 0,
            'amount': e.amount or 0,
            'notes': e.notes
        })
    
    logger.info(f"[STOCK-ENTRY GET] Returning {len(result)} entries to frontend")
    return jsonify(result)

@app.route('/api/stock-entries/<int:entry_id>', methods=['PUT', 'DELETE'])
@login_required
def manage_stock_entry(entry_id):
    entry = StockEntry.query.get(entry_id)
    if not entry:
        return jsonify({'success': False, 'message': 'Entry not found'}), 404
    
    if request.method == 'DELETE':
        db.session.delete(entry)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Entry deleted'})
    
    # PUT - Update entry
    data = request.get_json()
    
    try:
        if 'category_id' in data:
            entry.category_id = int(data['category_id'])
        if 'ticket_code' in data:
            entry.ticket_code = data['ticket_code'].strip().upper() if data['ticket_code'] else None
        if 'start_number' in data:
            entry.start_number = data['start_number']
        if 'end_number' in data:
            entry.end_number = data['end_number']
        if 'quantity' in data:
            entry.quantity = int(data['quantity'])
        if 'rate' in data:
            entry.rate = float(data['rate'])
        # Recalculate amount
        entry.amount = (entry.rate or 0) * (entry.quantity or 0)
        
        db.session.commit()
        return jsonify({'success': True, 'message': 'Entry updated'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 400

@app.route('/api/export-csv')
@login_required
def export_csv():
    date_filter = request.args.get('date')
    
    query = StockEntry.query
    if date_filter:
        query = query.filter_by(entry_date=datetime.strptime(date_filter, '%Y-%m-%d').date())
    
    entries = query.all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Date', 'Category', 'Series', 'Denomination', 'Code', 'Start Number', 'End Number', 'Quantity', 'Rate', 'Amount', 'Notes'])
    
    for entry in entries:
        category = Category.query.get(entry.category_id)
        writer.writerow([
            entry.entry_date.strftime('%Y-%m-%d'),
            category.name,
            category.series,
            category.denomination,
            entry.ticket_code or '',
            entry.start_number,
            entry.end_number,
            entry.quantity,
            entry.rate or 0,
            entry.amount or 0,
            entry.notes or ''
        ])
    
    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode()),
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'lottery_stock_{datetime.now().strftime("%Y%m%d")}.csv'
    )

@app.route('/api/admin/make-admin', methods=['POST'])
@login_required
def make_admin():
    if not current_user.is_admin:
        return jsonify({'success': False, 'message': 'Admin access required'}), 403
    
    data = request.get_json()
    user = User.query.filter_by(username=data.get('username')).first()
    
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    
    user.is_admin = True
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'User promoted to admin'})

@app.route('/api/admin/users', methods=['GET'])
@login_required
def get_users():
    if not current_user.is_admin:
        return jsonify({'success': False, 'message': 'Admin access required'}), 403
    
    users = User.query.all()
    return jsonify([{
        'id': u.id,
        'username': u.username,
        'is_admin': u.is_admin,
        'created_at': u.created_at.strftime('%Y-%m-%d %H:%M:%S')
    } for u in users])

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        
        # Add rate and amount columns if they don't exist (migration for existing databases)
        from sqlalchemy import inspect, text
        inspector = inspect(db.engine)
        
        # Migrate stock_entry table
        stock_columns = [col['name'] for col in inspector.get_columns('stock_entry')]
        
        if 'rate' not in stock_columns:
            db.session.execute(text('ALTER TABLE stock_entry ADD COLUMN rate FLOAT DEFAULT 0'))
            logger.info("Added 'rate' column to stock_entry table")
        
        if 'amount' not in stock_columns:
            db.session.execute(text('ALTER TABLE stock_entry ADD COLUMN amount FLOAT DEFAULT 0'))
            logger.info("Added 'amount' column to stock_entry table")
        
        if 'ticket_code' not in stock_columns:
            db.session.execute(text('ALTER TABLE stock_entry ADD COLUMN ticket_code VARCHAR(10)'))
            logger.info("Added 'ticket_code' column to stock_entry table")
        
        # Migrate category table for purchase_rate and sale_rate
        category_columns = [col['name'] for col in inspector.get_columns('category')]
        
        if 'purchase_rate' not in category_columns:
            db.session.execute(text('ALTER TABLE category ADD COLUMN purchase_rate FLOAT DEFAULT 0'))
            logger.info("Added 'purchase_rate' column to category table")
        
        if 'sale_rate' not in category_columns:
            db.session.execute(text('ALTER TABLE category ADD COLUMN sale_rate FLOAT DEFAULT 0'))
            logger.info("Added 'sale_rate' column to category table")
        
        db.session.commit()
        
        # Create default admin user if doesn't exist
        admin_user = User.query.filter_by(username='admin').first()
        if not admin_user:
            admin_user = User(
                username='admin',
                password=generate_password_hash('admin'),
                is_admin=True
            )
            db.session.add(admin_user)
            db.session.commit()
            print("✓ Default admin user created: username='admin', password='admin'")
    
    app.run(debug=True, port=5000)
