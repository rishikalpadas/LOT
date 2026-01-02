import sqlite3
import os

# Check both possible paths
db_path = r'c:\Users\rishikalpa\Desktop\LOT\lottery.db'
instance_path = r'c:\Users\rishikalpa\Desktop\LOT\instance\lottery.db'

if os.path.exists(instance_path):
    db_path = instance_path
    
print(f'Using database: {db_path}')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check the raw data in the database
cursor.execute('SELECT id, start_number, end_number, typeof(start_number), typeof(end_number) FROM stock_entry')
rows = cursor.fetchall()

print('Raw data in SQLite:')
for row in rows:
    print(f'  ID: {row[0]}')
    print(f'    start_number: {repr(row[1])} (SQLite type: {row[3]})')
    print(f'    end_number: {repr(row[2])} (SQLite type: {row[4]})')

conn.close()
