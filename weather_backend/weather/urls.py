from django.urls import path
from . import views

urlpatterns = [
    path("fetch-weather/", views.fetch_weather),
    path("api/smart-predict/", views.smart_prediction),
    path("api/upload-model/", views.upload_model_predict),
    path("api/auth/login/", views.login_view),
    path("api/auth/register/", views.register_view),
    path("api/auth/logout/", views.logout_view),
    path("api/auth/me/", views.current_user_view),
    path("api/sms/preferences/", views.sms_preferences_view),
    path("api/sms/preferences/update/", views.update_sms_preferences),
    path("api/sms/send-test/", views.send_test_sms_view),
    path("api/notifications/", views.notifications_view),
    path("api/notifications/mark-read/", views.mark_notifications_read),
    path("api/saved-predictions/", views.saved_predictions_view),
    path("api/favorite-cities/", views.add_favorite_city),
]
