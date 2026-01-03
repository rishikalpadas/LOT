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

class Party(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    sale_entries = db.relationship('SaleEntry', backref='party', lazy=True)

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

class SaleEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=False)
    party_id = db.Column(db.Integer, db.ForeignKey('party.id'), nullable=True)
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
    sale_category = db.relationship('Category', backref='sale_entries')

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

# Party API endpoints
@app.route('/api/parties', methods=['GET', 'POST'])
@login_required
def parties():
    if request.method == 'POST':
        if not current_user.is_admin:
            return jsonify({'success': False, 'message': 'Admin access required'}), 403
        
        data = request.get_json()
        name = data.get('name', '').strip()
        
        if not name:
            return jsonify({'success': False, 'message': 'Party name is required'}), 400
        
        # Check if party already exists
        if Party.query.filter_by(name=name).first():
            return jsonify({'success': False, 'message': 'Party already exists'}), 400
        
        party = Party(name=name)
        db.session.add(party)
        db.session.commit()
        
        return jsonify({'success': True, 'id': party.id, 'message': 'Party created'})
    
    parties = Party.query.all()
    return jsonify([{
        'id': p.id,
        'name': p.name
    } for p in parties])

@app.route('/api/parties/<int:party_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def manage_party(party_id):
    party = Party.query.get(party_id)
    if not party:
        return jsonify({'success': False, 'message': 'Party not found'}), 404
    
    if request.method == 'DELETE':
        if not current_user.is_admin:
            return jsonify({'success': False, 'message': 'Admin access required'}), 403
        
        db.session.delete(party)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Party deleted'})
    
    if request.method == 'PUT':
        if not current_user.is_admin:
            return jsonify({'success': False, 'message': 'Admin access required'}), 403
        
        data = request.get_json()
        name = data.get('name', '').strip()
        
        if not name:
            return jsonify({'success': False, 'message': 'Party name is required'}), 400
        
        # Check if new name already exists (excluding current party)
        existing = Party.query.filter_by(name=name).first()
        if existing and existing.id != party_id:
            return jsonify({'success': False, 'message': 'Party already exists'}), 400
        
        party.name = name
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Party updated'})
    
    # GET
    return jsonify({
        'id': party.id,
        'name': party.name
    })

# Helper function to check for overlapping ticket ranges
def check_overlapping_range(category_id, ticket_code, start_num, end_num, exclude_entry_id=None):
    """
    Check if a ticket range overlaps with existing entries for the same category and ticket code.
    Returns the overlapping entry if found, None otherwise.
    Two ranges [a, b] and [c, d] overlap if: a <= d AND c <= b
    """
    # Get all entries for this category with the same ticket code
    query = StockEntry.query.filter_by(category_id=category_id)
    
    # Filter by ticket code (both must match, including None)
    if ticket_code:
        query = query.filter_by(ticket_code=ticket_code)
    else:
        query = query.filter(StockEntry.ticket_code.is_(None))
    
    # Exclude the current entry if updating
    if exclude_entry_id:
        query = query.filter(StockEntry.id != exclude_entry_id)
    
    existing_entries = query.all()
    
    new_start = int(start_num)
    new_end = int(end_num)
    
    for entry in existing_entries:
        existing_start = int(entry.start_number)
        existing_end = int(entry.end_number)
        
        # Check for overlap: ranges overlap if new_start <= existing_end AND existing_start <= new_end
        if new_start <= existing_end and existing_start <= new_end:
            return entry
    
    return None

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
            
            category_id = int(data.get('category_id'))
            ticket_code = data.get('ticket_code', '').strip().upper() or None
            start_number = data.get('start_number')
            end_number = data.get('end_number')
            
            # Check for overlapping ranges
            overlapping = check_overlapping_range(category_id, ticket_code, start_number, end_number)
            if overlapping:
                category = Category.query.get(category_id)
                cat_name = category.name if category else 'Unknown'
                return jsonify({
                    'success': False, 
                    'message': f'Overlapping range exists for {cat_name} ({ticket_code or "no code"}): {overlapping.start_number} - {overlapping.end_number}'
                }), 400
            
            rate = float(data.get('rate', 0))
            quantity = int(data.get('quantity', 0))
            amount = rate * quantity
            
            entry = StockEntry(
                category_id=category_id,
                distributor_id=distributor_id,
                entry_date=datetime.strptime(data.get('entry_date'), '%Y-%m-%d').date(),
                ticket_code=ticket_code,
                start_number=start_number,
                end_number=end_number,
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
    
    # Get all entries or filter by date and distributor
    date_filter = request.args.get('date')
    distributor_id_filter = request.args.get('distributor_id')
    query = StockEntry.query
    
    if date_filter:
        query = query.filter_by(entry_date=datetime.strptime(date_filter, '%Y-%m-%d').date())
    
    if distributor_id_filter:
        query = query.filter_by(distributor_id=int(distributor_id_filter))
    
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
        # Get values for overlap check
        category_id = int(data.get('category_id', entry.category_id))
        ticket_code = data.get('ticket_code', entry.ticket_code)
        if ticket_code:
            ticket_code = ticket_code.strip().upper() if ticket_code else None
        start_number = data.get('start_number', entry.start_number)
        end_number = data.get('end_number', entry.end_number)
        
        # Check for overlapping ranges (exclude current entry)
        overlapping = check_overlapping_range(category_id, ticket_code, start_number, end_number, exclude_entry_id=entry_id)
        if overlapping:
            category = Category.query.get(category_id)
            cat_name = category.name if category else 'Unknown'
            return jsonify({
                'success': False, 
                'message': f'Overlapping range exists for {cat_name} ({ticket_code or "no code"}): {overlapping.start_number} - {overlapping.end_number}'
            }), 400
        
        entry.category_id = category_id
        entry.ticket_code = ticket_code
        entry.start_number = start_number
        entry.end_number = end_number
        
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

# API endpoint to check stock availability and find matching codes for a ticket range
@app.route('/api/check-stock-range', methods=['POST'])
@login_required
def check_stock_range():
    """
    Check if a ticket range exists in stock and return matching codes.
    Used by Sale screen to auto-populate or prompt for code.
    Only considers stock purchased on or before the sale date.
    """
    data = request.get_json()
    category_id = int(data.get('category_id'))
    start_num = data.get('start_number')
    end_num = data.get('end_number')
    sale_date_str = data.get('sale_date')
    
    new_start = int(start_num)
    new_end = int(end_num)
    
    # Get stock entries for this category, filtered by date if provided
    stock_query = StockEntry.query.filter_by(category_id=category_id)
    
    if sale_date_str:
        sale_date = datetime.strptime(sale_date_str, '%Y-%m-%d').date()
        stock_query = stock_query.filter(StockEntry.entry_date <= sale_date)
    
    stock_entries = stock_query.all()
    
    # Find all stock entries that contain the requested range
    matching_entries = []
    for stock in stock_entries:
        stock_start = int(stock.start_number)
        stock_end = int(stock.end_number)
        
        # Check if requested range is fully contained within this stock entry
        if new_start >= stock_start and new_end <= stock_end:
            matching_entries.append({
                'id': stock.id,
                'ticket_code': stock.ticket_code or '',
                'start_number': stock.start_number,
                'end_number': stock.end_number
            })
    
    if len(matching_entries) == 0:
        return jsonify({
            'available': False,
            'message': 'Tickets not available in stock for this date',
            'matches': []
        })
    elif len(matching_entries) == 1:
        return jsonify({
            'available': True,
            'auto_code': matching_entries[0]['ticket_code'],
            'matches': matching_entries
        })
    else:
        # Multiple matches with different codes
        return jsonify({
            'available': True,
            'multiple': True,
            'message': 'Multiple stock entries found. Please specify the code.',
            'matches': matching_entries
        })

# Helper function to check if ticket range is available in stock and return the matching stock entry
def find_stock_entry_for_range(category_id, ticket_code, start_num, end_num, sale_date=None):
    """
    Find the stock entry that contains the given ticket range.
    If sale_date is provided, only considers stock purchased on or before that date.
    Returns the stock entry if found, None otherwise.
    """
    new_start = int(start_num)
    new_end = int(end_num)
    
    # Get all stock entries for this category and ticket code
    stock_query = StockEntry.query.filter_by(category_id=category_id)
    if ticket_code:
        stock_query = stock_query.filter_by(ticket_code=ticket_code)
    else:
        stock_query = stock_query.filter(StockEntry.ticket_code.is_(None))
    
    # Filter by date - only stock purchased on or before sale date
    if sale_date:
        stock_query = stock_query.filter(StockEntry.entry_date <= sale_date)
    
    stock_entries = stock_query.all()
    
    # Find the stock entry that fully contains the requested range
    for stock in stock_entries:
        stock_start = int(stock.start_number)
        stock_end = int(stock.end_number)
        
        # Check if requested range is fully contained within this stock entry
        if new_start >= stock_start and new_end <= stock_end:
            return stock
    
    return None

# Helper function to deduct tickets from stock by splitting the stock entry
def deduct_from_stock(stock_entry, sell_start, sell_end, category):
    """
    Deduct a ticket range from a stock entry by splitting it.
    Returns list of new stock entries created (for the remaining ranges).
    """
    stock_start = int(stock_entry.start_number)
    stock_end = int(stock_entry.end_number)
    sell_start = int(sell_start)
    sell_end = int(sell_end)
    
    # Preserve leading zeros format
    num_length = len(stock_entry.start_number)
    
    new_entries = []
    denomination = int(category.denomination) if category else 1
    
    # Case 1: Selling the entire stock entry
    if sell_start == stock_start and sell_end == stock_end:
        # Delete the entire stock entry
        db.session.delete(stock_entry)
        return new_entries
    
    # Case 2: Selling from the beginning
    elif sell_start == stock_start:
        # Update the original entry to start after the sold range
        new_start = sell_end + 1
        stock_entry.start_number = str(new_start).zfill(num_length)
        ticket_count = stock_end - new_start + 1
        stock_entry.quantity = ticket_count * denomination
        stock_entry.amount = (stock_entry.rate or 0) * stock_entry.quantity
        return new_entries
    
    # Case 3: Selling from the end
    elif sell_end == stock_end:
        # Update the original entry to end before the sold range
        new_end = sell_start - 1
        stock_entry.end_number = str(new_end).zfill(num_length)
        ticket_count = new_end - stock_start + 1
        stock_entry.quantity = ticket_count * denomination
        stock_entry.amount = (stock_entry.rate or 0) * stock_entry.quantity
        return new_entries
    
    # Case 4: Selling from the middle - need to split into two entries
    else:
        # Update original entry for the first part (before sold range)
        new_end_first = sell_start - 1
        stock_entry.end_number = str(new_end_first).zfill(num_length)
        ticket_count_first = new_end_first - stock_start + 1
        stock_entry.quantity = ticket_count_first * denomination
        stock_entry.amount = (stock_entry.rate or 0) * stock_entry.quantity
        
        # Create new entry for the second part (after sold range)
        new_start_second = sell_end + 1
        ticket_count_second = stock_end - new_start_second + 1
        
        new_entry = StockEntry(
            category_id=stock_entry.category_id,
            distributor_id=stock_entry.distributor_id,
            entry_date=stock_entry.entry_date,
            ticket_code=stock_entry.ticket_code,
            start_number=str(new_start_second).zfill(num_length),
            end_number=str(stock_end).zfill(num_length),
            quantity=ticket_count_second * denomination,
            rate=stock_entry.rate,
            amount=(stock_entry.rate or 0) * ticket_count_second * denomination,
            notes=stock_entry.notes,
            created_by=stock_entry.created_by
        )
        db.session.add(new_entry)
        new_entries.append(new_entry)
        
        return new_entries

# Sale Entry API Endpoints
@app.route('/api/sale-entries', methods=['GET', 'POST'])
@login_required
def sale_entries():
    if request.method == 'POST':
        try:
            data = request.get_json()
            logger.info(f"[SALE-ENTRY POST] Received data: {data}")
            
            # Handle party_id - can be empty string, None, or a number
            party_id = data.get('party_id')
            if party_id == '' or party_id is None:
                party_id = None
            else:
                party_id = int(party_id)
            
            category_id = int(data.get('category_id'))
            ticket_code = data.get('ticket_code', '').strip().upper() or None
            start_number = data.get('start_number')
            end_number = data.get('end_number')
            
            # Parse the sale date
            sale_date = datetime.strptime(data.get('entry_date'), '%Y-%m-%d').date()
            
            # Find the stock entry that contains this range (only from stock purchased on or before sale date)
            stock_entry = find_stock_entry_for_range(category_id, ticket_code, start_number, end_number, sale_date)
            if not stock_entry:
                return jsonify({'success': False, 'message': f'Tickets {start_number}-{end_number} are not available in stock for this date. Stock must be purchased on or before the sale date.'}), 400
            
            # Get category for denomination
            category = Category.query.get(category_id)
            
            rate = float(data.get('rate', 0))
            quantity = int(data.get('quantity', 0))
            amount = rate * quantity
            
            # Deduct from stock (split the stock entry)
            deduct_from_stock(stock_entry, start_number, end_number, category)
            
            entry = SaleEntry(
                category_id=category_id,
                party_id=party_id,
                entry_date=sale_date,
                ticket_code=ticket_code,
                start_number=start_number,
                end_number=end_number,
                quantity=quantity,
                rate=rate,
                amount=amount,
                notes=data.get('notes'),
                created_by=current_user.id
            )
            
            db.session.add(entry)
            db.session.commit()
            
            return jsonify({'success': True, 'id': entry.id, 'message': 'Sale entry created'})
        except Exception as e:
            logger.error(f"[SALE-ENTRY POST] Error: {str(e)}")
            db.session.rollback()
            return jsonify({'success': False, 'message': str(e)}), 500
    
    # Get all entries or filter by date and party
    date_filter = request.args.get('date')
    party_id_filter = request.args.get('party_id')
    query = SaleEntry.query
    
    if date_filter:
        query = query.filter_by(entry_date=datetime.strptime(date_filter, '%Y-%m-%d').date())
    
    if party_id_filter:
        query = query.filter_by(party_id=int(party_id_filter))
    
    entries = query.all()
    
    result = []
    for e in entries:
        category = Category.query.get(e.category_id)
        party = Party.query.get(e.party_id) if e.party_id else None
        result.append({
            'id': e.id,
            'category': category.name if category else 'Unknown',
            'category_id': e.category_id,
            'party': party.name if party else '',
            'party_id': e.party_id,
            'date': e.entry_date.strftime('%Y-%m-%d'),
            'ticket_code': e.ticket_code or '',
            'start_number': e.start_number,
            'end_number': e.end_number,
            'quantity': e.quantity,
            'rate': e.rate or 0,
            'amount': e.amount or 0,
            'notes': e.notes
        })
    
    return jsonify(result)

# Helper function to restore tickets back to stock when a sale is deleted
def restore_to_stock(sale_entry):
    """
    Restore sold tickets back to stock.
    Tries to merge with adjacent stock entries if possible, otherwise creates a new entry.
    """
    category_id = sale_entry.category_id
    ticket_code = sale_entry.ticket_code
    start_num = int(sale_entry.start_number)
    end_num = int(sale_entry.end_number)
    num_length = len(sale_entry.start_number)
    
    # Get category for denomination
    category = Category.query.get(category_id)
    denomination = int(category.denomination) if category else 1
    
    # Find adjacent stock entries to merge with
    stock_query = StockEntry.query.filter_by(category_id=category_id)
    if ticket_code:
        stock_query = stock_query.filter_by(ticket_code=ticket_code)
    else:
        stock_query = stock_query.filter(StockEntry.ticket_code.is_(None))
    
    stock_entries = stock_query.all()
    
    # Look for entries that are immediately adjacent
    left_entry = None  # Entry that ends just before our start
    right_entry = None  # Entry that starts just after our end
    
    for stock in stock_entries:
        stock_start = int(stock.start_number)
        stock_end = int(stock.end_number)
        
        if stock_end == start_num - 1:
            left_entry = stock
        if stock_start == end_num + 1:
            right_entry = stock
    
    # Merge logic
    if left_entry and right_entry:
        # Merge all three: extend left to include right, delete right
        left_entry.end_number = right_entry.end_number
        new_start = int(left_entry.start_number)
        new_end = int(right_entry.end_number)
        ticket_count = new_end - new_start + 1
        left_entry.quantity = ticket_count * denomination
        left_entry.amount = (left_entry.rate or 0) * left_entry.quantity
        db.session.delete(right_entry)
    elif left_entry:
        # Extend left entry to include our range
        left_entry.end_number = str(end_num).zfill(num_length)
        new_start = int(left_entry.start_number)
        ticket_count = end_num - new_start + 1
        left_entry.quantity = ticket_count * denomination
        left_entry.amount = (left_entry.rate or 0) * left_entry.quantity
    elif right_entry:
        # Extend right entry to include our range
        right_entry.start_number = str(start_num).zfill(num_length)
        new_end = int(right_entry.end_number)
        ticket_count = new_end - start_num + 1
        right_entry.quantity = ticket_count * denomination
        right_entry.amount = (right_entry.rate or 0) * right_entry.quantity
    else:
        # Create new stock entry
        ticket_count = end_num - start_num + 1
        new_entry = StockEntry(
            category_id=category_id,
            distributor_id=None,  # Original distributor info is lost
            entry_date=sale_entry.entry_date,
            ticket_code=ticket_code,
            start_number=str(start_num).zfill(num_length),
            end_number=str(end_num).zfill(num_length),
            quantity=ticket_count * denomination,
            rate=0,  # Rate info from original purchase is lost
            amount=0,
            notes='Restored from cancelled sale',
            created_by=sale_entry.created_by
        )
        db.session.add(new_entry)

@app.route('/api/sale-entries/<int:entry_id>', methods=['PUT', 'DELETE'])
@login_required
def manage_sale_entry(entry_id):
    entry = SaleEntry.query.get(entry_id)
    if not entry:
        return jsonify({'success': False, 'message': 'Entry not found'}), 404
    
    if request.method == 'DELETE':
        # Restore tickets back to stock before deleting
        restore_to_stock(entry)
        db.session.delete(entry)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Sale entry deleted and tickets restored to stock'})
    
    # PUT - Update entry (only allow rate changes, not ticket range changes)
    data = request.get_json()
    
    try:
        # For simplicity, only allow updating rate (not changing ticket range)
        # Changing ticket range would require complex stock restoration/re-deduction
        if 'rate' in data:
            entry.rate = float(data['rate'])
        # Recalculate amount
        entry.amount = (entry.rate or 0) * (entry.quantity or 0)
        
        db.session.commit()
        return jsonify({'success': True, 'message': 'Sale entry updated'})
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
        
        # Migrate sale_entry table if it exists
        table_names = inspector.get_table_names()
        if 'sale_entry' in table_names:
            sale_columns = [col['name'] for col in inspector.get_columns('sale_entry')]
            
            if 'party_id' not in sale_columns:
                db.session.execute(text('ALTER TABLE sale_entry ADD COLUMN party_id INTEGER REFERENCES party(id)'))
                logger.info("Added 'party_id' column to sale_entry table")
        
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
