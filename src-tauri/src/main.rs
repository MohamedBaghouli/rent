use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

const INIT_SQL: &str = include_str!("../../prisma/migrations/20260427213400_init/migration.sql");
const MIGRATION_CLIENT_EXTRA: &str = include_str!("../../prisma/migrations/20260430000000_client_extra_fields/migration.sql");
const MIGRATION_CAR_IMAGE_URL: &str = include_str!("../../prisma/migrations/20260501000000_car_image_url/migration.sql");
const MIGRATION_CLIENT_BIRTHPLACE_NATIONALITY_UNIQUE: &str =
    include_str!("../../prisma/migrations/20260501010000_client_birthplace_nationality_unique/migration.sql");
const MIGRATION_RESERVATION_SECOND_CLIENT: &str =
    include_str!("../../prisma/migrations/20260501020000_reservation_second_client/migration.sql");
const MIGRATION_CLIENT_IS_ACTIVE: &str =
    include_str!("../../prisma/migrations/20260502000000_client_is_active/migration.sql");

struct AppState {
    db: Mutex<Connection>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Car {
    id: i32,
    brand: String,
    model: String,
    registration_number: String,
    year: Option<i32>,
    fuel_type: String,
    transmission: String,
    daily_price: f64,
    status: String,
    mileage: Option<i32>,
    image_url: Option<String>,
    insurance_expiry_date: Option<String>,
    technical_visit_expiry_date: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateCarDto {
    brand: String,
    model: String,
    registration_number: String,
    year: Option<i32>,
    fuel_type: String,
    transmission: String,
    daily_price: f64,
    status: String,
    mileage: Option<i32>,
    image_url: Option<String>,
    insurance_expiry_date: Option<String>,
    technical_visit_expiry_date: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Client {
    id: i32,
    full_name: String,
    phone: String,
    cin: Option<String>,
    passport_number: Option<String>,
    driving_license: Option<String>,
    driving_license_date: Option<String>,
    cin_issue_date: Option<String>,
    cin_issue_place: Option<String>,
    birth_date: Option<String>,
    birth_place: Option<String>,
    nationality: Option<String>,
    address: Option<String>,
    is_active: bool,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateClientDto {
    full_name: String,
    phone: String,
    cin: Option<String>,
    passport_number: Option<String>,
    driving_license: Option<String>,
    driving_license_date: Option<String>,
    cin_issue_date: Option<String>,
    cin_issue_place: Option<String>,
    birth_date: Option<String>,
    birth_place: Option<String>,
    nationality: Option<String>,
    address: Option<String>,
    is_active: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Reservation {
    id: i32,
    client_id: i32,
    second_client_id: Option<i32>,
    car_id: i32,
    start_date: String,
    end_date: String,
    daily_price: f64,
    total_price: f64,
    deposit_amount: f64,
    status: String,
    pickup_mileage: Option<i32>,
    return_mileage: Option<i32>,
    pickup_fuel_level: Option<String>,
    return_fuel_level: Option<String>,
    notes: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Payment {
    id: i32,
    reservation_id: i32,
    amount: f64,
    #[serde(rename = "type")]
    payment_type: String,
    method: String,
    payment_date: String,
    note: Option<String>,
    created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreatePaymentDto {
    reservation_id: i32,
    amount: f64,
    #[serde(rename = "type")]
    payment_type: String,
    method: String,
    payment_date: Option<String>,
    note: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Contract {
    id: i32,
    reservation_id: i32,
    contract_number: String,
    pdf_path: Option<String>,
    status: String,
    generated_at: String,
    signed_at: Option<String>,
    created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateReservationDto {
    client_id: i32,
    second_client_id: Option<i32>,
    car_id: i32,
    start_date: String,
    end_date: String,
    daily_price: f64,
    total_price: f64,
    deposit_amount: f64,
    status: String,
    pickup_mileage: Option<i32>,
    return_mileage: Option<i32>,
    pickup_fuel_level: Option<String>,
    return_fuel_level: Option<String>,
    notes: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DashboardStats {
    total_cars: i32,
    available_cars: i32,
    rented_cars: i32,
    ongoing_reservations: i32,
    today_reservations: i32,
    monthly_revenue: f64,
    overdue_payments: i32,
    insurance_alerts: i32,
    technical_visit_alerts: i32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateReservationStatusDto {
    status: String,
    return_mileage: Option<i32>,
    return_fuel_level: Option<String>,
}

fn db_path() -> Result<PathBuf, String> {
    let current_dir = std::env::current_dir().map_err(|error| error.to_string())?;
    let root = if current_dir.file_name().and_then(|name| name.to_str()) == Some("src-tauri") {
        current_dir
            .parent()
            .map(Path::to_path_buf)
            .ok_or("Impossible de résoudre le dossier projet")?
    } else {
        current_dir
    };

    Ok(root.join("prisma").join("dev.db"))
}

fn init_db() -> Result<Connection, String> {
    let path = db_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|error| error.to_string())?;

    let table_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('Car', 'Client', 'Reservation', 'Payment', 'Contract')",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    if table_count < 5 {
        connection
            .execute_batch(INIT_SQL)
            .map_err(|error| error.to_string())?;
    }

    // Apply client extra fields migration if columns don't exist yet
    let has_birth_date: bool = connection
        .prepare("PRAGMA table_info(Client)")
        .and_then(|mut stmt| {
            let cols: Result<Vec<String>, _> = stmt.query_map([], |row| row.get::<_, String>(1)).map(|iter| iter.flatten().collect());
            cols
        })
        .map(|cols| cols.iter().any(|c| c == "birthDate"))
        .unwrap_or(false);

    if !has_birth_date {
        connection
            .execute_batch(MIGRATION_CLIENT_EXTRA)
            .map_err(|error| error.to_string())?;
    }

    let has_car_image_url: bool = connection
        .prepare("PRAGMA table_info(Car)")
        .and_then(|mut stmt| {
            let cols: Result<Vec<String>, _> = stmt.query_map([], |row| row.get::<_, String>(1)).map(|iter| iter.flatten().collect());
            cols
        })
        .map(|cols| cols.iter().any(|c| c == "imageUrl"))
        .unwrap_or(false);

    if !has_car_image_url {
        connection
            .execute_batch(MIGRATION_CAR_IMAGE_URL)
            .map_err(|error| error.to_string())?;
    }

    if !has_column(&connection, "Client", "birthPlace") {
        connection
            .execute_batch(MIGRATION_CLIENT_BIRTHPLACE_NATIONALITY_UNIQUE)
            .map_err(|error| error.to_string())?;
    }

    if !has_column(&connection, "Reservation", "secondClientId") {
        connection
            .execute_batch(MIGRATION_RESERVATION_SECOND_CLIENT)
            .map_err(|error| error.to_string())?;
    }

    if !has_column(&connection, "Client", "isActive") {
        connection
            .execute_batch(MIGRATION_CLIENT_IS_ACTIVE)
            .map_err(|error| error.to_string())?;
    }

    Ok(connection)
}

fn has_column(connection: &Connection, table: &str, column: &str) -> bool {
    let sql = format!("PRAGMA table_info({})", table);
    connection
        .prepare(&sql)
        .and_then(|mut stmt| {
            let cols: Result<Vec<String>, _> =
                stmt.query_map([], |row| row.get::<_, String>(1)).map(|iter| iter.flatten().collect());
            cols
        })
        .map(|cols| cols.iter().any(|c| c == column))
        .unwrap_or(false)
}

fn get_car_by_id(connection: &Connection, id: i64) -> Result<Car, String> {
    connection
        .query_row(
            "SELECT id, brand, model, registrationNumber, year, fuelType, transmission, dailyPrice, status, mileage, imageUrl, insuranceExpiryDate, technicalVisitExpiryDate, createdAt, updatedAt FROM Car WHERE id = ?1",
            params![id],
            map_car,
        )
        .map_err(|error| error.to_string())
}

fn get_client_by_id(connection: &Connection, id: i64) -> Result<Client, String> {
    connection
        .query_row(
            "SELECT id, fullName, phone, cin, passportNumber, drivingLicense, drivingLicenseDate, cinIssueDate, cinIssuePlace, birthDate, birthPlace, nationality, address, isActive, createdAt, updatedAt FROM Client WHERE id = ?1",
            params![id],
            map_client,
        )
        .map_err(|error| error.to_string())
}

fn get_reservation_by_id(connection: &Connection, id: i64) -> Result<Reservation, String> {
    connection
        .query_row(
            "SELECT id, clientId, secondClientId, carId, startDate, endDate, dailyPrice, totalPrice, depositAmount, status, pickupMileage, returnMileage, pickupFuelLevel, returnFuelLevel, notes, createdAt, updatedAt FROM Reservation WHERE id = ?1",
            params![id],
            map_reservation,
        )
        .map_err(|error| error.to_string())
}

fn get_payment_by_id(connection: &Connection, id: i64) -> Result<Payment, String> {
    connection
        .query_row(
            "SELECT id, reservationId, amount, type, method, paymentDate, note, createdAt FROM Payment WHERE id = ?1",
            params![id],
            map_payment,
        )
        .map_err(|error| error.to_string())
}

fn get_contract_by_id(connection: &Connection, id: i64) -> Result<Contract, String> {
    connection
        .query_row(
            "SELECT id, reservationId, contractNumber, pdfPath, status, generatedAt, signedAt, createdAt FROM Contract WHERE id = ?1",
            params![id],
            map_contract,
        )
        .map_err(|error| error.to_string())
}

fn map_car(row: &rusqlite::Row<'_>) -> rusqlite::Result<Car> {
    Ok(Car {
        id: row.get(0)?,
        brand: row.get(1)?,
        model: row.get(2)?,
        registration_number: row.get(3)?,
        year: row.get(4)?,
        fuel_type: row.get(5)?,
        transmission: row.get(6)?,
        daily_price: row.get(7)?,
        status: row.get(8)?,
        mileage: row.get(9)?,
        image_url: row.get(10)?,
        insurance_expiry_date: row.get(11)?,
        technical_visit_expiry_date: row.get(12)?,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
    })
}

fn map_client(row: &rusqlite::Row<'_>) -> rusqlite::Result<Client> {
    Ok(Client {
        id: row.get(0)?,
        full_name: row.get(1)?,
        phone: row.get(2)?,
        cin: row.get(3)?,
        passport_number: row.get(4)?,
        driving_license: row.get(5)?,
        driving_license_date: row.get(6)?,
        cin_issue_date: row.get(7)?,
        cin_issue_place: row.get(8)?,
        birth_date: row.get(9)?,
        birth_place: row.get(10)?,
        nationality: row.get(11)?,
        address: row.get(12)?,
        is_active: row.get(13)?,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
    })
}

fn map_reservation(row: &rusqlite::Row<'_>) -> rusqlite::Result<Reservation> {
    Ok(Reservation {
        id: row.get(0)?,
        client_id: row.get(1)?,
        second_client_id: row.get(2)?,
        car_id: row.get(3)?,
        start_date: row.get(4)?,
        end_date: row.get(5)?,
        daily_price: row.get(6)?,
        total_price: row.get(7)?,
        deposit_amount: row.get(8)?,
        status: row.get(9)?,
        pickup_mileage: row.get(10)?,
        return_mileage: row.get(11)?,
        pickup_fuel_level: row.get(12)?,
        return_fuel_level: row.get(13)?,
        notes: row.get(14)?,
        created_at: row.get(15)?,
        updated_at: row.get(16)?,
    })
}

fn map_payment(row: &rusqlite::Row<'_>) -> rusqlite::Result<Payment> {
    Ok(Payment {
        id: row.get(0)?,
        reservation_id: row.get(1)?,
        amount: row.get(2)?,
        payment_type: row.get(3)?,
        method: row.get(4)?,
        payment_date: row.get(5)?,
        note: row.get(6)?,
        created_at: row.get(7)?,
    })
}

fn map_contract(row: &rusqlite::Row<'_>) -> rusqlite::Result<Contract> {
    Ok(Contract {
        id: row.get(0)?,
        reservation_id: row.get(1)?,
        contract_number: row.get(2)?,
        pdf_path: row.get(3)?,
        status: row.get(4)?,
        generated_at: row.get(5)?,
        signed_at: row.get(6)?,
        created_at: row.get(7)?,
    })
}

fn generate_contract_for_reservation(
    connection: &Connection,
    reservation_id: i32,
) -> Result<Contract, String> {
    if let Ok(existing) = connection.query_row(
        "SELECT id, reservationId, contractNumber, pdfPath, status, generatedAt, signedAt, createdAt FROM Contract WHERE reservationId = ?1",
        params![reservation_id],
        map_contract,
    ) {
        return Ok(existing);
    }

    let year: String = connection
        .query_row("SELECT strftime('%Y', 'now')", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    let next_number: i32 = connection
        .query_row("SELECT COUNT(*) + 1 FROM Contract", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    let contract_number = format!("CNT-{}-{:04}", year, next_number);

    let pdf_path = format!("contracts/{}.pdf", contract_number);

    connection
        .execute(
            "INSERT INTO Contract (reservationId, contractNumber, pdfPath, status, generatedAt, createdAt)
             VALUES (?1, ?2, ?3, 'GENERATED', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
            params![reservation_id, contract_number, pdf_path],
        )
        .map_err(|error| error.to_string())?;

    get_contract_by_id(connection, connection.last_insert_rowid())
}

#[tauri::command]
fn get_cars(state: tauri::State<'_, AppState>) -> Result<Vec<Car>, String> {
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare("SELECT id, brand, model, registrationNumber, year, fuelType, transmission, dailyPrice, status, mileage, imageUrl, insuranceExpiryDate, technicalVisitExpiryDate, createdAt, updatedAt FROM Car ORDER BY createdAt DESC")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], map_car)
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn create_car(state: tauri::State<'_, AppState>, data: CreateCarDto) -> Result<Car, String> {
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO Car (brand, model, registrationNumber, year, fuelType, transmission, dailyPrice, status, mileage, imageUrl, insuranceExpiryDate, technicalVisitExpiryDate, createdAt, updatedAt)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
            params![
                data.brand,
                data.model,
                data.registration_number,
                data.year,
                data.fuel_type,
                data.transmission,
                data.daily_price,
                data.status,
                data.mileage,
                data.image_url,
                data.insurance_expiry_date,
                data.technical_visit_expiry_date
            ],
        )
        .map_err(|error| error.to_string())?;

    get_car_by_id(&connection, connection.last_insert_rowid())
}

#[tauri::command]
fn update_car(
    state: tauri::State<'_, AppState>,
    id: i32,
    data: CreateCarDto,
) -> Result<Car, String> {
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE Car
             SET brand = ?1, model = ?2, registrationNumber = ?3, year = ?4, fuelType = ?5,
                 transmission = ?6, dailyPrice = ?7, status = ?8, mileage = ?9,
                 imageUrl = ?10, insuranceExpiryDate = ?11, technicalVisitExpiryDate = ?12,
                 updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
             WHERE id = ?13",
            params![
                data.brand,
                data.model,
                data.registration_number,
                data.year,
                data.fuel_type,
                data.transmission,
                data.daily_price,
                data.status,
                data.mileage,
                data.image_url,
                data.insurance_expiry_date,
                data.technical_visit_expiry_date,
                id
            ],
        )
        .map_err(|error| error.to_string())?;

    get_car_by_id(&connection, id.into())
}

#[tauri::command]
fn change_car_status(
    state: tauri::State<'_, AppState>,
    id: i32,
    status: String,
) -> Result<Car, String> {
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE Car SET status = ?1, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?2",
            params![status, id],
        )
        .map_err(|error| error.to_string())?;

    get_car_by_id(&connection, id.into())
}

#[tauri::command]
fn delete_car(state: tauri::State<'_, AppState>, id: i32) -> Result<(), String> {
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    connection
        .execute("DELETE FROM Car WHERE id = ?1", params![id])
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_clients(state: tauri::State<'_, AppState>) -> Result<Vec<Client>, String> {
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare("SELECT id, fullName, phone, cin, passportNumber, drivingLicense, drivingLicenseDate, cinIssueDate, cinIssuePlace, birthDate, birthPlace, nationality, address, isActive, createdAt, updatedAt FROM Client ORDER BY createdAt DESC")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], map_client)
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn create_client(
    state: tauri::State<'_, AppState>,
    data: CreateClientDto,
) -> Result<Client, String> {
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO Client (fullName, phone, cin, passportNumber, drivingLicense, drivingLicenseDate, cinIssueDate, cinIssuePlace, birthDate, birthPlace, nationality, address, isActive, createdAt, updatedAt)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, COALESCE(?13, true), strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
            params![
                data.full_name,
                data.phone,
                data.cin,
                data.passport_number,
                data.driving_license,
                data.driving_license_date,
                data.cin_issue_date,
                data.cin_issue_place,
                data.birth_date,
                data.birth_place,
                data.nationality,
                data.address,
                data.is_active
            ],
        )
        .map_err(map_client_db_error)?;

    get_client_by_id(&connection, connection.last_insert_rowid())
}

#[tauri::command]
fn update_client(
    state: tauri::State<'_, AppState>,
    id: i32,
    data: CreateClientDto,
) -> Result<Client, String> {
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE Client
             SET fullName = ?1, phone = ?2, cin = ?3, passportNumber = ?4,
                 drivingLicense = ?5, drivingLicenseDate = ?6, cinIssueDate = ?7,
                 cinIssuePlace = ?8, birthDate = ?9, birthPlace = ?10, nationality = ?11, address = ?12,
                 updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
             WHERE id = ?13",
            params![
                data.full_name,
                data.phone,
                data.cin,
                data.passport_number,
                data.driving_license,
                data.driving_license_date,
                data.cin_issue_date,
                data.cin_issue_place,
                data.birth_date,
                data.birth_place,
                data.nationality,
                data.address,
                id
            ],
        )
        .map_err(map_client_db_error)?;

    get_client_by_id(&connection, id.into())
}

#[tauri::command]
fn delete_client(state: tauri::State<'_, AppState>, id: i32) -> Result<(), String> {
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    connection
        .execute("DELETE FROM Client WHERE id = ?1", params![id])
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_reservations(state: tauri::State<'_, AppState>) -> Result<Vec<Reservation>, String> {
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare("SELECT id, clientId, secondClientId, carId, startDate, endDate, dailyPrice, totalPrice, depositAmount, status, pickupMileage, returnMileage, pickupFuelLevel, returnFuelLevel, notes, createdAt, updatedAt FROM Reservation ORDER BY createdAt DESC")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], map_reservation)
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn create_reservation(
    state: tauri::State<'_, AppState>,
    data: CreateReservationDto,
) -> Result<Reservation, String> {
    let connection = state.db.lock().map_err(|error| error.to_string())?;

    let car_status: String = connection
        .query_row(
            "SELECT status FROM Car WHERE id = ?1",
            params![data.car_id],
            |row| row.get(0),
        )
        .map_err(|_| "Voiture introuvable".to_string())?;

    validate_reservation_data(&data)?;
    ensure_client_active(&connection, data.client_id, "Client")?;
    if let Some(second_client_id) = data.second_client_id {
        ensure_client_active(&connection, second_client_id, "Deuxième conducteur")?;
    }

    if car_status == "MAINTENANCE" || car_status == "UNAVAILABLE" {
        return Err("Cette voiture n'est pas disponible.".to_string());
    }

    if has_reservation_conflict(&connection, data.car_id, &data.start_date, &data.end_date, None)? {
        return Err("Cette voiture est déjà réservée sur cette période.".to_string());
    }

    connection
        .execute(
            "INSERT INTO Reservation (clientId, secondClientId, carId, startDate, endDate, dailyPrice, totalPrice, depositAmount, status, pickupMileage, returnMileage, pickupFuelLevel, returnFuelLevel, notes, createdAt, updatedAt)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
            params![
                data.client_id,
                data.second_client_id,
                data.car_id,
                data.start_date,
                data.end_date,
                data.daily_price,
                data.total_price,
                data.deposit_amount,
                data.status,
                data.pickup_mileage,
                data.return_mileage,
                data.pickup_fuel_level,
                data.return_fuel_level,
                data.notes
            ],
        )
        .map_err(|error| error.to_string())?;

    let reservation_id = connection.last_insert_rowid();
    let reservation = get_reservation_by_id(&connection, reservation_id)?;

    Ok(reservation)
}

#[tauri::command]
fn deactivate_client(state: tauri::State<'_, AppState>, id: i32) -> Result<Client, String> {
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE Client SET isActive = false, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?1",
            params![id],
        )
        .map_err(|error| error.to_string())?;

    get_client_by_id(&connection, id.into())
}

#[tauri::command]
fn reactivate_client(state: tauri::State<'_, AppState>, id: i32) -> Result<Client, String> {
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE Client SET isActive = true, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?1",
            params![id],
        )
        .map_err(|error| error.to_string())?;

    get_client_by_id(&connection, id.into())
}

#[tauri::command]
fn update_reservation(
    state: tauri::State<'_, AppState>,
    id: i32,
    data: CreateReservationDto,
) -> Result<Reservation, String> {
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    let current_status: String = connection
        .query_row("SELECT status FROM Reservation WHERE id = ?1", params![id], |row| row.get(0))
        .map_err(|_| "Réservation introuvable".to_string())?;

    if current_status != "EN_ATTENTE" {
        return Err("Seules les réservations en attente peuvent être modifiées.".to_string());
    }

    let car_status: String = connection
        .query_row("SELECT status FROM Car WHERE id = ?1", params![data.car_id], |row| row.get(0))
        .map_err(|_| "Voiture introuvable".to_string())?;

    validate_reservation_data(&data)?;
    ensure_client_active(&connection, data.client_id, "Client")?;
    if let Some(second_client_id) = data.second_client_id {
        ensure_client_active(&connection, second_client_id, "Deuxième conducteur")?;
    }

    if car_status == "MAINTENANCE" || car_status == "UNAVAILABLE" {
        return Err("Cette voiture n'est pas disponible.".to_string());
    }

    if has_reservation_conflict(&connection, data.car_id, &data.start_date, &data.end_date, Some(id))? {
        return Err("Cette voiture est déjà réservée sur cette période.".to_string());
    }

    connection
        .execute(
            "UPDATE Reservation
             SET clientId = ?1, secondClientId = ?2, carId = ?3, startDate = ?4, endDate = ?5,
                 dailyPrice = ?6, totalPrice = ?7, depositAmount = ?8, status = ?9,
                 pickupMileage = ?10, returnMileage = ?11, pickupFuelLevel = ?12,
                 returnFuelLevel = ?13, notes = ?14,
                 updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
             WHERE id = ?15",
            params![
                data.client_id,
                data.second_client_id,
                data.car_id,
                data.start_date,
                data.end_date,
                data.daily_price,
                data.total_price,
                data.deposit_amount,
                data.status,
                data.pickup_mileage,
                data.return_mileage,
                data.pickup_fuel_level,
                data.return_fuel_level,
                data.notes,
                id
            ],
        )
        .map_err(|error| error.to_string())?;

    get_reservation_by_id(&connection, id.into())
}

#[tauri::command]
fn update_reservation_status(
    state: tauri::State<'_, AppState>,
    id: i32,
    data: UpdateReservationStatusDto,
) -> Result<Reservation, String> {
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    let car_id: i32 = connection
        .query_row(
            "SELECT carId FROM Reservation WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    connection
        .execute(
            "UPDATE Reservation
             SET status = ?1, returnMileage = COALESCE(?2, returnMileage), returnFuelLevel = COALESCE(?3, returnFuelLevel),
                 updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
             WHERE id = ?4",
            params![data.status, data.return_mileage, data.return_fuel_level, id],
        )
        .map_err(|error| error.to_string())?;

    match data.status.as_str() {
        "ONGOING" => {
            connection
                .execute(
                    "UPDATE Car SET status = 'RENTED', updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?1",
                    params![car_id],
                )
                .map_err(|error| error.to_string())?;
        }
        "COMPLETED" | "CANCELLED" => {
            connection
                .execute(
                    "UPDATE Car SET status = 'AVAILABLE', updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?1",
                    params![car_id],
                )
                .map_err(|error| error.to_string())?;
        }
        _ => {}
    }

    get_reservation_by_id(&connection, id.into())
}

#[tauri::command]
fn delete_reservation(state: tauri::State<'_, AppState>, id: i32) -> Result<(), String> {
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    let (car_id, status): (i32, String) = connection
        .query_row(
            "SELECT carId, status FROM Reservation WHERE id = ?1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Réservation introuvable.".to_string())?;

    connection
        .execute("DELETE FROM Contract WHERE reservationId = ?1", params![id])
        .map_err(|error| error.to_string())?;
    connection
        .execute("DELETE FROM Payment WHERE reservationId = ?1", params![id])
        .map_err(|error| error.to_string())?;
    connection
        .execute("DELETE FROM Reservation WHERE id = ?1", params![id])
        .map_err(|error| error.to_string())?;

    if status == "ONGOING" {
        connection
            .execute(
                "UPDATE Car SET status = 'AVAILABLE', updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?1",
                params![car_id],
            )
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn get_payments(state: tauri::State<'_, AppState>) -> Result<Vec<Payment>, String> {
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare("SELECT id, reservationId, amount, type, method, paymentDate, note, createdAt FROM Payment ORDER BY paymentDate DESC")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], map_payment)
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn create_payment(
    state: tauri::State<'_, AppState>,
    data: CreatePaymentDto,
) -> Result<Payment, String> {
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO Payment (reservationId, amount, type, method, paymentDate, note, createdAt)
             VALUES (?1, ?2, ?3, ?4, COALESCE(?5, strftime('%Y-%m-%dT%H:%M:%fZ','now')), ?6, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
            params![
                data.reservation_id,
                data.amount,
                data.payment_type,
                data.method,
                data.payment_date,
                data.note
            ],
        )
        .map_err(|error| error.to_string())?;

    get_payment_by_id(&connection, connection.last_insert_rowid())
}

#[tauri::command]
fn get_contracts(state: tauri::State<'_, AppState>) -> Result<Vec<Contract>, String> {
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare("SELECT id, reservationId, contractNumber, pdfPath, status, generatedAt, signedAt, createdAt FROM Contract ORDER BY generatedAt DESC")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], map_contract)
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn generate_contract(
    state: tauri::State<'_, AppState>,
    reservation_id: i32,
) -> Result<Contract, String> {
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    generate_contract_for_reservation(&connection, reservation_id)
}

#[tauri::command]
fn get_dashboard_stats(state: tauri::State<'_, AppState>) -> Result<DashboardStats, String> {
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    let total_cars = count(&connection, "SELECT COUNT(*) FROM Car")?;
    let available_cars = count(
        &connection,
        "SELECT COUNT(*) FROM Car WHERE status = 'AVAILABLE'",
    )?;
    let rented_cars = count(
        &connection,
        "SELECT COUNT(*) FROM Car WHERE status = 'RENTED'",
    )?;
    let ongoing_reservations = count(
        &connection,
        "SELECT COUNT(*) FROM Reservation WHERE status = 'ONGOING'",
    )?;
    let today_reservations = count(
        &connection,
        "SELECT COUNT(*) FROM Reservation WHERE date(startDate) = date('now')",
    )?;
    let monthly_revenue: f64 = connection
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM Payment WHERE type = 'RENTAL_PAYMENT' AND strftime('%Y-%m', paymentDate) = strftime('%Y-%m', 'now')",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    let insurance_alerts = count(
        &connection,
        "SELECT COUNT(*) FROM Car WHERE insuranceExpiryDate IS NOT NULL AND date(insuranceExpiryDate) BETWEEN date('now') AND date('now', '+30 days')",
    )?;
    let technical_visit_alerts = count(
        &connection,
        "SELECT COUNT(*) FROM Car WHERE technicalVisitExpiryDate IS NOT NULL AND date(technicalVisitExpiryDate) BETWEEN date('now') AND date('now', '+30 days')",
    )?;

    Ok(DashboardStats {
        total_cars,
        available_cars,
        rented_cars,
        ongoing_reservations,
        today_reservations,
        monthly_revenue,
        overdue_payments: 0,
        insurance_alerts,
        technical_visit_alerts,
    })
}

fn count(connection: &Connection, sql: &str) -> Result<i32, String> {
    connection
        .query_row(sql, [], |row| row.get(0))
        .map_err(|error| error.to_string())
}

fn validate_reservation_data(data: &CreateReservationDto) -> Result<(), String> {
    if data.client_id <= 0 {
        return Err("Client obligatoire.".to_string());
    }

    if data.second_client_id == Some(data.client_id) {
        return Err("Le deuxième conducteur doit être différent du client principal.".to_string());
    }

    if data.car_id <= 0 {
        return Err("Voiture obligatoire.".to_string());
    }

    if data.start_date.trim().is_empty() {
        return Err("Date et heure de prise obligatoires.".to_string());
    }

    if data.end_date.trim().is_empty() {
        return Err("Date et heure de retour obligatoires.".to_string());
    }

    let start_minutes = parse_iso_minutes(&data.start_date).ok_or("Date de début invalide.".to_string())?;
    let end_minutes = parse_iso_minutes(&data.end_date).ok_or("Date de fin invalide.".to_string())?;

    if end_minutes - start_minutes < 24 * 60 {
        return Err("La durée minimale de location est de 24h.".to_string());
    }

    if data.daily_price <= 0.0 {
        return Err("Le prix/jour doit être supérieur à 0.".to_string());
    }

    if data.deposit_amount < 0.0 {
        return Err("La caution doit être supérieure ou égale à 0.".to_string());
    }

    Ok(())
}

fn ensure_client_active(connection: &Connection, client_id: i32, label: &str) -> Result<(), String> {
    let is_active: bool = connection
        .query_row(
            "SELECT isActive FROM Client WHERE id = ?1",
            params![client_id],
            |row| row.get(0),
        )
        .map_err(|_| format!("{} introuvable.", label))?;

    if !is_active {
        return Err(format!("{} désactivé.", label));
    }

    Ok(())
}

fn has_reservation_conflict(
    connection: &Connection,
    car_id: i32,
    start_date: &str,
    end_date: &str,
    excluded_id: Option<i32>,
) -> Result<bool, String> {
    let overlapping_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM Reservation
             WHERE carId = ?1
               AND (?4 IS NULL OR id != ?4)
               AND status IN ('EN_ATTENTE', 'RESERVED', 'ONGOING')
               AND (CASE WHEN length(startDate) = 10 THEN startDate || 'T00:00:00.000Z' ELSE startDate END) < ?3
               AND (CASE WHEN length(endDate) = 10 THEN endDate || 'T23:59:59.999Z' ELSE endDate END) > ?2",
            params![car_id, start_date, end_date, excluded_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    Ok(overlapping_count > 0)
}

fn parse_iso_minutes(value: &str) -> Option<i64> {
    let value = value.trim();
    let date_part = value.get(0..10)?;
    let time_part = if value.len() >= 16 { value.get(11..16).unwrap_or("00:00") } else { "00:00" };
    let mut date = date_part.split('-');
    let year: i32 = date.next()?.parse().ok()?;
    let month: u32 = date.next()?.parse().ok()?;
    let day: u32 = date.next()?.parse().ok()?;
    let mut time = time_part.split(':');
    let hour: i64 = time.next()?.parse().ok()?;
    let minute: i64 = time.next()?.parse().ok()?;
    Some(days_from_civil(year, month, day) * 24 * 60 + hour * 60 + minute)
}

fn days_from_civil(year: i32, month: u32, day: u32) -> i64 {
    let year = year - if month <= 2 { 1 } else { 0 };
    let era = if year >= 0 { year } else { year - 399 } / 400;
    let yoe = year - era * 400;
    let month = month as i32;
    let day = day as i32;
    let doy = (153 * (month + if month > 2 { -3 } else { 9 }) + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    (era * 146097 + doe - 719468) as i64
}

fn map_client_db_error(error: rusqlite::Error) -> String {
    let message = error.to_string();
    if message.contains("Client.phone") {
        return "Ce téléphone existe déjà.".to_string();
    }
    if message.contains("Client.cin") {
        return "Cette CIN existe déjà.".to_string();
    }
    if message.contains("Client.passportNumber") {
        return "Ce passeport existe déjà.".to_string();
    }
    if message.contains("Client.drivingLicense") {
        return "Ce numéro de permis existe déjà.".to_string();
    }
    message
}

fn main() {
    let db = init_db().expect("failed to initialize local SQLite database");

    tauri::Builder::default()
        .manage(AppState { db: Mutex::new(db) })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_cars,
            create_car,
            update_car,
            change_car_status,
            delete_car,
            get_clients,
            create_client,
            update_client,
            delete_client,
            deactivate_client,
            reactivate_client,
            get_reservations,
            create_reservation,
            update_reservation,
            update_reservation_status,
            delete_reservation,
            get_payments,
            create_payment,
            get_contracts,
            generate_contract,
            get_dashboard_stats
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
