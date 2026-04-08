import os
import pickle
import json
import re
from datetime import date, datetime, timedelta

import numpy as np
import pandas as pd
import requests
from django.core.cache import cache
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods
from sklearn.ensemble import (
    AdaBoostRegressor,
    ExtraTreesRegressor,
    GradientBoostingRegressor,
    RandomForestRegressor,
)
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.preprocessing import PolynomialFeatures
from statsmodels.tsa.statespace.sarimax import SARIMAX

from .models import (
    FavoriteCity,
    Notification,
    SMSNotificationLog,
    SavedPrediction,
    UserProfile,
    WeatherHistory,
)
from .sms_service import send_sms_notification, send_sms_to_phone_number

try:
    from xgboost import XGBRegressor
except ImportError:
    XGBRegressor = None


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FOLDER = os.path.join(BASE_DIR, "datasets")
MODEL_FOLDER = os.path.join(BASE_DIR, "saved_models")

os.makedirs(DATA_FOLDER, exist_ok=True)
os.makedirs(MODEL_FOLDER, exist_ok=True)

HTTP_SESSION = requests.Session()
HTTP_SESSION.trust_env = False


def attach_dataframe_meta(df, meta):
    df.attrs.update(meta)
    return df


def dataframe_meta(df):
    return {
        "city_file": df.attrs.get("city_file", ""),
        "data_status": df.attrs.get("data_status", "unknown"),
        "used_local_file": df.attrs.get("used_local_file", False),
    }


def build_prediction_cache_key(city, target, days):
    normalized_city = re.sub(r"[^a-z0-9]+", "-", city.strip().lower()).strip("-")
    return f"smart-prediction-{normalized_city}-{target.isoformat()}-{days}"


def fetch_json(url, headers=None):
    response = HTTP_SESSION.get(url, headers=headers, timeout=30)
    response.raise_for_status()
    return response.json()


def latest_archive_date():
    return date.today() - timedelta(days=1)


def find_city_file(city):
    normalized_city = city.strip().lower()

    for file_name in os.listdir(DATA_FOLDER):
        if not file_name.lower().endswith(".csv"):
            continue
        if os.path.splitext(file_name)[0].strip().lower() == normalized_city:
            return os.path.join(DATA_FOLDER, file_name)

    return os.path.join(DATA_FOLDER, f"{city}.csv")


def normalize_weather_dataframe(df, fallback_city):
    renamed_df = df.rename(
        columns={
            "time": "date",
            "Time": "date",
            "temperature_2m_max": "temperature",
            "temperature_2m_max (°C)": "temperature",
            "temperature_2m_max (Â°C)": "temperature",
            "relative_humidity_2m_mean": "humidity",
            "relative_humidity_2m_mean (%)": "humidity",
            "wind_speed": "wind",
            "windspeed": "wind",
            "windspeed_10m_max": "wind",
            "windspeed_10m_max (km/h)": "wind",
            "wind_speed_10m_max": "wind",
            "precipitation_sum": "precipitation",
            "precipitation_sum (mm)": "precipitation",
            "rain_sum": "precipitation",
            "rain_sum (mm)": "precipitation",
            "precipitation": "precipitation",
            "snowfall_sum": "snowfall",
            "snowfall_sum (cm)": "snowfall",
            "snowfall": "snowfall",
            "city_name": "city",
        }
    ).copy()

    if "date" not in renamed_df.columns:
        raise ValueError("Dataset is missing a supported date column")

    if "temperature" not in renamed_df.columns:
        raise ValueError("Dataset is missing a supported temperature column")

    if "humidity" not in renamed_df.columns:
        renamed_df["humidity"] = np.nan

    if "wind" not in renamed_df.columns:
        renamed_df["wind"] = np.nan

    if "precipitation" not in renamed_df.columns:
        renamed_df["precipitation"] = np.nan

    if "snowfall" not in renamed_df.columns:
        renamed_df["snowfall"] = np.nan

    if "city" not in renamed_df.columns:
        renamed_df["city"] = fallback_city

    renamed_df["date"] = pd.to_datetime(renamed_df["date"], errors="coerce")
    renamed_df["temperature"] = pd.to_numeric(
        renamed_df["temperature"], errors="coerce"
    )
    renamed_df["humidity"] = pd.to_numeric(renamed_df["humidity"], errors="coerce")
    renamed_df["wind"] = pd.to_numeric(renamed_df["wind"], errors="coerce")
    renamed_df["precipitation"] = pd.to_numeric(
        renamed_df["precipitation"], errors="coerce"
    )
    renamed_df["snowfall"] = pd.to_numeric(renamed_df["snowfall"], errors="coerce")
    renamed_df = renamed_df.dropna(subset=["date", "temperature"]).reset_index(drop=True)

    return renamed_df[
        ["date", "temperature", "humidity", "wind", "precipitation", "snowfall", "city"]
    ]


def build_weather_response_from_dataframe(df):
    if df.empty:
        return {
            "labels": [],
            "temps": [],
            "humidity": [],
            "wind": [],
            "precipitation": [],
            "snowfall": [],
            "source": "dataset",
            "data_meta": dataframe_meta(df),
        }

    recent_df = (
        df.sort_values("date")
        .tail(7)
        .reset_index(drop=True)
    )

    return {
        "labels": recent_df["date"].dt.strftime("%Y-%m-%d").tolist(),
        "temps": recent_df["temperature"].astype(float).round(2).tolist(),
        "humidity": recent_df["humidity"].fillna(0).astype(float).round(2).tolist(),
        "wind": recent_df["wind"].fillna(0).astype(float).round(2).tolist(),
        "precipitation": recent_df["precipitation"].fillna(0).astype(float).round(2).tolist(),
        "snowfall": recent_df["snowfall"].fillna(0).astype(float).round(2).tolist(),
        "source": "dataset",
        "data_meta": dataframe_meta(df),
    }


def notification_payload(notification):
    return {
        "id": notification.id,
        "title": notification.title,
        "message": notification.message,
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat(),
    }


def user_payload(user):
    profile = getattr(user, "profile", None)
    return {
        "id": user.id,
        "username": user.username,
        "is_staff": user.is_staff,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "phone_number": profile.phone_number if profile else "",
        "city": profile.city if profile else "",
        "country": profile.country if profile else "",
        "sms_notifications_enabled": profile.sms_notifications_enabled if profile else False,
        "phone_verified": profile.phone_verified if profile else False,
    }


def sms_log_payload(log_item):
    return {
        "id": log_item.id,
        "phone_number": log_item.phone_number,
        "message": log_item.message,
        "status": log_item.status,
        "provider_message_id": log_item.provider_message_id,
        "error_message": log_item.error_message,
        "created_at": log_item.created_at.isoformat(),
        "username": log_item.user.username,
    }


def create_notification(user, title, message):
    return Notification.objects.create(user=user, title=title, message=message)


def send_user_sms_if_enabled(user, message):
    try:
        return send_sms_notification(user, message)
    except Exception:
        return {"sent": False, "reason": "Unexpected SMS error"}


def build_forecast_sms_message(city, target_date, best_model, alerts):
    future_values = best_model.get("future", []) or []
    future_dates = best_model.get("future_dates", []) or []
    target_date_label = target_date.strftime("%Y-%m-%d")
    target_temp = None

    if target_date_label in future_dates:
        target_index = future_dates.index(target_date_label)
        if target_index < len(future_values):
            target_temp = future_values[target_index]

    if target_temp is None and future_values:
        target_temp = future_values[0]

    peak_temp = best_model.get("highest_temp_next_month")
    model_name = best_model.get("model", "Forecast Model")

    message_parts = [
        "Weather Prediction System",
        f"City: {city}",
        f"Date: {target_date.strftime('%d %b %Y')}",
        f"Model: {model_name}",
    ]

    if target_temp is not None:
        message_parts.append(f"Predicted temp: {target_temp:.1f} C")

    if peak_temp is not None:
        message_parts.append(f"Peak temp: {peak_temp:.1f} C")

    if alerts:
        top_alert = alerts[0]
        message_parts.append(f"Alert: {top_alert['title']}")
    else:
        message_parts.append("Alert: No major weather alert")

    return " | ".join(message_parts)


def build_model_summary(model_result):
    future_values = model_result.get("future", []) or []
    peak_temperature = max(future_values) if future_values else None

    return {
        **model_result,
        "highest_temp_next_month": peak_temperature,
    }


def build_timeline_labels(df, split_index, days):
    ordered_dates = pd.to_datetime(df["date"], errors="coerce").dropna().reset_index(drop=True)
    actual_dates = ordered_dates.iloc[split_index:].dt.strftime("%Y-%m-%d").tolist()

    if ordered_dates.empty:
        future_dates = []
    else:
        last_date = ordered_dates.iloc[-1]
        future_dates = [
            (last_date + timedelta(days=offset)).strftime("%Y-%m-%d")
            for offset in range(1, days + 1)
        ]

    return actual_dates, future_dates


def build_extreme_alerts(city, best_model, recent_weather):
    alerts = []
    future_values = best_model.get("future", []) or []

    if not future_values:
        return alerts

    peak_temp = max(future_values)
    min_temp = min(future_values)
    avg_humidity = (
        sum(recent_weather.get("humidity", [])) / len(recent_weather.get("humidity", []))
        if recent_weather.get("humidity")
        else 0
    )
    max_wind = max(recent_weather.get("wind", []) or [0])
    total_precipitation = sum(recent_weather.get("precipitation", []) or [0])
    total_snowfall = sum(recent_weather.get("snowfall", []) or [0])

    if peak_temp >= 42:
        alerts.append(
            {
                "level": "high",
                "title": "Heatwave Warning",
                "message": f"{city} may reach {peak_temp:.1f} C in the forecast period.",
            }
        )
    elif peak_temp >= 36:
        alerts.append(
            {
                "level": "medium",
                "title": "Hot Weather Alert",
                "message": f"{city} may see high temperatures near {peak_temp:.1f} C.",
            }
        )

    if min_temp <= 2:
        alerts.append(
            {
                "level": "medium",
                "title": "Cold Wave Alert",
                "message": f"Temperatures may drop close to {min_temp:.1f} C.",
            }
        )

    if total_precipitation >= 35:
        alerts.append(
            {
                "level": "high",
                "title": "Heavy Rain Alert",
                "message": f"Recent conditions suggest significant rainfall around {city}.",
            }
        )
    elif total_precipitation >= 10:
        alerts.append(
            {
                "level": "medium",
                "title": "Rain Watch",
                "message": f"Rainfall activity is elevated in the latest weather data for {city}.",
            }
        )

    if total_snowfall > 1:
        alerts.append(
            {
                "level": "medium",
                "title": "Snowfall Alert",
                "message": f"Snowfall has been detected in the latest weather data for {city}.",
            }
        )

    if max_wind >= 35:
        alerts.append(
            {
                "level": "high",
                "title": "Strong Wind Warning",
                "message": f"Winds have reached around {max_wind:.1f} km/h in recent data.",
            }
        )
    elif max_wind >= 22:
        alerts.append(
            {
                "level": "medium",
                "title": "Wind Advisory",
                "message": f"Expect breezy conditions with winds near {max_wind:.1f} km/h.",
            }
        )

    if avg_humidity >= 85 and total_precipitation >= 10:
        alerts.append(
            {
                "level": "high",
                "title": "Storm Risk",
                "message": f"High humidity and active rainfall indicate elevated storm potential in {city}.",
            }
        )

    return alerts


@csrf_exempt
@require_http_methods(["POST"])
def login_view(request):
    username = request.POST.get("username", "").strip()
    password = request.POST.get("password", "")

    if not username or not password:
        return JsonResponse({"error": "Username and password are required"}, status=400)

    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({"error": "Invalid username or password"}, status=401)

    login(request, user)
    create_notification(
        user,
        "Login successful",
        f"Welcome back, {user.get_username()}. You are now signed in.",
    )
    send_user_sms_if_enabled(
        user,
        f"Weather Prediction System: login successful for {user.get_username()}.",
    )

    return JsonResponse(
        {
            "message": "Login successful",
            "user": user_payload(user),
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def register_view(request):
    username = request.POST.get("username", "").strip()
    password = request.POST.get("password", "")
    first_name = request.POST.get("first_name", "").strip()
    last_name = request.POST.get("last_name", "").strip()
    email = request.POST.get("email", "").strip()
    phone_number = request.POST.get("phone_number", "").strip()
    city = request.POST.get("city", "").strip()
    country = request.POST.get("country", "").strip()

    if not username or not password:
        return JsonResponse({"error": "Username and password are required"}, status=400)

    if not first_name or not last_name or not email:
        return JsonResponse(
            {"error": "First name, last name, and email are required"},
            status=400,
        )

    if len(password) < 6:
        return JsonResponse({"error": "Password must be at least 6 characters"}, status=400)

    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "Username already exists"}, status=400)

    if User.objects.filter(email=email).exists():
        return JsonResponse({"error": "Email already exists"}, status=400)

    user = User.objects.create_user(
        username=username,
        password=password,
        first_name=first_name,
        last_name=last_name,
        email=email,
    )
    UserProfile.objects.create(
        user=user,
        phone_number=phone_number,
        city=city,
        country=country,
        sms_notifications_enabled=bool(phone_number),
    )
    login(request, user)
    create_notification(
        user,
        "Account created",
        "Your account was created successfully. Start exploring forecasts.",
    )
    send_user_sms_if_enabled(
        user,
        "Weather Prediction System: your account has been created successfully.",
    )

    return JsonResponse(
        {
            "message": "Registration successful",
            "user": user_payload(user),
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def logout_view(request):
    logout(request)
    return JsonResponse({"message": "Logged out successfully"})


@require_GET
def current_user_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({"user": None})

    return JsonResponse(
        {
            "user": user_payload(request.user)
        }
    )


@login_required
@require_GET
def sms_preferences_view(request):
    profile = getattr(request.user, "profile", None)
    recent_sms_logs = []

    if request.user.is_staff:
        recent_sms_logs = [
            sms_log_payload(item) for item in SMSNotificationLog.objects.select_related("user")[:25]
        ]

    return JsonResponse(
        {
            "sms_preferences": {
                "phone_number": profile.phone_number if profile else "",
                "sms_notifications_enabled": profile.sms_notifications_enabled if profile else False,
                "phone_verified": profile.phone_verified if profile else False,
            },
            "recent_sms_logs": recent_sms_logs,
        }
    )


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def update_sms_preferences(request):
    profile = getattr(request.user, "profile", None)
    if profile is None:
        profile = UserProfile.objects.create(user=request.user)

    phone_number = request.POST.get("phone_number", "").strip()
    sms_enabled = request.POST.get("sms_notifications_enabled", "").strip().lower()

    if phone_number:
        profile.phone_number = phone_number
        profile.phone_verified = False

    if sms_enabled in {"true", "false"}:
        profile.sms_notifications_enabled = sms_enabled == "true"

    profile.save()

    return JsonResponse(
        {
            "message": "SMS preferences updated",
            "sms_preferences": {
                "phone_number": profile.phone_number,
                "sms_notifications_enabled": profile.sms_notifications_enabled,
                "phone_verified": profile.phone_verified,
            },
        }
    )


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def send_test_sms_view(request):
    profile = getattr(request.user, "profile", None)

    if profile is None or not profile.phone_number:
        return JsonResponse({"error": "Add a phone number before sending a test SMS."}, status=400)

    if not profile.sms_notifications_enabled:
        return JsonResponse({"error": "Enable SMS alerts before sending a test SMS."}, status=400)

    sms_result = send_user_sms_if_enabled(
        request.user,
        "Weather Prediction System: this is a test SMS from your account settings.",
    )

    recent_logs = []
    if request.user.is_staff:
        recent_logs = [
            sms_log_payload(item) for item in SMSNotificationLog.objects.select_related("user")[:25]
        ]

    if sms_result.get("sent"):
        create_notification(
            request.user,
            "Test SMS sent",
            "A test SMS was sent from your account settings.",
        )
        return JsonResponse(
            {
                "message": "Test SMS sent successfully.",
                "recent_sms_logs": recent_logs,
            }
        )

    return JsonResponse(
        {
            "error": sms_result.get("reason") or "Unable to send test SMS.",
            "recent_sms_logs": recent_logs,
        },
        status=400,
    )


@login_required
@require_GET
def notifications_view(request):
    notifications = [
        notification_payload(item) for item in request.user.notifications.all()[:10]
    ]

    return JsonResponse(
        {
            "notifications": notifications,
            "unread_count": request.user.notifications.filter(is_read=False).count(),
        }
    )


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def mark_notifications_read(request):
    request.user.notifications.filter(is_read=False).update(is_read=True)
    return JsonResponse({"message": "Notifications marked as read"})


@login_required
@require_GET
def saved_predictions_view(request):
    predictions = request.user.saved_predictions.all()[:10]
    return JsonResponse(
        {
            "saved_predictions": [
                {
                    "id": item.id,
                    "city": item.city,
                    "target_date": item.target_date.isoformat(),
                    "model_name": item.model_name,
                    "r2_score": item.r2_score,
                    "mse": item.mse,
                    "peak_temperature": item.peak_temperature,
                    "future_temperatures": item.future_temperatures,
                    "created_at": item.created_at.isoformat(),
                }
                for item in predictions
            ]
        }
    )


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def add_favorite_city(request):
    city = request.POST.get("city", "").strip()
    if not city:
        return JsonResponse({"error": "City is required"}, status=400)

    favorite, created = FavoriteCity.objects.get_or_create(user=request.user, city=city)

    if created:
        create_notification(
            request.user,
            "City added to favorites",
            f"{city} is now in your favorite cities list.",
        )

    return JsonResponse(
        {
            "favorite_city": {
                "id": favorite.id,
                "city": favorite.city,
            },
            "created": created,
        }
    )


@require_GET
def fetch_weather(request):
    city = request.GET.get("city")

    if not city:
        return JsonResponse({"error": "City required"}, status=400)

    try:
        normalized_cached = get_city_data(city)
        if not normalized_cached.empty:
            return JsonResponse(build_weather_response_from_dataframe(normalized_cached))
    except FileNotFoundError:
        pass

    try:
        geo_url = f"https://nominatim.openstreetmap.org/search?q={city}&format=json&limit=1"
        geo_res = fetch_json(geo_url, headers={"User-Agent": "weather-app"})

        if not geo_res:
            return JsonResponse({"error": "City not found"}, status=404)

        lat = geo_res[0]["lat"]
        lon = geo_res[0]["lon"]

        end_date = latest_archive_date()
        start_date = end_date - timedelta(days=6)

        history_url = (
            f"https://archive-api.open-meteo.com/v1/archive"
            f"?latitude={lat}&longitude={lon}"
            f"&start_date={start_date}&end_date={end_date}"
            f"&daily=temperature_2m_max,relative_humidity_2m_mean,wind_speed_10m_max,"
            f"precipitation_sum,snowfall_sum"
            f"&timezone=auto"
        )

        res = fetch_json(history_url)
        daily = res.get("daily", {})

        dates = daily.get("time", [])
        temps = daily.get("temperature_2m_max", [])
        humidity = daily.get("relative_humidity_2m_mean", [])
        wind = daily.get("wind_speed_10m_max", [])
        precipitation = daily.get("precipitation_sum", [0] * len(dates))
        snowfall = daily.get("snowfall_sum", [0] * len(dates))

        for i in range(len(dates)):
            WeatherHistory.objects.update_or_create(
                city=city,
                date=datetime.strptime(dates[i], "%Y-%m-%d").date(),
                defaults={
                    "temperature": temps[i],
                    "humidity": humidity[i],
                    "wind": wind[i],
                },
            )

        return JsonResponse(
            {
                "labels": dates,
                "temps": temps,
                "humidity": humidity,
                "wind": wind,
                "precipitation": precipitation,
                "snowfall": snowfall,
                "source": "api",
                "data_meta": {
                    "city_file": os.path.basename(find_city_file(city)),
                    "data_status": "downloaded_recent_api_window",
                    "used_local_file": False,
                },
            }
        )
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)


def get_coordinates(city):
    url = f"https://nominatim.openstreetmap.org/search?q={city}&format=json&limit=1"
    res = fetch_json(url, headers={"User-Agent": "weather-app"})

    if not res:
        raise Exception("City not found")

    return res[0]["lat"], res[0]["lon"]


def fetch_archive_weather_data(city, lat, lon, start_date, end_date):
    if start_date > end_date:
        return pd.DataFrame(
            columns=["date", "temperature", "humidity", "wind", "precipitation", "snowfall", "city"]
        )

    url = (
        f"https://archive-api.open-meteo.com/v1/archive?"
        f"latitude={lat}&longitude={lon}"
        f"&start_date={start_date.isoformat()}&end_date={end_date.isoformat()}"
        f"&daily=temperature_2m_max,relative_humidity_2m_mean,wind_speed_10m_max,"
        f"precipitation_sum,snowfall_sum"
        f"&timezone=auto"
    )

    res = fetch_json(url)
    daily = res.get("daily", {})

    downloaded_df = pd.DataFrame(
        {
            "date": daily.get("time", []),
            "temperature": daily.get("temperature_2m_max", []),
            "humidity": daily.get("relative_humidity_2m_mean", []),
            "wind": daily.get("wind_speed_10m_max", []),
            "precipitation": daily.get("precipitation_sum", []),
            "snowfall": daily.get("snowfall_sum", []),
            "city": city,
        }
    )

    return normalize_weather_dataframe(downloaded_df, city)


def get_city_data(city):
    file_path = find_city_file(city)
    archive_end_date = latest_archive_date()
    start_date = archive_end_date - timedelta(days=15 * 365)
    city_file_name = os.path.basename(file_path)

    if os.path.exists(file_path):
        cached = pd.read_csv(file_path)
        normalized_cached = normalize_weather_dataframe(cached, city)

        if not normalized_cached.empty:
            try:
                lat, lon = get_coordinates(city)
                latest_cached_date = normalized_cached["date"].max().date()
                missing_precipitation_history = "precipitation" not in cached.columns
                missing_snowfall_history = "snowfall" not in cached.columns

                if missing_precipitation_history or missing_snowfall_history:
                    refreshed_full_df = fetch_archive_weather_data(
                        city, lat, lon, start_date, archive_end_date
                    )

                    if not refreshed_full_df.empty:
                        refreshed_full_df.to_csv(file_path, index=False)
                        return attach_dataframe_meta(
                            refreshed_full_df,
                            {
                                "city_file": city_file_name,
                                "data_status": "upgraded_local_city_file",
                                "used_local_file": True,
                            },
                        )

                if latest_cached_date < archive_end_date:
                    refresh_start = latest_cached_date + timedelta(days=1)
                    refresh_df = fetch_archive_weather_data(
                        city, lat, lon, refresh_start, archive_end_date
                    )

                    if not refresh_df.empty:
                        normalized_cached = (
                            pd.concat([normalized_cached, refresh_df], ignore_index=True)
                            .drop_duplicates(subset=["date"], keep="last")
                            .sort_values("date")
                            .reset_index(drop=True)
                        )
                        normalized_cached.to_csv(file_path, index=False)
                        return attach_dataframe_meta(
                            normalized_cached,
                            {
                                "city_file": city_file_name,
                                "data_status": "refreshed_local_city_file",
                                "used_local_file": True,
                            },
                        )

                return attach_dataframe_meta(
                    normalized_cached,
                    {
                        "city_file": city_file_name,
                        "data_status": "used_local_city_file",
                        "used_local_file": True,
                    },
                )
            except Exception:
                return attach_dataframe_meta(
                    normalized_cached,
                    {
                        "city_file": city_file_name,
                        "data_status": "used_local_city_file_fallback",
                        "used_local_file": True,
                    },
                )

    try:
        lat, lon = get_coordinates(city)
        normalized_df = fetch_archive_weather_data(city, lat, lon, start_date, archive_end_date)

        if normalized_df.empty:
            raise ValueError(f"No historical weather data was returned for '{city}'.")

        normalized_df.to_csv(file_path, index=False)
        return attach_dataframe_meta(
            normalized_df,
            {
                "city_file": city_file_name,
                "data_status": "downloaded_new_city_file",
                "used_local_file": False,
            },
        )
    except Exception as exc:
        raise FileNotFoundError(
            f"City '{city}' is not available locally, and live weather fetch failed. {exc}"
        ) from exc


def prepare_weather_features(df):
    working_df = df.copy()
    working_df["date"] = pd.to_datetime(working_df["date"], errors="coerce")
    working_df["temperature"] = pd.to_numeric(working_df["temperature"], errors="coerce")
    working_df["humidity"] = pd.to_numeric(working_df["humidity"], errors="coerce")
    working_df["wind"] = pd.to_numeric(working_df["wind"], errors="coerce")
    working_df = working_df.dropna(subset=["date", "temperature"]).sort_values("date").reset_index(drop=True)

    working_df["humidity"] = working_df["humidity"].ffill().bfill()
    working_df["wind"] = working_df["wind"].ffill().bfill()

    dates = working_df["date"]
    feature_frame = pd.DataFrame(
        {
            "trend": np.arange(len(working_df)),
            "month": dates.dt.month,
            "day": dates.dt.day,
            "day_of_year": dates.dt.dayofyear,
            "week_of_year": dates.dt.isocalendar().week.astype(int),
            "season_sin": np.sin(2 * np.pi * dates.dt.dayofyear / 365.25),
            "season_cos": np.cos(2 * np.pi * dates.dt.dayofyear / 365.25),
            "humidity": working_df["humidity"],
            "wind": working_df["wind"],
        }
    )

    for lag in (1, 2, 3, 7, 14, 30):
        feature_frame[f"temp_lag_{lag}"] = working_df["temperature"].shift(lag)

    for window in (3, 7, 14, 30):
        feature_frame[f"temp_roll_mean_{window}"] = working_df["temperature"].shift(1).rolling(window).mean()
        feature_frame[f"humidity_roll_mean_{window}"] = working_df["humidity"].rolling(window).mean()
        feature_frame[f"wind_roll_mean_{window}"] = working_df["wind"].rolling(window).mean()

    feature_frame = feature_frame.replace([np.inf, -np.inf], np.nan)
    valid_mask = feature_frame.notna().all(axis=1)
    filtered_df = working_df.loc[valid_mask].reset_index(drop=True)
    filtered_features = feature_frame.loc[valid_mask].reset_index(drop=True)
    target = filtered_df["temperature"].to_numpy()

    return filtered_df, filtered_features, target


def build_future_feature_row(current_date, history_length, step_index, temp_history, humidity_history, wind_history):
    day_of_year = current_date.timetuple().tm_yday
    row = {
        "trend": history_length + step_index,
        "month": current_date.month,
        "day": current_date.day,
        "day_of_year": day_of_year,
        "week_of_year": current_date.isocalendar()[1],
        "season_sin": np.sin(2 * np.pi * day_of_year / 365.25),
        "season_cos": np.cos(2 * np.pi * day_of_year / 365.25),
        "humidity": humidity_history[-1],
        "wind": wind_history[-1],
    }

    for lag in (1, 2, 3, 7, 14, 30):
        row[f"temp_lag_{lag}"] = temp_history[-lag]

    for window in (3, 7, 14, 30):
        row[f"temp_roll_mean_{window}"] = float(np.mean(temp_history[-window:]))
        row[f"humidity_roll_mean_{window}"] = float(np.mean(humidity_history[-window:]))
        row[f"wind_roll_mean_{window}"] = float(np.mean(wind_history[-window:]))

    return row


def train_and_predict(df, days, city):
    model_path = os.path.join(MODEL_FOLDER, f"{city}_linear.pkl")
    temps = df["temperature"].astype(float).dropna().values

    X = np.arange(len(temps)).reshape(-1, 1)
    y = temps

    if os.path.exists(model_path):
        with open(model_path, "rb") as file_pointer:
            model = pickle.load(file_pointer)
        used_saved_pkl = True
    else:
        model = LinearRegression()
        model.fit(X, y)
        with open(model_path, "wb") as file_pointer:
            pickle.dump(model, file_pointer)
        used_saved_pkl = False

    split = int(len(temps) * 0.9)
    X_test = X[split:]
    y_test = y[split:]
    pred = model.predict(X_test)
    future = model.predict(np.arange(len(temps), len(temps) + days).reshape(-1, 1))
    actual_dates, future_dates = build_timeline_labels(df, split, days)

    return build_model_summary(
        {
            "actual": y_test.tolist(),
            "actual_dates": actual_dates,
            "predicted": pred.tolist(),
            "future": future.tolist(),
            "future_dates": future_dates,
            "r2_score": round(r2_score(y_test, pred), 4),
            "mse": round(mean_squared_error(y_test, pred), 4),
            "model": "Linear Regression",
            "model_cache": {
                "used_saved_pkl": used_saved_pkl,
                "model_file": os.path.basename(model_path),
            },
        }
    )


def sarima_predict(df, days):
    temps = df["temperature"].astype(float).dropna()
    split = int(len(temps) * 0.9)
    train = temps[:split]
    test = temps[split:]

    model = SARIMAX(train, order=(1, 1, 1), seasonal_order=(1, 1, 1, 12))
    model_fit = model.fit(disp=False)

    pred = model_fit.forecast(len(test))
    future = model_fit.forecast(days)
    actual_dates, future_dates = build_timeline_labels(df, split, days)

    return build_model_summary(
        {
            "actual": test.tolist(),
            "actual_dates": actual_dates,
            "predicted": pred.tolist(),
            "future": future.tolist(),
            "future_dates": future_dates,
            "r2_score": round(r2_score(test, pred), 4),
            "mse": round(mean_squared_error(test, pred), 4),
            "model": "SARIMA",
        }
    )


def polynomial_predict(df, days):
    temps = df["temperature"].astype(float).dropna().values
    X = np.arange(len(temps)).reshape(-1, 1)
    y = temps
    split = int(len(temps) * 0.9)

    poly = PolynomialFeatures(2)
    X_train = poly.fit_transform(X[:split])
    X_test = poly.transform(X[split:])

    model = LinearRegression()
    model.fit(X_train, y[:split])

    pred = model.predict(X_test)
    future = model.predict(
        poly.transform(np.arange(len(temps), len(temps) + days).reshape(-1, 1))
    )
    actual_dates, future_dates = build_timeline_labels(df, split, days)

    return build_model_summary(
        {
            "actual": y[split:].tolist(),
            "actual_dates": actual_dates,
            "predicted": pred.tolist(),
            "future": future.tolist(),
            "future_dates": future_dates,
            "r2_score": round(r2_score(y[split:], pred), 4),
            "mse": round(mean_squared_error(y[split:], pred), 4),
            "model": "Polynomial Regression",
        }
    )


def tree_model_predict(df, days, model, model_name):
    working_df, feature_frame, target = prepare_weather_features(df)

    if len(feature_frame) < 90:
        raise ValueError("Not enough historical data for advanced weather features")

    split = int(len(feature_frame) * 0.9)

    X_train = feature_frame.iloc[:split]
    X_test = feature_frame.iloc[split:]
    y_train = target[:split]
    y_test = target[split:]

    model.fit(X_train, y_train)
    pred = model.predict(X_test)
    temp_history = working_df["temperature"].tolist()
    humidity_history = working_df["humidity"].tolist()
    wind_history = working_df["wind"].tolist()
    future = []
    last_date = working_df["date"].iloc[-1].date()

    for step_index in range(days):
        current_date = last_date + timedelta(days=step_index + 1)
        future_row = build_future_feature_row(
            current_date,
            len(working_df),
            step_index,
            temp_history,
            humidity_history,
            wind_history,
        )
        future_value = float(model.predict(pd.DataFrame([future_row]))[0])
        future.append(future_value)
        temp_history.append(future_value)
        humidity_history.append(humidity_history[-1])
        wind_history.append(wind_history[-1])

    actual_dates, future_dates = build_timeline_labels(working_df, split, days)

    return build_model_summary(
        {
            "actual": y_test.tolist(),
            "actual_dates": actual_dates,
            "predicted": pred.tolist(),
            "future": future,
            "future_dates": future_dates,
            "r2_score": round(r2_score(y_test, pred), 4),
            "mse": round(mean_squared_error(y_test, pred), 4),
            "model": model_name,
        }
    )


def random_forest_predict(df, days):
    return tree_model_predict(
        df,
        days,
        RandomForestRegressor(
            n_estimators=80,
            max_depth=14,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
        ),
        "Random Forest",
    )


def gradient_boosting_predict(df, days):
    return tree_model_predict(
        df,
        days,
        GradientBoostingRegressor(random_state=42),
        "Gradient Boosting",
    )


def extra_trees_predict(df, days):
    return tree_model_predict(
        df,
        days,
        ExtraTreesRegressor(
            n_estimators=100,
            max_depth=14,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
        ),
        "Extra Trees",
    )


def hist_gradient_boosting_predict(df, days):
    return tree_model_predict(
        df,
        days,
        AdaBoostRegressor(random_state=42, n_estimators=80, learning_rate=0.08),
        "AdaBoost",
    )


def xgboost_predict(df, days):
    if XGBRegressor is None:
        raise ValueError("XGBoost is not installed")

    return tree_model_predict(
        df,
        days,
        XGBRegressor(
            n_estimators=120,
            learning_rate=0.08,
            max_depth=6,
            subsample=0.85,
            colsample_bytree=0.85,
            objective="reg:squarederror",
            random_state=42,
            n_jobs=-1,
        ),
        "XGBoost",
    )


def run_all_models(df, days, city):
    results = []

    model_runners = [
        lambda: train_and_predict(df, days, city),
        lambda: polynomial_predict(df, days),
        lambda: random_forest_predict(df, days),
        lambda: gradient_boosting_predict(df, days),
        lambda: extra_trees_predict(df, days),
        lambda: hist_gradient_boosting_predict(df, days),
    ]

    if XGBRegressor is not None:
        model_runners.append(lambda: xgboost_predict(df, days))

    for runner in model_runners:
        try:
            results.append(runner())
        except Exception:
            continue

    if len(df) <= 1200:
        try:
            results.append(sarima_predict(df, days))
        except Exception:
            pass

    if not results:
        raise ValueError("No prediction model could generate a forecast for this city dataset.")

    best = max(results, key=lambda item: item["r2_score"])
    return {"best_model": best, "all_models": results}


@require_GET
def smart_prediction(request):
    city = request.GET.get("city")
    date_str = request.GET.get("date")
    phone_number = request.GET.get("phone_number", "").strip()
    sms_alerts_enabled = request.GET.get("sms_alerts_enabled", "").strip().lower() == "true"

    if not city:
        return JsonResponse({"error": "City required"}, status=400)

    try:
        if date_str:
            target = datetime.strptime(date_str, "%Y-%m-%d").date()
            days = (target - date.today()).days
            if days <= 0:
                return JsonResponse({"error": "Enter future date"}, status=400)
        else:
            target = date.today() + timedelta(days=30)
            days = 30

        cache_key = build_prediction_cache_key(city, target, days)
        cached_result = cache.get(cache_key)
        if cached_result is not None:
            result = json.loads(json.dumps(cached_result))
            result["cache_meta"] = {"used_prediction_cache": True}
        else:
            df = get_city_data(city)
            result = run_all_models(df, days, city)
            recent_weather_data = build_weather_response_from_dataframe(df)

            if "best_model" in result:
                result["alerts"] = build_extreme_alerts(city, result["best_model"], recent_weather_data)
                result["data_meta"] = dataframe_meta(df)
                result["cache_meta"] = {"used_prediction_cache": False}

            cache.set(cache_key, result, timeout=60 * 30)

        if "best_model" in result and request.user.is_authenticated:
            best_model = result["best_model"]
            alerts = result.get("alerts", [])
            SavedPrediction.objects.create(
                user=request.user,
                city=city,
                target_date=target,
                model_name=best_model["model"],
                r2_score=best_model.get("r2_score"),
                mse=best_model.get("mse"),
                peak_temperature=best_model.get("highest_temp_next_month"),
                future_temperatures=best_model.get("future", []),
            )
            create_notification(
                request.user,
                "Prediction saved",
                f"Your {best_model['model']} forecast for {city} has been saved.",
            )
            for alert in alerts:
                create_notification(
                    request.user,
                    alert["title"],
                    alert["message"],
                )
            send_user_sms_if_enabled(
                request.user,
                build_forecast_sms_message(city, target, best_model, alerts),
            )

        if "best_model" in result and sms_alerts_enabled and phone_number:
            sms_result = send_sms_to_phone_number(
                phone_number,
                build_forecast_sms_message(city, target, result["best_model"], result.get("alerts", [])),
            )
            result["sms_status"] = {
                "enabled": True,
                "sent": sms_result.get("sent", False),
                "phone_number": sms_result.get("phone_number", phone_number),
                "reason": sms_result.get("reason", ""),
            }

        if "error" in result:
            return JsonResponse(result, status=400)

        return JsonResponse(result)
    except FileNotFoundError as exc:
        return JsonResponse({"error": str(exc)}, status=404)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def upload_model_predict(request):
    try:
        file = request.FILES.get("file")

        if not file:
            return JsonResponse({"error": "No file uploaded"}, status=400)

        model = pickle.load(file)
        X = np.arange(10).reshape(-1, 1)
        prediction = model.predict(X).tolist()

        return JsonResponse(
            {
                "message": "Model uploaded successfully",
                "model": "Uploaded Custom Model",
                "actual": [],
                "predicted": prediction,
            }
        )
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)
