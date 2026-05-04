"""Generate offline predictions for RentalDesk.

Loads the .pkl models produced by train_model.py and emits a JSON
forecast: revenue, demand, top cars, client segments, recommendations.

Usage:
    python predict.py --db <path> --models <dir>
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import traceback
from datetime import datetime, timedelta
from typing import Any, Dict

PEAK_DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]


def emit(payload: Dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    sys.stdout.flush()


def fail(reason: str, message: str) -> None:
    emit({"success": False, "reason": reason, "message": message})
    sys.exit(0)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="RentalDesk ML prediction")
    parser.add_argument("--db", required=True, help="Path to SQLite database file")
    parser.add_argument("--models", required=True, help="Directory containing the .pkl models")
    return parser.parse_args()


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


def build_future_features(days: int):
    import numpy as np

    future_dates = [datetime.utcnow().date() + timedelta(days=offset + 1) for offset in range(days)]
    rows = []
    for date in future_dates:
        rows.append([
            date.weekday(),
            date.day,
            date.month,
            date.timetuple().tm_yday,
        ])
    return future_dates, np.array(rows)


def predict_series(model_payload, days: int):
    if model_payload is None:
        return [], 0.0

    future_dates, matrix = build_future_features(days)
    predictions = model_payload["model"].predict(matrix)
    points = []
    for date, value in zip(future_dates, predictions):
        points.append({"date": date.isoformat(), "value": float(max(0.0, value))})
    return points, float(model_payload.get("score", 0.0))


def compute_trend(history_dict, recent_total):
    if not history_dict:
        return "n/a"
    history = list(history_dict.values())
    if len(history) < 14:
        return "n/a"
    last_period = sum(history[-7:])
    previous_period = sum(history[-14:-7])
    if previous_period <= 0:
        return "+100%" if last_period > 0 else "n/a"
    delta = (recent_total - previous_period) / previous_period * 100.0
    sign = "+" if delta >= 0 else ""
    return f"{sign}{delta:.0f}%"


def compute_peak_days(history_dict):
    if not history_dict:
        return []
    by_weekday = [0.0] * 7
    counts = [0] * 7
    for date_key, value in history_dict.items():
        try:
            date = datetime.fromisoformat(str(date_key).replace("Z", "+00:00").split("+")[0])
        except Exception:
            try:
                date = datetime.strptime(str(date_key)[:10], "%Y-%m-%d")
            except Exception:
                continue
        weekday = date.weekday()
        by_weekday[weekday] += float(value)
        counts[weekday] += 1
    averages = [
        (PEAK_DAY_LABELS[i], by_weekday[i] / counts[i] if counts[i] else 0.0)
        for i in range(7)
    ]
    averages.sort(key=lambda pair: pair[1], reverse=True)
    return [label for label, value in averages[:3] if value > 0]


def predict_top_cars(cars, reservations, days: int):
    if cars.empty or reservations.empty:
        return []

    horizon = datetime.utcnow() - timedelta(days=180)
    recent = reservations.copy()
    recent["startDt"] = recent["startDate"].map(parse_iso)
    recent = recent[recent["startDt"].notna() & (recent["startDt"] >= horizon)]

    counts = recent.groupby("carId").size().sort_values(ascending=False)
    if counts.empty:
        return []

    total = float(counts.sum()) or 1.0
    top = counts.head(5)
    horizon_factor = days / 180.0
    rows = []
    for car_id, count in top.items():
        car = cars[cars["id"] == car_id]
        if car.empty:
            continue
        car_row = car.iloc[0]
        name = f"{car_row.get('brand', '')} {car_row.get('model', '')}".strip() or f"Voiture #{car_id}"
        expected = max(1, int(round(count * horizon_factor)))
        score = round(float(count) / total, 2)
        rows.append({
            "carName": name,
            "expectedReservations": expected,
            "score": min(1.0, max(0.0, score)),
        })
    return rows


def predict_client_segments(models_dir: str, clients):
    import joblib
    import numpy as np

    path = os.path.join(models_dir, "client_segments.pkl")
    if not os.path.exists(path):
        return []

    payload = joblib.load(path)
    kmeans = payload["kmeans"]
    feature_columns = payload["feature_columns"]
    feature_rows = payload.get("client_features", [])
    if not feature_rows:
        return []

    matrix = np.array([[row.get(col, 0.0) for col in feature_columns] for row in feature_rows])
    matrix_scaled = payload["scaler"].transform(matrix)
    labels = kmeans.predict(matrix_scaled)

    centroids_unscaled = payload["scaler"].inverse_transform(kmeans.cluster_centers_)
    segments = []
    for cluster_index, centroid in enumerate(centroids_unscaled):
        nb_reservations, total_paid, avg_duration, days_since_last, avg_amount = centroid
        if days_since_last > 180 and nb_reservations < 1.5:
            name = "Clients inactifs"
            description = "Clients sans location récente"
        elif total_paid > centroids_unscaled[:, 1].mean() * 1.3:
            name = "Clients à forte valeur"
            description = "Clients avec un panier moyen élevé"
        elif nb_reservations >= 3:
            name = "Clients fidèles"
            description = "Clients réguliers avec plusieurs locations"
        else:
            name = "Clients occasionnels"
            description = "Clients avec peu de locations"
        count = int((labels == cluster_index).sum())
        segments.append({"name": name, "count": count, "description": description})

    deduped: Dict[str, Dict[str, Any]] = {}
    for segment in segments:
        key = segment["name"]
        if key in deduped:
            deduped[key]["count"] += segment["count"]
        else:
            deduped[key] = segment
    return list(deduped.values())


def build_recommendations(top_cars, segments, demand_points):
    recommendations = []
    if top_cars:
        recommendations.append(
            f"Surveiller la disponibilité de {top_cars[0]['carName']} (forte demande prévue)."
        )
    if any(seg["name"] == "Clients inactifs" and seg["count"] > 0 for seg in segments):
        recommendations.append("Relancer les clients inactifs avec une promotion ciblée.")
    if any(seg["name"] == "Clients fidèles" and seg["count"] > 0 for seg in segments):
        recommendations.append("Préparer un programme de fidélité pour récompenser les meilleurs clients.")
    weekend_demand = sum(point["value"] for point in demand_points[:7]) if demand_points else 0
    if weekend_demand > 5:
        recommendations.append("Préparer plus de véhicules économiques pour le week-end.")
    if not recommendations:
        recommendations.append("Continuer à enregistrer les paiements et réservations pour affiner les prévisions.")
    return recommendations


def main() -> None:
    args = parse_args()

    try:
        import joblib  # noqa: F401
        import pandas as pd  # noqa: F401
    except ImportError as exc:
        fail("EXECUTION_ERROR", f"Dépendances Python manquantes : {exc}")

    revenue_payload = None
    demand_payload = None
    revenue_path = os.path.join(args.models, "revenue_model.pkl")
    demand_path = os.path.join(args.models, "demand_model.pkl")
    if not os.path.exists(revenue_path) or not os.path.exists(demand_path):
        fail("INSUFFICIENT_DATA", "Modèles non entraînés. Lancez d'abord l'entraînement.")

    try:
        import joblib

        revenue_payload = joblib.load(revenue_path)
        demand_payload = joblib.load(demand_path)

        cars, clients, reservations, payments = load_dataframes(args.db)

        revenue_points_30, revenue_score = predict_series(revenue_payload, 30)
        demand_points_30, demand_score = predict_series(demand_payload, 30)
        revenue_points_7 = revenue_points_30[:7]
        demand_points_7 = demand_points_30[:7]

        next_7_total = float(sum(point["value"] for point in revenue_points_7))
        next_30_total = float(sum(point["value"] for point in revenue_points_30))
        trend = compute_trend(revenue_payload.get("history", {}), next_7_total)
        peak_days = compute_peak_days(demand_payload.get("history", {}))
        top_cars = predict_top_cars(cars, reservations, 30)
        segments = predict_client_segments(args.models, clients)
        recommendations = build_recommendations(top_cars, segments, demand_points_7)

        history = revenue_payload.get("history", {})
        revenue_history_points = [
            {"date": str(date_key)[:10], "value": float(value)}
            for date_key, value in list(history.items())[-30:]
        ]

        confidence = max(
            0.0,
            min(
                1.0,
                ((revenue_score or 0.0) + (demand_score or 0.0)) / 2.0
                if revenue_score is not None and demand_score is not None
                else 0.5,
            ),
        )

        emit(
            {
                "success": True,
                "generatedAt": datetime.utcnow().isoformat(timespec="seconds"),
                "modelConfidence": round(float(confidence), 3),
                "dataPeriod": "6 derniers mois",
                "revenue": {
                    "next7Days": round(next_7_total, 2),
                    "next30Days": round(next_30_total, 2),
                    "trend": trend,
                },
                "demand": {
                    "next7DaysReservations": int(round(sum(point["value"] for point in demand_points_7))),
                    "next30DaysReservations": int(round(sum(point["value"] for point in demand_points_30))),
                    "peakDays": peak_days,
                },
                "topCars": top_cars,
                "clientSegments": segments,
                "recommendations": recommendations,
                "revenueHistory": revenue_history_points,
                "revenueForecast": revenue_points_7,
                "demandForecast": demand_points_7,
            }
        )
    except Exception as exc:
        fail("EXECUTION_ERROR", f"Erreur prédiction : {exc}\n{traceback.format_exc()}")


if __name__ == "__main__":
    main()
