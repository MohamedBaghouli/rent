"""Train ML models for RentalDesk (offline).

Reads the local SQLite database, builds two models:
- K-Means for client segmentation
- Random Forest for revenue and demand forecasting

Saves them as .pkl files via joblib. Outputs a JSON summary on stdout
so the Tauri/Rust caller can parse it.

Usage:
    python train_model.py --db <path> --models <dir> [--min-reservations 30]
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import traceback
from datetime import datetime
from typing import Any, Dict

MIN_RESERVATIONS_DEFAULT = 30


def emit(payload: Dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    sys.stdout.flush()


def fail(reason: str, message: str) -> None:
    emit({"success": False, "reason": reason, "message": message})
    sys.exit(0)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="RentalDesk ML training")
    parser.add_argument("--db", required=True, help="Path to SQLite database file")
    parser.add_argument("--models", required=True, help="Directory to write .pkl models to")
    parser.add_argument(
        "--min-reservations",
        type=int,
        default=MIN_RESERVATIONS_DEFAULT,
        help="Minimum number of reservations required to train (default: 30)",
    )
    return parser.parse_args()


def load_dataframes(db_path: str):
    import pandas as pd

    if not os.path.exists(db_path):
        fail("INSUFFICIENT_DATA", f"Base de données introuvable : {db_path}")

    conn = sqlite3.connect(db_path)
    try:
        cars = pd.read_sql_query("SELECT * FROM Car", conn)
        clients = pd.read_sql_query("SELECT * FROM Client", conn)
        reservations = pd.read_sql_query("SELECT * FROM Reservation", conn)
        payments = pd.read_sql_query("SELECT * FROM Payment", conn)
    finally:
        conn.close()

    return cars, clients, reservations, payments


def parse_iso(value):
    if value is None or value == "":
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00").split("+")[0])
    except Exception:
        try:
            return datetime.strptime(str(value)[:10], "%Y-%m-%d")
        except Exception:
            return None


def build_client_features(clients, reservations, payments):
    import numpy as np
    import pandas as pd

    if reservations.empty:
        return pd.DataFrame()

    reservations = reservations.copy()
    reservations["startDt"] = reservations["startDate"].map(parse_iso)
    reservations["endDt"] = reservations["endDate"].map(parse_iso)
    reservations["duration_days"] = reservations.apply(
        lambda row: max(1.0, (row["endDt"] - row["startDt"]).total_seconds() / 86400.0)
        if row["startDt"] and row["endDt"]
        else 1.0,
        axis=1,
    )

    rental_payments = payments[payments["type"] == "RENTAL_PAYMENT"] if not payments.empty else payments
    paid_per_reservation = (
        rental_payments.groupby("reservationId")["amount"].sum()
        if not rental_payments.empty
        else pd.Series(dtype=float)
    )

    now = datetime.utcnow()
    rows = []
    for _, client in clients.iterrows():
        client_reservations = reservations[reservations["clientId"] == client["id"]]
        nb_reservations = int(len(client_reservations))
        if nb_reservations == 0:
            rows.append(
                {
                    "clientId": int(client["id"]),
                    "fullName": client.get("fullName", ""),
                    "nb_reservations": 0,
                    "total_paid": 0.0,
                    "avg_duration": 0.0,
                    "days_since_last": 9999.0,
                    "avg_amount": 0.0,
                }
            )
            continue

        total_paid = float(
            paid_per_reservation.reindex(client_reservations["id"], fill_value=0.0).sum()
        )
        avg_duration = float(client_reservations["duration_days"].mean() or 0.0)
        last_dates = client_reservations["startDt"].dropna()
        days_since_last = (
            (now - last_dates.max()).days if not last_dates.empty else 9999
        )
        avg_amount = float(total_paid / max(1, nb_reservations))
        rows.append(
            {
                "clientId": int(client["id"]),
                "fullName": client.get("fullName", ""),
                "nb_reservations": nb_reservations,
                "total_paid": total_paid,
                "avg_duration": avg_duration,
                "days_since_last": float(days_since_last),
                "avg_amount": avg_amount,
            }
        )

    return pd.DataFrame(rows)


def train_kmeans_segments(features):
    import numpy as np
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler

    if features.empty:
        return None

    feature_columns = ["nb_reservations", "total_paid", "avg_duration", "days_since_last", "avg_amount"]
    matrix = features[feature_columns].fillna(0.0).values
    scaler = StandardScaler()
    matrix_scaled = scaler.fit_transform(matrix)

    n_clusters = min(4, max(2, len(features)))
    kmeans = KMeans(n_clusters=n_clusters, n_init=10, random_state=42)
    kmeans.fit(matrix_scaled)

    return {
        "kmeans": kmeans,
        "scaler": scaler,
        "feature_columns": feature_columns,
    }


def build_daily_history(reservations, payments):
    import pandas as pd

    if payments.empty:
        return pd.DataFrame(columns=["date", "revenue", "reservations"])

    payments = payments.copy()
    payments["date"] = payments["paymentDate"].map(lambda v: parse_iso(v).date() if parse_iso(v) else None)
    rental = payments[(payments["type"] == "RENTAL_PAYMENT") & (payments["date"].notna())]
    revenue_by_day = rental.groupby("date")["amount"].sum().rename("revenue")

    reservations = reservations.copy()
    reservations["date"] = reservations["startDate"].map(
        lambda v: parse_iso(v).date() if parse_iso(v) else None
    )
    reservations_by_day = (
        reservations[reservations["date"].notna()].groupby("date").size().rename("reservations")
    )

    daily = pd.concat([revenue_by_day, reservations_by_day], axis=1).fillna(0.0)
    daily.index = pd.to_datetime(daily.index)
    daily = daily.sort_index()
    return daily


def train_random_forest(daily):
    import numpy as np
    import pandas as pd
    from sklearn.ensemble import RandomForestRegressor

    if daily.empty or len(daily) < 7:
        return None

    df = daily.copy()
    df["dayofweek"] = df.index.dayofweek
    df["day"] = df.index.day
    df["month"] = df.index.month
    df["dayofyear"] = df.index.dayofyear

    revenue_features = ["dayofweek", "day", "month", "dayofyear"]
    revenue_target = df["revenue"].values
    demand_target = df["reservations"].values

    revenue_model = RandomForestRegressor(n_estimators=80, random_state=42)
    revenue_model.fit(df[revenue_features].values, revenue_target)

    demand_model = RandomForestRegressor(n_estimators=80, random_state=42)
    demand_model.fit(df[revenue_features].values, demand_target)

    revenue_score = float(revenue_model.score(df[revenue_features].values, revenue_target))
    demand_score = float(demand_model.score(df[revenue_features].values, demand_target))

    return {
        "revenue_model": revenue_model,
        "demand_model": demand_model,
        "feature_columns": revenue_features,
        "revenue_score": revenue_score,
        "demand_score": demand_score,
    }


def main() -> None:
    args = parse_args()

    try:
        import joblib  # noqa: F401
        import pandas as pd  # noqa: F401
        from sklearn.cluster import KMeans  # noqa: F401
    except ImportError as exc:
        fail("EXECUTION_ERROR", f"Dépendances Python manquantes : {exc}")

    try:
        cars, clients, reservations, payments = load_dataframes(args.db)
    except Exception as exc:  # pragma: no cover - defensive
        fail("EXECUTION_ERROR", f"Erreur lecture SQLite : {exc}")

    if len(reservations) < args.min_reservations:
        fail(
            "INSUFFICIENT_DATA",
            f"Pas assez de réservations ({len(reservations)} / {args.min_reservations}) pour entraîner un modèle fiable.",
        )

    os.makedirs(args.models, exist_ok=True)

    try:
        client_features = build_client_features(clients, reservations, payments)
        segments_payload = train_kmeans_segments(client_features)
        daily = build_daily_history(reservations, payments)
        forest_payload = train_random_forest(daily)

        import joblib

        if segments_payload is not None:
            joblib.dump(
                {
                    "kmeans": segments_payload["kmeans"],
                    "scaler": segments_payload["scaler"],
                    "feature_columns": segments_payload["feature_columns"],
                    "client_features": client_features.to_dict(orient="records"),
                },
                os.path.join(args.models, "client_segments.pkl"),
            )

        if forest_payload is not None:
            joblib.dump(
                {
                    "model": forest_payload["revenue_model"],
                    "feature_columns": forest_payload["feature_columns"],
                    "score": forest_payload["revenue_score"],
                    "history": daily["revenue"].astype(float).to_dict(),
                },
                os.path.join(args.models, "revenue_model.pkl"),
            )
            joblib.dump(
                {
                    "model": forest_payload["demand_model"],
                    "feature_columns": forest_payload["feature_columns"],
                    "score": forest_payload["demand_score"],
                    "history": daily["reservations"].astype(float).to_dict(),
                },
                os.path.join(args.models, "demand_model.pkl"),
            )

        confidence_parts = []
        if forest_payload is not None:
            confidence_parts.append(max(0.0, min(1.0, forest_payload["revenue_score"])))
            confidence_parts.append(max(0.0, min(1.0, forest_payload["demand_score"])))
        confidence = sum(confidence_parts) / len(confidence_parts) if confidence_parts else 0.5

        emit(
            {
                "success": True,
                "trainedAt": datetime.utcnow().isoformat(timespec="seconds"),
                "rowsUsed": int(len(reservations) + len(payments)),
                "clientsUsed": int(len(clients)),
                "reservationsUsed": int(len(reservations)),
                "confidence": round(float(confidence), 3),
                "message": "Modèles entraînés avec succès.",
            }
        )
    except Exception as exc:
        fail("EXECUTION_ERROR", f"Erreur entraînement : {exc}\n{traceback.format_exc()}")


if __name__ == "__main__":
    main()
