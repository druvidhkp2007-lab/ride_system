BEGIN;

-- Drop existing tables cleanly
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS rides CASCADE;
DROP TABLE IF EXISTS passengers CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS stations CASCADE;
DROP TABLE IF EXISTS operators CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users Management
CREATE TABLE users(
    user_id VARCHAR(50) PRIMARY KEY,
    user_name VARCHAR(100) NOT NULL,
    user_type VARCHAR(50) NOT NULL,
    user_no VARCHAR(50) NOT NULL,
    gender VARCHAR(20) NOT NULL,
    password VARCHAR(255) NOT NULL
);

-- 2. Operators Management
CREATE TABLE operators(
    operator_id VARCHAR(50) PRIMARY KEY,
    operator_name VARCHAR(100) NOT NULL,
    contact VARCHAR(50) NOT NULL
);

-- 3. Stations & Rest Stops (Long-Distance Travel Module)
CREATE TABLE stations(
    station_id VARCHAR(50) PRIMARY KEY,
    station_name VARCHAR(100) NOT NULL,
    station_no VARCHAR(50) NOT NULL,
    food_available BOOLEAN DEFAULT FALSE,
    rest_stop_info VARCHAR(255) DEFAULT 'Standard Stop',
    operator_id VARCHAR(50) REFERENCES operators(operator_id) ON DELETE SET NULL
);

-- 4. Drivers & Vehicle Module (Bike, Auto, Sedan, SUV, Luxury)
CREATE TABLE drivers(
    driver_id VARCHAR(50) PRIMARY KEY,
    driver_name VARCHAR(100) NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL,
    vehicle_number VARCHAR(50) NOT NULL,
    rating DECIMAL(2,1) DEFAULT 5.0,
    operator_id VARCHAR(50) REFERENCES operators(operator_id) ON DELETE SET NULL
);

-- 5. Passengers Module
CREATE TABLE passengers(
    passenger_id VARCHAR(50) PRIMARY KEY,
    passenger_name VARCHAR(100) NOT NULL,
    passenger_no VARCHAR(50) NOT NULL,
    travel_group VARCHAR(50),
    user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
    station_id VARCHAR(50) REFERENCES stations(station_id) ON DELETE SET NULL
);

-- 6. Ride & Booking Module
CREATE TABLE rides(
    ride_code VARCHAR(50) PRIMARY KEY,
    ride_group VARCHAR(50) NOT NULL,
    ride_type VARCHAR(50) DEFAULT 'Local', -- Local / Long-Distance
    fare_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(100) DEFAULT 'Completed',
    user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
    driver_id VARCHAR(50) REFERENCES drivers(driver_id) ON DELETE SET NULL,
    station_id VARCHAR(50) REFERENCES stations(station_id) ON DELETE SET NULL, -- Pickup Station Hub
    destination VARCHAR(100) DEFAULT 'Munnar Tea Hills Station', -- Destination place (dynamically excludes the chosen pickup station)
    ride_date DATE DEFAULT CURRENT_DATE -- Scheduled date of travel
);

-- 7. Payment & Transaction Management Module
CREATE TABLE payments(
    payment_id VARCHAR(50) PRIMARY KEY,
    ride_code VARCHAR(50) REFERENCES rides(ride_code) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    payment_mode VARCHAR(50) CHECK (payment_mode IN ('Card', 'UPI', 'Net Banking', 'Cash')),
    payment_status VARCHAR(30) DEFAULT 'Success',
    transaction_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. In-Vehicle Food & Dining Service Module
CREATE TABLE food_orders(
    order_id VARCHAR(50) PRIMARY KEY,
    ride_code VARCHAR(50) REFERENCES rides(ride_code) ON DELETE CASCADE,
    user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
    food_items VARCHAR(255) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    delivery_status VARCHAR(50) DEFAULT 'Preparing in Vehicle',
    order_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Initial Data Seeding
INSERT INTO users VALUES ('USR01', 'Druvidh K P', 'Admin', '9847012345', 'Male', 'admin123');

INSERT INTO operators VALUES ('OP01', 'Kerala Royal Transit', '+91-98470-12345');

INSERT INTO stations VALUES 
('ST01', 'Kochi Marine Drive Hub (Ernakulam)', 'BAY-01', TRUE, 'Marine Promenade, Fine Dining, Fast EV Charging & Metro Connect', 'OP01'),
('ST02', 'Thiruvananthapuram Central (Trivandrum)', 'BAY-02', TRUE, 'Executive Lounge, Metro Connect & 24/7 Dining', 'OP01'),
('ST03', 'Kozhikode Beach Square (Calicut)', 'BAY-03', TRUE, 'Malabar Food Court, Calicut Halwa Bazaar & Sea View Lounge', 'OP01'),
('ST04', 'Munnar Tea Hills Station (Idukki)', 'BAY-04', TRUE, 'Highland Tea Lounge, Panoramic Mountain View & Warm Suites', 'OP01'),
('ST05', 'Alappuzha Backwater Jetty (Alleppey)', 'BAY-05', TRUE, 'Houseboat Terminal, Backwater Refreshments & Café', 'OP01'),
('ST06', 'Thrissur Swaraj Round (Cultural Capital)', 'BAY-06', TRUE, 'Cultural Heritage Hub, 24/7 Filter Coffee & EV Station', 'OP01'),
('ST07', 'Cochin International Airport (CIAL)', 'BAY-07', TRUE, 'Airport VIP Terminal, 24/7 Duty-Free Dining & Cab Plaza', 'OP01'),
('ST08', 'Kovalam Beach Promenade (Trivandrum)', 'BAY-08', TRUE, 'Coastal Lighthouse View, Seafood Lounge & Rest Zone', 'OP01'),
('ST09', 'Wayanad Vythiri Hill Pass', 'BAY-09', TRUE, 'Misty Mountain Pass, Coffee Estate Café & Rest Suites', 'OP01'),
('ST10', 'Kannur Payyambalam Coast', 'BAY-10', TRUE, 'Theyyam Heritage Station, Thalassery Biryani Hub', 'OP01'),
('ST11', 'Kollam Ashtamudi Lake Hub', 'BAY-11', TRUE, 'Ashtamudi Backwater Boat Jetty, Lakeside Bistro & Parking', 'OP01'),
('ST12', 'Kottayam Kumarakom Gateway', 'BAY-12', TRUE, 'Vembanad Lake Sanctuary Gateway & Spice Garden Lounge', 'OP01'),
('ST13', 'Palakkad Fort Junction', 'BAY-13', TRUE, 'Historic Fort Rest Stop, Palakkad Matta Meals & Shaded Bays', 'OP01'),
('ST14', 'Malappuram Kottakkal Gateway', 'BAY-14', TRUE, 'Ayurveda Heritage Hub, Herbal Tea Bar & Rest Suites', 'OP01'),
('ST15', 'Pathanamthitta Sabarimala Junction', 'BAY-15', TRUE, 'Pilgrim Rest Center, Pure Veg Cuisine & Facilities', 'OP01'),
('ST16', 'Kasaragod Bekal Fort Station', 'BAY-16', TRUE, 'Historic Bekal Fort Point, Coastal Rest Stop & Refreshments', 'OP01');

INSERT INTO drivers VALUES 
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
('DRV14', 'Chandrashekhar Pillai', 'Volvo', 'KL-02-VL-5050', 4.9, 'OP01');

INSERT INTO passengers VALUES 
('PAS01', 'Druvidh K P', '9847012345', 'VIP Traveler', 'USR01', 'ST01');

INSERT INTO rides VALUES 
('RD01', 'Benz Fleet', 'Local', 1400.00, 'Completed', 'USR01', 'DRV01', 'ST01', 'Munnar Tea Hills Station', CURRENT_DATE),
('RD02', 'Tesla Cyber Fleet', 'Local', 1550.00, 'Booked & Payment Successful', 'USR01', 'DRV07', 'ST07', 'Kochi Marine Drive Hub (Ernakulam)', CURRENT_DATE),
('RD03', 'Rolls-Royce Royal Fleet', 'Long-Distance', 2500.00, 'Booked', 'USR01', 'DRV10', 'ST02', 'Kovalam Beach Promenade (Trivandrum)', CURRENT_DATE);

INSERT INTO payments VALUES 
('PAY01', 'RD01', 1400.00, 'UPI', 'Success', CURRENT_TIMESTAMP),
('PAY02', 'RD02', 1550.00, 'UPI', 'Success', CURRENT_TIMESTAMP);

INSERT INTO food_orders VALUES 
('FO01', 'RD01', 'USR01', 'Thalassery Dum Biryani + Sulaimani Tea', 240.00, 'Served In-Vehicle', CURRENT_TIMESTAMP);

COMMIT;
