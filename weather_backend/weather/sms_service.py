import requests
from django.conf import settings

from .models import SMSNotificationLog


def normalize_phone_number(phone_number):
    cleaned = (phone_number or "").strip().replace(" ", "").replace("-", "")

    if cleaned.startswith("00"):
        cleaned = f"+{cleaned[2:]}"

    if cleaned.startswith("+"):
        return cleaned

    digits_only = "".join(character for character in cleaned if character.isdigit())

    if len(digits_only) == 10:
        return f"+91{digits_only}"

    if len(digits_only) > 10:
        return f"+{digits_only}"

    return cleaned


def send_sms_notification(user, message):
    profile = getattr(user, "profile", None)
    phone_number = getattr(profile, "phone_number", "").strip() if profile else ""
    normalized_phone_number = normalize_phone_number(phone_number)

    if not profile or not profile.sms_notifications_enabled:
        return {"sent": False, "reason": "SMS notifications are disabled for this user"}

    if not normalized_phone_number:
        return {"sent": False, "reason": "No phone number is configured"}

    log = SMSNotificationLog.objects.create(
        user=user,
        phone_number=normalized_phone_number,
        message=message,
        status=SMSNotificationLog.STATUS_PENDING,
    )

    if not settings.SMS_NOTIFICATIONS_ENABLED:
        log.status = SMSNotificationLog.STATUS_FAILED
        log.error_message = "Global SMS sending is disabled in settings"
        log.save(update_fields=["status", "error_message"])
        return {"sent": False, "reason": log.error_message}

    if settings.SMS_PROVIDER != "twilio":
        log.status = SMSNotificationLog.STATUS_FAILED
        log.error_message = f"Unsupported SMS provider: {settings.SMS_PROVIDER}"
        log.save(update_fields=["status", "error_message"])
        return {"sent": False, "reason": log.error_message}

    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN or not settings.TWILIO_PHONE_NUMBER:
        log.status = SMSNotificationLog.STATUS_FAILED
        log.error_message = "Twilio credentials are missing"
        log.save(update_fields=["status", "error_message"])
        return {"sent": False, "reason": log.error_message}

    try:
        response = requests.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json",
            auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
            data={
                "To": normalized_phone_number,
                "From": settings.TWILIO_PHONE_NUMBER,
                "Body": message,
            },
            timeout=15,
        )

        response.raise_for_status()
        payload = response.json()

        log.status = SMSNotificationLog.STATUS_SENT
        log.provider_message_id = payload.get("sid", "")
        log.save(update_fields=["status", "provider_message_id"])
        return {"sent": True, "sid": log.provider_message_id}
    except requests.RequestException as exc:
        log.status = SMSNotificationLog.STATUS_FAILED
        response = getattr(exc, "response", None)
        log.error_message = response.text if response is not None else str(exc)
        log.save(update_fields=["status", "error_message"])
        return {"sent": False, "reason": log.error_message}


def send_sms_to_phone_number(phone_number, message):
    normalized_phone_number = normalize_phone_number(phone_number)

    if not normalized_phone_number:
        return {"sent": False, "reason": "No phone number is configured"}

    if not settings.SMS_NOTIFICATIONS_ENABLED:
        return {"sent": False, "reason": "Global SMS sending is disabled in settings"}

    if settings.SMS_PROVIDER != "twilio":
        return {"sent": False, "reason": f"Unsupported SMS provider: {settings.SMS_PROVIDER}"}

    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN or not settings.TWILIO_PHONE_NUMBER:
        return {"sent": False, "reason": "Twilio credentials are missing"}

    try:
        response = requests.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json",
            auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
            data={
                "To": normalized_phone_number,
                "From": settings.TWILIO_PHONE_NUMBER,
                "Body": message,
            },
            timeout=15,
        )
        response.raise_for_status()
        payload = response.json()
        return {"sent": True, "sid": payload.get("sid", ""), "phone_number": normalized_phone_number}
    except requests.RequestException as exc:
        response = getattr(exc, "response", None)
        return {
            "sent": False,
            "reason": response.text if response is not None else str(exc),
            "phone_number": normalized_phone_number,
        }
