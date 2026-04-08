from django.contrib import admin

from .models import (
    FavoriteCity,
    Notification,
    SMSNotificationLog,
    SavedPrediction,
    UserProfile,
    WeatherHistory,
)


@admin.register(WeatherHistory)
class WeatherHistoryAdmin(admin.ModelAdmin):
    list_display = ("city", "date", "temperature", "humidity", "wind")
    list_filter = ("city", "date")
    search_fields = ("city",)


@admin.register(FavoriteCity)
class FavoriteCityAdmin(admin.ModelAdmin):
    list_display = ("user", "city", "created_at")
    list_filter = ("created_at",)
    search_fields = ("user__username", "city")


@admin.register(SavedPrediction)
class SavedPredictionAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "city",
        "target_date",
        "model_name",
        "r2_score",
        "mse",
        "created_at",
    )
    list_filter = ("model_name", "created_at")
    search_fields = ("user__username", "city", "model_name")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("user", "title", "is_read", "created_at")
    list_filter = ("is_read", "created_at")
    search_fields = ("user__username", "title", "message")


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "phone_number",
        "sms_notifications_enabled",
        "phone_verified",
        "city",
        "country",
        "created_at",
    )
    list_filter = ("sms_notifications_enabled", "phone_verified", "country", "created_at")
    search_fields = ("user__username", "user__email", "city", "country")


@admin.register(SMSNotificationLog)
class SMSNotificationLogAdmin(admin.ModelAdmin):
    list_display = ("user", "phone_number", "status", "provider_message_id", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("user__username", "phone_number", "provider_message_id", "message")
