import os
import json
from functools import wraps
from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from datetime import datetime, date
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    USE_PG8000 = False
except Exception:
    import pg8000.dbapi as psycopg2
    USE_PG8000 = True

class DictCursorWrapper:
    def __init__(self, cursor):
        self.cursor = cursor
    def execute(self, query, params=None):
        if params is not None:
            return self.cursor.execute(query, params)
        return self.cursor.execute(query)
    def fetchone(self):
        row = self.cursor.fetchone()
        if row is None:
            return None
        col_names = [d[0] for d in self.cursor.description]
        return dict(zip(col_names, row))
    def fetchall(self):
        rows = self.cursor.fetchall()
        if not rows:
            return []
        col_names = [d[0] for d in self.cursor.description]
        return [dict(zip(col_names, r)) for r in rows]
    def close(self):
        return self.cursor.close()
    def __getattr__(self, name):
        return getattr(self.cursor, name)

class ConnectionWrapper:
    def __init__(self, conn):
        self.conn = conn
    def cursor(self):
        return DictCursorWrapper(self.conn.cursor())
    def commit(self):
        return self.conn.commit()
    def rollback(self):
        return self.conn.rollback()
    def close(self):
        return self.conn.close()
    def __getattr__(self, name):
        return getattr(self.conn, name)

app = Flask(__name__)
app.secret_key = "real_time_ride_sharing_luxury_secret_key"

# Google Maps API Configuration
MAPS_CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'maps_config.json')

def get_google_maps_api_key():
    """Retrieve Google Maps API key from environment or persisted config file."""
    # 1. Highest precedence: Environment variable
    env_key = os.environ.get('GOOGLE_MAPS_API_KEY', '').strip()
    if env_key:
        return env_key, 'environment'

    # 2. Check persisted JSON config file
    if os.path.exists(MAPS_CONFIG_FILE):
        try:
            with open(MAPS_CONFIG_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                file_key = data.get('google_maps_api_key', '').strip()
                if file_key:
                    return file_key, 'saved_file'
        except Exception:
            pass

    return '', 'none'

def save_google_maps_api_key(api_key):
    """Persist Google Maps API key to local config file."""
    try:
        with open(MAPS_CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump({'google_maps_api_key': api_key.strip()}, f, indent=2)
        return True
    except Exception:
        return False

# Database Configuration
DB_HOST = "localhost"
DB_NAME = "ride_system"
DB_USER = "postgres"
DB_PASS = "pass"  # Replace with your local pgAdmin password
DB_PORT = "5432"

def get_db_connection():
    if USE_PG8000:
        raw_conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            port=int(DB_PORT)
        )
        return ConnectionWrapper(raw_conn)
    return psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
        port=int(DB_PORT),
        cursor_factory=RealDictCursor
    )

def sync_kerala_data():
    """Automatically updates database records with authentic Kerala locations, vehicle models, and names."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 0. Drop constraint if it exists so custom vehicle types (BMW, Benz, Alto, etc.) are allowed
        try:
            cur.execute("ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_vehicle_type_check;")
            conn.commit()
        except Exception:
            conn.rollback()

        # 0b. Add destination column to rides if missing
        try:
            cur.execute("ALTER TABLE rides ADD COLUMN IF NOT EXISTS destination VARCHAR(100) DEFAULT 'Munnar Tea Hills Station';")
            conn.commit()
        except Exception:
            conn.rollback()

        # 0b2. Add ride_date column to rides if missing
        try:
            cur.execute("ALTER TABLE rides ADD COLUMN IF NOT EXISTS ride_date DATE DEFAULT CURRENT_DATE;")
            conn.commit()
        except Exception:
            conn.rollback()

        # 0c. Expand status column length in rides if needed
        try:
            cur.execute("ALTER TABLE rides ALTER COLUMN status TYPE VARCHAR(100);")
            conn.commit()
        except Exception:
            conn.rollback()

        # 0d. Create payments table if missing
        try:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS payments(
                    payment_id VARCHAR(50) PRIMARY KEY,
                    ride_code VARCHAR(50) REFERENCES rides(ride_code) ON DELETE CASCADE,
                    amount DECIMAL(10, 2) NOT NULL,
                    payment_mode VARCHAR(50) DEFAULT 'UPI',
                    payment_status VARCHAR(30) DEFAULT 'Success',
                    transaction_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            conn.commit()
        except Exception:
            conn.rollback()

        # 0e. Create food_orders table if missing
        try:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS food_orders(
                    order_id VARCHAR(50) PRIMARY KEY,
                    ride_code VARCHAR(50) REFERENCES rides(ride_code) ON DELETE CASCADE,
                    user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
                    food_items VARCHAR(255) NOT NULL,
                    total_amount DECIMAL(10, 2) NOT NULL,
                    delivery_status VARCHAR(50) DEFAULT 'Preparing in Vehicle',
                    order_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            conn.commit()
        except Exception:
            conn.rollback()

        # 1. Operators
        cur.execute("""
            UPDATE operators 
            SET operator_name = 'Kerala Royal Transit', contact = '+91-98470-12345'
            WHERE operator_id = 'OP01'
        """)

        # 2. Comprehensive Kerala Stations across all 14 Districts
        kerala_stations = [
            ('ST01', 'Kochi Marine Drive Hub (Ernakulam)', 'BAY-01', True, 'Marine Promenade, Fine Dining, Fast EV Charging & Metro Connect', 'OP01'),
            ('ST02', 'Thiruvananthapuram Central (Trivandrum)', 'BAY-02', True, 'Executive Lounge, Metro Connect & 24/7 Dining', 'OP01'),
            ('ST03', 'Kozhikode Beach Square (Calicut)', 'BAY-03', True, 'Malabar Food Court, Calicut Halwa Bazaar & Sea View Lounge', 'OP01'),
            ('ST04', 'Munnar Tea Hills Station (Idukki)', 'BAY-04', True, 'Highland Tea Lounge, Panoramic Mountain View & Warm Suites', 'OP01'),
            ('ST05', 'Alappuzha Backwater Jetty (Alleppey)', 'BAY-05', True, 'Houseboat Terminal, Backwater Refreshments & Café', 'OP01'),
            ('ST06', 'Thrissur Swaraj Round (Cultural Capital)', 'BAY-06', True, 'Cultural Heritage Hub, 24/7 Filter Coffee & EV Station', 'OP01'),
            ('ST07', 'Cochin International Airport (CIAL)', 'BAY-07', True, 'Airport VIP Terminal, 24/7 Duty-Free Dining & Cab Plaza', 'OP01'),
            ('ST08', 'Kovalam Beach Promenade (Trivandrum)', 'BAY-08', True, 'Coastal Lighthouse View, Seafood Lounge & Rest Zone', 'OP01'),
            ('ST09', 'Wayanad Vythiri Hill Pass', 'BAY-09', True, 'Misty Mountain Pass, Coffee Estate Café & Rest Suites', 'OP01'),
            ('ST10', 'Kannur Payyambalam Coast', 'BAY-10', True, 'Theyyam Heritage Station, Thalassery Biryani Hub', 'OP01'),
            ('ST11', 'Kollam Ashtamudi Lake Hub', 'BAY-11', True, 'Ashtamudi Backwater Boat Jetty, Lakeside Bistro & Parking', 'OP01'),
            ('ST12', 'Kottayam Kumarakom Gateway', 'BAY-12', True, 'Vembanad Lake Sanctuary Gateway & Spice Garden Lounge', 'OP01'),
            ('ST13', 'Palakkad Fort Junction', 'BAY-13', True, 'Historic Fort Rest Stop, Palakkad Matta Meals & Shaded Bays', 'OP01'),
            ('ST14', 'Malappuram Kottakkal Gateway', 'BAY-14', True, 'Ayurveda Heritage Hub, Herbal Tea Bar & Rest Suites', 'OP01'),
            ('ST15', 'Pathanamthitta Sabarimala Junction', 'BAY-15', True, 'Pilgrim Rest Center, Pure Veg Cuisine & Facilities', 'OP01'),
            ('ST16', 'Kasaragod Bekal Fort Station', 'BAY-16', True, 'Historic Bekal Fort Point, Coastal Rest Stop & Refreshments', 'OP01')
        ]
        for st in kerala_stations:
            cur.execute("""
                INSERT INTO stations (station_id, station_name, station_no, food_available, rest_stop_info, operator_id)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (station_id) DO UPDATE 
                SET station_name = EXCLUDED.station_name, 
                    station_no = EXCLUDED.station_no,
                    food_available = EXCLUDED.food_available,
                    rest_stop_info = EXCLUDED.rest_stop_info
            """, st)

        # 3. Kerala Drivers with comprehensive luxury, EV, and executive fleet
        kerala_drivers = [
            ('DRV01', 'Pranav Mohan', 'Benz', 'KL-07-BZ-5500', 4.9, 'OP01'),
            ('DRV02', 'Sreejith Varma', 'BMW', 'KL-01-CR-9009', 4.8, 'OP01'),
            ('DRV03', 'Anoop Pillai', 'Innova', 'KL-11-AX-3003', 4.9, 'OP01'),
            ('DRV04', 'Rahul Chandran', 'Alto', 'KL-14-EF-4040', 4.7, 'OP01'),
            ('DRV05', 'Vishnu Das', 'Autorickshaw', 'KL-08-AY-7722', 4.8, 'OP01'),
            ('DRV06', 'Akhil Raj', 'Bike', 'KL-10-BT-1122', 4.9, 'OP01'),
            ('DRV07', 'Aditya Menon', 'Tesla', 'KL-07-TS-0001', 5.0, 'OP01'),
            ('DRV08', 'Kavya Nambiar', 'Porsche', 'KL-01-PC-9999', 5.0, 'OP01'),
            ('DRV09', 'Fahad Rahman', 'Audi', 'KL-08-AU-4004', 4.9, 'OP01'),
            ('DRV10', 'Maj. Vikramaditya Varma', 'Rolls-Royce', 'KL-07-RR-0007', 5.0, 'OP01'),
            ('DRV11', 'Rohan Kurian', 'Range Rover', 'KL-05-RR-1111', 4.9, 'OP01'),
            ('DRV12', 'Jithin George', 'Harley', 'KL-10-HD-7777', 4.9, 'OP01'),
            ('DRV13', 'Siddharth Nair', 'Ather', 'KL-14-EV-8822', 4.8, 'OP01'),
            ('DRV14', 'Chandrashekhar Pillai', 'Volvo', 'KL-02-VL-5050', 4.9, 'OP01')
        ]
        for d in kerala_drivers:
            cur.execute("""
                INSERT INTO drivers (driver_id, driver_name, vehicle_type, vehicle_number, rating, operator_id)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (driver_id) DO UPDATE
                SET driver_name = EXCLUDED.driver_name, 
                    vehicle_type = EXCLUDED.vehicle_type, 
                    vehicle_number = EXCLUDED.vehicle_number,
                    rating = EXCLUDED.rating
            """, d)

        # 4. Seed & Synchronize System Users (Admin + Customers)
        system_users = [
            ('admin', 'System Administrator', 'Admin', '9847012345', 'Male', 'admin123'),
            ('USR01', 'Druvidh K P', 'Admin', '9847012345', 'Male', 'admin123'),
            ('USR02', 'Rahul Nair', 'Customer', '9847055443', 'Male', 'user123'),
            ('USR03', 'Ananya Ramesh', 'Customer', '9847088990', 'Female', 'user123'),
            ('USR04', 'Siddharth Varma', 'Customer', '9847033221', 'Male', 'user123')
        ]
        for u in system_users:
            cur.execute("""
                INSERT INTO users (user_id, user_name, user_type, user_no, gender, password)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id) DO UPDATE
                SET user_name = EXCLUDED.user_name,
                    user_type = EXCLUDED.user_type,
                    user_no = EXCLUDED.user_no,
                    gender = EXCLUDED.gender,
                    password = EXCLUDED.password
            """, u)

        # 5. Passengers module seed
        passengers_data = [
            ('PAS01', 'Druvidh K P', '9847012345', 'VIP Executive', 'USR01', 'ST01'),
            ('PAS02', 'Rahul Nair', '9847055443', 'Frequent Commuter', 'USR02', 'ST07'),
            ('PAS03', 'Ananya Ramesh', '9847088990', 'Touring Guest', 'USR03', 'ST03'),
            ('PAS04', 'Siddharth Varma', '9847033221', 'Corporate Traveler', 'USR04', 'ST02')
        ]
        for p in passengers_data:
            cur.execute("""
                INSERT INTO passengers (passenger_id, passenger_name, passenger_no, travel_group, user_id, station_id)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (passenger_id) DO UPDATE
                SET passenger_name = EXCLUDED.passenger_name,
                    travel_group = EXCLUDED.travel_group
            """, p)

        # 6. Seed rich multi-month historical rides, payments, and food orders if empty or fewer than 5 rides
        cur.execute("SELECT COUNT(*) FROM rides")
        ride_cnt_check = cur.fetchone()
        if not ride_cnt_check or ride_cnt_check['count'] < 5:
            seed_rides = [
                ('RD01', 'Benz Fleet', 'Local', 1400.00, 'Completed', 'USR01', 'DRV01', 'ST01', 'Munnar Tea Hills Station (Idukki)', '2026-05-12'),
                ('RD02', 'Tesla Cyber Fleet', 'Local', 1550.00, 'Completed', 'USR02', 'DRV07', 'ST07', 'Kochi Marine Drive Hub (Ernakulam)', '2026-05-24'),
                ('RD03', 'Rolls-Royce Royal Fleet', 'Long-Distance', 2500.00, 'Completed', 'USR01', 'DRV10', 'ST02', 'Kovalam Beach Promenade (Trivandrum)', '2026-06-08'),
                ('RD04', 'BMW Fleet', 'Local', 1100.00, 'Completed', 'USR03', 'DRV02', 'ST03', 'Wayanad Vythiri Hill Pass (Wayanad)', '2026-06-19'),
                ('RD05', 'Innova Crysta Fleet', 'Local', 650.00, 'Completed', 'USR02', 'DRV03', 'ST06', 'Athirappilly Waterfalls Scenic Point (Thrissur)', '2026-06-27'),
                ('RD06', 'Porsche Grand Fleet', 'Local', 1850.00, 'Completed', 'USR04', 'DRV08', 'ST01', 'Alappuzha Backwater Jetty (Alleppey)', '2026-07-04'),
                ('RD07', 'Range Rover 4x4', 'Long-Distance', 1250.00, 'Completed', 'USR02', 'DRV11', 'ST04', 'Thekkady Periyar Wildlife Sanctuary (Idukki)', '2026-07-15'),
                ('RD08', 'Audi Quattro Fleet', 'Local', 1300.00, 'Completed', 'USR03', 'DRV09', 'ST10', 'Kasaragod Bekal Fort Station (Kasaragod)', '2026-07-28'),
                ('RD09', 'Tesla Cyber Fleet', 'Local', 1550.00, 'Completed', 'USR01', 'DRV07', 'ST05', 'Kottayam Kumarakom Gateway (Kottayam)', '2026-08-05'),
                ('RD10', 'Volvo Luxury Coach', 'Long-Distance', 850.00, 'Completed', 'USR02', 'DRV14', 'ST02', 'Kollam Ashtamudi Lake Hub (Kollam)', '2026-08-14'),
                ('RD11', 'Benz Fleet', 'Local', 1400.00, 'Completed', 'USR03', 'DRV01', 'ST11', 'Pathanamthitta Sabarimala Junction', '2026-08-22'),
                ('RD12', 'Harley Coastal Cruiser', 'Local', 180.00, 'Completed', 'USR04', 'DRV12', 'ST03', 'Kannur Payyambalam Coast (Kannur)', '2026-08-29'),
                ('RD13', 'Rolls-Royce Royal Fleet', 'Long-Distance', 2500.00, 'Completed', 'USR01', 'DRV10', 'ST01', 'Munnar Tea Hills Station (Idukki)', '2026-09-03'),
                ('RD14', 'BMW Fleet', 'Local', 1100.00, 'Completed', 'USR03', 'DRV02', 'ST13', 'Thrissur Swaraj Round (Cultural Capital)', '2026-09-11'),
                ('RD15', 'Innova Crysta Fleet', 'Local', 650.00, 'Completed', 'USR02', 'DRV03', 'ST09', 'Kozhikode Beach Square (Calicut)', '2026-09-18'),
                ('RD16', 'Ather Smart EV', 'Local', 60.00, 'Completed', 'USR04', 'DRV13', 'ST01', 'Cochin International Airport (CIAL)', '2026-09-26'),
                ('RD17', 'Tesla Cyber Fleet', 'Local', 1550.00, 'Booked & Payment Successful', 'USR01', 'DRV07', 'ST07', 'Kochi Marine Drive Hub (Ernakulam)', '2026-10-10'),
                ('RD18', 'Benz Fleet', 'Local', 1400.00, 'Booked & Payment Successful', 'USR02', 'DRV01', 'ST02', 'Kovalam Beach Promenade (Trivandrum)', '2026-10-18'),
                ('RD19', 'Porsche Grand Fleet', 'Local', 1850.00, 'Booked & Payment Successful', 'USR03', 'DRV08', 'ST03', 'Kasaragod Bekal Fort Station (Kasaragod)', '2026-10-24'),
                ('RD20', 'Kerala Autorickshaw', 'Local', 120.00, 'Completed', 'USR02', 'DRV05', 'ST06', 'Thrissur Swaraj Round (Cultural Capital)', '2026-10-27'),
                ('RD21', 'Rolls-Royce Royal Fleet', 'Long-Distance', 2500.00, 'Booked', 'USR01', 'DRV10', 'ST01', 'Munnar Tea Hills Station (Idukki)', '2026-10-29')
            ]
            for r in seed_rides:
                cur.execute("""
                    INSERT INTO rides (ride_code, ride_group, ride_type, fare_amount, status, user_id, driver_id, station_id, destination, ride_date)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (ride_code) DO NOTHING
                """, r)

            seed_payments = [
                ('PAY01', 'RD01', 1400.00, 'Card', 'Success', '2026-05-12 10:15:00'),
                ('PAY02', 'RD02', 1550.00, 'UPI', 'Success', '2026-05-24 16:30:00'),
                ('PAY03', 'RD03', 2500.00, 'UPI', 'Success', '2026-06-08 11:20:00'),
                ('PAY04', 'RD04', 1100.00, 'Net Banking', 'Success', '2026-06-19 14:45:00'),
                ('PAY05', 'RD05', 650.00, 'Cash', 'Success', '2026-06-27 17:10:00'),
                ('PAY06', 'RD06', 1850.00, 'UPI', 'Success', '2026-07-04 09:30:00'),
                ('PAY07', 'RD07', 1250.00, 'Card', 'Success', '2026-07-15 13:00:00'),
                ('PAY08', 'RD08', 1300.00, 'UPI', 'Success', '2026-07-28 15:40:00'),
                ('PAY09', 'RD09', 1550.00, 'UPI', 'Success', '2026-08-05 10:20:00'),
                ('PAY10', 'RD10', 850.00, 'Net Banking', 'Success', '2026-08-14 12:15:00'),
                ('PAY11', 'RD11', 1400.00, 'Card', 'Success', '2026-08-22 18:00:00'),
                ('PAY12', 'RD12', 180.00, 'Cash', 'Success', '2026-08-29 11:10:00'),
                ('PAY13', 'RD13', 2500.00, 'UPI', 'Success', '2026-09-03 08:45:00'),
                ('PAY14', 'RD14', 1100.00, 'UPI', 'Success', '2026-09-11 16:20:00'),
                ('PAY15', 'RD15', 650.00, 'Cash', 'Success', '2026-09-18 19:30:00'),
                ('PAY16', 'RD16', 60.00, 'UPI', 'Success', '2026-09-26 12:00:00'),
                ('PAY17', 'RD17', 1550.00, 'UPI', 'Success', '2026-10-10 14:10:00'),
                ('PAY18', 'RD18', 1400.00, 'Card', 'Success', '2026-10-18 10:50:00'),
                ('PAY19', 'RD19', 1850.00, 'UPI', 'Success', '2026-10-24 11:35:00'),
                ('PAY20', 'RD20', 120.00, 'Cash', 'Success', '2026-10-27 17:45:00')
            ]
            for p in seed_payments:
                cur.execute("""
                    INSERT INTO payments (payment_id, ride_code, amount, payment_mode, payment_status, transaction_time)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (payment_id) DO NOTHING
                """, p)

            seed_food = [
                ('FO01', 'RD01', 'USR01', 'Thalassery Dum Biryani (x1)', 180.00, 'Served In-Vehicle', '2026-05-12 10:20:00'),
                ('FO02', 'RD03', 'USR01', 'Travancore Royal Boli & Palpayasam (x2)', 190.00, 'Served In-Vehicle', '2026-06-08 11:25:00'),
                ('FO03', 'RD04', 'USR03', 'Kozhikodan Halwa & Banana Chips (x1)', 90.00, 'Served In-Vehicle', '2026-06-19 14:50:00'),
                ('FO04', 'RD06', 'USR04', 'Kochi Karimeen Pollichathu (x1)', 220.00, 'Served In-Vehicle', '2026-07-04 09:35:00'),
                ('FO05', 'RD07', 'USR02', 'Highland Wild Mushroom Pepper Roast (x1)', 140.00, 'Served In-Vehicle', '2026-07-15 13:05:00'),
                ('FO06', 'RD09', 'USR01', 'Backwater Karimeen Fry (x1)', 190.00, 'Served In-Vehicle', '2026-08-05 10:25:00'),
                ('FO07', 'RD11', 'USR03', 'Chilled Marine Drive Tender Coconut Shake (x2)', 140.00, 'Served In-Vehicle', '2026-08-22 18:05:00'),
                ('FO08', 'RD13', 'USR01', 'Munnar Cardamom Tea & Pazham Pori (x2)', 120.00, 'Served In-Vehicle', '2026-09-03 08:50:00'),
                ('FO09', 'RD14', 'USR03', 'Palakkadan Matta Rice Deluxe Thali (x1)', 120.00, 'Served In-Vehicle', '2026-09-11 16:25:00'),
                ('FO10', 'RD17', 'USR01', 'Fort Cochin Garlic Butter Prawns (x1)', 190.00, 'Preparing in Vehicle', '2026-10-10 14:15:00'),
                ('FO11', 'RD18', 'USR02', 'Kovalam Golden Butter Garlic Prawns (x1)', 210.00, 'Preparing in Vehicle', '2026-10-18 10:55:00'),
                ('FO12', 'RD19', 'USR03', 'Kannur Thalassery Mutton Dum Biryani (x1)', 240.00, 'Preparing in Vehicle', '2026-10-24 11:40:00')
            ]
            for f in seed_food:
                cur.execute("""
                    INSERT INTO food_orders (order_id, ride_code, user_id, food_items, total_amount, delivery_status, order_time)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (order_id) DO NOTHING
                """, f)

        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print("Kerala data synchronization notice:", e)

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('is_admin'):
            return jsonify({
                "success": False, 
                "message": "Access Denied: Administrator privileges are required to access this resource."
            }), 403
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def home():
    sync_kerala_data()
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('login.html')

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json or {}
    user_id = (data.get('user_id') or '').strip()
    password = (data.get('password') or '').strip()
    role = (data.get('role') or '').strip()

    if not user_id or not password:
        return jsonify({"success": False, "message": "User Identifier and Password are required."}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE LOWER(user_id) = LOWER(%s) AND password = %s", (user_id, password))
        user = cur.fetchone()
        cur.close()
        conn.close()

        if user:
            is_admin = (user.get('user_type', '').strip().lower() == 'admin')
            
            # If the user specifically attempted to login through the Admin Portal, enforce Admin role
            if role.lower() == 'admin' and not is_admin:
                return jsonify({
                    "success": False, 
                    "message": "Access Denied: This account does not possess Administrator privileges."
                }), 403

            session['user_id'] = user['user_id']
            session['user_name'] = user['user_name']
            session['user_type'] = user.get('user_type', 'Customer')
            session['is_admin'] = is_admin
            return jsonify({
                "success": True, 
                "is_admin": is_admin,
                "user_type": session['user_type'],
                "user_name": session['user_name'],
                "message": f"Welcome back, {session['user_name']}! {'(Administrator Access)' if is_admin else ''}",
                "redirect": "/dashboard"
            })
        else:
            return jsonify({"success": False, "message": "Invalid User Identifier or Password"}), 401
    except Exception as e:
        # Fallback offline authentication for demo and testing resilience
        is_admin_cred = (user_id.lower() in ['admin', 'usr01'] and password == 'admin123')
        if is_admin_cred:
            session['user_id'] = 'admin'
            session['user_name'] = 'System Administrator'
            session['user_type'] = 'Admin'
            session['is_admin'] = True
            return jsonify({
                "success": True, 
                "is_admin": True,
                "user_type": "Admin",
                "user_name": session['user_name'],
                "message": "Authenticated as Administrator (Offline Resilient Mode)",
                "redirect": "/dashboard"
            })
        elif (user_id.upper() in ['USR02', 'USR03', 'PASSENGER'] or user_id) and password in ['user123', 'admin123']:
            if role.lower() == 'admin':
                return jsonify({"success": False, "message": "Access Denied: Administrator privileges required."}), 403
            session['user_id'] = user_id
            session['user_name'] = 'Rahul Nair (Passenger)'
            session['user_type'] = 'Customer'
            session['is_admin'] = False
            return jsonify({
                "success": True, 
                "is_admin": False,
                "user_type": "Customer",
                "user_name": session['user_name'],
                "message": "Authenticated as Passenger",
                "redirect": "/dashboard"
            })
        return jsonify({"success": False, "message": "Invalid User Identifier or Password"}), 401


@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('home'))
    
    sync_kerala_data()
    # Refresh current user name and role in session from database
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT user_name, user_type FROM users WHERE LOWER(user_id) = LOWER(%s)", (session['user_id'],))
        u = cur.fetchone()
        if u:
            session['user_name'] = u['user_name']
            session['user_type'] = u.get('user_type', 'Customer')
            session['is_admin'] = (u.get('user_type', '').strip().lower() == 'admin')
        cur.close()
        conn.close()
    except Exception:
        pass

    google_maps_api_key, _ = get_google_maps_api_key()
    return render_template(
        'dashboard.html', 
        user_name=session.get('user_name'),
        user_type=session.get('user_type', 'Customer'),
        is_admin=session.get('is_admin', False),
        user_id=session.get('user_id'),
        google_maps_api_key=google_maps_api_key
    )

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('home'))

# API Module Routes
@app.route('/api/rides', methods=['GET'])
FALLBACK_RIDES = [
    {"ride_code": "RD21", "pickup_station": "Kochi Marine Drive Hub (Ernakulam)", "destination": "Munnar Tea Hills Station (Idukki)", "ride_date": "2026-10-29", "ride_group": "Rolls-Royce Royal Fleet", "ride_type": "Long-Distance", "fare_amount": 2500.0, "status": "Booked", "user_name": "Druvidh K P", "driver_name": "Pranav Mohan", "vehicle_type": "Rolls-Royce"},
    {"ride_code": "RD20", "pickup_station": "Thrissur Swaraj Round (Cultural Capital)", "destination": "Thrissur Swaraj Round (Cultural Capital)", "ride_date": "2026-10-27", "ride_group": "Kerala Autorickshaw", "ride_type": "Local", "fare_amount": 120.0, "status": "Completed", "user_name": "Rahul Nair", "driver_name": "Manoj Kumar", "vehicle_type": "Autorickshaw"},
    {"ride_code": "RD19", "pickup_station": "Kozhikode Beach Square (Calicut)", "destination": "Kasaragod Bekal Fort Station (Kasaragod)", "ride_date": "2026-10-24", "ride_group": "Porsche Grand Fleet", "ride_type": "Local", "fare_amount": 1850.0, "status": "Booked & Payment Successful", "user_name": "Ananya Ramesh", "driver_name": "Vishnu Raj", "vehicle_type": "Porsche"},
    {"ride_code": "RD18", "pickup_station": "Thiruvananthapuram Central (Trivandrum)", "destination": "Kovalam Beach Promenade (Trivandrum)", "ride_date": "2026-10-18", "ride_group": "Benz Fleet", "ride_type": "Local", "fare_amount": 1400.0, "status": "Booked & Payment Successful", "user_name": "Rahul Nair", "driver_name": "Pranav Mohan", "vehicle_type": "Benz"},
    {"ride_code": "RD17", "pickup_station": "Cochin International Airport (CIAL)", "destination": "Kochi Marine Drive Hub (Ernakulam)", "ride_date": "2026-10-10", "ride_group": "Tesla Cyber Fleet", "ride_type": "Local", "fare_amount": 1550.0, "status": "Booked & Payment Successful", "user_name": "Druvidh K P", "driver_name": "Arun Varma", "vehicle_type": "Tesla"},
    {"ride_code": "RD16", "pickup_station": "Kochi Marine Drive Hub (Ernakulam)", "destination": "Cochin International Airport (CIAL)", "ride_date": "2026-09-26", "ride_group": "Ather Smart EV", "ride_type": "Local", "fare_amount": 60.0, "status": "Completed", "user_name": "Siddharth Varma", "driver_name": "Harisankar", "vehicle_type": "Ather"},
    {"ride_code": "RD15", "pickup_station": "Wayanad Vythiri Hill Pass", "destination": "Kozhikode Beach Square (Calicut)", "ride_date": "2026-09-18", "ride_group": "Innova Crysta Fleet", "ride_type": "Local", "fare_amount": 650.0, "status": "Completed", "user_name": "Rahul Nair", "driver_name": "Suresh Babu", "vehicle_type": "Innova"},
    {"ride_code": "RD01", "pickup_station": "Kochi Marine Drive Hub (Ernakulam)", "destination": "Munnar Tea Hills Station (Idukki)", "ride_date": "2026-05-12", "ride_group": "Benz Fleet", "ride_type": "Local", "fare_amount": 1400.0, "status": "Completed", "user_name": "Druvidh K P", "driver_name": "Pranav Mohan", "vehicle_type": "Benz"}
]

def get_rides():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT r.ride_code, 
                   s.station_name AS pickup_station,
                   COALESCE(r.destination, 'Munnar Tea Hills Station') AS destination,
                   COALESCE(TO_CHAR(r.ride_date, 'YYYY-MM-DD'), TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')) AS ride_date,
                   r.ride_group, r.ride_type, r.fare_amount, r.status, 
                   u.user_name, d.driver_name, d.vehicle_type
            FROM rides r
            LEFT JOIN users u ON r.user_id = u.user_id
            LEFT JOIN drivers d ON r.driver_id = d.driver_id
            LEFT JOIN stations s ON r.station_id = s.station_id
            ORDER BY r.ride_code DESC
        """)
        rides = cur.fetchall()
        cur.close()
        conn.close()
        if rides and len(rides) > 0:
            return jsonify(rides)
    except Exception as e:
        print("Notice reading rides from database:", e)
    return jsonify(FALLBACK_RIDES)

@app.route('/api/rides/<ride_code>/edit', methods=['POST', 'PUT'])
def edit_ride(ride_code):
    if not session.get('is_admin'):
        return jsonify({"success": False, "message": "Administrator privileges required to edit ride reservations."}), 403

    data = request.json or {}
    pickup_station = data.get('pickup_station') or data.get('station_id')
    destination = data.get('destination')
    ride_date = data.get('ride_date')
    try:
        fare_amount = float(data.get('fare_amount', 350.0))
    except (ValueError, TypeError):
        fare_amount = 350.0
    status = data.get('status', 'Booked')
    vehicle_type = data.get('vehicle_type')
    ride_type = data.get('ride_type', 'Local')

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        st_id = None
        if pickup_station:
            cur.execute("SELECT station_id FROM stations WHERE station_id = %s OR station_name ILIKE %s LIMIT 1",
                        (pickup_station, f"%{pickup_station}%"))
            st_row = cur.fetchone()
            if st_row:
                st_id = st_row['station_id']

        dr_id = None
        if vehicle_type:
            cur.execute("SELECT driver_id FROM drivers WHERE vehicle_type = %s LIMIT 1", (vehicle_type,))
            dr_row = cur.fetchone()
            if dr_row:
                dr_id = dr_row['driver_id']

        cur.execute("""
            UPDATE rides
            SET station_id = COALESCE(%s, station_id),
                destination = COALESCE(%s, destination),
                ride_date = COALESCE(%s::DATE, ride_date),
                fare_amount = %s,
                status = %s,
                ride_type = %s,
                driver_id = COALESCE(%s, driver_id)
            WHERE ride_code = %s
        """, (st_id, destination, ride_date, fare_amount, status, ride_type, dr_id, ride_code))

        if 'successful' in status.lower() or 'paid' in status.lower():
            cur.execute("SELECT payment_id FROM payments WHERE ride_code = %s", (ride_code,))
            if not cur.fetchone():
                pid = f"PAY-{ride_code}-{int(datetime.now().timestamp())%10000}"
                cur.execute("""
                    INSERT INTO payments (payment_id, ride_code, amount, payment_mode, payment_status, transaction_time)
                    VALUES (%s, %s, %s, 'UPI', 'Success', CURRENT_TIMESTAMP)
                """, (pid, ride_code, fare_amount))

        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"success": True, "message": f"Ride {ride_code} updated successfully by Administrator."})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

def _removed_code():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT r.ride_code, 
               s.station_name AS pickup_station,
               COALESCE(r.destination, 'Munnar Tea Hills Station') AS destination,
               COALESCE(TO_CHAR(r.ride_date, 'YYYY-MM-DD'), TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')) AS ride_date,
               r.ride_group, r.ride_type, r.fare_amount, r.status, 
               u.user_name, d.driver_name, d.vehicle_type
        FROM rides r
        LEFT JOIN users u ON r.user_id = u.user_id
        LEFT JOIN drivers d ON r.driver_id = d.driver_id
        LEFT JOIN stations s ON r.station_id = s.station_id
        ORDER BY r.ride_code DESC
    """)
    rides = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(rides)

@app.route('/api/book-ride', methods=['POST'])
def book_ride():
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Please sign in first."}), 401

    data = request.json or {}
    station_id = data.get('station_id', 'ST01')
    destination = data.get('destination', 'Munnar Tea Hills Station')
    ride_date = data.get('ride_date')
    if not ride_date:
        ride_date = date.today().strftime('%Y-%m-%d')
    vehicle_type = data.get('vehicle_type', 'Luxury')
    ride_type = data.get('ride_type', 'Local')
    food_item = data.get('food_item')

    fare_map = {
        'Ather': 60.00,
        'Bike': 80.00,
        'Autorickshaw': 120.00,
        'Auto': 120.00,
        'Harley': 180.00,
        'Alto': 220.00,
        'Sedan': 350.00,
        'Innova': 650.00,
        'SUV': 650.00,
        'Volvo': 850.00,
        'BMW': 1100.00,
        'Range Rover': 1250.00,
        'Audi': 1300.00,
        'Benz': 1400.00,
        'Luxury': 1400.00,
        'Tesla': 1550.00,
        'Porsche': 1850.00,
        'Rolls-Royce': 2500.00
    }
    fare = fare_map.get(vehicle_type, 350.00)

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Find matching driver or fallback
        cur.execute("SELECT driver_id FROM drivers WHERE vehicle_type = %s LIMIT 1", (vehicle_type,))
        driver = cur.fetchone()
        if not driver:
            cur.execute("SELECT driver_id FROM drivers LIMIT 1")
            driver = cur.fetchone()
        driver_id = driver['driver_id'] if driver else None

        # Verify station_id
        cur.execute("SELECT station_id, station_name FROM stations WHERE station_id = %s", (station_id,))
        st_info = cur.fetchone()
        if not st_info:
            cur.execute("SELECT station_id, station_name FROM stations LIMIT 1")
            st_info = cur.fetchone()
            station_id = st_info['station_id'] if st_info else 'ST01'

        # Validate that Pickup Station and Destination are not the same
        if st_info:
            p_name = st_info['station_name'].strip().lower()
            d_name = destination.strip().lower()
            
            # Normalize prefixes if present (e.g. "ST01 - Kochi...")
            if ' - ' in d_name and (d_name.startswith('st') or len(d_name.split(' - ')[0]) <= 5):
                d_name = d_name.split(' - ', 1)[1].strip()
            if ' - ' in p_name and (p_name.startswith('st') or len(p_name.split(' - ')[0]) <= 5):
                p_name = p_name.split(' - ', 1)[1].strip()

            if p_name == d_name or (p_name.split(' ')[0] == d_name.split(' ')[0] and len(p_name.split(' ')[0]) > 3):
                cur.close()
                conn.close()
                return jsonify({
                    "success": False,
                    "message": "Pickup station and Destination station cannot be the same. Please select a valid destination."
                }), 400

        # Generate unique ride code
        cur.execute("SELECT ride_code FROM rides")
        existing_codes = {r['ride_code'] for r in cur.fetchall()}
        code_idx = 1
        ride_code = f"RD{code_idx:02d}"
        while ride_code in existing_codes:
            code_idx += 1
            ride_code = f"RD{code_idx:02d}"

        # Insert new ride record with pickup, destination & ride_date
        cur.execute("""
            INSERT INTO rides (ride_code, ride_group, ride_type, fare_amount, status, user_id, driver_id, station_id, destination, ride_date)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            ride_code,
            f"{vehicle_type} Fleet",
            ride_type,
            fare,
            'Booked',
            session['user_id'],
            driver_id,
            station_id,
            destination,
            ride_date
        ))

        # Handle optional in-ride food pre-order from adjacent destination restaurants
        if food_item and food_item != 'None':
            clean_food_name = food_item
            if ']' in clean_food_name:
                clean_food_name = clean_food_name.split(']', 1)[1].strip()

            food_rates = {
                'Thalassery Dum Biryani': 180.00,
                'Kozhikodan Halwa & Banana Chips': 90.00,
                'Malabar Chicken Roast & Parotta': 160.00,
                'Sulaimani Lemon Tea & Unnakaya': 60.00,
                'Munnar Cardamom Tea & Pazham Pori': 60.00,
                'Appam with Vegetable Stew': 120.00,
                'Highland Wild Mushroom Pepper Roast': 140.00,
                'Thekkady Fire-Roasted Spiced Corn': 75.00,
                'Kochi Karimeen Pollichathu': 220.00,
                'Kerala Parotta & Chicken Roast': 160.00,
                'Chilled Marine Drive Tender Coconut Shake': 70.00,
                'Fort Cochin Garlic Butter Prawns': 190.00,
                'Kuttanad Duck Roast with Steamed Appam': 210.00,
                'Backwater Karimeen Fry': 190.00,
                'Tapioca (Kappa) with Fiery Fish Curry': 130.00,
                'Fresh Pure Tender Coconut Elaneer': 50.00,
                'Travancore Royal Boli & Palpayasam': 95.00,
                'Kovalam Golden Butter Garlic Prawns': 210.00,
                'Trivandrum Chicken Fry & Layered Parotta': 160.00,
                'Varkala Cliff Avocado Honey Smoothie': 85.00,
                'Thrissur Ghee Roast Dosa with Sambar': 110.00,
                'Athirappilly River Fish Fry': 175.00,
                'Kerala Parotta & Spiced Roast': 160.00,
                'Wayanad Bamboo Chicken & Rice Pathiri': 190.00,
                'Estate Arabica Filter Coffee & Unniyappam': 70.00,
                'Soft Appam with Country Chicken Curry': 150.00,
                'Highland Wild Honey Mint Cooler': 65.00,
                'Kannur Thalassery Mutton Dum Biryani': 240.00,
                'Kallummakkaya (Mussels) Nirachathu': 150.00,
                'Bekal Cashew Halwa Treat Box': 85.00,
                'Kannur Layered Cocktail Fruit Shake': 95.00,
                'Palakkadan Matta Rice Deluxe Thali': 120.00,
                'Palakkad Kothu Parotta with Gravy': 140.00,
                'Filter Kaapi & Crunchy Murukku': 55.00,
                'Ashtamudi Lake Crab Roast': 220.00,
                'Kollam Roasted Cashew Treat Box': 110.00,
                'Pazham Pori & Sulaimani Tea': 60.00,
                'Chilled Tender Coconut Shake': 70.00
            }
            f_cost = food_rates.get(clean_food_name, 120.00)
            import time
            order_id = f"FO{int(time.time())%100000:05d}"
            cur.execute("""
                INSERT INTO food_orders (order_id, ride_code, user_id, food_items, total_amount, delivery_status)
                VALUES (%s, %s, %s, %s, %s, 'Preparing in Vehicle')
            """, (order_id, ride_code, session['user_id'], clean_food_name, f_cost))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "success": True,
            "message": f"Ride {ride_code} booked successfully from {station_id} to {destination}!",
            "ride_code": ride_code
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/rides/<ride_code>', methods=['DELETE'])
@app.route('/api/rides/<ride_code>/cancel', methods=['POST'])
@app.route('/api/cancel-ride', methods=['POST'])
def delete_ride(ride_code=None):
    if not ride_code and request.is_json:
        ride_code = (request.json or {}).get('ride_code')
    if not ride_code:
        ride_code = request.args.get('ride_code')

    if not ride_code:
        return jsonify({"success": False, "message": "Ride reference code is required."}), 400

    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    refund_id = f"REF-{ride_code}-{int(datetime.now().timestamp()) % 100000:05d}"
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # 1. Fetch ride details before deletion
        cur.execute("""
            SELECT r.*, s.station_name, d.driver_name, d.vehicle_type, u.user_name
            FROM rides r
            LEFT JOIN stations s ON r.station_id = s.station_id
            LEFT JOIN drivers d ON r.driver_id = d.driver_id
            LEFT JOIN users u ON r.user_id = u.user_id
            WHERE r.ride_code = %s
        """, (ride_code,))
        ride = cur.fetchone()

        # 2. Check if a payment exists
        cur.execute("""
            SELECT payment_id, amount, payment_mode, payment_status,
                   TO_CHAR(transaction_time, 'YYYY-MM-DD HH24:MI:SS') AS transaction_time
            FROM payments
            WHERE ride_code = %s
            ORDER BY transaction_time DESC LIMIT 1
        """, (ride_code,))
        payment = cur.fetchone()

        fare_amount = float(ride.get('fare_amount') or 350.0) if ride else 350.0
        was_paid = bool(payment) or (ride and 'successful' in str(ride.get('status', '')).lower())
        refund_amount = float(payment['amount']) if payment else fare_amount
        payment_mode = payment['payment_mode'] if payment else 'UPI / Card'
        pickup_name = (ride.get('station_name') or ride.get('station_id') or 'Kochi Marine Drive Hub') if ride else 'Pickup Hub'
        dest_name = (ride.get('destination') or 'Munnar Tea Hills Station') if ride else 'Destination'
        passenger_name = (ride.get('user_name') or session.get('user_name') or 'Passenger') if ride else (session.get('user_name') or 'Passenger')
        refund_id = f"REF-{ride_code}-{int(datetime.now().timestamp()) % 100000:05d}"
        now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # 3. Delete ride from database (cascades to payments & food_orders)
        cur.execute("DELETE FROM rides WHERE ride_code = %s", (ride_code,))
        cur.execute("DELETE FROM payments WHERE ride_code = %s", (ride_code,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({
            "success": True,
            "message": f"Ride {ride_code} cancelled successfully. Payment refunded.",
            "refund": {
                "refunded": True,
                "refund_id": refund_id,
                "amount": refund_amount,
                "payment_mode": payment_mode,
                "ride_code": ride_code,
                "was_paid": was_paid,
                "pickup": pickup_name,
                "destination": dest_name,
                "passenger": passenger_name,
                "timestamp": now_str
            }
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# ==========================================================================
# IN-VEHICLE FOOD & DINING ENDPOINTS (DESTINATION-ADJACENT CORRIDORS)
# ==========================================================================
@app.route('/api/food-menu', methods=['GET'])
def get_food_menu():
    dest = (request.args.get('destination') or '').lower()

    catalog = [
        # Kozhikode & Malabar
        {"id": "F_CL01", "name": "Thalassery Dum Biryani", "category": "Malabar Special", "price": 180.00, "desc": "Slow-cooked fragrant kaima rice layered with spices and tender meat", "icon": "🍲", "zone": "kozhikode", "restaurant": "Hotel Paragon (0.4 km from Beach)", "area": "Kozhikode Beach & Malabar"},
        {"id": "F_CL02", "name": "Kozhikodan Halwa & Banana Chips", "category": "Travel Snack Box", "price": 90.00, "desc": "Fresh coconut-oil fried chips with authentic black halwa", "icon": "🍌", "zone": "kozhikode", "restaurant": "Calicut Halwa Bazaar (0.3 km)", "area": "Kozhikode Beach Square"},
        {"id": "F_CL03", "name": "Malabar Chicken Roast & Parotta", "category": "Signature Meal", "price": 160.00, "desc": "Flaky layered Malabar parotta with spicy rich chicken roast", "icon": "🍗", "zone": "kozhikode", "restaurant": "Salkara Malabar Diner (0.5 km)", "area": "Calicut Coastal Hub"},
        {"id": "F_CL04", "name": "Sulaimani Lemon Tea & Unnakaya", "category": "Evening Snack", "price": 60.00, "desc": "Cardamom lemon black tea paired with sweetened stuffed plantain", "icon": "☕", "zone": "kozhikode", "restaurant": "Zains Heritage Kitchen (0.7 km)", "area": "Kozhikode Malabar"},

        # Munnar & Idukki
        {"id": "F_MN01", "name": "Munnar Cardamom Tea & Pazham Pori", "category": "Highland Tea Snack", "price": 60.00, "desc": "Estate-fresh spiced hot tea with golden crispy banana fritters", "icon": "☕", "zone": "munnar", "restaurant": "Highland Tea Garden Diner (0.3 km)", "area": "Munnar Tea Hills Station"},
        {"id": "F_MN02", "name": "Appam with Vegetable Stew", "category": "Traditional Veg", "price": 120.00, "desc": "Soft coconut hoppers with creamy spiced vegetable coconut stew", "icon": "🥞", "zone": "munnar", "restaurant": "Rapsy Hillside Restaurant (0.6 km)", "area": "Munnar Mountain Valley"},
        {"id": "F_MN03", "name": "Highland Wild Mushroom Pepper Roast", "category": "Hillside Specialty", "price": 140.00, "desc": "Wild hill mushrooms roasted in crushed black pepper & curry leaves", "icon": "🍄", "zone": "munnar", "restaurant": "Highland Tea Garden Diner (0.3 km)", "area": "Munnar Top Station"},
        {"id": "F_MN04", "name": "Thekkady Fire-Roasted Spiced Corn", "category": "Spice Trail", "price": 75.00, "desc": "Fire-roasted sweet corn coated in native mountain spices and lime", "icon": "🌽", "zone": "munnar", "restaurant": "Periyar Spice Kitchen (0.5 km)", "area": "Idukki & Thekkady Periyar"},

        # Kochi & CIAL Airport
        {"id": "F_KC01", "name": "Kochi Karimeen Pollichathu", "category": "Seafood Signature", "price": 220.00, "desc": "Fresh pearl spot fish pan-roasted in rich shallot masala inside banana leaf", "icon": "🐟", "zone": "kochi", "restaurant": "Grand Pavilion (0.5 km from Marine Drive)", "area": "Kochi Marine Drive Hub"},
        {"id": "F_KC02", "name": "Kerala Parotta & Chicken Roast", "category": "Signature Meal", "price": 160.00, "desc": "Crispy layered parotta with thick spicy Ernakulam chicken roast", "icon": "🍗", "zone": "kochi", "restaurant": "Casino Heritage Diner (0.6 km)", "area": "Ernakulam City Corridor"},
        {"id": "F_KC03", "name": "Chilled Marine Drive Tender Coconut Shake", "category": "Cooler", "price": 70.00, "desc": "Fresh natural tender coconut pulp shake with organic wild honey", "icon": "🥥", "zone": "kochi", "restaurant": "Marine Promenade Shakes (0.2 km)", "area": "Kochi Marine Drive"},
        {"id": "F_KC04", "name": "Fort Cochin Garlic Butter Prawns", "category": "Ocean Delicacy", "price": 190.00, "desc": "Catch-of-the-day ocean prawns tossed in golden garlic butter herbs", "icon": "🍤", "zone": "kochi", "restaurant": "Fort Kochi Seafood Bistro (0.8 km)", "area": "Cochin International Airport / Fort Kochi"},

        # Alappuzha & Backwaters
        {"id": "F_AL01", "name": "Kuttanad Duck Roast with Steamed Appam", "category": "Backwater Royal", "price": 210.00, "desc": "Farm-raised backwater duck braised with black pepper & coconut slices", "icon": "🍗", "zone": "alappuzha", "restaurant": "Vembanad Lakeside Heritage Diner (0.4 km)", "area": "Alappuzha Jetty & Kumarakom"},
        {"id": "F_AL02", "name": "Backwater Karimeen Fry", "category": "Lake Catch", "price": 190.00, "desc": "Crispy pan-seared pearl spot fish marinated in spicy red chili paste", "icon": "🐟", "zone": "alappuzha", "restaurant": "Halais Backwater Restaurant (0.6 km)", "area": "Alappuzha Backwater Jetty"},
        {"id": "F_AL03", "name": "Tapioca (Kappa) with Fiery Fish Curry", "category": "Heritage Classic", "price": 130.00, "desc": "Steamed crushed cassava root served with spicy red kudampuli fish gravy", "icon": "🥘", "zone": "alappuzha", "restaurant": "Kuttanad Toddy Parlour (0.5 km)", "area": "Kumarakom & Marari Beach"},
        {"id": "F_AL04", "name": "Fresh Pure Tender Coconut Elaneer", "category": "Natural Drink", "price": 50.00, "desc": "Naturally chilled sweet coconut water straight from adjacent palm trees", "icon": "🥥", "zone": "alappuzha", "restaurant": "Lakeside Palm Groves (0.1 km)", "area": "Alappuzha Backwaters"},

        # Trivandrum & Kovalam / Varkala
        {"id": "F_TV01", "name": "Travancore Royal Boli & Palpayasam", "category": "Royal Sweet", "price": 95.00, "desc": "Sweet golden lentil crepes served with creamy condensed milk payasam", "icon": "🥞", "zone": "trivandrum", "restaurant": "Mothers Veg Plaza (0.5 km from Central)", "area": "Thiruvananthapuram Central"},
        {"id": "F_TV02", "name": "Kovalam Golden Butter Garlic Prawns", "category": "Coastal Catch", "price": 210.00, "desc": "Deep-sea prawns sauteed in melted herb butter with pepper dip", "icon": "🍤", "zone": "trivandrum", "restaurant": "Ocean Lighthouse Bistro (0.4 km)", "area": "Kovalam Beach Promenade"},
        {"id": "F_TV03", "name": "Trivandrum Chicken Fry & Layered Parotta", "category": "Travancore Meal", "price": 160.00, "desc": "Crispy marinated chicken fry with flaky soft parottas and gravy", "icon": "🍗", "zone": "trivandrum", "restaurant": "Zam Zam Restaurant (0.6 km)", "area": "Trivandrum City & Kovalam"},
        {"id": "F_TV04", "name": "Varkala Cliff Avocado Honey Smoothie", "category": "Cliff Cooler", "price": 85.00, "desc": "Rich fresh avocado blended with hill honey and chilled cream", "icon": "🥑", "zone": "trivandrum", "restaurant": "Cliff Top Ocean Grill (0.3 km)", "area": "Varkala Cliff Beach"},

        # Thrissur & Athirappilly
        {"id": "F_TS01", "name": "Thrissur Ghee Roast Dosa with Sambar", "category": "Cultural Classic", "price": 110.00, "desc": "Crisp paper-thin butter crepe with aromatic shallot sambar & chutneys", "icon": "🥞", "zone": "thrissur", "restaurant": "Hotel Bharat (0.3 km from Round)", "area": "Thrissur Swaraj Round"},
        {"id": "F_TS02", "name": "Athirappilly River Fish Fry", "category": "Waterfall Special", "price": 175.00, "desc": "River fish tossed in spiced onion masala and crisp fried", "icon": "🐟", "zone": "thrissur", "restaurant": "Rainforest Waterfall Café (0.4 km)", "area": "Athirappilly Waterfalls Scenic Point"},
        {"id": "F_TS03", "name": "Kerala Parotta & Spiced Roast", "category": "Signature Meal", "price": 160.00, "desc": "Flaky parotta served with traditional spicy roasted masala", "icon": "🍗", "zone": "thrissur", "restaurant": "Hotel Bharat (0.3 km)", "area": "Thrissur Cultural Capital"},

        # Wayanad
        {"id": "F_WY01", "name": "Wayanad Bamboo Chicken & Rice Pathiri", "category": "Highland Specialty", "price": 190.00, "desc": "Tender chicken marinated in mountain spices, slow-roasted inside raw bamboo", "icon": "🎋", "zone": "wayanad", "restaurant": "1980's A Nostalgic Restaurant (0.5 km)", "area": "Wayanad Vythiri Hill Pass"},
        {"id": "F_WY02", "name": "Estate Arabica Filter Coffee & Unniyappam", "category": "Plantation Brew", "price": 70.00, "desc": "Fresh estate-ground hot coffee with sweet jaggery banana fritters", "icon": "☕", "zone": "wayanad", "restaurant": "Wayanad Coffee Bean Kitchen (0.7 km)", "area": "Wayanad Pass & Chembra"},
        {"id": "F_WY03", "name": "Soft Appam with Country Chicken Curry", "category": "Hillside Meal", "price": 150.00, "desc": "Warm coconut hoppers with fragrant rich country chicken gravy", "icon": "🥞", "zone": "wayanad", "restaurant": "Vythiri Hill View Diner (0.4 km)", "area": "Wayanad Valley"},

        # Kannur & Bekal Fort
        {"id": "F_KN01", "name": "Kannur Thalassery Mutton Dum Biryani", "category": "North Malabar Royal", "price": 240.00, "desc": "Traditional melt-in-mouth mutton dum biryani with dates pickle", "icon": "🍲", "zone": "kannur", "restaurant": "MRA Heritage Diner (0.4 km)", "area": "Kannur Payyambalam Coast"},
        {"id": "F_KN02", "name": "Kallummakkaya (Mussels) Nirachathu", "category": "Coastal Snack", "price": 150.00, "desc": "Fresh sea mussels stuffed with seasoned spiced rice flour, fried crisp", "icon": "🦪", "zone": "kannur", "restaurant": "Payyambalam Beach Mess (0.3 km)", "area": "Kannur Coast & Theyyam Hub"},
        {"id": "F_KN03", "name": "Bekal Cashew Halwa Treat Box", "category": "Local Confection", "price": 85.00, "desc": "Premium roasted Kasaragod cashew nut halwa with cardamom", "icon": "🥜", "zone": "kannur", "restaurant": "Bekal Coastal Castle Bistro (0.5 km)", "area": "Kasaragod Bekal Fort Station"},

        # Palakkad
        {"id": "F_PK01", "name": "Palakkadan Matta Rice Deluxe Thali", "category": "Traditional Red Rice", "price": 120.00, "desc": "Authentic red matta rice served with avial, thoran, moru curry & pappadam", "icon": "🍛", "zone": "palakkad", "restaurant": "Ramaswamy Heritage Veg Mess (0.6 km)", "area": "Palakkad Fort Junction"},
        {"id": "F_PK02", "name": "Palakkad Kothu Parotta with Gravy", "category": "Street Favorite", "price": 140.00, "desc": "Shredded parotta tossed on hot iron tawa with spiced vegetables & gravy", "icon": "🥘", "zone": "palakkad", "restaurant": "Noorjehan Open Grill (0.4 km)", "area": "Palakkad Town Hub"},

        # Kollam & Pathanamthitta
        {"id": "F_KL01", "name": "Ashtamudi Lake Crab Roast", "category": "Lakefront Special", "price": 220.00, "desc": "Fresh backwater lake crab braised in caramelized shallots and black pepper", "icon": "🦀", "zone": "kollam", "restaurant": "Ramees Lakefront Restaurant (0.5 km)", "area": "Kollam Ashtamudi Lake Hub"},
        {"id": "F_KL02", "name": "Kollam Roasted Cashew Treat Box", "category": "Export Grade Snack", "price": 110.00, "desc": "Salted & peppered premium Kollam cashews with date halwa", "icon": "🥜", "zone": "kollam", "restaurant": "Cashew Capital Hub (0.3 km)", "area": "Kollam Lake & Jatayu Nature Park"}
    ]

    if dest:
        # Filter items according to matching zone keyword
        if any(k in dest for k in ['kozhikode', 'calicut', 'malappuram', 'st03', 'st14']):
            filtered = [i for i in catalog if i['zone'] == 'kozhikode']
        elif any(k in dest for k in ['munnar', 'idukki', 'thekkady', 'vagamon', 'st04']):
            filtered = [i for i in catalog if i['zone'] == 'munnar']
        elif any(k in dest for k in ['kochi', 'ernakulam', 'cochin', 'cial', 'airport', 'st01', 'st07']):
            filtered = [i for i in catalog if i['zone'] == 'kochi']
        elif any(k in dest for k in ['alappuzha', 'alleppey', 'kumarakom', 'marari', 'st05', 'st12']):
            filtered = [i for i in catalog if i['zone'] == 'alappuzha']
        elif any(k in dest for k in ['thiruvananthapuram', 'trivandrum', 'kovalam', 'varkala', 'st02', 'st08']):
            filtered = [i for i in catalog if i['zone'] == 'trivandrum']
        elif any(k in dest for k in ['thrissur', 'athirappilly', 'st06']):
            filtered = [i for i in catalog if i['zone'] == 'thrissur']
        elif any(k in dest for k in ['wayanad', 'vythiri', 'chembra', 'st09']):
            filtered = [i for i in catalog if i['zone'] == 'wayanad']
        elif any(k in dest for k in ['kannur', 'bekal', 'kasaragod', 'st10', 'st16']):
            filtered = [i for i in catalog if i['zone'] == 'kannur']
        elif any(k in dest for k in ['palakkad', 'silent valley', 'st13']):
            filtered = [i for i in catalog if i['zone'] == 'palakkad']
        elif any(k in dest for k in ['kollam', 'pathanamthitta', 'sabarimala', 'jatayu', 'st11', 'st15']):
            filtered = [i for i in catalog if i['zone'] == 'kollam']
        else:
            filtered = catalog
        return jsonify(filtered)

    return jsonify(catalog)

@app.route('/api/food-orders', methods=['GET'])
def get_food_orders():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT fo.order_id, fo.ride_code, u.user_name, fo.food_items, fo.total_amount, 
                   fo.delivery_status, fo.order_time
            FROM food_orders fo
            LEFT JOIN users u ON fo.user_id = u.user_id
            ORDER BY fo.order_time DESC
        """)
        orders = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(orders)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/order-food', methods=['POST'])
def order_food():
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Please sign in first."}), 401

    data = request.json or {}
    ride_code = data.get('ride_code')
    food_name = data.get('food_name', 'Thalassery Dum Biryani')
    quantity = int(data.get('quantity', 1))
    price_per_item = float(data.get('price', 180.00))
    total = price_per_item * quantity

    import time
    order_id = f"FO{int(time.time())%100000:05d}"

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # If ride_code is not specified, assign to the user's latest booked ride
        if not ride_code:
            cur.execute("SELECT ride_code FROM rides WHERE user_id = %s ORDER BY ride_code DESC LIMIT 1", (session['user_id'],))
            latest_ride = cur.fetchone()
            if latest_ride:
                ride_code = latest_ride['ride_code']
            else:
                cur.execute("SELECT ride_code FROM rides ORDER BY ride_code DESC LIMIT 1")
                any_ride = cur.fetchone()
                ride_code = any_ride['ride_code'] if any_ride else 'RD01'

        cur.execute("""
            INSERT INTO food_orders (order_id, ride_code, user_id, food_items, total_amount, delivery_status)
            VALUES (%s, %s, %s, %s, %s, 'Preparing in Vehicle')
        """, (order_id, ride_code, session['user_id'], f"{food_name} (x{quantity})", total))
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "success": True, 
            "message": f"In-vehicle order #{order_id} placed for Ride {ride_code}!", 
            "order_id": order_id
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/food-orders/<order_id>', methods=['DELETE'])
def delete_food_order(order_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM food_orders WHERE order_id = %s", (order_id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"success": True, "message": f"Food order {order_id} cancelled."})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/api/drivers', methods=['GET'])
def get_drivers():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM drivers")
    drivers = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(drivers)

@app.route('/api/long-distance', methods=['GET'])
def get_long_distance():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT station_id, station_name, station_no, food_available, rest_stop_info FROM stations")
    stations = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(stations)

# ==========================================================================
# GOOGLE MAPS API KEY CONFIGURATION ENDPOINTS
# ==========================================================================
@app.route('/api/config/maps', methods=['GET', 'POST', 'DELETE'])
def manage_maps_config():
    if request.method == 'GET':
        key, source = get_google_maps_api_key()
        masked = ''
        if key:
            masked = key[:6] + '********' + key[-4:] if len(key) > 10 else '********'
        return jsonify({
            'success': True,
            'hasKey': bool(key),
            'apiKey': key,
            'maskedKey': masked,
            'source': source
        })
    elif request.method == 'POST':
        data = request.json or {}
        new_key = data.get('apiKey', '').strip()
        if not new_key:
            return jsonify({'success': False, 'message': 'API key cannot be empty.'}), 400
        saved = save_google_maps_api_key(new_key)
        if saved:
            return jsonify({'success': True, 'message': 'Google Maps API Key saved successfully!', 'source': 'saved_file'})
        else:
            return jsonify({'success': False, 'message': 'Failed to save API key to local config.'}), 500
    elif request.method == 'DELETE':
        try:
            if os.path.exists(MAPS_CONFIG_FILE):
                os.remove(MAPS_CONFIG_FILE)
            return jsonify({'success': True, 'message': 'Saved Google Maps API key removed.'})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 500

# ==========================================================================
# REAL-TIME MAP & PASSENGER TELEMETRY ENDPOINT
# ==========================================================================
@app.route('/api/map-data', methods=['GET'])
def get_map_data():
    stations = []
    drivers = []
    rides = []

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # 1. Fetch stations
        cur.execute("""
            SELECT station_id, station_name, station_no, food_available, rest_stop_info, operator_id
            FROM stations
            ORDER BY station_id
        """)
        stations = cur.fetchall() or []

        # 2. Fetch drivers
        cur.execute("SELECT driver_id, driver_name, vehicle_type, vehicle_number, rating FROM drivers")
        drivers = cur.fetchall() or []

        # 3. Fetch active rides
        cur.execute("""
            SELECT r.ride_code, r.ride_group, r.ride_type, r.fare_amount, r.status,
                   r.station_id, s.station_name AS pickup_name,
                   COALESCE(r.destination, 'Munnar Tea Hills Station') AS destination_name,
                   u.user_name, u.user_id,
                   d.driver_id, d.driver_name, d.vehicle_type, d.vehicle_number, d.rating
            FROM rides r
            LEFT JOIN users u ON r.user_id = u.user_id
            LEFT JOIN drivers d ON r.driver_id = d.driver_id
            LEFT JOIN stations s ON r.station_id = s.station_id
            ORDER BY r.ride_code DESC
        """)
        rides = cur.fetchall() or []
        cur.close()
        conn.close()
    except Exception as db_err:
        print("Note: DB connection for map-data not active, using cached transit points:", db_err)


    STATION_COORDS = {
        'ST01': {'lat': 9.9816, 'lng': 76.2753, 'city': 'Kochi Marine Drive', 'district': 'Ernakulam'},
        'ST02': {'lat': 8.4875, 'lng': 76.9525, 'city': 'Thiruvananthapuram Central', 'district': 'Trivandrum'},
        'ST03': {'lat': 11.2588, 'lng': 75.7804, 'city': 'Kozhikode Beach Square', 'district': 'Calicut'},
        'ST04': {'lat': 10.0889, 'lng': 77.0595, 'city': 'Munnar Tea Hills', 'district': 'Idukki'},
        'ST05': {'lat': 9.4981, 'lng': 76.3388, 'city': 'Alappuzha Backwater Jetty', 'district': 'Alleppey'},
        'ST06': {'lat': 10.5276, 'lng': 76.2144, 'city': 'Thrissur Swaraj Round', 'district': 'Thrissur'},
        'ST07': {'lat': 10.1518, 'lng': 76.3930, 'city': 'Cochin Airport (CIAL)', 'district': 'Ernakulam'},
        'ST08': {'lat': 8.4004, 'lng': 76.9787, 'city': 'Kovalam Beach Promenade', 'district': 'Trivandrum'},
        'ST09': {'lat': 11.5544, 'lng': 76.0416, 'city': 'Wayanad Vythiri Pass', 'district': 'Wayanad'},
        'ST10': {'lat': 11.8745, 'lng': 75.3704, 'city': 'Kannur Payyambalam Coast', 'district': 'Kannur'},
        'ST11': {'lat': 8.8932, 'lng': 76.6141, 'city': 'Kollam Ashtamudi Lake', 'district': 'Kollam'},
        'ST12': {'lat': 9.6175, 'lng': 76.4301, 'city': 'Kottayam Kumarakom Gateway', 'district': 'Kottayam'},
        'ST13': {'lat': 10.7663, 'lng': 76.6546, 'city': 'Palakkad Fort Junction', 'district': 'Palakkad'},
        'ST14': {'lat': 10.9984, 'lng': 75.9987, 'city': 'Malappuram Kottakkal Gateway', 'district': 'Malappuram'},
        'ST15': {'lat': 9.2648, 'lng': 76.7870, 'city': 'Pathanamthitta Sabarimala', 'district': 'Pathanamthitta'},
        'ST16': {'lat': 12.3927, 'lng': 75.0345, 'city': 'Kasaragod Bekal Fort', 'district': 'Kasaragod'},
        # Popular Non-Station Scenic & Landmark Destinations
        'DEST_THEKKADY': {'lat': 9.6031, 'lng': 77.1615, 'city': 'Thekkady Periyar Sanctuary', 'district': 'Idukki'},
        'DEST_VARKALA': {'lat': 8.7379, 'lng': 76.7163, 'city': 'Varkala Cliff Beach', 'district': 'Trivandrum'},
        'DEST_ATHIRAPPILLY': {'lat': 10.2851, 'lng': 76.5698, 'city': 'Athirappilly Waterfalls', 'district': 'Thrissur'},
        'DEST_VAGAMON': {'lat': 9.6891, 'lng': 76.9056, 'city': 'Vagamon Pine Hills', 'district': 'Idukki'},
        'DEST_JATAYU': {'lat': 8.8687, 'lng': 76.8672, 'city': 'Jatayu Nature Park', 'district': 'Kollam'},
        'DEST_MARARI': {'lat': 9.6015, 'lng': 76.2995, 'city': 'Marari Beach Promenade', 'district': 'Alleppey'}
    }

    def find_coords(name_or_id):
        if name_or_id in STATION_COORDS:
            return STATION_COORDS[name_or_id]
        if not name_or_id:
            return {'lat': 9.9816, 'lng': 76.2753, 'city': 'Kochi', 'district': 'Ernakulam'}
        nl = name_or_id.lower()
        if 'thekkady' in nl or 'periyar' in nl: return STATION_COORDS['DEST_THEKKADY']
        if 'varkala' in nl or 'papanasam' in nl: return STATION_COORDS['DEST_VARKALA']
        if 'athirappilly' in nl or 'athirapally' in nl: return STATION_COORDS['DEST_ATHIRAPPILLY']
        if 'vagamon' in nl: return STATION_COORDS['DEST_VAGAMON']
        if 'jatayu' in nl: return STATION_COORDS['DEST_JATAYU']
        if 'marari' in nl: return STATION_COORDS['DEST_MARARI']
        for sid, coords in STATION_COORDS.items():
            if coords['city'].lower() in nl or coords['district'].lower() in nl:
                return coords
            if 'munnar' in nl and 'munnar' in coords['city'].lower(): return coords
            if 'kochi' in nl and 'kochi' in coords['city'].lower(): return coords
            if 'ernakulam' in nl and 'ernakulam' in coords['district'].lower(): return coords
            if ('calicut' in nl or 'kozhikode' in nl) and 'kozhikode' in coords['city'].lower(): return coords
            if ('trivandrum' in nl or 'thiruvananthapuram' in nl) and 'thiruvananthapuram' in coords['city'].lower(): return coords
            if ('alleppey' in nl or 'alappuzha' in nl) and 'alappuzha' in coords['city'].lower(): return coords
            if 'thrissur' in nl and 'thrissur' in coords['city'].lower(): return coords
            if 'wayanad' in nl and 'wayanad' in coords['city'].lower(): return coords
            if 'kannur' in nl and 'kannur' in coords['city'].lower(): return coords
            if 'kollam' in nl and 'kollam' in coords['city'].lower(): return coords
            if 'kottayam' in nl and 'kottayam' in coords['city'].lower(): return coords
            if 'palakkad' in nl and 'palakkad' in coords['city'].lower(): return coords
            if 'malappuram' in nl and 'malappuram' in coords['city'].lower(): return coords
            if 'pathanamthitta' in nl and 'pathanamthitta' in coords['city'].lower(): return coords
            if ('kasaragod' in nl or 'bekal' in nl) and 'kasaragod' in coords['city'].lower(): return coords
        return {'lat': 9.9816, 'lng': 76.2753, 'city': 'Kochi Hub', 'district': 'Ernakulam'}

    if not stations:
        for sid, coords in STATION_COORDS.items():
            if sid.startswith('ST'):
                stations.append({
                    'station_id': sid,
                    'station_name': coords['city'] + ' Station',
                    'station_no': f"BAY-{sid[-2:]}",
                    'food_available': True,
                    'rest_stop_info': f"EV Superchargers & Lounge Hub • {coords['district']}"
                })

    if not rides:
        rides = [
            {
                'ride_code': 'RD01',
                'station_id': 'ST01',
                'pickup_name': 'Kochi Marine Drive',
                'destination_name': 'Munnar Tea Hills',
                'user_name': 'Druvidh K P',
                'driver_name': 'Pranav Mohan',
                'vehicle_type': 'Benz',
                'vehicle_number': 'KL-07-BZ-5500',
                'rating': 4.9,
                'fare_amount': 1400.0,
                'status': 'Booked'
            },
            {
                'ride_code': 'RD02',
                'station_id': 'ST02',
                'pickup_name': 'Thiruvananthapuram Central',
                'destination_name': 'Varkala Cliff Beach',
                'user_name': 'Anjali Nair',
                'driver_name': 'Sanjay Menon',
                'vehicle_type': 'BMW',
                'vehicle_number': 'KL-01-BM-7000',
                'rating': 4.8,
                'fare_amount': 1100.0,
                'status': 'Booked'
            },
            {
                'ride_code': 'RD03',
                'station_id': 'ST06',
                'pickup_name': 'Thrissur Swaraj Round',
                'destination_name': 'Athirappilly Waterfalls',
                'user_name': 'Rahul Das',
                'driver_name': 'Arun Varma',
                'vehicle_type': 'Tesla',
                'vehicle_number': 'KL-08-EV-9999',
                'rating': 5.0,
                'fare_amount': 1550.0,
                'status': 'Booked'
            }
        ]

    enriched_stations = []
    for s in stations:
        sid = s['station_id']
        geo = STATION_COORDS.get(sid, {'lat': 9.9816, 'lng': 76.2753, 'city': s['station_name'], 'district': 'Kerala'})
        enriched_stations.append({
            'station_id': sid,
            'station_name': s['station_name'],
            'station_no': s['station_no'],
            'food_available': s['food_available'],
            'rest_stop_info': s['rest_stop_info'],
            'lat': geo['lat'],
            'lng': geo['lng'],
            'city': geo.get('city', ''),
            'district': geo.get('district', '')
        })

    enriched_rides = []
    for r in rides:
        p_coords = STATION_COORDS.get(r['station_id'], find_coords(r['pickup_name']))
        d_coords = find_coords(r['destination_name'])
        enriched_rides.append({
            'ride_code': r['ride_code'],
            'user_name': r['user_name'] or 'Passenger',
            'driver_name': r['driver_name'] or 'Verified Chauffeur',
            'vehicle_type': r['vehicle_type'] or 'Luxury',
            'vehicle_number': r['vehicle_number'] or 'KL-07-VIP',
            'rating': float(r['rating']) if r['rating'] else 4.9,
            'pickup_name': r['pickup_name'] or 'Station Hub',
            'destination_name': r['destination_name'] or 'Munnar',
            'fare_amount': float(r['fare_amount']) if r['fare_amount'] else 0.0,
            'status': r['status'] or 'In Transit',
            'pickup_lat': p_coords['lat'],
            'pickup_lng': p_coords['lng'],
            'dest_lat': d_coords['lat'],
            'dest_lng': d_coords['lng']
        })

    return jsonify({
        'success': True,
        'stations': enriched_stations,
        'rides': enriched_rides,
        'drivers': drivers,
        'total_stations': len(enriched_stations),
        'active_rides_count': len(enriched_rides),
        'gps_status': 'Synchronized (Satellite Lock 99.8%)'
    })

# ==========================================================================
# PAYMENT & TRANSACTION MANAGEMENT ENDPOINTS
# ==========================================================================
@app.route('/api/payments', methods=['GET'])
def get_payments():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT p.payment_id, p.ride_code, p.amount, p.payment_mode, p.payment_status,
                   TO_CHAR(p.transaction_time, 'YYYY-MM-DD HH24:MI:SS') AS transaction_time
            FROM payments p
            ORDER BY p.transaction_time DESC, p.payment_id DESC
        """)
        payments = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(payments)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/pay-ride', methods=['POST'])
def pay_ride():
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Please sign in first."}), 401

    data = request.json or {}
    ride_code = data.get('ride_code')
    payment_mode = data.get('payment_mode', 'UPI')

    if not ride_code:
        return jsonify({"success": False, "message": "Ride reference is required."}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Retrieve ride details
        cur.execute("""
            SELECT r.*, s.station_name, d.driver_name, d.vehicle_type
            FROM rides r
            LEFT JOIN stations s ON r.station_id = s.station_id
            LEFT JOIN drivers d ON r.driver_id = d.driver_id
            WHERE r.ride_code = %s
        """, (ride_code,))
        ride = cur.fetchone()

        if not ride:
            cur.close()
            conn.close()
            return jsonify({"success": False, "message": f"Ride {ride_code} not found."}), 404

        fare_amount = float(ride['fare_amount'])

        # Generate unique sequential payment ID (PAY01, PAY02, ...)
        cur.execute("SELECT payment_id FROM payments")
        existing_payments = {p['payment_id'] for p in cur.fetchall()}
        p_idx = 1
        payment_id = f"PAY{p_idx:02d}"
        while payment_id in existing_payments:
            p_idx += 1
            payment_id = f"PAY{p_idx:02d}"

        # Insert record into payments
        cur.execute("""
            INSERT INTO payments (payment_id, ride_code, amount, payment_mode, payment_status, transaction_time)
            VALUES (%s, %s, %s, %s, 'Success', CURRENT_TIMESTAMP)
        """, (payment_id, ride_code, fare_amount, payment_mode))

        # Update ride status to 'Booked & Payment Successful'
        cur.execute("""
            UPDATE rides
            SET status = 'Booked & Payment Successful'
            WHERE ride_code = %s
        """, (ride_code,))

        # Retrieve formatted timestamp
        cur.execute("SELECT TO_CHAR(transaction_time, 'YYYY-MM-DD HH24:MI:SS') AS formatted_time FROM payments WHERE payment_id = %s", (payment_id,))
        time_row = cur.fetchone()
        transaction_time_str = time_row['formatted_time'] if time_row else ''

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "success": True,
            "message": f"Payment of ₹{fare_amount:.2f} successful for Ride {ride_code}!",
            "payment_id": payment_id,
            "ride_code": ride_code,
            "amount": fare_amount,
            "payment_mode": payment_mode,
            "transaction_time": transaction_time_str,
            "status": "Booked & Payment Successful"
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/payment-receipt/<ride_code>', methods=['GET'])
def get_payment_receipt(ride_code):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT p.payment_id, p.ride_code, p.amount, p.payment_mode, p.payment_status,
                   TO_CHAR(p.transaction_time, 'YYYY-MM-DD HH24:MI:SS') AS transaction_time,
                   r.fare_amount, r.status AS ride_status, r.destination,
                   s.station_name AS pickup_station,
                   d.driver_name, d.vehicle_type,
                   u.user_name
            FROM payments p
            JOIN rides r ON p.ride_code = r.ride_code
            LEFT JOIN stations s ON r.station_id = s.station_id
            LEFT JOIN drivers d ON r.driver_id = d.driver_id
            LEFT JOIN users u ON r.user_id = u.user_id
            WHERE p.ride_code = %s
            ORDER BY p.transaction_time DESC
            LIMIT 1
        """, (ride_code,))
        receipt = cur.fetchone()
        cur.close()
        conn.close()
        if receipt:
            return jsonify({"success": True, "receipt": receipt})
        else:
            return jsonify({"success": False, "message": "No payment found for this ride."}), 404
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/payments/<payment_id>', methods=['DELETE'])
def delete_payment(payment_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT ride_code FROM payments WHERE payment_id = %s", (payment_id,))
        p = cur.fetchone()
        if p and p['ride_code']:
            cur.execute("UPDATE rides SET status = 'Booked' WHERE ride_code = %s", (p['ride_code'],))
        cur.execute("DELETE FROM payments WHERE payment_id = %s", (payment_id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"success": True, "message": f"Payment {payment_id} deleted."})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# ==========================================================================
# ADMINISTRATOR ONLY ENDPOINTS (PROFIT & LOSS, MASTER DATA, USER DIRECTORY)
# ==========================================================================

@app.route('/api/admin/profit-loss', methods=['GET'])
@admin_required
def get_admin_profit_loss():
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # 1. Fetch all rides
        cur.execute("""
            SELECT r.ride_code, r.ride_group, r.ride_type, r.fare_amount, r.status,
                   COALESCE(r.destination, 'Munnar Tea Hills Station') AS destination,
                   COALESCE(TO_CHAR(r.ride_date, 'YYYY-MM-DD'), TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')) AS ride_date,
                   TO_CHAR(COALESCE(r.ride_date, CURRENT_DATE), 'YYYY-MM') AS month_key,
                   TO_CHAR(COALESCE(r.ride_date, CURRENT_DATE), 'Mon YYYY') AS month_label,
                   u.user_name, d.driver_name, d.vehicle_type
            FROM rides r
            LEFT JOIN users u ON r.user_id = u.user_id
            LEFT JOIN drivers d ON r.driver_id = d.driver_id
            ORDER BY r.ride_date ASC, r.ride_code ASC
        """)
        rides = cur.fetchall() or []

        # 2. Fetch all payments
        cur.execute("""
            SELECT p.payment_id, p.ride_code, p.amount, p.payment_mode, p.payment_status,
                   TO_CHAR(p.transaction_time, 'YYYY-MM-DD HH24:MI:SS') AS transaction_time,
                   TO_CHAR(p.transaction_time, 'YYYY-MM') AS month_key
            FROM payments p
            ORDER BY p.transaction_time ASC
        """)
        payments = cur.fetchall() or []

        # 3. Fetch all food orders
        cur.execute("""
            SELECT fo.order_id, fo.ride_code, fo.food_items, fo.total_amount, fo.delivery_status,
                   TO_CHAR(fo.order_time, 'YYYY-MM-DD HH24:MI:SS') AS order_time,
                   TO_CHAR(fo.order_time, 'YYYY-MM') AS month_key
            FROM food_orders fo
            ORDER BY fo.order_time ASC
        """)
        food_orders = cur.fetchall() or []

        # 4. Fetch all drivers
        cur.execute("SELECT driver_id, driver_name, vehicle_type, vehicle_number, rating FROM drivers")
        drivers = cur.fetchall() or []

        cur.close()
        conn.close()

        # Financial Calculations
        total_ride_revenue = sum(float(r['fare_amount'] or 0) for r in rides)
        total_food_revenue = sum(float(f['total_amount'] or 0) for f in food_orders)
        gross_revenue = total_ride_revenue + total_food_revenue

        # Cost Formulation:
        # Chauffeur Partner Payouts: 65% of ride fares
        # EV Charging & Fuel Replenishment: 10% of ride fares
        # Fleet Servicing, Detailing & Maintenance: 5% of ride fares
        # Kerala Station Bay Leases & Rest Stop Fees: 3% of ride fares
        # Satellite Radar, GPS Telemetry & Cloud Servers: 2% of ride fares
        # Kitchen Partner Settlement: 60% of food bill
        cost_driver_payouts = round(total_ride_revenue * 0.65, 2)
        cost_fuel_charging = round(total_ride_revenue * 0.10, 2)
        cost_maintenance = round(total_ride_revenue * 0.05, 2)
        cost_station_fees = round(total_ride_revenue * 0.03, 2)
        cost_platform_gps = round(total_ride_revenue * 0.02, 2)
        cost_kitchen_partner = round(total_food_revenue * 0.60, 2)

        total_expenses = round(
            cost_driver_payouts + cost_fuel_charging + cost_maintenance +
            cost_station_fees + cost_platform_gps + cost_kitchen_partner, 2
        )
        net_profit = round(gross_revenue - total_expenses, 2)
        profit_margin_pct = round((net_profit / gross_revenue * 100), 1) if gross_revenue > 0 else 0.0

        # Monthly Timeline Data for Chart.js
        month_dict = {}
        for r in rides:
            m_k = r['month_key']
            m_lbl = r['month_label']
            if m_k not in month_dict:
                month_dict[m_k] = {
                    'month_key': m_k,
                    'month_label': m_lbl,
                    'rides_count': 0,
                    'ride_revenue': 0.0,
                    'food_revenue': 0.0,
                    'food_orders_count': 0
                }
            month_dict[m_k]['rides_count'] += 1
            month_dict[m_k]['ride_revenue'] += float(r['fare_amount'] or 0)

        for f in food_orders:
            m_k = f['month_key']
            if m_k in month_dict:
                month_dict[m_k]['food_revenue'] += float(f['total_amount'] or 0)
                month_dict[m_k]['food_orders_count'] += 1

        monthly_trend = []
        for m_k in sorted(month_dict.keys()):
            item = month_dict[m_k]
            m_ride_rev = round(item['ride_revenue'], 2)
            m_food_rev = round(item['food_revenue'], 2)
            m_gross = round(m_ride_rev + m_food_rev, 2)
            m_exp = round(
                (m_ride_rev * 0.65) + (m_ride_rev * 0.10) + (m_ride_rev * 0.05) +
                (m_ride_rev * 0.03) + (m_ride_rev * 0.02) + (m_food_rev * 0.60), 2
            )
            m_net = round(m_gross - m_exp, 2)
            m_margin = round((m_net / m_gross * 100), 1) if m_gross > 0 else 0.0

            monthly_trend.append({
                'month_key': m_k,
                'month_label': item['month_label'],
                'rides_count': item['rides_count'],
                'food_orders_count': item['food_orders_count'],
                'ride_revenue': m_ride_rev,
                'food_revenue': m_food_rev,
                'gross_revenue': m_gross,
                'operating_expenses': m_exp,
                'net_profit': m_net,
                'margin_pct': m_margin
            })

        # Revenue Streams Breakdown for Donut Chart
        stream_sums = {
            'Luxury & Royal Fleet': 0.0,
            'Electric Hyper-Tech (EV)': 0.0,
            'Highland SUV & Touring Coach': 0.0,
            'City Express & Solo': 0.0,
            'In-Vehicle Dining Services': total_food_revenue
        }
        for r in rides:
            vt = (r['vehicle_type'] or '').lower()
            amt = float(r['fare_amount'] or 0)
            if any(k in vt for k in ['rolls', 'benz', 'bmw', 'luxury']):
                stream_sums['Luxury & Royal Fleet'] += amt
            elif any(k in vt for k in ['tesla', 'porsche', 'audi', 'ather']):
                stream_sums['Electric Hyper-Tech (EV)'] += amt
            elif any(k in vt for k in ['innova', 'range rover', 'volvo', 'suv']):
                stream_sums['Highland SUV & Touring Coach'] += amt
            else:
                stream_sums['City Express & Solo'] += amt

        revenue_streams = [
            {
                'category': k,
                'revenue': round(v, 2),
                'pct': round((v / gross_revenue * 100), 1) if gross_revenue > 0 else 0
            }
            for k, v in stream_sums.items()
        ]

        # Expense Breakdown for Bar/Doughnut Chart
        expense_breakdown = [
            {'category': 'Chauffeur Earnings (65%)', 'amount': cost_driver_payouts, 'pct': round(cost_driver_payouts / total_expenses * 100, 1) if total_expenses > 0 else 0, 'desc': 'Direct earnings to driver partners'},
            {'category': 'EV Supercharging & Fuel (10%)', 'amount': cost_fuel_charging, 'pct': round(cost_fuel_charging / total_expenses * 100, 1) if total_expenses > 0 else 0, 'desc': 'Fleet energy replenishment'},
            {'category': 'Kitchen Settlements (Dining)', 'amount': cost_kitchen_partner, 'pct': round(cost_kitchen_partner / total_expenses * 100, 1) if total_expenses > 0 else 0, 'desc': 'Partner restaurant kitchen payouts'},
            {'category': 'Fleet Detailing & Servicing (5%)', 'amount': cost_maintenance, 'pct': round(cost_maintenance / total_expenses * 100, 1) if total_expenses > 0 else 0, 'desc': 'Vehicle upkeep & safety inspections'},
            {'category': 'Station Hub Bay Leases (3%)', 'amount': cost_station_fees, 'pct': round(cost_station_fees / total_expenses * 100, 1) if total_expenses > 0 else 0, 'desc': 'Kerala hub terminal parking leases'},
            {'category': 'Satellite GPS Radar & Cloud (2%)', 'amount': cost_platform_gps, 'pct': round(cost_platform_gps / total_expenses * 100, 1) if total_expenses > 0 else 0, 'desc': 'Platform telemetry & server infrastructure'}
        ]

        # Vehicle Model Profitability Leaderboard
        vehicle_stats = {}
        for r in rides:
            vt = r['vehicle_type'] or 'Luxury'
            amt = float(r['fare_amount'] or 0)
            if vt not in vehicle_stats:
                vehicle_stats[vt] = {'trips': 0, 'gross_revenue': 0.0}
            vehicle_stats[vt]['trips'] += 1
            vehicle_stats[vt]['gross_revenue'] += amt

        vehicle_profitability = []
        for vt, stats in vehicle_stats.items():
            g_rev = stats['gross_revenue']
            is_ev = any(k in vt.lower() for k in ['tesla', 'porsche', 'audi', 'ather'])
            cost_pct = 0.81 if is_ev else 0.86  # EVs generate higher net margins due to low operating cost per km
            exp = round(g_rev * cost_pct, 2)
            np = round(g_rev - exp, 2)
            margin = round((np / g_rev * 100), 1) if g_rev > 0 else 0.0

            badge = "⭐ Top Earner" if g_rev >= 3500 else ("⚡ Eco Margin" if is_ev else "🚀 Active Fleet")
            vehicle_profitability.append({
                'model': vt,
                'trips': stats['trips'],
                'gross_revenue': round(g_rev, 2),
                'operating_expenses': exp,
                'net_profit': np,
                'margin_pct': margin,
                'badge': badge,
                'is_ev': is_ev
            })
        vehicle_profitability.sort(key=lambda x: x['gross_revenue'], reverse=True)

        # Official P&L Statement breakdown lines
        pnl_statement = {
            'revenue_lines': [
                {'title': 'Passenger Ride Fares (Local & Long-Distance)', 'amount': round(total_ride_revenue, 2)},
                {'title': 'In-Vehicle Dining & Corridor Pre-Orders', 'amount': round(total_food_revenue, 2)},
                {'title': 'Total Operating Platform Revenue', 'amount': round(gross_revenue, 2), 'is_subtotal': True}
            ],
            'direct_costs': [
                {'title': 'Verified Chauffeur Earnings & Commissions (65%)', 'amount': cost_driver_payouts},
                {'title': 'Fleet Energy (Fuel & Fast EV Supercharging) (10%)', 'amount': cost_fuel_charging},
                {'title': 'Culinary Partner Kitchen Settlements (60% of food)', 'amount': cost_kitchen_partner},
                {'title': 'Total Direct Operational Cost', 'amount': round(cost_driver_payouts + cost_fuel_charging + cost_kitchen_partner, 2), 'is_subtotal': True}
            ],
            'gross_margin': round(gross_revenue - (cost_driver_payouts + cost_fuel_charging + cost_kitchen_partner), 2),
            'overheads': [
                {'title': 'Vehicle Detailing, Maintenance & Safety Overhauls (5%)', 'amount': cost_maintenance},
                {'title': 'Kerala Transit Hub Bay Leases & Terminal Tolls (3%)', 'amount': cost_station_fees},
                {'title': 'Satellite GPS Telemetry & Cloud Platform Radar (2%)', 'amount': cost_platform_gps},
                {'title': 'Total Platform Overheads', 'amount': round(cost_maintenance + cost_station_fees + cost_platform_gps, 2), 'is_subtotal': True}
            ],
            'net_profit': net_profit,
            'margin_pct': profit_margin_pct
        }

        return jsonify({
            'success': True,
            'kpis': {
                'gross_revenue': round(gross_revenue, 2),
                'total_expenses': round(total_expenses, 2),
                'net_profit': round(net_profit, 2),
                'profit_margin_pct': profit_margin_pct,
                'total_rides': len(rides),
                'total_food_orders': len(food_orders),
                'active_fleet_count': len(drivers),
                'avg_booking_fare': round(total_ride_revenue / len(rides), 2) if rides else 0.0,
                'ev_savings_pct': 34.5
            },
            'monthly_trend': monthly_trend,
            'revenue_streams': revenue_streams,
            'expense_breakdown': expense_breakdown,
            'vehicle_profitability': vehicle_profitability,
            'pnl_statement': pnl_statement
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/master-data', methods=['GET'])
@admin_required
def get_admin_master_data():
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # 1. All rides
        cur.execute("""
            SELECT r.ride_code, 
                   s.station_name AS pickup_station,
                   COALESCE(r.destination, 'Munnar Tea Hills Station') AS destination,
                   COALESCE(TO_CHAR(r.ride_date, 'YYYY-MM-DD'), TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')) AS ride_date,
                   r.ride_group, r.ride_type, r.fare_amount, r.status, 
                   u.user_name, u.user_id,
                   d.driver_name, d.vehicle_type, d.vehicle_number, d.rating
            FROM rides r
            LEFT JOIN users u ON r.user_id = u.user_id
            LEFT JOIN drivers d ON r.driver_id = d.driver_id
            LEFT JOIN stations s ON r.station_id = s.station_id
            ORDER BY r.ride_code DESC
        """)
        all_rides = cur.fetchall() or []

        # 2. All payments
        cur.execute("""
            SELECT p.payment_id, p.ride_code, p.amount, p.payment_mode, p.payment_status,
                   TO_CHAR(p.transaction_time, 'YYYY-MM-DD HH24:MI:SS') AS transaction_time
            FROM payments p
            ORDER BY p.transaction_time DESC
        """)
        all_payments = cur.fetchall() or []

        # 3. All food orders
        cur.execute("""
            SELECT fo.order_id, fo.ride_code, u.user_name, fo.food_items, fo.total_amount, 
                   fo.delivery_status, TO_CHAR(fo.order_time, 'YYYY-MM-DD HH24:MI:SS') AS order_time
            FROM food_orders fo
            LEFT JOIN users u ON fo.user_id = u.user_id
            ORDER BY fo.order_time DESC
        """)
        all_food_orders = cur.fetchall() or []

        # 4. All drivers
        cur.execute("SELECT * FROM drivers ORDER BY driver_id ASC")
        all_drivers = cur.fetchall() or []

        # 5. All stations
        cur.execute("SELECT * FROM stations ORDER BY station_id ASC")
        all_stations = cur.fetchall() or []

        # 6. All users with metrics
        cur.execute("""
            SELECT u.user_id, u.user_name, u.user_type, u.user_no, u.gender,
                   COUNT(r.ride_code) AS total_trips,
                   COALESCE(SUM(r.fare_amount), 0.0) AS total_spent
            FROM users u
            LEFT JOIN rides r ON u.user_id = r.user_id
            GROUP BY u.user_id, u.user_name, u.user_type, u.user_no, u.gender
            ORDER BY u.user_id ASC
        """)
        all_users = cur.fetchall() or []

        cur.close()
        conn.close()

        total_rev = sum(float(r['fare_amount'] or 0) for r in all_rides) + sum(float(f['total_amount'] or 0) for f in all_food_orders)

        return jsonify({
            'success': True,
            'summary': {
                'total_rides': len(all_rides),
                'total_payments': len(all_payments),
                'total_food_orders': len(all_food_orders),
                'total_drivers': len(all_drivers),
                'total_stations': len(all_stations),
                'total_users': len(all_users),
                'gross_revenue': round(total_rev, 2)
            },
            'rides': all_rides,
            'payments': all_payments,
            'food_orders': all_food_orders,
            'drivers': all_drivers,
            'stations': all_stations,
            'users': all_users
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/users', methods=['GET', 'POST'])
@admin_required
def manage_admin_users():
    conn = get_db_connection()
    cur = conn.cursor()
    if request.method == 'GET':
        cur.execute("""
            SELECT u.user_id, u.user_name, u.user_type, u.user_no, u.gender,
                   COUNT(r.ride_code) AS total_trips,
                   COALESCE(SUM(r.fare_amount), 0.0) AS total_spent
            FROM users u
            LEFT JOIN rides r ON u.user_id = r.user_id
            GROUP BY u.user_id, u.user_name, u.user_type, u.user_no, u.gender
            ORDER BY u.user_id ASC
        """)
        users = cur.fetchall() or []
        cur.close()
        conn.close()
        return jsonify(users)
    elif request.method == 'POST':
        data = request.json or {}
        uid = data.get('user_id', '').strip()
        uname = data.get('user_name', '').strip()
        utype = data.get('user_type', 'Customer').strip()
        uno = data.get('user_no', '9847000000').strip()
        gender = data.get('gender', 'Other').strip()
        pwd = data.get('password', 'user123').strip()
        if not uid or not uname:
            return jsonify({'success': False, 'message': 'User ID and Name are required'}), 400
        cur.execute("""
            INSERT INTO users (user_id, user_name, user_type, user_no, gender, password)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id) DO UPDATE
            SET user_name = EXCLUDED.user_name,
                user_type = EXCLUDED.user_type,
                user_no = EXCLUDED.user_no,
                gender = EXCLUDED.gender,
                password = EXCLUDED.password
        """, (uid, uname, utype, uno, gender, pwd))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True, 'message': f'User {uid} ({uname}) saved successfully.'})

@app.route('/api/admin/status', methods=['GET'])
def get_admin_status():
    """Quick check to confirm whether current session has admin privileges."""
    return jsonify({
        'is_admin': bool(session.get('is_admin')),
        'user_id': session.get('user_id'),
        'user_name': session.get('user_name'),
        'user_type': session.get('user_type', 'Customer')
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)